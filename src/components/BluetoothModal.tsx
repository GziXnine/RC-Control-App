import React from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";

import { BluetoothDeviceInfo } from "../comms/bluetoothClassic";
import { palette } from "../theme/palette";

interface BluetoothModalProps {
  visible: boolean;
  busy: boolean;
  status: string;
  error: string | null;
  rxFrameCount: number;
  devices: BluetoothDeviceInfo[];
  connectedAddress: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onConnect: (address: string) => void;
  onDisconnect: () => void;
}

export function BluetoothModal({
  visible,
  busy,
  status,
  error,
  rxFrameCount,
  devices,
  connectedAddress,
  onClose,
  onRefresh,
  onConnect,
  onDisconnect
}: BluetoothModalProps): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>BLUETOOTH CLASSIC</Text>
            <Pressable style={styles.headerButton} onPress={onClose}>
              <Text style={styles.headerButtonText}>CLOSE</Text>
            </Pressable>
          </View>

          <View style={styles.headerRow}>
            <Pressable style={styles.headerButton} onPress={onRefresh}>
              <Text style={styles.headerButtonText}>{busy ? "SCANNING" : "REFRESH"}</Text>
            </Pressable>
            <Pressable style={styles.headerButton} onPress={onDisconnect}>
              <Text style={styles.headerButtonText}>DISCONNECT</Text>
            </Pressable>
          </View>

          <View style={styles.statusPanel}>
            <Text style={styles.statusText}>{`STATUS: ${status}`}</Text>
            <Text style={styles.statusText}>{`RX FRAMES: ${rxFrameCount}`}</Text>
            {connectedAddress ? (
              <Text numberOfLines={1} style={styles.statusText}>{`LINK: ${connectedAddress}`}</Text>
            ) : null}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          <FlatList
            data={devices}
            keyExtractor={(item) => item.address}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const connected = item.address === connectedAddress;

              return (
                <Pressable
                  style={[styles.deviceRow, connected && styles.deviceRowConnected]}
                  onPress={() => onConnect(item.address)}
                >
                  <Text style={styles.deviceName}>{item.name}</Text>
                  <Text style={styles.deviceAddress}>{item.address}</Text>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No paired devices found.</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.58)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16
  },
  card: {
    width: "100%",
    maxWidth: 720,
    maxHeight: "90%",
    backgroundColor: palette.panel,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: palette.frameBorder,
    padding: 12,
    gap: 8
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8
  },
  title: {
    color: palette.textPrimary,
    fontFamily: "monospace",
    fontSize: 16,
    fontWeight: "700"
  },
  headerButton: {
    minWidth: 110,
    height: 38,
    borderRadius: 10,
    backgroundColor: palette.panelRaised,
    borderWidth: 2,
    borderColor: palette.frameBorder,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  headerButtonText: {
    color: palette.textPrimary,
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "700"
  },
  listContent: {
    gap: 8,
    paddingVertical: 8
  },
  statusPanel: {
    borderWidth: 2,
    borderColor: palette.frameBorder,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
    backgroundColor: palette.panelInset
  },
  statusText: {
    color: palette.textSecondary,
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "700"
  },
  errorText: {
    color: palette.warning,
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "700"
  },
  deviceRow: {
    borderWidth: 2,
    borderColor: palette.frameBorder,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: palette.panelInset
  },
  deviceRowConnected: {
    borderColor: palette.greenLed,
    backgroundColor: "#2a4d31"
  },
  deviceName: {
    color: palette.textPrimary,
    fontFamily: "monospace",
    fontSize: 14,
    fontWeight: "700"
  },
  deviceAddress: {
    color: palette.textSecondary,
    fontFamily: "monospace",
    fontSize: 12,
    marginTop: 4
  },
  emptyWrap: {
    paddingVertical: 22,
    alignItems: "center"
  },
  emptyText: {
    color: palette.textSecondary,
    fontFamily: "monospace",
    fontSize: 13
  }
});
