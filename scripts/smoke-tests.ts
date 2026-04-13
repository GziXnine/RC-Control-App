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
  parseCommandAckFrame,
  parseTelemetryFrame,
} from "../src/protocol/frames";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function testProtocolFrames(): Promise<void> {
  assert.equal(buildStopFrame(), "STOP;");
  assert.equal(buildModeFrame("AUTO"), "MODE:AUTO;");
  assert.equal(buildMotorFrame({ left: 280, right: -340 }), "M:255,-255;");
  assert.equal(buildServoFrame(2, 188), "S2:180;");
  assert.equal(buildTuningFrame("base pwm fast", 175.8), "T:BASEPWMFAST=176;");

  const telemetry = parseTelemetryFrame(
    "R:A,1,34,25,28,120,118,90,95,30,1,7,140,3,1",
  );
  assert.ok(telemetry);
  assert.equal(telemetry?.mode, "AUTO");
  assert.equal(telemetry?.frontCm, 34);

  const ack = parseCommandAckFrame("ACK:T:MAX=210");
  const nack = parseCommandAckFrame("NACK:M:10,10");
  assert.deepEqual(ack, { accepted: true, frame: "T:MAX=210" });
  assert.deepEqual(nack, { accepted: false, frame: "M:10,10" });
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

async function testQueueAndAckGate(): Promise<void> {
  const sent: string[] = [];

  const engine = new PriorityCommandEngine(
    async (frame) => {
      sent.push(frame);
      return true;
    },
    {
      periodMs: 10,
      ackTimeoutMs: 40,
      maxRetries: 2,
    },
  );

  engine.start();
  engine.queueMode("AUTO");

  await wait(20);
  assert.equal(sent.length, 1);
  assert.equal(sent[0], "MODE:AUTO;");

  await wait(45);
  assert.ok(sent.length >= 2);

  engine.acknowledge("MODE:AUTO", true);
  await wait(20);
  assert.equal(engine.getQueueSize(), 0);
  engine.stop();
}

async function testPriorityFairness(): Promise<void> {
  const sent: string[] = [];
  let engine: PriorityCommandEngine;

  engine = new PriorityCommandEngine(
    async (frame) => {
      sent.push(frame);
      setTimeout(() => {
        engine.acknowledge(frame, true);
      }, 0);
      return true;
    },
    {
      periodMs: 10,
      ackTimeoutMs: 80,
      maxRetries: 2,
    },
  );

  engine.start();
  engine.queueMotor({ left: 170, right: 160 });
  engine.queueServo(1, 120);
  engine.queueTuning("MAX", 220);

  await wait(260);

  assert.ok(sent.some((frame) => frame.startsWith("M:")));
  assert.ok(sent.some((frame) => frame.startsWith("S1:")));
  assert.ok(sent.some((frame) => frame.startsWith("T:MAX=")));

  engine.stop();
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
    { name: "ack gate", run: testQueueAndAckGate },
    { name: "priority fairness", run: testPriorityFairness },
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
