import React from "react";
import { SafeAreaView, StyleSheet, View } from "react-native";

import { BluetoothModal } from "../components/BluetoothModal";
import { JoystickPad } from "../components/JoystickPad";
import { LcdPanel } from "../components/LcdPanel";
import { RetroSlider } from "../components/RetroSlider";
import { TopBar } from "../components/TopBar";
import { TuningModal } from "../components/TuningModal";
import { useRobotController } from "../hooks/useRobotController";
import { palette } from "../theme/palette";

export function ControlScreen(): React.JSX.Element {
  const controller = useRobotController();

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.shell}>
        <TopBar
          mode={controller.mode}
          stopLatched={controller.stopLatched}
          bluetoothLabel={controller.bluetoothLabel}
          onBluetoothPress={controller.openBluetooth}
          onTuningPress={controller.openTuning}
          onToggleMode={controller.toggleMode}
          onStopPress={controller.sendStop}
        />

        <View style={styles.mainPanel}>
          <View style={styles.leftColumn}>
            <JoystickPad onMove={controller.onJoystickMove} onRelease={controller.onJoystickRelease} />
          </View>

          <View style={styles.centerColumn}>
            <LcdPanel
              telemetry={controller.telemetry}
              queueSize={controller.queueSize}
              lastFrame={controller.lastFrame}
              lastAck={controller.lastAck}
              ackCount={controller.ackCount}
              nackCount={controller.nackCount}
            />
          </View>

          <View style={styles.rightColumn}>
            <View style={styles.rightTop}>
              <RetroSlider
                label="SERVO 1"
                value={controller.servoValues.s1}
                min={controller.limits.s1Min}
                max={controller.limits.s1Max}
                vertical
                onChange={(value) => controller.setServo(1, value)}
                variant="flat"
                style={styles.verticalSlider}
              />

              <RetroSlider
                label="SERVO 2"
                value={controller.servoValues.s2}
                min={controller.limits.s2Min}
                max={controller.limits.s2Max}
                vertical
                onChange={(value) => controller.setServo(2, value)}
                variant="flat"
                style={styles.verticalSlider}
              />
            </View>

            <View style={styles.rightBottom}>
              <RetroSlider
                label="SERVO 3"
                value={controller.servoValues.s3}
                min={controller.limits.s3Min}
                max={controller.limits.s3Max}
                onChange={(value) => controller.setServo(3, value)}
                variant="flat"
                style={styles.horizontalSlider}
              />
            </View>
          </View>
        </View>
      </View>

      <BluetoothModal
        visible={controller.bluetoothModalOpen}
        busy={controller.bluetoothBusy}
        status={controller.bluetoothStatus}
        error={controller.bluetoothError}
        rxFrameCount={controller.rxFrameCount}
        devices={controller.devices}
        connectedAddress={controller.connectedAddress}
        onClose={controller.closeBluetooth}
        onRefresh={controller.refreshDevices}
        onConnect={controller.connectToDevice}
        onDisconnect={controller.disconnectDevice}
      />

      <TuningModal
        visible={controller.tuningModalOpen}
        onClose={controller.closeTuning}
        drive={controller.drive}
        limits={controller.limits}
        autoValues={controller.autoValues}
        tuningBusy={controller.tuningBusy}
        tuningStatus={controller.tuningStatus}
        onDriveChange={controller.updateDrive}
        onLimitsChange={controller.updateLimits}
        onAutoChange={controller.updateAuto}
        onSaveProfile={controller.saveTuningProfile}
        onResetDefaults={controller.resetTuningDefaults}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#090b0d"
  },
  shell: {
    flex: 1,
    margin: 8,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: palette.shellEdge,
    backgroundColor: palette.shell,
    padding: 8,
    gap: 8
  },
  mainPanel: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: palette.frameBorder,
    backgroundColor: palette.panel,
    padding: 8,
    flexDirection: "row",
    gap: 8
  },
  leftColumn: {
    flex: 1.2
  },
  centerColumn: {
    flex: 1
  },
  rightColumn: {
    flex: 1,
    minWidth: 240
  },
  rightTop: {
    flex: 1,
    minHeight: 0,
    flexDirection: "row",
    gap: 8
  },
  rightBottom: {
    marginTop: 8,
    height: 78,
    paddingHorizontal: 2
  },
  verticalSlider: {
    flex: 1,
    minHeight: 0,
    paddingVertical: 2
  },
  horizontalSlider: {
    flex: 1,
    width: "100%",
    paddingVertical: 0
  }
});
