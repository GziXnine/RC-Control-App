/** @format */

export interface BluetoothDeviceInfo {
  address: string;
  name: string;
}

type DataListener = (chunk: string) => void;

interface SimState {
  mode: "M" | "A";
  stopLatched: boolean;
  motorLeft: number;
  motorRight: number;
  servo1: number;
  servo2: number;
  servo3: number;
  frontCm: number;
  leftCm: number;
  rightCm: number;
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

function parseIntSafe(text: string): number | null {
  const parsed = Number.parseInt(text, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export class BluetoothClassicClient {
  private connected = false;
  private onData: DataListener | null = null;
  private telemetryTimer: ReturnType<typeof setInterval> | null = null;

  private sim: SimState = {
    mode: "M",
    stopLatched: false,
    motorLeft: 0,
    motorRight: 0,
    servo1: 90,
    servo2: 95,
    servo3: 90,
    frontCm: 120,
    leftCm: 85,
    rightCm: 85,
  };

  async ensureEnabled(): Promise<boolean> {
    return true;
  }

  async listBondedDevices(): Promise<BluetoothDeviceInfo[]> {
    return [
      {
        address: "DEMO-HC05",
        name: "HC-05 Demo",
      },
    ];
  }

  async connect(_address: string, onData: DataListener): Promise<boolean> {
    await this.disconnect();

    this.connected = true;
    this.onData = onData;
    this.startTelemetry();
    return true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.onData = null;

    if (this.telemetryTimer !== null) {
      clearInterval(this.telemetryTimer);
      this.telemetryTimer = null;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async write(frame: string): Promise<boolean> {
    if (!this.connected) {
      return false;
    }

    this.applyCommand(frame);
    return true;
  }

  private startTelemetry(): void {
    if (this.telemetryTimer !== null) {
      clearInterval(this.telemetryTimer);
    }

    this.telemetryTimer = setInterval(() => {
      if (!this.connected || this.onData === null) {
        return;
      }

      this.tickSimulation();
      const frame =
        `T=${this.sim.frontCm},${this.sim.leftCm},${this.sim.rightCm},` +
        `${this.sim.mode},${this.sim.motorLeft},${this.sim.motorRight};`;
      this.onData(frame);
    }, 200);
  }

  private tickSimulation(): void {
    const speed =
      (Math.abs(this.sim.motorLeft) + Math.abs(this.sim.motorRight)) / 2;
    const noise = () => Math.floor(Math.random() * 5) - 2;

    const forwardBias = this.sim.mode === "A" ? 2 : Math.round(speed / 90);
    this.sim.frontCm = clampInt(this.sim.frontCm - forwardBias + noise(), 8, 220);

    if (this.sim.frontCm < 18) {
      this.sim.frontCm = 120;
    }

    this.sim.leftCm = clampInt(this.sim.leftCm + noise(), 10, 200);
    this.sim.rightCm = clampInt(this.sim.rightCm + noise(), 10, 200);

    if (this.sim.mode === "A" && !this.sim.stopLatched) {
      const base = this.sim.frontCm < 40 ? 90 : 140;
      const diff = this.sim.leftCm - this.sim.rightCm;
      this.sim.motorLeft = clampInt(base - diff, -255, 255);
      this.sim.motorRight = clampInt(base + diff, -255, 255);
    }
  }

  private applyCommand(frame: string): void {
    const normalized = frame.trim().toUpperCase();

    if (normalized === "STOP;") {
      this.sim.stopLatched = true;
      this.sim.mode = "M";
      this.sim.motorLeft = 0;
      this.sim.motorRight = 0;
      return;
    }

    if (normalized === "A=0;") {
      this.sim.stopLatched = false;
      this.sim.mode = "M";
      this.sim.motorLeft = 0;
      this.sim.motorRight = 0;
      return;
    }

    if (normalized === "A=1;") {
      if (!this.sim.stopLatched) {
        this.sim.mode = "A";
      }
      return;
    }

    const motorMatch = normalized.match(/^M=\s*(-?\d+)\s*,\s*(-?\d+)\s*;$/);
    if (motorMatch) {
      if (this.sim.stopLatched) {
        return;
      }

      const left = parseIntSafe(motorMatch[1] ?? "");
      const right = parseIntSafe(motorMatch[2] ?? "");
      if (left === null || right === null) {
        return;
      }

      this.sim.mode = "M";
      this.sim.motorLeft = clampInt(left, -255, 255);
      this.sim.motorRight = clampInt(right, -255, 255);
      return;
    }

    const servoMatch = normalized.match(/^S([123])=(\d+);$/);
    if (servoMatch) {
      if (this.sim.stopLatched) {
        return;
      }

      const id = parseIntSafe(servoMatch[1] ?? "");
      const value = parseIntSafe(servoMatch[2] ?? "");
      if (id === null || value === null) {
        return;
      }

      const safe = clampInt(value, 0, 180);
      if (id === 1) {
        this.sim.servo1 = safe;
      } else if (id === 2) {
        this.sim.servo2 = safe;
      } else {
        this.sim.servo3 = safe;
      }
    }
  }
}
