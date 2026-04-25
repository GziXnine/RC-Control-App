import React from "react";
import { SafeAreaView, StyleSheet, View } from "react-native";

import { ArmController } from "../components/ArmController";
import { BluetoothModal } from "../components/BluetoothModal";
import { DirectionButtons } from "../components/DirectionButtons";
import { JoystickPad } from "../components/JoystickPad";
import { LcdPanel } from "../components/LcdPanel";
import { TopBar } from "../components/TopBar";
import { TuningModal } from "../components/TuningModal";
import { useRobotController } from "../hooks/useRobotController";
import { palette } from "../theme/palette";

export function ControlScreen(): React.JSX.Element {
  const controller = useRobotController();
  const armMinRaw = Math.max(controller.limits.s1Min, controller.limits.s2Min);
  const armMaxRaw = Math.min(controller.limits.s1Max, controller.limits.s2Max);
  const armMin = armMinRaw <= armMaxRaw ? armMinRaw : 0;
  const armMax = armMinRaw <= armMaxRaw ? armMaxRaw : 180;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.shell}>
        <TopBar
          mode={controller.mode}
          stopLatched={controller.stopLatched}
          gyroEnabled={controller.gyroEnabled}
          bluetoothLabel={controller.bluetoothLabel}
          onBluetoothPress={controller.openBluetooth}
          onTuningPress={controller.openTuning}
          onToggleMode={controller.toggleMode}
          onToggleGyro={controller.toggleGyro}
          onStopPress={controller.sendStop}
        />

        <View style={styles.mainPanel}>
          <View style={styles.leftColumn}>
            {controller.gyroEnabled ? (
              <DirectionButtons
                onTurn={controller.sendTurn}
                onMoveStart={controller.startDirectionalMove}
                onMoveStop={controller.stopDirectionalMove}
              />
            ) : (
              <JoystickPad onMove={controller.onJoystickMove} onRelease={controller.onJoystickRelease} />
            )}
          </View>

          <View style={styles.centerColumn}>
            <LcdPanel
              telemetry={controller.telemetry}
              queueSize={controller.queueSize}
              lastFrame={controller.lastFrame}
              lastRxFrame={controller.lastRxFrame}
              rxFrameCount={controller.rxFrameCount}
              connected={controller.connectedAddress !== null}
            />
          </View>

          <View style={styles.rightColumn}>
            <ArmController
              armValue={(controller.servoValues.s1 + controller.servoValues.s2) / 2}
              armMin={armMin}
              armMax={armMax}
              servo3Value={controller.servoValues.s3}
              gripMin={controller.limits.s3Min}
              gripMax={controller.limits.s3Max}
              onArmChange={controller.setArmPair}
              onGrip={controller.setServo3Grip}
              onOpen={controller.setServo3Open}
            />
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
    flex: 1
  },
  centerColumn: {
    flex: 1
  },
  rightColumn: {
    flex: 1
  },
  servoRack: {
    flex: 1,
    flexDirection: "row",
    gap: 8
  },
  servoSlider: {
    flex: 1,
    minHeight: 0,
    paddingVertical: 2
  }
});
