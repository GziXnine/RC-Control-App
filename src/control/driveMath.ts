/** @format */

import { DriveTuning, MotorCommand } from "../types/protocol";

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function applyDeadZone(value: number, deadZoneRatio: number): number {
  const magnitude = Math.abs(value);
  if (magnitude <= deadZoneRatio) {
    return 0;
  }

  const normalized = (magnitude - deadZoneRatio) / (1 - deadZoneRatio);
  return Math.sign(value) * normalized;
}

function shape(value: number): number {
  const magnitude = Math.abs(value);
  return Math.sign(value) * Math.pow(magnitude, 1.35);
}

function rateLimit(current: number, target: number, step: number): number {
  if (current < target) {
    return Math.min(current + step, target);
  }

  if (current > target) {
    return Math.max(current - step, target);
  }

  return current;
}

export function joystickToDifferential(
  x: number,
  y: number,
  tuning: DriveTuning,
  previous: MotorCommand,
): MotorCommand {
  const normalizedX = clamp(x, -1, 1);
  const normalizedY = clamp(y, -1, 1);
  const deadZoneRatio = clamp(tuning.dead / 255, 0, 0.5);

  const xShaped = shape(applyDeadZone(normalizedX, deadZoneRatio));
  const yShaped = shape(applyDeadZone(normalizedY, deadZoneRatio));

  const turnScale = clamp(tuning.turn / 100, 0.4, 1.8);
  let leftNorm = yShaped + xShaped * turnScale;
  let rightNorm = yShaped - xShaped * turnScale;

  const maxAbs = Math.max(1, Math.abs(leftNorm), Math.abs(rightNorm));
  leftNorm /= maxAbs;
  rightNorm /= maxAbs;

  const maxPwm = clamp(Math.round(tuning.max), 60, 255);
  const targetLeft = Math.round(leftNorm * maxPwm);
  const targetRight = Math.round(rightNorm * maxPwm);

  const step = clamp(Math.round(2 + tuning.acc * 1.2), 1, 50);

  return {
    left: rateLimit(previous.left, targetLeft, step),
    right: rateLimit(previous.right, targetRight, step),
  };
}

export function neutralMotor(): MotorCommand {
  return { left: 0, right: 0 };
}
