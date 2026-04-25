import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { palette } from "../theme/palette";
import { RobotMode } from "../types/protocol";

interface TopBarProps {
  mode: RobotMode;
  stopLatched: boolean;
  gyroEnabled: boolean;
  bluetoothLabel: string;
  onBluetoothPress: () => void;
  onTuningPress: () => void;
  onToggleMode: () => void;
  onToggleGyro: () => void;
  onStopPress: () => void;
}

export function TopBar({
  mode,
  stopLatched,
  gyroEnabled,
  bluetoothLabel,
  onBluetoothPress,
  onTuningPress,
  onToggleMode,
  onToggleGyro,
  onStopPress
}: TopBarProps): React.JSX.Element {
  return (
    <View style={styles.bar}>
      <Pressable style={styles.button} onPress={onBluetoothPress}>
        <Text style={styles.buttonText}>{bluetoothLabel}</Text>
      </Pressable>

      <Pressable style={styles.button} onPress={onTuningPress}>
        <Text style={styles.buttonText}>TUNING</Text>
      </Pressable>

      <Pressable
        style={[
          styles.button,
          gyroEnabled && styles.gyroButtonActive
        ]}
        onPress={onToggleGyro}
      >
        <Text style={[styles.buttonText, gyroEnabled && styles.gyroTextActive]}>
          GYRO
        </Text>
      </Pressable>

      <Pressable
        style={[styles.button, mode === "AUTO" ? styles.modeAuto : styles.modeManual]}
        onPress={onToggleMode}
      >
        <Text style={styles.buttonText}>{`MODE ${mode}`}</Text>
      </Pressable>

      <Pressable style={[styles.stopButton, stopLatched && styles.stopButtonLatched]} onPress={onStopPress}>
        <View style={styles.triangle} />
        <Text style={styles.stopText}>STOP</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 68,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: palette.frameBorder,
    backgroundColor: palette.panel,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  button: {
    minWidth: 110,
    height: 46,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: palette.shellEdge,
    backgroundColor: palette.panelRaised,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  modeManual: {
    borderColor: palette.accentDark
  },
  modeAuto: {
    borderColor: palette.greenLed,
    backgroundColor: "#264532"
  },
  buttonText: {
    color: palette.textPrimary,
    fontFamily: "monospace",
    fontSize: 13,
    fontWeight: "600"
  },
  stopButton: {
    minWidth: 120,
    height: 46,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: palette.warningDark,
    backgroundColor: palette.warning,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12
  },
  stopButtonLatched: {
    backgroundColor: "#a1202f"
  },
  triangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 18,
    borderStyle: "solid",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#fff"
  },
  stopText: {
    color: "#fff",
    fontFamily: "monospace",
    fontSize: 14,
    fontWeight: "700"
  },
  gyroButtonActive: {
    borderColor: palette.greenLed,
    backgroundColor: "#264532"
  },
  gyroTextActive: {
    color: palette.greenLed
  }
});
