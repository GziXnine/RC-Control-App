import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { RetroSlider } from "./RetroSlider";
import { palette } from "../theme/palette";

interface ArmControllerProps {
  baseValue: number;
  upperValue: number;
  gripValue: number;
  baseMin: number;
  baseMax: number;
  upperMin: number;
  upperMax: number;
  gripMin: number;
  gripMax: number;
  onBaseChange: (value: number) => void;
  onUpperChange: (value: number) => void;
  onGrip: () => void;
  onOpen: () => void;
}

export function ArmController({
  baseValue,
  upperValue,
  gripValue,
  baseMin,
  baseMax,
  upperMin,
  upperMax,
  gripMin,
  gripMax,
  onBaseChange,
  onUpperChange,
  onGrip,
  onOpen,
}: ArmControllerProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <View style={styles.armSection}>
        <RetroSlider
          label="BASE"
          value={baseValue}
          min={baseMin}
          max={baseMax}
          vertical
          onChange={onBaseChange}
          variant="flat"
          style={styles.armSlider}
        />
      </View>

      <View style={styles.armSection}>
        <RetroSlider
          label="UPPER"
          value={upperValue}
          min={upperMin}
          max={upperMax}
          vertical
          onChange={onUpperChange}
          variant="flat"
          style={styles.armSlider}
        />
      </View>

      <View style={styles.gripSection}>

        <Pressable
          style={({ pressed }) => [
            styles.thumbButton,
            styles.gripButton,
            pressed && styles.gripButtonPressed,
          ]}
          onPress={onGrip}
        >
          <Text style={styles.gripButtonText}>G</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.thumbButton,
            styles.openButton,
            pressed && styles.openButtonPressed,
          ]}
          onPress={onOpen}
        >
          <Text style={styles.gripButtonText}>O</Text>
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
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 12,
  },
  armSection: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  armSlider: {
    flex: 1,
  },
  gripSection: {
    width: 80,
    height: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  gripLabel: {
    color: palette.textPrimary,
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: "700",
  },
  gripValue: {
    color: palette.textPrimary,
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "700",
  },
  gripRange: {
    color: palette.textSecondary,
    fontFamily: "monospace",
    fontSize: 10,
    fontWeight: "600",
  },
  thumbButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  gripButton: {
    borderColor: palette.accentDark,
    backgroundColor: palette.accent,
  },
  openButton: {
    borderColor: palette.greenLed,
    backgroundColor: "#6adf88",
  },
  gripButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.92 }],
  },
  openButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.92 }],
  },
  gripButtonText: {
    color: palette.lcdBg,
    fontFamily: "monospace",
    fontSize: 18,
    fontWeight: "700",
  },
});
