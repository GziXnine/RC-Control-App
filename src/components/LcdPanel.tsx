import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { palette } from "../theme/palette";
import { Telemetry } from "../types/protocol";

interface LcdPanelProps {
  telemetry: Telemetry;
  queueSize: number;
  lastFrame: string;
  lastRxFrame: string;
  rxFrameCount: number;
  connected: boolean;
}

function shortFrame(frame: string): string {
  if (frame.length <= 28) {
    return frame;
  }

  return `${frame.slice(0, 25)}...`;
}

export function LcdPanel({
  telemetry,
  queueSize,
  lastFrame,
  lastRxFrame,
  rxFrameCount,
  connected
}: LcdPanelProps): React.JSX.Element {
  const speed = Math.round(
    (Math.abs(telemetry.motorLeft) + Math.abs(telemetry.motorRight)) / 2,
  );
  const turnBias = telemetry.motorLeft - telemetry.motorRight;
  const nearestObstacle = [telemetry.frontCm, telemetry.leftCm, telemetry.rightCm]
    .filter((item) => item > 0)
    .reduce((min, value) => (value < min ? value : min), 999);
  const nearestLabel = nearestObstacle === 999 ? "NONE" : String(nearestObstacle);
  const heading =
    Math.abs(turnBias) <= 10 ? "STRAIGHT" : turnBias > 0 ? "RIGHT BIAS" : "LEFT BIAS";
  const obstacleState =
    nearestObstacle === 999
      ? "NO SENSOR DATA"
      : nearestObstacle <= 20
        ? "CAUTION"
        : "CLEAR";

  return (
    <View style={styles.wrapper}>
      <View style={styles.scanOverlay} />

      <View style={styles.row}>
        <Text style={styles.key}>LINK</Text>
        <Text style={styles.value}>{connected ? "CONNECTED" : "OFFLINE"}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.key}>SPEED</Text>
        <Text style={styles.value}>{speed}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.key}>DIST CM</Text>
        <Text style={styles.value}>{`${telemetry.leftCm} | ${telemetry.frontCm} | ${telemetry.rightCm}`}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.key}>MOTOR</Text>
        <Text style={styles.value}>{`${telemetry.motorLeft} | ${telemetry.motorRight}`}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.key}>TURN</Text>
        <Text style={styles.value}>{`${turnBias} (${heading})`}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.key}>NEAR CM</Text>
        <Text style={styles.value}>{`${nearestLabel} (${obstacleState})`}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.key}>RX FRAMES</Text>
        <Text style={styles.value}>{rxFrameCount}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.key}>QUEUE</Text>
        <Text style={styles.value}>{queueSize}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.key}>TX</Text>
        <Text style={styles.value}>{shortFrame(lastFrame)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    borderWidth: 3,
    borderColor: palette.lcdDark,
    borderRadius: 12,
    backgroundColor: palette.lcdBg,
    padding: 12,
    justifyContent: "space-between",
    overflow: "hidden"
  },
  scanOverlay: {
    ...StyleSheet.absoluteFill,
    opacity: 0.12,
    backgroundColor: palette.lcdDark
  },
  header: {
    fontFamily: "monospace",
    color: palette.lcdDark,
    fontSize: 18,
    letterSpacing: 1,
    marginBottom: 4,
    fontWeight: "700"
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.0,
    borderBottomColor: palette.lcdMid,
    paddingVertical: 3,
    gap: 8
  },
  key: {
    fontFamily: "monospace",
    color: palette.lcdDark,
    fontSize: 13,
    fontWeight: "700"
  },
  value: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: "monospace",
    color: palette.lcdDark,
    fontSize: 13,
    fontWeight: "700"
  }
});
