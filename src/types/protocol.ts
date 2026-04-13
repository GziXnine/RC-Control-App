/** @format */

export type RobotMode = "MANUAL" | "AUTO";

export type PriorityClass = "STOP" | "MODE" | "MOTOR" | "SERVO" | "TUNING";

export interface MotorCommand {
  left: number;
  right: number;
}

export interface DriveTuning {
  max: number;
  dead: number;
  acc: number;
  turn: number;
  servoStep: number;
}

export interface ServoState {
  id: 1 | 2 | 3;
  value: number;
}

export interface Telemetry {
  mode: RobotMode;
  stateCode: number;
  frontCm: number;
  leftCm: number;
  rightCm: number;
  motorLeft: number;
  motorRight: number;
  servo1: number;
  servo2: number;
  servo3: number;
  stopLatched: boolean;
}

export interface TuningLimits {
  s1Min: number;
  s1Max: number;
  s2Min: number;
  s2Max: number;
  s3Min: number;
  s3Max: number;
}
