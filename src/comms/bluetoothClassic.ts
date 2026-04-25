/** @format */

import { PermissionsAndroid, Platform, type Permission } from "react-native";
import RNBluetoothClassic from "react-native-bluetooth-classic";

export interface BluetoothDeviceInfo {
  address: string;
  name: string;
}

type DataListener = (chunk: string) => void;

const bt: any = RNBluetoothClassic as any;
const READ_POLL_MS = 30;

function normalizeChunk(input: unknown): string {
  return typeof input === "string" ? input : "";
}

async function requestAndroidBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== "android") {
    return true;
  }

  if (typeof Platform.Version !== "number" || Platform.Version < 23) {
    return true;
  }

  const permissionSet = new Set<Permission>();

  const permissions = PermissionsAndroid.PERMISSIONS;
  if (Platform.Version >= 31) {
    if (permissions.BLUETOOTH_CONNECT) {
      permissionSet.add(permissions.BLUETOOTH_CONNECT as Permission);
    }

    if (permissions.BLUETOOTH_SCAN) {
      permissionSet.add(permissions.BLUETOOTH_SCAN as Permission);
    }
  }

  if (permissions.ACCESS_FINE_LOCATION) {
    permissionSet.add(permissions.ACCESS_FINE_LOCATION as Permission);
  }

  const permissionList = Array.from(permissionSet);
  if (permissionList.length === 0) {
    return true;
  }

  const results = await PermissionsAndroid.requestMultiple(permissionList);
  return permissionList.every(
    (permission) => results[permission] === PermissionsAndroid.RESULTS.GRANTED,
  );
}

export class BluetoothClassicClient {
  private activeDevice: any = null;
  private readSubscription: { remove?: () => void } | null = null;
  private readPollTimer: ReturnType<typeof setInterval> | null = null;
  private readPollBusy = false;

  async ensureEnabled(): Promise<boolean> {
    try {
      if (!(await requestAndroidBluetoothPermissions())) {
        return false;
      }

      const isEnabled = await bt.isBluetoothEnabled?.();
      if (isEnabled) {
        return true;
      }

      const enabled = await bt.requestBluetoothEnabled?.();
      return Boolean(enabled);
    } catch {
      return false;
    }
  }

  async listBondedDevices(): Promise<BluetoothDeviceInfo[]> {
    try {
      const raw =
        (await bt.getBondedDevices?.()) ??
        (await bt.getPairedDevices?.()) ??
        [];

      return raw
        .map((item: any) => ({
          address: String(item.address ?? item.id ?? ""),
          name: String(item.name ?? item.address ?? "Unknown"),
        }))
        .filter((item: BluetoothDeviceInfo) => item.address.length > 0);
    } catch {
      return [];
    }
  }

  async connect(address: string, onData: DataListener): Promise<boolean> {
    await this.disconnect();

    try {
      const connectOptions = {
        delimiter: "\n",
        charset: "ascii",
      };

      let device = await bt.connectToDevice?.(address, {
        ...connectOptions,
      });

      if (!device) {
        device = await bt.connect?.(address, connectOptions);
      }

      if (!device) {
        device = await bt.connect?.(address);
      }

      if (!device) {
        return false;
      }

      this.activeDevice = device;
      this.attachReader(onData);
      return true;
    } catch {
      this.activeDevice = null;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.readSubscription?.remove?.();
      this.readSubscription = null;
      this.stopReadPolling();

      if (this.activeDevice?.disconnect) {
        await this.activeDevice.disconnect();
      } else if (this.activeDevice?.address && bt.disconnectFromDevice) {
        await bt.disconnectFromDevice(this.activeDevice.address);
      }
    } catch {
      // Ignore disconnect errors to keep control loop resilient.
    } finally {
      this.activeDevice = null;
    }
  }

  isConnected(): boolean {
    return this.activeDevice !== null;
  }

  async write(frame: string): Promise<boolean> {
    if (!this.activeDevice) {
      return false;
    }

    try {
      if (this.activeDevice.write) {
        await this.activeDevice.write(frame);
        return true;
      }

      if (this.activeDevice.address && bt.writeToDevice) {
        await bt.writeToDevice(this.activeDevice.address, frame);
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  private attachReader(onData: DataListener): void {
    this.readSubscription?.remove?.();
    this.readSubscription = null;
    this.stopReadPolling();

    if (this.activeDevice?.onDataReceived) {
      this.readSubscription = this.activeDevice.onDataReceived((event: any) => {
        const chunk = normalizeChunk(event?.data ?? event?.message);
        if (chunk.length > 0) {
          onData(chunk);
        }
      });
      return;
    }

    if (this.activeDevice?.address && bt.onDeviceRead) {
      this.readSubscription = bt.onDeviceRead(
        this.activeDevice.address,
        (event: any) => {
          const chunk = normalizeChunk(event?.data ?? event?.message);
          if (chunk.length > 0) {
            onData(chunk);
          }
        },
      );
      return;
    }

    // Android only fallback for some plugin versions.
    if (Platform.OS === "android" && bt.onDataReceived) {
      this.readSubscription = bt.onDataReceived((event: any) => {
        const chunk = normalizeChunk(event?.data ?? event?.message);
        if (chunk.length > 0) {
          onData(chunk);
        }
      });
      return;
    }

    // Fallback for builds where event streams are unavailable.
    this.startReadPolling(onData);
  }

  private stopReadPolling(): void {
    if (this.readPollTimer !== null) {
      clearInterval(this.readPollTimer);
      this.readPollTimer = null;
    }
    this.readPollBusy = false;
  }

  private startReadPolling(onData: DataListener): void {
    this.stopReadPolling();

    this.readPollTimer = setInterval(() => {
      if (!this.activeDevice || this.readPollBusy) {
        return;
      }

      this.readPollBusy = true;
      void (async () => {
        try {
          if (this.activeDevice?.read) {
            const chunk = normalizeChunk(await this.activeDevice.read());
            if (chunk.length > 0) {
              onData(chunk);
            }
            return;
          }

          if (this.activeDevice?.address && bt.readFromDevice) {
            const chunk = normalizeChunk(
              await bt.readFromDevice(this.activeDevice.address),
            );
            if (chunk.length > 0) {
              onData(chunk);
            }
          }
        } catch {
          // Ignore polling read errors; link-health logic handles disconnects.
        } finally {
          this.readPollBusy = false;
        }
      })();
    }, READ_POLL_MS);
  }
}
