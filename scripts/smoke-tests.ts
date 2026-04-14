/** @format */

import assert from "node:assert/strict";

import { PriorityCommandEngine } from "../src/comms/priorityCommandEngine";
import {
  getReconnectDelayMs,
  hasTelemetryTimedOut,
} from "../src/comms/reconnectPolicy";
import { joystickToDifferential, neutralMotor } from "../src/control/driveMath";
import {
  buildModeFrame,
  buildMotorFrame,
  buildServoFrame,
  buildStopFrame,
  buildTuningFrame,
  parseTelemetryFrame,
} from "../src/protocol/frames";
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
  assert.equal(buildMotorFrame({ left: 280, right: -340 }), "M=255,-255;");
  assert.equal(buildServoFrame(2, 188), "S2=180;");
  assert.equal(buildTuningFrame("th", 19.6), "TH=20;");

  const telemetry = parseTelemetryFrame("T=34,25,28,A,120,118");
  assert.ok(telemetry);
  assert.equal(telemetry?.mode, "AUTO");
  assert.equal(telemetry?.frontCm, 34);
  assert.equal(telemetry?.motorLeft, 120);
  assert.equal(telemetry?.motorRight, 118);
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

async function testTuningCatalogIntegrity(): Promise<void> {
  assert.equal(FIRMWARE_TUNING_KEYS.length, FIRMWARE_TUNING_SPECS.length);
  assert.equal(new Set(FIRMWARE_TUNING_KEYS).size, FIRMWARE_TUNING_KEYS.length);

  const sanitized = sanitizeFirmwareTuning({
    KP: 500,
    KD: -20,
    TH: 3,
    TS: 400,
    BL: 0,
  });

  assert.equal(sanitized.KP, FIRMWARE_TUNING_LIMITS.KP.max);
  assert.equal(sanitized.KD, FIRMWARE_TUNING_LIMITS.KD.min);
  assert.equal(sanitized.TH, FIRMWARE_TUNING_LIMITS.TH.min);
  assert.equal(sanitized.TS, FIRMWARE_TUNING_LIMITS.TS.max);
  assert.equal(sanitized.BL, FIRMWARE_TUNING_LIMITS.BL.min);

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

async function run(): Promise<void> {
  const tests: Array<{ name: string; run: () => Promise<void> }> = [
    { name: "protocol frames", run: testProtocolFrames },
    { name: "joystick mapping", run: testJoystickMath },
    { name: "queue without ack", run: testQueueWithoutAck },
    { name: "priority fairness", run: testPriorityFairness },
    { name: "tuning catalog integrity", run: testTuningCatalogIntegrity },
    { name: "reconnect policy", run: testReconnectPolicy },
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
