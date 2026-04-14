/** @format */

import { MotorCommand, RobotMode, Telemetry } from "../types/protocol";

export interface CommandAck {
  accepted: boolean;
  frame: string;
}

const ASCII_SAFE = /[^\x20-\x7E]/g;

function clampInt(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function sanitizeAsciiUpper(value: string): string {
  return value.replace(ASCII_SAFE, "").toUpperCase();
}

export function buildStopFrame(): string {
  return "STOP;";
}

export function buildModeFrame(mode: RobotMode): string {
  return mode === "AUTO" ? "A=1;" : "A=0;";
}

export function buildMotorFrame(command: MotorCommand): string {
  const left = clampInt(Math.round(command.left), -255, 255);
  const right = clampInt(Math.round(command.right), -255, 255);
  return `M=${left},${right};`;
}

export function buildServoFrame(id: 1 | 2 | 3, angle: number): string {
  const safe = clampInt(Math.round(angle), 0, 180);
  return `S${id}=${safe};`;
}

export function buildTuningFrame(key: string, value: number): string {
  const normalizedKey = sanitizeAsciiUpper(key).replace(/[^A-Z0-9_]/g, "");
  const safeValue = Math.round(value);
  if (normalizedKey.length === 0) {
    return "";
  }

  return `${normalizedKey}=${safeValue};`;
}

export function parseTelemetryFrame(frame: string): Telemetry | null {
  const normalized = sanitizeAsciiUpper(frame.trim());
  const toNumber = (input: string): number => {
    const value = Number.parseInt(input, 10);
    return Number.isFinite(value) ? value : 0;
  };

  // Firmware-native telemetry: T=front,left,right,mode,currentL,currentR;
  if (normalized.startsWith("T=")) {
    const payload = normalized.slice(2);
    const fields = payload.split(",");
    if (fields.length < 6) {
      return null;
    }

    const modeField = fields[3] ?? "M";
    const mode = modeField === "A" || modeField === "AUTO" ? "AUTO" : "MANUAL";

    return {
      mode,
      stateCode: 0,
      frontCm: toNumber(fields[0] ?? "0"),
      leftCm: toNumber(fields[1] ?? "0"),
      rightCm: toNumber(fields[2] ?? "0"),
      motorLeft: toNumber(fields[4] ?? "0"),
      motorRight: toNumber(fields[5] ?? "0"),
      servo1: 0,
      servo2: 0,
      servo3: 0,
      stopLatched: false,
    };
  }

  // Legacy parser fallback retained for compatibility with older test frames.
  if (!normalized.startsWith("R:")) {
    return null;
  }

  const payload = normalized.slice(2);
  const fields = payload.split(",");
  if (fields.length < 11) {
    return null;
  }

  const mode = fields[0] === "A" ? "AUTO" : "MANUAL";

  return {
    mode,
    stateCode: toNumber(fields[1] ?? "0"),
    frontCm: toNumber(fields[2] ?? "0"),
    leftCm: toNumber(fields[3] ?? "0"),
    rightCm: toNumber(fields[4] ?? "0"),
    motorLeft: toNumber(fields[5] ?? "0"),
    motorRight: toNumber(fields[6] ?? "0"),
    servo1: toNumber(fields[7] ?? "0"),
    servo2: toNumber(fields[8] ?? "0"),
    servo3: toNumber(fields[9] ?? "0"),
    stopLatched: toNumber(fields[10] ?? "0") === 1,
  };
}

export function parseCommandAckFrame(frame: string): CommandAck | null {
  const normalized = sanitizeAsciiUpper(frame.trim());

  if (normalized.startsWith("ACK:")) {
    return {
      accepted: true,
      frame: normalized.slice(4),
    };
  }

  if (normalized.startsWith("NACK:")) {
    return {
      accepted: false,
      frame: normalized.slice(5),
    };
  }

  return null;
}
