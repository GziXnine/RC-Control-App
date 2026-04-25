import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { RetroSlider } from "./RetroSlider";
import { palette } from "../theme/palette";

interface ArmControllerProps {
  armValue: number; // 0-180 for combined servo 1+2
  armMin: number;
  armMax: number;
  servo3Value: number; // 0-180 for servo 3
  gripMin: number;
  gripMax: number;
  onArmChange: (value: number) => void;
  onGrip: () => void;
  onOpen: () => void;
}

export function ArmController({
  armValue,
  armMin,
  armMax,
  servo3Value,
  gripMin,
  gripMax,
  onArmChange,
  onGrip,
  onOpen,
}: ArmControllerProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      {/* ARM Slider (Left) */}
      <View style={styles.armSection}>
        <RetroSlider
          label="ARM"
          value={armValue}
          min={armMin}
          max={armMax}
          vertical
          onChange={onArmChange}
          variant="flat"
          style={styles.armSlider}
        />
      </View>

      {/* Vertical Grip Stack (Right) */}
      <View style={styles.gripSection}>
        <View style={styles.gripHeader}>
          <Text style={styles.gripLabel}>GRIP</Text>
        </View>

        <Pressable 
          style={({ pressed }) => [
            styles.thumbButton,
            styles.gripButton,
            pressed && styles.gripButtonPressed
          ]} 
          onPress={onGrip}
        >
          <View style={styles.thumbCore}>
            <Text style={styles.gripButtonText}>G</Text>
          </View>
        </Pressable>

        <View style={styles.spacer} />

        <Pressable 
          style={({ pressed }) => [
            styles.thumbButton,
            styles.openButton,
            pressed && styles.openButtonPressed
          ]} 
          onPress={onOpen}
        >
          <View style={styles.thumbCore}>
            <Text style={styles.openButtonText}>O</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: palette.frameBorder,
    backgroundColor: palette.panel,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 24,
  },
  armSection: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  gripSection: {
    width: 110,
    height: "100%",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingVertical: 0,
    gap: 0,
  },
  sectionLabel: {
    color: palette.textPrimary,
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  gripHeader: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingBottom: 8,
  },
  gripLabel: {
    color: palette.textPrimary,
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  degreeDisplay: {
    color: palette.lcdGlow,
    fontFamily: "monospace",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  rangeLabel: {
    color: palette.textSecondary,
    fontFamily: "monospace",
    fontSize: 10,
    fontWeight: "600",
  },
  armSlider: {
    flex: 1,
  },
  thumbButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  thumbCore: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.2)",
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  gripButton: {
    borderColor: palette.accentDark,
    backgroundColor: palette.accent,
  },
  gripButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.92 }],
  },
  openButton: {
    borderColor: palette.greenLed,
    backgroundColor: "#6adf88",
  },
  openButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.92 }],
  },
  gripButtonText: {
    color: palette.lcdBg,
    fontFamily: "monospace",
    fontSize: 20,
    fontWeight: "700",
  },
  openButtonText: {
    color: palette.lcdBg,
    fontFamily: "monospace",
    fontSize: 20,
    fontWeight: "700",
  },
  spacer: {
    flex: 1,
  },
});
