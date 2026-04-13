import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { palette } from "../theme/palette";
import { Telemetry } from "../types/protocol";

interface LcdPanelProps {
  telemetry: Telemetry;
  queueSize: number;
  lastFrame: string;
  lastAck: string;
  ackCount: number;
  nackCount: number;
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
  lastAck,
  ackCount,
  nackCount
}: LcdPanelProps): React.JSX.Element {
  const speed = Math.round((Math.abs(telemetry.motorLeft) + Math.abs(telemetry.motorRight)) / 2);

  return (
    <View style={styles.wrapper}>
      <View style={styles.scanOverlay} />
      <Text style={styles.header}>Car Status</Text>

      <View style={styles.row}>
        <Text style={styles.key}>MODE</Text>
        <Text style={styles.value}>{telemetry.mode}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.key}>STOP</Text>
        <Text style={styles.value}>{telemetry.stopLatched ? "LATCHED" : "READY"}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.key}>SPEED</Text>
        <Text style={styles.value}>{speed}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.key}>DIST CM</Text>
        <Text style={styles.value}>{` ${telemetry.leftCm} | ${telemetry.frontCm} | ${telemetry.rightCm}`}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.key}>MOTOR</Text>
        <Text style={styles.value}>{`${telemetry.motorLeft} | ${telemetry.motorRight}`}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.key}>SERVOS</Text>
        <Text style={styles.value}>{`${telemetry.servo1} | ${telemetry.servo2} | ${telemetry.servo3}`}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.key}>QUEUE</Text>
        <Text style={styles.value}>{queueSize}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.key}>TX</Text>
        <Text style={styles.value}>{shortFrame(lastFrame)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.key}>ACK</Text>
        <Text style={styles.value}>{shortFrame(lastAck)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.key}>A/N</Text>
        <Text style={styles.value}>{`${ackCount}/${nackCount}`}</Text>
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
