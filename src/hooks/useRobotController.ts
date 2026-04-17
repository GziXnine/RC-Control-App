/** @format */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ScreenOrientation from "expo-screen-orientation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import {
  BluetoothClassicClient,
  BluetoothDeviceInfo,
} from "../comms/bluetoothClassic";
import { PriorityCommandEngine } from "../comms/priorityCommandEngine";
import {
  getReconnectDelayMs,
  hasTelemetryTimedOut,
} from "../comms/reconnectPolicy";
import { joystickToDifferential, neutralMotor } from "../control/driveMath";
import { FrameStream } from "../protocol/frameStream";
import { parseCommandAckFrame, parseTelemetryFrame } from "../protocol/frames";
import {
  DEFAULT_FIRMWARE_TUNING,
  FIRMWARE_TUNING_KEYS,
  FIRMWARE_TUNING_LIMITS,
  sanitizeFirmwareTuning,
} from "../protocol/tuningCatalog";
import {
  DriveTuning,
  RobotMode,
  Telemetry,
  TuningLimits,
} from "../types/protocol";

const DEFAULT_DRIVE: DriveTuning = {
  max: 210,
  dead: 8,
  acc: 8,
  turn: 100,
  servoStep: 2,
};

const DEFAULT_LIMITS: TuningLimits = {
  s1Min: 10,
  s1Max: 170,
  s2Min: 20,
  s2Max: 165,
  s3Min: 30,
  s3Max: 90,
};

const DEFAULT_TELEMETRY: Telemetry = {
  mode: "MANUAL",
  stateCode: 0,
  frontCm: 0,
  leftCm: 0,
  rightCm: 0,
  motorLeft: 0,
  motorRight: 0,
  servo1: 90,
  servo2: 95,
  servo3: 90,
  stopLatched: false,
};

const TUNING_STORAGE_KEY = "competition_robot_tuning_profile_v1";
const TUNING_PROFILE_VERSION = 1;
const WRITE_FAILURE_THRESHOLD = 8;
const TELEMETRY_TIMEOUT_MS = 6000;
const CONNECT_RX_GRACE_MS = 12000;
const LINK_MONITOR_INTERVAL_MS = 250;
const MAX_RECONNECT_ATTEMPTS = 10;

interface TuningProfile {
  version: number;
  drive: DriveTuning;
  limits: TuningLimits;
  autoValues: Record<string, number>;
}

type BluetoothState =
  | "DISCONNECTED"
  | "SCANNING"
  | "READY"
  | "CONNECTING"
  | "CONNECTED"
  | "ERROR";

interface ServoValues {
  s1: number;
  s2: number;
  s3: number;
}

function clampInt(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function toFiniteNumber(input: unknown, fallback: number): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

function sanitizeDrive(input?: Partial<DriveTuning>): DriveTuning {
  const source = input ?? {};

  return {
    max: clampInt(
      Math.round(toFiniteNumber(source.max, DEFAULT_DRIVE.max)),
      60,
      255,
    ),
    dead: clampInt(
      Math.round(toFiniteNumber(source.dead, DEFAULT_DRIVE.dead)),
      0,
      80,
    ),
    acc: clampInt(
      Math.round(toFiniteNumber(source.acc, DEFAULT_DRIVE.acc)),
      1,
      40,
    ),
    turn: clampInt(
      Math.round(toFiniteNumber(source.turn, DEFAULT_DRIVE.turn)),
      40,
      180,
    ),
    servoStep: clampInt(
      Math.round(toFiniteNumber(source.servoStep, DEFAULT_DRIVE.servoStep)),
      1,
      12,
    ),
  };
}

function sanitizeLimits(input?: Partial<TuningLimits>): TuningLimits {
  const source = input ?? {};

  let s1Min = clampInt(
    Math.round(toFiniteNumber(source.s1Min, DEFAULT_LIMITS.s1Min)),
    0,
    180,
  );
  let s1Max = clampInt(
    Math.round(toFiniteNumber(source.s1Max, DEFAULT_LIMITS.s1Max)),
    0,
    180,
  );
  let s2Min = clampInt(
    Math.round(toFiniteNumber(source.s2Min, DEFAULT_LIMITS.s2Min)),
    0,
    180,
  );
  let s2Max = clampInt(
    Math.round(toFiniteNumber(source.s2Max, DEFAULT_LIMITS.s2Max)),
    0,
    180,
  );
  let s3Min = clampInt(
    Math.round(toFiniteNumber(source.s3Min, DEFAULT_LIMITS.s3Min)),
    0,
    180,
  );
  let s3Max = clampInt(
    Math.round(toFiniteNumber(source.s3Max, DEFAULT_LIMITS.s3Max)),
    0,
    180,
  );

  if (s1Min > s1Max) {
    s1Max = s1Min;
  }
  if (s2Min > s2Max) {
    s2Max = s2Min;
  }
  if (s3Min > s3Max) {
    s3Max = s3Min;
  }

  return {
    s1Min,
    s1Max,
    s2Min,
    s2Max,
    s3Min,
    s3Max,
  };
}

function sanitizeAutoValues(
  input?: Record<string, number>,
): Record<string, number> {
  return sanitizeFirmwareTuning(input);
}

function clampServosToLimits(
  values: ServoValues,
  limits: TuningLimits,
): ServoValues {
  return {
    s1: clampInt(Math.round(values.s1), limits.s1Min, limits.s1Max),
    s2: clampInt(Math.round(values.s2), limits.s2Min, limits.s2Max),
    s3: clampInt(Math.round(values.s3), limits.s3Min, limits.s3Max),
  };
}

function createDefaultProfile(): TuningProfile {
  return {
    version: TUNING_PROFILE_VERSION,
    drive: sanitizeDrive(DEFAULT_DRIVE),
    limits: sanitizeLimits(DEFAULT_LIMITS),
    autoValues: sanitizeAutoValues(DEFAULT_FIRMWARE_TUNING),
  };
}

function normalizeStoredProfile(input: unknown): TuningProfile {
  const candidate =
    typeof input === "object" && input !== null
      ? (input as Partial<TuningProfile>)
      : {};

  return {
    version: TUNING_PROFILE_VERSION,
    drive: sanitizeDrive(candidate.drive),
    limits: sanitizeLimits(candidate.limits),
    autoValues: sanitizeAutoValues(candidate.autoValues),
  };
}

export function useRobotController() {
  const bluetoothRef = useRef(new BluetoothClassicClient());
  const streamRef = useRef(new FrameStream());
  const engineRef = useRef<PriorityCommandEngine | null>(null);
  const motorRef = useRef(neutralMotor());
  const driveRef = useRef<DriveTuning>(DEFAULT_DRIVE);
  const limitsRef = useRef<TuningLimits>(DEFAULT_LIMITS);
  const autoRef = useRef<Record<string, number>>(DEFAULT_FIRMWARE_TUNING);
  const connectedAddressRef = useRef<string | null>(null);
  const writeFailureStreakRef = useRef(0);
  const lastTelemetryAtRef = useRef(0);
  const connectedAtRef = useRef(0);
  const hasRxSinceConnectRef = useRef(false);
  const linkDropGuardRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTargetRef = useRef<string | null>(null);
  const autoReconnectEnabledRef = useRef(true);
  const modeRef = useRef<RobotMode>("MANUAL");
  const servoValuesRef = useRef<ServoValues>({ s1: 90, s2: 95, s3: 90 });

  const [mode, setMode] = useState<RobotMode>("MANUAL");
  const [stopLatched, setStopLatched] = useState(false);
  const [telemetry, setTelemetry] = useState<Telemetry>(DEFAULT_TELEMETRY);
  const [drive, setDrive] = useState<DriveTuning>(DEFAULT_DRIVE);
  const [limits, setLimits] = useState<TuningLimits>(DEFAULT_LIMITS);
  const [autoValues, setAutoValues] = useState<Record<string, number>>(
    DEFAULT_FIRMWARE_TUNING,
  );
  const [servoValues, setServoValues] = useState<ServoValues>({
    s1: 90,
    s2: 95,
    s3: 90,
  });

  const [lastFrame, setLastFrame] = useState("IDLE");
  const [lastRxFrame, setLastRxFrame] = useState("NONE");
  const [queueSize, setQueueSize] = useState(0);

  const [bluetoothModalOpen, setBluetoothModalOpen] = useState(false);
  const [tuningModalOpen, setTuningModalOpen] = useState(false);
  const [bluetoothBusy, setBluetoothBusy] = useState(false);
  const [bluetoothStatus, setBluetoothStatus] =
    useState<BluetoothState>("DISCONNECTED");
  const [bluetoothError, setBluetoothError] = useState<string | null>(null);
  const [devices, setDevices] = useState<BluetoothDeviceInfo[]>([]);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [rxFrameCount, setRxFrameCount] = useState(0);
  const [tuningBusy, setTuningBusy] = useState(false);
  const [tuningStatus, setTuningStatus] = useState("LIVE UNSAVED");

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    servoValuesRef.current = servoValues;
  }, [servoValues]);

  const handleLinkLoss = useCallback(
    (reason: string) => {
      if (linkDropGuardRef.current) {
        return;
      }

      const lostAddress = connectedAddressRef.current;

      linkDropGuardRef.current = true;
      writeFailureStreakRef.current = 0;
      lastTelemetryAtRef.current = 0;
      connectedAtRef.current = 0;
      hasRxSinceConnectRef.current = false;
      connectedAddressRef.current = null;

      void bluetoothRef.current.disconnect().finally(() => {
        streamRef.current.reset();
        engineRef.current?.clearPending();
        motorRef.current = neutralMotor();
        setConnectedAddress(null);
        setStopLatched(true);
        setLastRxFrame("NONE");

        if (lostAddress && autoReconnectEnabledRef.current) {
          clearReconnectTimer();
          reconnectAttemptRef.current = 0;
          reconnectTargetRef.current = lostAddress;
          setBluetoothStatus("CONNECTING");
          setBluetoothError(reason);
        } else {
          setBluetoothStatus("ERROR");
          setBluetoothError(reason);
        }

        linkDropGuardRef.current = false;
      });
    },
    [clearReconnectTimer],
  );

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    void ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE,
    );

    return () => {
      void ScreenOrientation.unlockAsync();
    };
  }, []);

  useEffect(() => {
    const engine = new PriorityCommandEngine(
      async (frame) => {
        const sent = await bluetoothRef.current.write(frame);
        if (sent) {
          setLastFrame(frame);
          lastTelemetryAtRef.current = Date.now();
          writeFailureStreakRef.current = 0;
        } else if (connectedAddressRef.current !== null) {
          writeFailureStreakRef.current += 1;
          if (writeFailureStreakRef.current >= WRITE_FAILURE_THRESHOLD) {
            handleLinkLoss("Bluetooth write failed repeatedly. Link dropped.");
          }
        }
        return sent;
      },
      {
        periodMs: 20,
        onError: () => {
          // Keep controller loop running even if one write fails.
        },
        onFrameDropped: (frame, reason) => {
          if (reason === "invalid-frame") {
            setBluetoothError(`Invalid frame dropped: ${frame}`);
            return;
          }

          if (connectedAddressRef.current !== null) {
            writeFailureStreakRef.current += 1;
            if (writeFailureStreakRef.current >= WRITE_FAILURE_THRESHOLD) {
              handleLinkLoss("Bluetooth transport dropped repeatedly.");
            }
          }
        },
      },
    );

    engineRef.current = engine;
    engine.start();

    const queueTimer = setInterval(() => {
      const nextSize = engine.getQueueSize();
      setQueueSize((previous) => (previous === nextSize ? previous : nextSize));
    }, 100);

    return () => {
      clearInterval(queueTimer);
      engine.stop();
      void bluetoothRef.current.disconnect();
      engineRef.current = null;
    };
  }, [handleLinkLoss]);

  useEffect(() => {
    connectedAddressRef.current = connectedAddress;
  }, [connectedAddress]);

  useEffect(() => {
    const monitor = setInterval(() => {
      if (connectedAddressRef.current === null) {
        return;
      }

      const lastTelemetry = lastTelemetryAtRef.current;
      const connectedAt = connectedAtRef.current;
      const inConnectGrace =
        !hasRxSinceConnectRef.current &&
        connectedAt > 0 &&
        Date.now() - connectedAt < CONNECT_RX_GRACE_MS;

      if (inConnectGrace) {
        return;
      }

      if (
        hasTelemetryTimedOut(lastTelemetry, Date.now(), TELEMETRY_TIMEOUT_MS)
      ) {
        handleLinkLoss("Bluetooth link timeout. No recent telemetry or ACK frames.");
      }
    }, LINK_MONITOR_INTERVAL_MS);

    return () => {
      clearInterval(monitor);
    };
  }, [handleLinkLoss]);

  const onBluetoothChunk = useCallback((chunk: string) => {
    const frames = streamRef.current.pushChunk(chunk);

    for (const frame of frames) {
      const now = Date.now();

      const parsed = parseTelemetryFrame(frame);
      if (parsed) {
        hasRxSinceConnectRef.current = true;
        lastTelemetryAtRef.current = now;
        writeFailureStreakRef.current = 0;
        setRxFrameCount((previous) => previous + 1);
        setLastRxFrame(frame);
        setTelemetry((previous) => ({
          ...previous,
          ...parsed,
          stopLatched: parsed.mode === "AUTO" ? false : previous.stopLatched,
          servo1: servoValuesRef.current.s1,
          servo2: servoValuesRef.current.s2,
          servo3: servoValuesRef.current.s3,
        }));
        setMode(parsed.mode);
        if (parsed.mode === "AUTO") {
          setStopLatched(false);
        }
        setBluetoothStatus("CONNECTED");
        continue;
      }

      const ack = parseCommandAckFrame(frame);
      if (ack) {
        hasRxSinceConnectRef.current = true;
        lastTelemetryAtRef.current = now;
        writeFailureStreakRef.current = 0;
        setLastRxFrame(frame);
        setBluetoothStatus("CONNECTED");

        if (!ack.accepted) {
          setBluetoothError(`Robot rejected command: ${ack.frame}`);
        }
      }
    }
  }, []);

  const canQueueCommand = useCallback((): boolean => {
    return (
      connectedAddressRef.current !== null && bluetoothRef.current.isConnected()
    );
  }, []);

  const queueTuning = useCallback(
    (key: string, value: number): boolean => {
      if (!canQueueCommand()) {
        return false;
      }

      engineRef.current?.queueTuning(key, value);
      return true;
    },
    [canQueueCommand],
  );

  const queueAllTuning = useCallback(
    (profile?: TuningProfile) => {
      const sourceDrive = profile?.drive ?? driveRef.current;
      const sourceLimits = profile?.limits ?? limitsRef.current;
      const sourceAuto = profile?.autoValues ?? autoRef.current;
      const engine = engineRef.current;

      if (!engine || !canQueueCommand()) {
        return;
      }

      engine.queueTuning("MAX", sourceDrive.max);
      engine.queueTuning("ACC", sourceDrive.acc);
      engine.queueTuning("DEAD", sourceDrive.dead);
      engine.queueTuning("TURN", sourceDrive.turn);
      engine.queueTuning("SERVOSTEP", sourceDrive.servoStep);

      engine.queueTuning("S1MIN", sourceLimits.s1Min);
      engine.queueTuning("S1MAX", sourceLimits.s1Max);
      engine.queueTuning("S2MIN", sourceLimits.s2Min);
      engine.queueTuning("S2MAX", sourceLimits.s2Max);
      engine.queueTuning("S3MIN", sourceLimits.s3Min);
      engine.queueTuning("S3MAX", sourceLimits.s3Max);

      for (const key of FIRMWARE_TUNING_KEYS) {
        const value = sourceAuto[key] ?? DEFAULT_FIRMWARE_TUNING[key] ?? 0;
        engine.queueTuning(key, value);
      }
    },
    [canQueueCommand],
  );

  const restoreConnectedSession = useCallback(
    (address: string, source: "manual" | "auto") => {
      streamRef.current.reset();
      engineRef.current?.clearPending();
      motorRef.current = neutralMotor();

      linkDropGuardRef.current = false;
      writeFailureStreakRef.current = 0;
      const now = Date.now();
      connectedAtRef.current = now;
      hasRxSinceConnectRef.current = false;
      lastTelemetryAtRef.current = now;

      reconnectTargetRef.current = null;
      reconnectAttemptRef.current = 0;
      clearReconnectTimer();

      connectedAddressRef.current = address;
      setConnectedAddress(address);
      setBluetoothStatus("CONNECTED");
      setBluetoothError(null);

      setMode("MANUAL");
      setStopLatched(false);
      setRxFrameCount(0);
      setLastRxFrame("NONE");

      const engine = engineRef.current;
      if (engine) {
        const previousMode = modeRef.current;
        engine.queueMode("MANUAL");
        engine.queueMotor({ left: 0, right: 0 });
        if (previousMode === "AUTO") {
          engine.queueMode("AUTO");
        }
        engine.queueServo(1, servoValuesRef.current.s1);
        engine.queueServo(2, servoValuesRef.current.s2);
        engine.queueServo(3, servoValuesRef.current.s3);
      }

      if (source === "manual") {
        queueAllTuning();
        setTuningStatus("PROFILE SYNC QUEUED");
        setBluetoothModalOpen(false);
      } else {
        setTuningStatus("LINK RESTORED");
      }
    },
    [clearReconnectTimer, queueAllTuning],
  );

  const attemptAutoReconnect = useCallback(async () => {
    const address = reconnectTargetRef.current;
    if (!address || connectedAddressRef.current !== null) {
      return;
    }

    const enabled = await bluetoothRef.current.ensureEnabled();
    if (!enabled) {
      setBluetoothStatus("ERROR");
      setBluetoothError("Auto reconnect failed: Bluetooth is disabled.");
      reconnectTargetRef.current = null;
      return;
    }

    const ok = await bluetoothRef.current.connect(address, onBluetoothChunk);
    if (ok) {
      restoreConnectedSession(address, "auto");
      return;
    }

    setBluetoothStatus("CONNECTING");
    setBluetoothError(
      `Auto reconnect attempt ${reconnectAttemptRef.current} failed. Retrying...`,
    );
  }, [onBluetoothChunk, restoreConnectedSession]);

  useEffect(() => {
    if (!autoReconnectEnabledRef.current) {
      return;
    }

    if (connectedAddressRef.current !== null) {
      return;
    }

    const target = reconnectTargetRef.current;
    if (!target) {
      return;
    }

    if (reconnectTimerRef.current !== null) {
      return;
    }

    if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
      reconnectTargetRef.current = null;
      setBluetoothStatus("ERROR");
      setBluetoothError(
        "Auto reconnect exhausted retries. Reconnect manually.",
      );
      return;
    }

    const attempt = reconnectAttemptRef.current;
    const delayMs = getReconnectDelayMs(attempt);
    setBluetoothStatus("CONNECTING");
    setBluetoothError(
      `Auto reconnect ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS} in ${delayMs}ms.`,
    );

    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      reconnectAttemptRef.current += 1;
      void attemptAutoReconnect();
    }, delayMs);
  }, [attemptAutoReconnect, bluetoothError, bluetoothStatus, connectedAddress]);

  useEffect(() => {
    return () => {
      clearReconnectTimer();
    };
  }, [clearReconnectTimer]);

  const applyProfile = useCallback(
    (profile: TuningProfile, queueToRobot: boolean) => {
      const safeDrive = sanitizeDrive(profile.drive);
      const safeLimits = sanitizeLimits(profile.limits);
      const safeAuto = sanitizeAutoValues(profile.autoValues);

      driveRef.current = safeDrive;
      limitsRef.current = safeLimits;
      autoRef.current = safeAuto;

      setDrive(safeDrive);
      setLimits(safeLimits);
      setAutoValues(safeAuto);
      setServoValues((previous) => clampServosToLimits(previous, safeLimits));

      if (queueToRobot) {
        queueAllTuning({
          version: TUNING_PROFILE_VERSION,
          drive: safeDrive,
          limits: safeLimits,
          autoValues: safeAuto,
        });
      }
    },
    [queueAllTuning],
  );

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        const raw = await AsyncStorage.getItem(TUNING_STORAGE_KEY);
        if (!raw) {
          if (active) {
            setTuningStatus("DEFAULT PROFILE");
          }
          return;
        }

        const parsed = JSON.parse(raw);
        const profile = normalizeStoredProfile(parsed);

        if (!active) {
          return;
        }

        applyProfile(profile, false);
        setTuningStatus("PROFILE LOADED");
      } catch {
        if (active) {
          setTuningStatus("LOAD FAILED; USING DEFAULTS");
        }
      }
    };

    void loadProfile();

    return () => {
      active = false;
    };
  }, [applyProfile]);

  const saveTuningProfile = useCallback(async () => {
    setTuningBusy(true);
    try {
      const profile: TuningProfile = {
        version: TUNING_PROFILE_VERSION,
        drive: sanitizeDrive(driveRef.current),
        limits: sanitizeLimits(limitsRef.current),
        autoValues: sanitizeAutoValues(autoRef.current),
      };

      await AsyncStorage.setItem(TUNING_STORAGE_KEY, JSON.stringify(profile));

      if (connectedAddress) {
        queueAllTuning(profile);
        setTuningStatus("PROFILE SAVED + SYNC QUEUED");
      } else {
        setTuningStatus("PROFILE SAVED");
      }
    } catch {
      setTuningStatus("SAVE FAILED");
    } finally {
      setTuningBusy(false);
    }
  }, [connectedAddress, queueAllTuning]);

  const resetTuningDefaults = useCallback(async () => {
    setTuningBusy(true);
    try {
      const defaults = createDefaultProfile();
      applyProfile(defaults, connectedAddress !== null);
      await AsyncStorage.setItem(TUNING_STORAGE_KEY, JSON.stringify(defaults));
      setTuningStatus(
        connectedAddress
          ? "DEFAULTS RESTORED + SYNC QUEUED"
          : "DEFAULTS RESTORED",
      );
    } catch {
      setTuningStatus("RESET FAILED");
    } finally {
      setTuningBusy(false);
    }
  }, [applyProfile, connectedAddress]);

  const openBluetooth = useCallback(() => {
    setBluetoothModalOpen(true);
  }, []);

  const closeBluetooth = useCallback(() => {
    setBluetoothModalOpen(false);
  }, []);

  const openTuning = useCallback(() => {
    setTuningModalOpen(true);
  }, []);

  const closeTuning = useCallback(() => {
    setTuningModalOpen(false);
  }, []);

  const refreshDevices = useCallback(async () => {
    setBluetoothBusy(true);
    setBluetoothError(null);
    setBluetoothStatus("SCANNING");
    try {
      const enabled = await bluetoothRef.current.ensureEnabled();
      if (!enabled) {
        setDevices([]);
        setBluetoothStatus("ERROR");
        setBluetoothError("Bluetooth is disabled.");
        return;
      }

      const list = await bluetoothRef.current.listBondedDevices();
      setDevices(list);
      setBluetoothStatus(connectedAddress ? "CONNECTED" : "READY");
    } catch {
      setBluetoothStatus("ERROR");
      setBluetoothError("Failed to read paired devices.");
    } finally {
      setBluetoothBusy(false);
    }
  }, [connectedAddress]);

  const connectToDevice = useCallback(
    async (address: string) => {
      setBluetoothBusy(true);
      setBluetoothStatus("CONNECTING");
      setBluetoothError(null);
      autoReconnectEnabledRef.current = true;
      reconnectTargetRef.current = null;
      reconnectAttemptRef.current = 0;
      clearReconnectTimer();

      try {
        const enabled = await bluetoothRef.current.ensureEnabled();
        if (!enabled) {
          setBluetoothStatus("ERROR");
          setBluetoothError("Please enable Bluetooth first.");
          return;
        }

        const ok = await bluetoothRef.current.connect(
          address,
          onBluetoothChunk,
        );
        if (ok) {
          restoreConnectedSession(address, "manual");
        } else {
          setBluetoothStatus("ERROR");
          setBluetoothError("Connection failed. Verify pairing and retry.");
        }
      } catch {
        setBluetoothStatus("ERROR");
        setBluetoothError("Unexpected Bluetooth error during connect.");
      } finally {
        setBluetoothBusy(false);
      }
    },
    [clearReconnectTimer, onBluetoothChunk, restoreConnectedSession],
  );

  const disconnectDevice = useCallback(async () => {
    setBluetoothBusy(true);
    autoReconnectEnabledRef.current = false;
    reconnectTargetRef.current = null;
    reconnectAttemptRef.current = 0;
    clearReconnectTimer();

    try {
      await bluetoothRef.current.disconnect();
      streamRef.current.reset();
      engineRef.current?.clearPending();
      motorRef.current = neutralMotor();
      connectedAddressRef.current = null;
      writeFailureStreakRef.current = 0;
      lastTelemetryAtRef.current = 0;
      connectedAtRef.current = 0;
      hasRxSinceConnectRef.current = false;
      setConnectedAddress(null);
      setBluetoothStatus("DISCONNECTED");
      setBluetoothError(null);
      setLastRxFrame("NONE");
    } finally {
      setBluetoothBusy(false);
    }
  }, [clearReconnectTimer]);

  const sendStop = useCallback(() => {
    if (!canQueueCommand()) {
      return;
    }

    setStopLatched(true);
    setMode("MANUAL");
    motorRef.current = neutralMotor();
    setTelemetry((previous) => ({
      ...previous,
      mode: "MANUAL",
      motorLeft: 0,
      motorRight: 0,
      stopLatched: true,
    }));
    engineRef.current?.queueStop();
  }, [canQueueCommand]);

  const toggleMode = useCallback(() => {
    if (!canQueueCommand()) {
      return;
    }

    const nextMode: RobotMode = mode === "MANUAL" ? "AUTO" : "MANUAL";
    setMode(nextMode);
    setStopLatched(false);
    setTelemetry((previous) => ({
      ...previous,
      mode: nextMode,
      stopLatched: false,
    }));

    motorRef.current = neutralMotor();
    const engine = engineRef.current;
    if (!engine) {
      return;
    }

    if (nextMode === "AUTO") {
      // Explicitly clear STOP latch before enabling AUTO.
      engine.queueMode("MANUAL");
      engine.queueMode("AUTO");
    } else {
      engine.queueMode("MANUAL");
    }

    engine.queueMotor({ left: 0, right: 0 });
  }, [canQueueCommand, mode]);

  const onJoystickMove = useCallback(
    (x: number, y: number) => {
      if (mode !== "MANUAL" || stopLatched || !canQueueCommand()) {
        return;
      }

      const next = joystickToDifferential(
        x,
        y,
        driveRef.current,
        motorRef.current,
      );
      motorRef.current = next;
      engineRef.current?.queueMotor(next);
    },
    [canQueueCommand, mode, stopLatched],
  );

  const onJoystickRelease = useCallback(() => {
    if (mode !== "MANUAL" || !canQueueCommand()) {
      return;
    }

    const neutral = neutralMotor();
    motorRef.current = neutral;
    engineRef.current?.queueMotor(neutral);
  }, [canQueueCommand, mode]);

  const setServo = useCallback(
    (id: 1 | 2 | 3, value: number) => {
      const rounded = Math.round(value);
      const safe =
        id === 1
          ? clampInt(rounded, limitsRef.current.s1Min, limitsRef.current.s1Max)
          : id === 2
            ? clampInt(
                rounded,
                limitsRef.current.s2Min,
                limitsRef.current.s2Max,
              )
            : clampInt(
                rounded,
                limitsRef.current.s3Min,
                limitsRef.current.s3Max,
              );

      setServoValues((previous) => {
        if (id === 1) {
          return { ...previous, s1: safe };
        }

        if (id === 2) {
          return { ...previous, s2: safe };
        }

        return { ...previous, s3: safe };
      });

      setTelemetry((previous) => ({
        ...previous,
        servo1: id === 1 ? safe : previous.servo1,
        servo2: id === 2 ? safe : previous.servo2,
        servo3: id === 3 ? safe : previous.servo3,
      }));

      if (canQueueCommand()) {
        engineRef.current?.queueServo(id, safe);
      }
    },
    [canQueueCommand],
  );

  const updateDrive = useCallback(
    (patch: Partial<DriveTuning>) => {
      setDrive((previous) => {
        const next = sanitizeDrive({ ...previous, ...patch });
        driveRef.current = next;

        if (next.max !== previous.max) {
          queueTuning("MAX", next.max);
        }

        if (next.acc !== previous.acc) {
          queueTuning("ACC", next.acc);
        }

        if (next.dead !== previous.dead) {
          queueTuning("DEAD", next.dead);
        }

        if (next.turn !== previous.turn) {
          queueTuning("TURN", next.turn);
        }

        if (next.servoStep !== previous.servoStep) {
          queueTuning("SERVOSTEP", next.servoStep);
        }

        if (
          next.max !== previous.max ||
          next.acc !== previous.acc ||
          next.dead !== previous.dead ||
          next.turn !== previous.turn ||
          next.servoStep !== previous.servoStep
        ) {
          setTuningStatus("LIVE UNSAVED");
        }

        return next;
      });
    },
    [queueTuning],
  );

  const updateLimits = useCallback(
    (patch: Partial<TuningLimits>) => {
      setLimits((previous) => {
        const next = sanitizeLimits({ ...previous, ...patch });

        limitsRef.current = next;

        if (next.s1Min !== previous.s1Min) {
          queueTuning("S1MIN", next.s1Min);
        }
        if (next.s1Max !== previous.s1Max) {
          queueTuning("S1MAX", next.s1Max);
        }
        if (next.s2Min !== previous.s2Min) {
          queueTuning("S2MIN", next.s2Min);
        }
        if (next.s2Max !== previous.s2Max) {
          queueTuning("S2MAX", next.s2Max);
        }
        if (next.s3Min !== previous.s3Min) {
          queueTuning("S3MIN", next.s3Min);
        }
        if (next.s3Max !== previous.s3Max) {
          queueTuning("S3MAX", next.s3Max);
        }

        if (
          next.s1Min !== previous.s1Min ||
          next.s1Max !== previous.s1Max ||
          next.s2Min !== previous.s2Min ||
          next.s2Max !== previous.s2Max ||
          next.s3Min !== previous.s3Min ||
          next.s3Max !== previous.s3Max
        ) {
          setTuningStatus("LIVE UNSAVED");
          setServoValues((existing) => clampServosToLimits(existing, next));
        }

        return next;
      });
    },
    [queueTuning],
  );

  const updateAuto = useCallback(
    (key: string, value: number) => {
      const normalizedKey = key.toUpperCase();
      if (
        !Object.prototype.hasOwnProperty.call(
          FIRMWARE_TUNING_LIMITS,
          normalizedKey,
        )
      ) {
        return;
      }

      const firmwareKey = normalizedKey as keyof typeof FIRMWARE_TUNING_LIMITS;
      const bounds = FIRMWARE_TUNING_LIMITS[firmwareKey];
      const rounded = clampInt(Math.round(value), bounds.min, bounds.max);

      setAutoValues((previous) => {
        if (previous[firmwareKey] === rounded) {
          return previous;
        }

        const next = {
          ...previous,
          [firmwareKey]: rounded,
        };

        autoRef.current = next;
        queueTuning(firmwareKey, rounded);
        setTuningStatus("LIVE UNSAVED");
        return next;
      });
    },
    [queueTuning],
  );

  const bluetoothLabel = connectedAddress
    ? "BT CONNECTED"
    : bluetoothStatus === "CONNECTING"
      ? "BT CONNECTING"
      : "BT DISCONNECTED";

  return {
    mode,
    stopLatched,
    telemetry,
    drive,
    limits,
    autoValues,
    servoValues,
    queueSize,
    lastFrame,
    lastRxFrame,
    bluetoothLabel,
    bluetoothModalOpen,
    tuningModalOpen,
    bluetoothBusy,
    bluetoothStatus,
    bluetoothError,
    devices,
    connectedAddress,
    rxFrameCount,
    tuningBusy,
    tuningStatus,
    openBluetooth,
    closeBluetooth,
    openTuning,
    closeTuning,
    refreshDevices,
    connectToDevice,
    disconnectDevice,
    sendStop,
    toggleMode,
    onJoystickMove,
    onJoystickRelease,
    setServo,
    updateDrive,
    updateLimits,
    updateAuto,
    saveTuningProfile,
    resetTuningDefaults,
  };
}
