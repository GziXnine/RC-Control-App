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
  onError?: (error: unknown) => void;
  onFrameSent?: (frame: string) => void;
  onFrameDropped?: (
    frame: string,
    reason: "transport" | "invalid-frame",
  ) => void;
}

interface PendingState {
  stop: boolean;
  modeQueue: RobotMode[];
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
  onDrop?: () => void;
}

const DEFAULT_PERIOD_MS = 25;
const MOTOR_INTERVAL_MS = 50;
const SERVO_INTERVAL_MS = 100;
const TUNING_MOTOR_GUARD_MS = 15;
const MAX_MODE_QUEUE = 3;

export class PriorityCommandEngine {
  private readonly sendFn: SendFn;
  private readonly periodMs: number;
  private readonly options: EngineOptions;

  private timer: ReturnType<typeof setInterval> | null = null;
  private sending = false;
  private nextMotorAtMs = 0;
  private nextServoAtMs = 0;

  private pending: PendingState = {
    stop: false,
    modeQueue: [],
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
  }

  queueMode(mode: RobotMode): void {
    const lastQueued =
      this.pending.modeQueue[this.pending.modeQueue.length - 1] ?? null;
    if (lastQueued === mode) {
      return;
    }

    this.pending.modeQueue.push(mode);
    if (this.pending.modeQueue.length > MAX_MODE_QUEUE) {
      this.pending.modeQueue.splice(
        0,
        this.pending.modeQueue.length - MAX_MODE_QUEUE,
      );
    }
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
    const normalized = key.toUpperCase().replace(/[^A-Z0-9_]/g, "");
    if (normalized.length === 0) {
      return;
    }

    if (!this.pending.tuning.has(normalized)) {
      this.pending.tuningOrder.push(normalized);
    }

    this.pending.tuning.set(normalized, Math.round(value));
  }

  clearPending(): void {
    this.pending.stop = false;
    this.pending.modeQueue = [];
    this.pending.motor = null;
    this.pending.servo.clear();
    this.pending.tuning.clear();
    this.pending.tuningOrder = [];
  }

  getQueueSize(): number {
    return (
      (this.pending.stop ? 1 : 0) +
      this.pending.modeQueue.length +
      (this.pending.motor ? 1 : 0) +
      this.pending.servo.size +
      this.pending.tuning.size
    );
  }

  // Intentionally retained as a no-op for compatibility with older call sites.
  acknowledge(_frame: string, _accepted: boolean): void {}

  private async flushOnce(): Promise<void> {
    if (this.sending) {
      return;
    }

    const now = Date.now();
    const nextFrame = this.pickNextFrame(now);
    if (nextFrame === null) {
      return;
    }

    this.sending = true;
    try {
      const success = await this.sendFn(nextFrame.frame);
      if (success) {
        nextFrame.onCommit();
        this.options.onFrameSent?.(nextFrame.frame);
      } else {
        nextFrame.onDrop?.();
        this.options.onFrameDropped?.(nextFrame.frame, "transport");
      }
    } catch (error) {
      this.options.onError?.(error);
      nextFrame.onDrop?.();
      this.options.onFrameDropped?.(nextFrame.frame, "transport");
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

    while (this.pending.modeQueue.length > 0) {
      const mode = this.pending.modeQueue[0];
      if (!mode) {
        this.pending.modeQueue.shift();
        continue;
      }

      if (this.lastCommitted.mode === mode) {
        this.pending.modeQueue.shift();
        continue;
      }

      return {
        kind: "MODE",
        frame: buildModeFrame(mode),
        onCommit: () => {
          this.lastCommitted.mode = mode;
          if (this.pending.modeQueue[0] === mode) {
            this.pending.modeQueue.shift();
          }
        },
      };
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
          onDrop: () => {
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
        onDrop: () => {
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

      const frame = buildTuningFrame(key, value);
      if (frame.length === 0) {
        this.pending.tuning.delete(key);
        this.pending.tuningOrder.shift();
        this.options.onFrameDropped?.(key, "invalid-frame");
        continue;
      }

      return {
        frame,
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
}
