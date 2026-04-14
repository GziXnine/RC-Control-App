/** @format */

export type FirmwareTuningKey =
  | "KP"
  | "KD"
  | "SP"
  | "MS"
  | "TH"
  | "TS"
  | "NR"
  | "MD"
  | "PB"
  | "PV"
  | "RA"
  | "RV"
  | "DZ"
  | "BR"
  | "CM"
  | "AV"
  | "PT"
  | "DP"
  | "DE"
  | "ST"
  | "BL";

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
  { key: "KP", label: "STEER KP", min: 0, max: 80, defaultValue: 5, section: "CORE" },
  { key: "KD", label: "STEER KD", min: 0, max: 80, defaultValue: 2, section: "CORE" },
  { key: "SP", label: "BASE SPEED", min: 60, max: 255, defaultValue: 150, section: "CORE" },
  { key: "MS", label: "MIN SPEED", min: 40, max: 220, defaultValue: 95, section: "CORE" },
  { key: "TH", label: "FRONT BLOCK", min: 6, max: 120, defaultValue: 16, section: "CORE" },
  { key: "TS", label: "SIDE BLOCK", min: 4, max: 100, defaultValue: 12, section: "CORE" },
  { key: "NR", label: "NEAR CM", min: 8, max: 120, defaultValue: 18, section: "CORE" },
  { key: "MD", label: "MID CM", min: 12, max: 200, defaultValue: 42, section: "CORE" },
  { key: "PB", label: "PIVOT BIAS", min: 0, max: 40, defaultValue: 3, section: "CORE" },
  { key: "PV", label: "PIVOT PWM", min: 70, max: 255, defaultValue: 130, section: "CORE" },
  { key: "RA", label: "RAMP STEP", min: 1, max: 40, defaultValue: 8, section: "ADVANCED" },
  { key: "RV", label: "REVERSE STEP", min: 1, max: 80, defaultValue: 22, section: "ADVANCED" },
  { key: "DZ", label: "DEADZONE", min: 0, max: 40, defaultValue: 8, section: "ADVANCED" },
  { key: "BR", label: "BREAKAWAY", min: 0, max: 180, defaultValue: 75, section: "ADVANCED" },
  { key: "CM", label: "CORR CLAMP", min: 20, max: 180, defaultValue: 110, section: "ADVANCED" },
  { key: "AV", label: "AVOID TO PIVOT", min: 60, max: 1000, defaultValue: 180, section: "ADVANCED" },
  { key: "PT", label: "PIVOT MS", min: 80, max: 2000, defaultValue: 280, section: "ADVANCED" },
  { key: "DP", label: "DEAD PIVOT", min: 120, max: 3000, defaultValue: 460, section: "ADVANCED" },
  { key: "DE", label: "DEAD EXIT", min: 80, max: 1500, defaultValue: 140, section: "ADVANCED" },
  { key: "ST", label: "STALE MS", min: 80, max: 2000, defaultValue: 220, section: "ADVANCED" },
  { key: "BL", label: "BASE BLEND", min: 1, max: 30, defaultValue: 6, section: "ADVANCED" },
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

export const FIRMWARE_TUNING_KEYS = FIRMWARE_TUNING_SPECS.map((item) => item.key);

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
