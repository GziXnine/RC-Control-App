/** @format */

import assert from "node:assert/strict";

import { PriorityCommandEngine } from "../src/comms/priorityCommandEngine";
import {
  getReconnectDelayMs,
  hasTelemetryTimedOut,
} from "../src/comms/reconnectPolicy";
import { joystickToDifferential, neutralMotor } from "../src/control/driveMath";
import {
  buildGyroAssistFrame,
  buildModeFrame,
  buildMotorFrame,
  buildServoFrame,
  buildStopFrame,
  buildTuningFrame,
  buildTurnFrame,
  parseCommandAckFrame,
  parseTelemetryFrame,
} from "../src/protocol/frames";
import { FrameStream } from "../src/protocol/frameStream";
import {
  DEFAULT_FIRMWARE_TUNING,
  FIRMWARE_TUNING_KEYS,
  FIRMWARE_TUNING_LIMITS,
  FIRMWARE_TUNING_SPECS,
  sanitizeFirmwareTuning,
} from "../src/protocol/tuningCatalog";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function testProtocolFrames(): Promise<void> {
  assert.equal(buildStopFrame(), "STOP;");
  assert.equal(buildModeFrame("AUTO"), "A=1;");
  assert.equal(buildModeFrame("MANUAL"), "A=0;");
  assert.equal(buildGyroAssistFrame(true), "G=1;");
  assert.equal(buildGyroAssistFrame(false), "G=0;");
  assert.equal(buildTurnFrame("RIGHT"), "TRN=1;");
  assert.equal(buildTurnFrame("LEFT"), "TRN=-1;");
  assert.equal(buildMotorFrame({ left: 280, right: -340 }), "M=255,-255;");
  assert.equal(buildServoFrame(2, 188), "S2=180;");
  assert.equal(buildTuningFrame("th", 19.6), "TH=20;");

  const telemetry = parseTelemetryFrame("T=34,25,28,-12");
  assert.ok(telemetry);
  assert.equal(telemetry?.frontCm, 34);
  assert.equal(telemetry?.leftCm, 25);
  assert.equal(telemetry?.rightCm, 28);
  assert.equal(telemetry?.yawDeg, -12);

  const gyroTelemetry = parseTelemetryFrame("T=12,16,19,-27");
  assert.ok(gyroTelemetry);
  assert.equal(gyroTelemetry?.frontCm, 12);
  assert.equal(gyroTelemetry?.yawDeg, -27);

  const ack = parseCommandAckFrame("ACK:KP=5;");
  assert.ok(ack);
  assert.equal(ack?.accepted, true);
  assert.equal(ack?.frame, "KP=5;");

  const nack = parseCommandAckFrame("NACK:TH=200;");
  assert.ok(nack);
  assert.equal(nack?.accepted, false);
  assert.equal(nack?.frame, "TH=200;");
}

async function testJoystickMath(): Promise<void> {
  const tuning = { max: 210, dead: 8, acc: 8, turn: 100, servoStep: 2 };

  const center = joystickToDifferential(0, 0, tuning, neutralMotor());
  assert.equal(center.left, 0);
  assert.equal(center.right, 0);

  const forward = joystickToDifferential(0, 1, tuning, neutralMotor());
  assert.ok(forward.left > 0);
  assert.equal(forward.left, forward.right);

  const rightTurn = joystickToDifferential(1, 0, tuning, neutralMotor());
  assert.ok(rightTurn.left > 0);
  assert.ok(rightTurn.right < 0);

  const limited = joystickToDifferential(0, 1, tuning, { left: 0, right: 0 });
  assert.ok(limited.left <= 12);
  assert.ok(limited.right <= 12);
}

async function testQueueWithoutAck(): Promise<void> {
  const sent: string[] = [];

  const engine = new PriorityCommandEngine(
    async (frame) => {
      sent.push(frame);
      return true;
    },
    {
      periodMs: 10,
    },
  );

  engine.start();
  engine.queueMode("AUTO");
  engine.queueMotor({ left: 120, right: 120 });

  await wait(70);
  assert.ok(sent.includes("A=1;"));
  assert.ok(sent.some((frame) => frame.startsWith("M=")));
  assert.equal(engine.getQueueSize(), 0);
  engine.stop();
}

async function testPriorityFairness(): Promise<void> {
  const sent: string[] = [];
  let engine: PriorityCommandEngine;

  engine = new PriorityCommandEngine(
    async (frame) => {
      sent.push(frame);
      return true;
    },
    {
      periodMs: 10,
    },
  );

  engine.start();
  engine.queueMotor({ left: 170, right: 160 });
  engine.queueServo(1, 120);
  engine.queueTuning("TH", 22);

  await wait(260);

  assert.ok(sent.some((frame) => frame.startsWith("M=")));
  assert.ok(sent.some((frame) => frame.startsWith("S1=")));
  assert.ok(sent.some((frame) => frame.startsWith("TH=")));

  engine.stop();
}

async function testTuningThrottle(): Promise<void> {
  const sent: Array<{ frame: string; at: number }> = [];

  const engine = new PriorityCommandEngine(
    async (frame) => {
      sent.push({ frame, at: Date.now() });
      return true;
    },
    {
      periodMs: 10,
    },
  );

  engine.start();
  engine.queueTuning("KP", 10);
  engine.queueTuning("KD", 8);
  engine.queueTuning("TH", 20);

  await wait(420);

  const tuning = sent.filter(
    (item) =>
      item.frame.startsWith("KP=") ||
      item.frame.startsWith("KD=") ||
      item.frame.startsWith("TH="),
  );

  assert.equal(tuning.length, 3);
  for (let index = 1; index < tuning.length; index += 1) {
    const delta = tuning[index].at - tuning[index - 1].at;
    assert.ok(delta >= 55);
  }

  engine.stop();
}

async function testTuningRetryAfterDrop(): Promise<void> {
  const sent: string[] = [];
  let attempts = 0;

  const engine = new PriorityCommandEngine(
    async (frame) => {
      sent.push(frame);
      attempts += 1;
      return attempts > 1;
    },
    {
      periodMs: 10,
    },
  );

  engine.start();
  engine.queueTuning("KP", 33);

  await wait(260);

  const kpFrames = sent.filter((frame) => frame.startsWith("KP="));
  assert.ok(kpFrames.length >= 2);
  assert.equal(engine.getQueueSize(), 0);

  engine.stop();
}

async function testLatestTuningValueWins(): Promise<void> {
  const sent: string[] = [];
  let releaseFirstSend: () => void = () => {};
  let firstCall = true;

  const engine = new PriorityCommandEngine(
    async (frame) => {
      sent.push(frame);

      if (firstCall) {
        firstCall = false;
        await new Promise<void>((resolve) => {
          releaseFirstSend = resolve;
        });
      }

      return true;
    },
    {
      periodMs: 10,
    },
  );

  engine.start();
  engine.queueTuning("CM", 18);

  await wait(25);
  engine.queueTuning("CM", 20);

  releaseFirstSend();
  await wait(220);

  const cmFrames = sent.filter((frame) => frame.startsWith("CM="));
  assert.ok(cmFrames.length >= 2);
  assert.equal(cmFrames[0], "CM=18;");
  assert.equal(cmFrames[cmFrames.length - 1], "CM=20;");
  assert.equal(engine.getQueueSize(), 0);

  engine.stop();
}

async function testTuningCatalogIntegrity(): Promise<void> {
  assert.equal(FIRMWARE_TUNING_KEYS.length, FIRMWARE_TUNING_SPECS.length);
  assert.equal(new Set(FIRMWARE_TUNING_KEYS).size, FIRMWARE_TUNING_KEYS.length);

  const sanitized = sanitizeFirmwareTuning({
    KP: 500,
    KD: -20,
    TH: 3,
    BR: 400,
    CM: 0,
  });

  assert.equal(sanitized.KP, FIRMWARE_TUNING_LIMITS.KP.max);
  assert.equal(sanitized.KD, FIRMWARE_TUNING_LIMITS.KD.min);
  assert.equal(sanitized.TH, FIRMWARE_TUNING_LIMITS.TH.min);
  assert.equal(sanitized.BR, FIRMWARE_TUNING_LIMITS.BR.max);
  assert.equal(sanitized.CM, FIRMWARE_TUNING_LIMITS.CM.min);

  for (const key of FIRMWARE_TUNING_KEYS) {
    const value = DEFAULT_FIRMWARE_TUNING[key];
    const bounds = FIRMWARE_TUNING_LIMITS[key];
    assert.ok(value >= bounds.min && value <= bounds.max);
  }
}

async function testReconnectPolicy(): Promise<void> {
  assert.equal(getReconnectDelayMs(0), 600);
  assert.equal(getReconnectDelayMs(1), 1200);
  assert.equal(getReconnectDelayMs(4), 5000);
  assert.equal(getReconnectDelayMs(15), 5000);

  assert.equal(hasTelemetryTimedOut(0, 1000, 1800), false);
  assert.equal(hasTelemetryTimedOut(1000, 2500, 1800), false);
  assert.equal(hasTelemetryTimedOut(1000, 2901, 1800), true);
}

async function testFrameStreamDelimiters(): Promise<void> {
  const stream = new FrameStream();

  const mixed = stream.pushChunk(
    "ACK:MODE=AUTO;T=34,25,28,-12\r\nNACK:BADFRAME\n",
  );
  assert.deepEqual(mixed, ["ACK:MODE=AUTO", "T=34,25,28,-12", "NACK:BADFRAME"]);

  const split1 = stream.pushChunk("T=34,25");
  assert.deepEqual(split1, []);
  const split2 = stream.pushChunk(",28,-12\n");
  assert.deepEqual(split2, ["T=34,25,28,-12"]);
}

async function run(): Promise<void> {
  const tests: Array<{ name: string; run: () => Promise<void> }> = [
    { name: "protocol frames", run: testProtocolFrames },
    { name: "joystick mapping", run: testJoystickMath },
    { name: "queue without ack", run: testQueueWithoutAck },
    { name: "priority fairness", run: testPriorityFairness },
    { name: "tuning throttle", run: testTuningThrottle },
    { name: "tuning retry after drop", run: testTuningRetryAfterDrop },
    { name: "latest tuning value wins", run: testLatestTuningValueWins },
    { name: "tuning catalog integrity", run: testTuningCatalogIntegrity },
    { name: "reconnect policy", run: testReconnectPolicy },
    { name: "frame stream delimiters", run: testFrameStreamDelimiters },
  ];

  for (const test of tests) {
    await test.run();
    process.stdout.write(`[PASS] ${test.name}\n`);
  }
}

run().catch((error: unknown) => {
  process.stderr.write(`[FAIL] ${(error as Error).message}\n`);
  process.exit(1);
});
