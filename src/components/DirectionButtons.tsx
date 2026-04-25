import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { palette } from "../theme/palette";

interface DirectionButtonsProps {
  onTurn: (direction: "LEFT" | "RIGHT") => void;
  onMoveStart: (direction: "UP" | "DOWN") => void;
  onMoveStop: () => void;
}

export function DirectionButtons({
  onTurn,
  onMoveStart,
  onMoveStop,
}: DirectionButtonsProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>GYRO MODE</Text>
        <View style={styles.liveDot} />
      </View>

      <View style={styles.padShell}>
        <View style={styles.outerRing} />
        <View style={styles.crosshairHorizontal} />
        <View style={styles.crosshairVertical} />
        <View style={styles.centerHub} />

        <Pressable
          style={({ pressed }) => [
            styles.directionButton,
            styles.upButton,
            pressed && styles.directionButtonPressed
          ]}
          onPressIn={() => onMoveStart("UP")}
          onPressOut={onMoveStop}
        >
          <Text style={styles.directionText}>▲</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.directionButton,
            styles.leftButton,
            pressed && styles.directionButtonPressed
          ]}
          onPress={() => onTurn("LEFT")}
        >
          <Text style={styles.directionText}>◀</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.directionButton,
            styles.rightButton,
            pressed && styles.directionButtonPressed
          ]}
          onPress={() => onTurn("RIGHT")}
        >
          <Text style={styles.directionText}>▶</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.directionButton,
            styles.downButton,
            pressed && styles.directionButtonPressed
          ]}
          onPressIn={() => onMoveStart("DOWN")}
          onPressOut={onMoveStop}
        >
          <Text style={styles.directionText}>▼</Text>
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
    backgroundColor: palette.panelInset,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    overflow: "hidden"
  },
  headerRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    gap: 8
  },
  label: {
    color: palette.textSecondary,
    fontFamily: "monospace",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.greenLed,
    shadowColor: palette.greenLed,
    shadowOpacity: 0.7,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 6,
    elevation: 4
  },
  padShell: {
    width: "100%",
    flex: 1,
    maxWidth: 320,
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    borderRadius: 999,
    borderWidth: 3,
    borderColor: palette.knobDark,
    backgroundColor: "#222931",
    overflow: "hidden"
  },
  outerRing: {
    position: "absolute",
    width: "86%",
    height: "86%",
    borderRadius: 999,
    borderWidth: 2,
    borderColor: palette.frameBorder,
    opacity: 0.45
  },
  crosshairHorizontal: {
    position: "absolute",
    width: "100%",
    height: 2,
    backgroundColor: palette.frameBorder,
    opacity: 0.42
  },
  crosshairVertical: {
    position: "absolute",
    height: "100%",
    width: 2,
    backgroundColor: palette.frameBorder,
    opacity: 0.42
  },
  centerHub: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: palette.knobDark,
    backgroundColor: palette.knob,
    opacity: 0.9
  },
  directionButton: {
    position: "absolute",
    width: "23%",
    minWidth: 58,
    maxWidth: 84,
    aspectRatio: 1,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#9beea2",
    backgroundColor: palette.greenLed,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 8,
    elevation: 6
  },
  upButton: {
    top: "8%"
  },
  leftButton: {
    left: "8%"
  },
  rightButton: {
    right: "8%"
  },
  downButton: {
    bottom: "8%"
  },
  directionButtonPressed: {
    backgroundColor: "#78d98a",
    shadowOpacity: 0.15,
    transform: [{ scale: 0.95 }]
  },
  directionText: {
    color: palette.lcdBg,
    fontFamily: "monospace",
    fontSize: 30,
    fontWeight: "700",
    lineHeight: 34,
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2
  }
});
