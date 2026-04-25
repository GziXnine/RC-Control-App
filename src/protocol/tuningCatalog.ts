/** @format */

export type FirmwareTuningKey =
  | "KP"
  | "KD"
  | "SP"
  | "TH"
  | "PV"
  | "GA"
  | "RA"
  | "RV"
  | "DZ"
  | "BR"
  | "CM";

export type AppTuningKey = "S3_GRIP" | "S3_OPEN";
export type AnyTuningKey = FirmwareTuningKey | AppTuningKey;

export type FirmwareTuningSection = "CORE" | "ADVANCED";

export interface FirmwareTuningSpec {
  key: FirmwareTuningKey;
  label: string;
  min: number;
  max: number;
  defaultValue: number;
  section: FirmwareTuningSection;
}

export const FIRMWARE_TUNING_SPECS: ReadonlyArray<FirmwareTuningSpec> = [
  {
    key: "KP",
    label: "STEER KP",
    min: 0,
    max: 80,
    defaultValue: 5,
    section: "CORE",
  },
  {
    key: "KD",
    label: "STEER KD",
    min: 0,
    max: 80,
    defaultValue: 2,
    section: "CORE",
  },
  {
    key: "SP",
    label: "BASE SPEED",
    min: 60,
    max: 255,
    defaultValue: 150,
    section: "CORE",
  },
  {
    key: "TH",
    label: "FRONT BLOCK",
    min: 6,
    max: 120,
    defaultValue: 16,
    section: "CORE",
  },
  {
    key: "PV",
    label: "PIVOT PWM",
    min: 70,
    max: 255,
    defaultValue: 130,
    section: "CORE",
  },
  {
    key: "GA",
    label: "GYRO ANGLE",
    min: 45,
    max: 135,
    defaultValue: 90,
    section: "CORE",
  },
  {
    key: "RA",
    label: "RAMP STEP",
    min: 1,
    max: 40,
    defaultValue: 8,
    section: "ADVANCED",
  },
  {
    key: "RV",
    label: "REVERSE STEP",
    min: 1,
    max: 80,
    defaultValue: 22,
    section: "ADVANCED",
  },
  {
    key: "DZ",
    label: "DEADZONE",
    min: 0,
    max: 40,
    defaultValue: 8,
    section: "ADVANCED",
  },
  {
    key: "BR",
    label: "BREAKAWAY",
    min: 0,
    max: 180,
    defaultValue: 75,
    section: "ADVANCED",
  },
  {
    key: "CM",
    label: "CORR CLAMP",
    min: 20,
    max: 180,
    defaultValue: 110,
    section: "ADVANCED",
  },
];

export interface AppTuningSpec {
  key: AppTuningKey;
  label: string;
  min: number;
  max: number;
  defaultValue: number;
  section: FirmwareTuningSection;
}

export const APP_TUNING_SPECS: ReadonlyArray<AppTuningSpec> = [
  {
    key: "S3_GRIP",
    label: "SERVO 3 GRIP",
    min: 0,
    max: 90,
    defaultValue: 15,
    section: "CORE",
  },
  {
    key: "S3_OPEN",
    label: "SERVO 3 OPEN",
    min: 15,
    max: 180,
    defaultValue: 90,
    section: "CORE",
  },
];

function clampInt(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

export const FIRMWARE_TUNING_KEYS = FIRMWARE_TUNING_SPECS.map(
  (item) => item.key,
);

export const DEFAULT_FIRMWARE_TUNING: Record<FirmwareTuningKey, number> =
  FIRMWARE_TUNING_SPECS.reduce(
    (result, item) => {
      result[item.key] = item.defaultValue;
      return result;
    },
    {} as Record<FirmwareTuningKey, number>,
  );

export const FIRMWARE_TUNING_LIMITS: Record<
  FirmwareTuningKey,
  { min: number; max: number }
> = FIRMWARE_TUNING_SPECS.reduce(
  (result, item) => {
    result[item.key] = { min: item.min, max: item.max };
    return result;
  },
  {} as Record<FirmwareTuningKey, { min: number; max: number }>,
);

export function sanitizeFirmwareTuning(
  input?: Record<string, number>,
): Record<FirmwareTuningKey, number> {
  const safe = {} as Record<FirmwareTuningKey, number>;

  for (const item of FIRMWARE_TUNING_SPECS) {
    const raw = input?.[item.key];
    const numeric = Number(raw);
    const fallback = item.defaultValue;
    const value = Number.isFinite(numeric) ? numeric : fallback;
    safe[item.key] = clampInt(Math.round(value), item.min, item.max);
  }

  return safe;
}
