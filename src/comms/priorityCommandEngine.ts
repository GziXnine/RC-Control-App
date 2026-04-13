/** @format */

import {
  buildModeFrame,
  buildMotorFrame,
  buildServoFrame,
  buildStopFrame,
  buildTuningFrame,
} from "../protocol/frames";
import { MotorCommand, PriorityClass, RobotMode } from "../types/protocol";

type SendFn = (frame: string) => Promise<boolean>;

interface EngineOptions {
  periodMs?: number;
  ackTimeoutMs?: number;
  maxRetries?: number;
  onError?: (error: unknown) => void;
  onFrameSent?: (frame: string) => void;
  onFrameDropped?: (
    frame: string,
    reason: "timeout" | "nack" | "transport",
  ) => void;
}

interface PendingState {
  stop: boolean;
  mode: RobotMode | null;
  motor: MotorCommand | null;
  servo: Map<1 | 2 | 3, number>;
  tuning: Map<string, number>;
  tuningOrder: string[];
}

interface LastCommittedState {
  mode: RobotMode | null;
  motor: string;
  servo: Map<1 | 2 | 3, number>;
  tuning: Map<string, number>;
}

interface PendingFrame {
  kind: PriorityClass;
  frame: string;
  onCommit: () => void;
}

interface InFlightFrame extends PendingFrame {
  sentAtMs: number;
  attempts: number;
}

const DEFAULT_PERIOD_MS = 25;
const DEFAULT_ACK_TIMEOUT_MS = 220;
const DEFAULT_MAX_RETRIES = 3;
const MOTOR_INTERVAL_MS = 50;
const SERVO_INTERVAL_MS = 100;
const TUNING_MOTOR_GUARD_MS = 15;

export class PriorityCommandEngine {
  private readonly sendFn: SendFn;
  private readonly periodMs: number;
  private readonly ackTimeoutMs: number;
  private readonly maxRetries: number;
  private readonly options: EngineOptions;

  private timer: ReturnType<typeof setInterval> | null = null;
  private sending = false;
  private inFlight: InFlightFrame | null = null;
  private nextMotorAtMs = 0;
  private nextServoAtMs = 0;

  private pending: PendingState = {
    stop: false,
    mode: null,
    motor: null,
    servo: new Map(),
    tuning: new Map(),
    tuningOrder: [],
  };

  private lastCommitted: LastCommittedState = {
    mode: null,
    motor: buildMotorFrame({ left: 0, right: 0 }),
    servo: new Map(),
    tuning: new Map(),
  };

  constructor(sendFn: SendFn, options?: EngineOptions) {
    this.sendFn = sendFn;
    this.periodMs = options?.periodMs ?? DEFAULT_PERIOD_MS;
    this.ackTimeoutMs = options?.ackTimeoutMs ?? DEFAULT_ACK_TIMEOUT_MS;
    this.maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.options = options ?? {};
  }

  start(): void {
    if (this.timer !== null) {
      return;
    }

    this.timer = setInterval(() => {
      void this.flushOnce();
    }, this.periodMs);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  queueStop(): void {
    this.pending.stop = true;
    this.pending.motor = { left: 0, right: 0 };

    if (this.inFlight !== null && this.inFlight.kind !== "STOP") {
      this.inFlight = null;
    }
  }

  queueMode(mode: RobotMode): void {
    this.pending.mode = mode;
  }

  queueMotor(command: MotorCommand): void {
    this.pending.motor = {
      left: Math.round(command.left),
      right: Math.round(command.right),
    };
  }

  queueServo(id: 1 | 2 | 3, value: number): void {
    this.pending.servo.set(id, Math.round(value));
  }

  queueTuning(key: string, value: number): void {
    const normalized = key.toUpperCase();
    if (!this.pending.tuning.has(normalized)) {
      this.pending.tuningOrder.push(normalized);
    }

    this.pending.tuning.set(normalized, Math.round(value));
  }

  clearPending(): void {
    this.pending.stop = false;
    this.pending.mode = null;
    this.pending.motor = null;
    this.pending.servo.clear();
    this.pending.tuning.clear();
    this.pending.tuningOrder = [];
    this.inFlight = null;
  }

  getQueueSize(): number {
    return (
      (this.pending.stop ? 1 : 0) +
      (this.pending.mode ? 1 : 0) +
      (this.pending.motor ? 1 : 0) +
      this.pending.servo.size +
      this.pending.tuning.size +
      (this.inFlight ? 1 : 0)
    );
  }

  acknowledge(frame: string, accepted: boolean): void {
    if (this.inFlight === null) {
      return;
    }

    const incoming = this.normalizeFrame(frame);
    const expected = this.normalizeFrame(this.inFlight.frame);

    if (incoming !== expected) {
      return;
    }

    if (accepted) {
      this.inFlight.onCommit();
      this.inFlight = null;
      return;
    }

    this.options.onFrameDropped?.(this.inFlight.frame, "nack");

    if (this.inFlight.attempts >= this.maxRetries) {
      this.inFlight = null;
      return;
    }

    // Force immediate retry on next scheduler tick.
    this.inFlight.sentAtMs = 0;
  }

  private async flushOnce(): Promise<void> {
    if (this.sending) {
      return;
    }

    const now = Date.now();

    if (this.inFlight !== null) {
      await this.handleInFlight(now);
      return;
    }

    const nextFrame = this.pickNextFrame(now);
    if (nextFrame === null) {
      return;
    }

    this.sending = true;
    try {
      const success = await this.sendFn(nextFrame.frame);
      if (success) {
        this.inFlight = {
          ...nextFrame,
          attempts: 1,
          sentAtMs: now,
        };

        this.options.onFrameSent?.(nextFrame.frame);
      } else {
        this.options.onFrameDropped?.(nextFrame.frame, "transport");
      }
    } catch (error) {
      this.options.onError?.(error);
    } finally {
      this.sending = false;
    }
  }

  private async handleInFlight(now: number): Promise<void> {
    if (this.inFlight === null) {
      return;
    }

    if (now - this.inFlight.sentAtMs < this.ackTimeoutMs) {
      return;
    }

    if (this.inFlight.attempts >= this.maxRetries) {
      this.options.onFrameDropped?.(this.inFlight.frame, "timeout");
      this.inFlight = null;
      return;
    }

    this.sending = true;
    try {
      const retryFrame = this.inFlight.frame;
      const success = await this.sendFn(retryFrame);
      if (!success) {
        this.options.onFrameDropped?.(retryFrame, "transport");
      }

      if (this.inFlight !== null) {
        this.inFlight.attempts += 1;
        this.inFlight.sentAtMs = Date.now();
      }

      if (success) {
        this.options.onFrameSent?.(retryFrame);
      }
    } catch (error) {
      this.options.onError?.(error);
      if (this.inFlight !== null) {
        this.inFlight.attempts += 1;
        this.inFlight.sentAtMs = Date.now();
      }
    } finally {
      this.sending = false;
    }
  }

  private pickNextFrame(now: number): PendingFrame | null {
    if (this.pending.stop) {
      return {
        kind: "STOP",
        frame: buildStopFrame(),
        onCommit: () => {
          this.pending.stop = false;
          this.lastCommitted.motor = buildMotorFrame({ left: 0, right: 0 });
        },
      };
    }

    if (this.pending.mode !== null) {
      const mode = this.pending.mode;
      if (this.lastCommitted.mode === mode) {
        this.pending.mode = null;
      } else {
        return {
          kind: "MODE",
          frame: buildModeFrame(mode),
          onCommit: () => {
            this.lastCommitted.mode = mode;
            if (this.pending.mode === mode) {
              this.pending.mode = null;
            }
          },
        };
      }
    }

    const motorFrame = this.peekMotorFrame();
    const servoFrame = this.peekServoFrame();
    const tuningFrame = this.peekTuningFrame();

    const motorReady = motorFrame !== null && now >= this.nextMotorAtMs;
    const servoReady = servoFrame !== null && now >= this.nextServoAtMs;

    if (servoReady && servoFrame !== null) {
      return {
        kind: "SERVO",
        frame: servoFrame.frame,
        onCommit: () => {
          this.lastCommitted.servo.set(servoFrame.id, servoFrame.value);
          if (this.pending.servo.get(servoFrame.id) === servoFrame.value) {
            this.pending.servo.delete(servoFrame.id);
          }
          this.nextServoAtMs = Date.now() + SERVO_INTERVAL_MS;
        },
      };
    }

    if (tuningFrame !== null) {
      const canSendBeforeMotor =
        !motorFrame || now + TUNING_MOTOR_GUARD_MS < this.nextMotorAtMs;
      if (canSendBeforeMotor) {
        return {
          kind: "TUNING",
          frame: tuningFrame.frame,
          onCommit: () => {
            this.lastCommitted.tuning.set(tuningFrame.key, tuningFrame.value);
            if (
              this.pending.tuning.get(tuningFrame.key) === tuningFrame.value
            ) {
              this.pending.tuning.delete(tuningFrame.key);
            }
            this.removeTuningOrderKey(tuningFrame.key);
          },
        };
      }
    }

    if (motorReady && motorFrame !== null) {
      return {
        kind: "MOTOR",
        frame: motorFrame.frame,
        onCommit: () => {
          this.lastCommitted.motor = motorFrame.frame;
          if (
            this.pending.motor &&
            this.pending.motor.left === motorFrame.left &&
            this.pending.motor.right === motorFrame.right
          ) {
            this.pending.motor = null;
          }
          this.nextMotorAtMs = Date.now() + MOTOR_INTERVAL_MS;
        },
      };
    }

    if (tuningFrame !== null && servoFrame === null) {
      return {
        kind: "TUNING",
        frame: tuningFrame.frame,
        onCommit: () => {
          this.lastCommitted.tuning.set(tuningFrame.key, tuningFrame.value);
          if (this.pending.tuning.get(tuningFrame.key) === tuningFrame.value) {
            this.pending.tuning.delete(tuningFrame.key);
          }
          this.removeTuningOrderKey(tuningFrame.key);
        },
      };
    }

    return null;
  }

  private peekMotorFrame(): {
    frame: string;
    left: number;
    right: number;
  } | null {
    if (this.pending.motor === null) {
      return null;
    }

    const command = this.pending.motor;
    const frame = buildMotorFrame(command);

    if (frame === this.lastCommitted.motor) {
      if (
        this.pending.motor &&
        this.pending.motor.left === command.left &&
        this.pending.motor.right === command.right
      ) {
        this.pending.motor = null;
      }
      return null;
    }

    return {
      frame,
      left: command.left,
      right: command.right,
    };
  }

  private peekServoFrame(): {
    frame: string;
    id: 1 | 2 | 3;
    value: number;
  } | null {
    for (const [id, value] of this.pending.servo.entries()) {
      if (this.lastCommitted.servo.get(id) === value) {
        this.pending.servo.delete(id);
        continue;
      }

      return {
        frame: buildServoFrame(id, value),
        id,
        value,
      };
    }

    return null;
  }

  private peekTuningFrame(): {
    frame: string;
    key: string;
    value: number;
  } | null {
    while (this.pending.tuningOrder.length > 0) {
      const key = this.pending.tuningOrder[0];
      if (!key) {
        this.pending.tuningOrder.shift();
        continue;
      }

      const value = this.pending.tuning.get(key);

      if (value === undefined) {
        this.pending.tuningOrder.shift();
        continue;
      }

      if (this.lastCommitted.tuning.get(key) === value) {
        this.pending.tuning.delete(key);
        this.pending.tuningOrder.shift();
        continue;
      }

      return {
        frame: buildTuningFrame(key, value),
        key,
        value,
      };
    }

    return null;
  }

  private removeTuningOrderKey(key: string): void {
    const index = this.pending.tuningOrder.indexOf(key);
    if (index >= 0) {
      this.pending.tuningOrder.splice(index, 1);
    }
  }

  private normalizeFrame(frame: string): string {
    const trimmed = frame.trim().toUpperCase();
    if (trimmed.endsWith(";")) {
      return trimmed.slice(0, -1);
    }

    return trimmed;
  }
}
