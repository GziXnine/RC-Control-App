/** @format */

export type FirmwareTuningKey =
  | "AFL"
  | "AFR"
  | "TPL"
  | "TPR"
  | "KP"
  | "DB"
  | "TOL"
  | "TTO"
  | "F45"
  | "CALN"
  | "TH"
  | "MG"
  | "MLT"
  | "MRT";

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
    key: "AFL",
    label: "AUTO FWD LEFT",
    min: 70,
    max: 230,
    defaultValue: 145,
    section: "CORE",
  },
  {
    key: "AFR",
    label: "AUTO FWD RIGHT",
    min: 70,
    max: 230,
    defaultValue: 145,
    section: "CORE",
  },
  {
    key: "TPL",
    label: "TURN PWM LEFT",
    min: 70,
    max: 230,
    defaultValue: 150,
    section: "CORE",
  },
  {
    key: "TPR",
    label: "TURN PWM RIGHT",
    min: 70,
    max: 230,
    defaultValue: 150,
    section: "CORE",
  },
  {
    key: "KP",
    label: "TURN KP",
    min: 0,
    max: 20,
    defaultValue: 4,
    section: "CORE",
  },
  {
    key: "DB",
    label: "GYRO DEADBAND",
    min: 0,
    max: 10,
    defaultValue: 2,
    section: "CORE",
  },
  {
    key: "TOL",
    label: "TURN TOLERANCE",
    min: 2,
    max: 15,
    defaultValue: 5,
    section: "CORE",
  },
  {
    key: "TH",
    label: "FRONT STOP CM",
    min: 4,
    max: 30,
    defaultValue: 8,
    section: "CORE",
  },
  {
    key: "MG",
    label: "SIDE MARGIN",
    min: 0,
    max: 10,
    defaultValue: 2,
    section: "CORE",
  },
  {
    key: "MLT",
    label: "MANUAL TRIM L",
    min: -60,
    max: 60,
    defaultValue: 0,
    section: "CORE",
  },
  {
    key: "MRT",
    label: "MANUAL TRIM R",
    min: -60,
    max: 60,
    defaultValue: 0,
    section: "ADVANCED",
  },
  {
    key: "TTO",
    label: "TURN TIMEOUT",
    min: 500,
    max: 2500,
    defaultValue: 1200,
    section: "ADVANCED",
  },
  {
    key: "F45",
    label: "FALLBACK 45 MS",
    min: 180,
    max: 900,
    defaultValue: 320,
    section: "ADVANCED",
  },
  {
    key: "CALN",
    label: "CALIB EVERY N",
    min: 1,
    max: 3,
    defaultValue: 2,
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
