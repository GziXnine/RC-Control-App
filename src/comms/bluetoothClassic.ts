import { Platform } from "react-native";
import RNBluetoothClassic from "react-native-bluetooth-classic";

export interface BluetoothDeviceInfo {
  address: string;
  name: string;
}

type DataListener = (chunk: string) => void;

const bt: any = RNBluetoothClassic as any;

export class BluetoothClassicClient {
  private activeDevice: any = null;
  private readSubscription: { remove?: () => void } | null = null;

  async ensureEnabled(): Promise<boolean> {
    try {
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
          name: String(item.name ?? item.address ?? "Unknown")
        }))
        .filter((item: BluetoothDeviceInfo) => item.address.length > 0);
    } catch {
      return [];
    }
  }

  async connect(address: string, onData: DataListener): Promise<boolean> {
    await this.disconnect();

    try {
      let device = await bt.connectToDevice?.(address, {
        delimiter: "",
        deviceCharset: "ascii"
      });

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

    if (this.activeDevice?.onDataReceived) {
      this.readSubscription = this.activeDevice.onDataReceived((event: any) => {
        const chunk = event?.data ?? event?.message ?? "";
        if (typeof chunk === "string" && chunk.length > 0) {
          onData(chunk);
        }
      });
      return;
    }

    if (this.activeDevice?.address && bt.onDeviceRead) {
      this.readSubscription = bt.onDeviceRead(this.activeDevice.address, (event: any) => {
        const chunk = event?.data ?? event?.message ?? "";
        if (typeof chunk === "string" && chunk.length > 0) {
          onData(chunk);
        }
      });
      return;
    }

    // Android only fallback for some plugin versions.
    if (Platform.OS === "android" && bt.onDataReceived) {
      this.readSubscription = bt.onDataReceived((event: any) => {
        const chunk = event?.data ?? event?.message ?? "";
        if (typeof chunk === "string" && chunk.length > 0) {
          onData(chunk);
        }
      });
    }
  }
}
