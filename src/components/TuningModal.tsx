import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";

import { DriveTuning, TuningLimits } from "../types/protocol";
import { FIRMWARE_TUNING_SPECS } from "../protocol/tuningCatalog";
import { palette } from "../theme/palette";
import { DualRangeBar } from "./DualRangeBar";
import { RetroSlider } from "./RetroSlider";

interface TuningModalProps {
  visible: boolean;
  onClose: () => void;
  drive: DriveTuning;
  limits: TuningLimits;
  autoValues: Record<string, number>;
  tuningBusy: boolean;
  tuningStatus: string;
  onDriveChange: (patch: Partial<DriveTuning>) => void;
  onLimitsChange: (patch: Partial<TuningLimits>) => void;
  onAutoChange: (key: string, value: number) => void;
  onSaveProfile: () => void;
  onResetDefaults: () => void;
}

type TabKey = "DRIVE" | "SERVO" | "CORE" | "ADV";

interface AutoControlSpec {
  key: string;
  min: number;
  max: number;
  label: string;
}

const AUTO_MAIN: AutoControlSpec[] = FIRMWARE_TUNING_SPECS
  .filter((item) => item.section === "CORE")
  .map((item) => ({
    key: item.key,
    min: item.min,
    max: item.max,
    label: item.label,
  }));

const AUTO_ADVANCED: AutoControlSpec[] = FIRMWARE_TUNING_SPECS
  .filter((item) => item.section === "ADVANCED")
  .map((item) => ({
    key: item.key,
    min: item.min,
    max: item.max,
    label: item.label,
  }));

export function TuningModal({
  visible,
  onClose,
  drive,
  limits,
  autoValues,
  tuningBusy,
  tuningStatus,
  onDriveChange,
  onLimitsChange,
  onAutoChange,
  onSaveProfile,
  onResetDefaults
}: TuningModalProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabKey>("DRIVE");
  const [sliderDragging, setSliderDragging] = useState(false);
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();

  const tabButtons: TabKey[] = ["DRIVE", "SERVO", "CORE", "ADV"];
  const controlItemStyle = useMemo(() => {
    if (viewportWidth >= 1040) {
      return styles.controlItem25;
    }

    if (viewportWidth >= 660) {
      return styles.controlItem50;
    }

    return styles.controlItemFull;
  }, [viewportWidth]);

  const panelHeight = Math.max(320, Math.min(760, viewportHeight - 20));
  const panelWidth = Math.max(320, Math.min(1050, viewportWidth - 12));

  const rangePairs = useMemo(
    () => [
      {
        label: "SERVO 1 RANGE",
        low: limits.s1Min,
        high: limits.s1Max,
        update: (low: number, high: number) => onLimitsChange({ s1Min: low, s1Max: high })
      },
      {
        label: "SERVO 2 RANGE",
        low: limits.s2Min,
        high: limits.s2Max,
        update: (low: number, high: number) => onLimitsChange({ s2Min: low, s2Max: high })
      },
      {
        label: "SERVO 3 RANGE",
        low: limits.s3Min,
        high: limits.s3Max,
        update: (low: number, high: number) => onLimitsChange({ s3Min: low, s3Max: high })
      }
    ],
    [limits, onLimitsChange]
  );

  const renderDriveTab = (): React.JSX.Element => {
    return (
      <View style={styles.grid}>
        <RetroSlider
          label="MAX"
          value={drive.max}
          min={60}
          max={255}
          onChange={(value) => onDriveChange({ max: value })}
          onDragStateChange={setSliderDragging}
          variant="flat"
          valuePlacement="header"
          style={controlItemStyle}
        />
        <RetroSlider
          label="ACC"
          value={drive.acc}
          min={1}
          max={40}
          onChange={(value) => onDriveChange({ acc: value })}
          onDragStateChange={setSliderDragging}
          variant="flat"
          valuePlacement="header"
          style={controlItemStyle}
        />
        <RetroSlider
          label="DEAD"
          value={drive.dead}
          min={0}
          max={80}
          onChange={(value) => onDriveChange({ dead: value })}
          onDragStateChange={setSliderDragging}
          variant="flat"
          valuePlacement="header"
          style={controlItemStyle}
        />
        <RetroSlider
          label="TURN"
          value={drive.turn}
          min={40}
          max={180}
          onChange={(value) => onDriveChange({ turn: value })}
          onDragStateChange={setSliderDragging}
          variant="flat"
          valuePlacement="header"
          style={controlItemStyle}
        />
        <RetroSlider
          label="SERVO STEP"
          value={drive.servoStep}
          min={1}
          max={12}
          onChange={(value) => onDriveChange({ servoStep: value })}
          onDragStateChange={setSliderDragging}
          variant="flat"
          valuePlacement="header"
          style={controlItemStyle}
        />
      </View>
    );
  };

  const renderServoTab = (): React.JSX.Element => {
    return (
      <View style={styles.rangeStack}>
        {rangePairs.map((item) => (
          <DualRangeBar
            key={item.label}
            label={item.label}
            min={0}
            max={180}
            lowValue={item.low}
            highValue={item.high}
            onChange={item.update}
            onDragStateChange={setSliderDragging}
            variant="flat"
            valuePlacement="header"
            style={styles.rangeItemFullWidth}
          />
        ))}
      </View>
    );
  };

  const renderAutoControls = (list: AutoControlSpec[]): React.JSX.Element => {
    return (
      <View style={styles.grid}>
        {list.map((item) => (
          <RetroSlider
            key={item.key}
            label={item.label}
            value={autoValues[item.key] ?? item.min}
            min={item.min}
            max={item.max}
            onChange={(value) => onAutoChange(item.key, value)}
            onDragStateChange={setSliderDragging}
            variant="flat"
            valuePlacement="header"
            style={controlItemStyle}
          />
        ))}
      </View>
    );
  };

  const renderBody = (): React.JSX.Element => {
    if (activeTab === "DRIVE") {
      return renderDriveTab();
    }

    if (activeTab === "SERVO") {
      return renderServoTab();
    }

    if (activeTab === "CORE") {
      return renderAutoControls(AUTO_MAIN);
    }

    return renderAutoControls(AUTO_ADVANCED);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.panel, { width: panelWidth, height: panelHeight }]}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>TUNING DASHBOARD</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>CLOSE</Text>
            </Pressable>
          </View>

          <View style={styles.tabRow}>
            {tabButtons.map((tab) => (
              <Pressable
                key={tab}
                style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={styles.tabText}>{tab}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.actionRow}>
            <Pressable
              style={[styles.actionButton, tuningBusy && styles.actionButtonDisabled]}
              onPress={onSaveProfile}
              disabled={tuningBusy}
            >
              <Text style={styles.actionButtonText}>{tuningBusy ? "WORKING" : "SAVE PROFILE"}</Text>
            </Pressable>

            <Pressable
              style={[styles.actionButton, tuningBusy && styles.actionButtonDisabled]}
              onPress={onResetDefaults}
              disabled={tuningBusy}
            >
              <Text style={styles.actionButtonText}>RESET DEFAULT</Text>
            </Pressable>

            <Text numberOfLines={1} style={styles.statusText}>
              {tuningStatus}
            </Text>
          </View>

          <View style={styles.body}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator
              nestedScrollEnabled
              scrollEnabled={!sliderDragging}
            >
              {renderBody()}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.56)",
    justifyContent: "center",
    alignItems: "center",
    padding: 14
  },
  panel: {
    backgroundColor: palette.panel,
    borderWidth: 2,
    borderColor: palette.frameBorder,
    borderRadius: 14,
    padding: 12,
    gap: 10
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  title: {
    color: palette.textPrimary,
    fontFamily: "monospace",
    fontSize: 16,
    fontWeight: "700"
  },
  closeButton: {
    minWidth: 96,
    height: 36,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: palette.frameBorder,
    backgroundColor: palette.panelRaised,
    alignItems: "center",
    justifyContent: "center"
  },
  closeText: {
    color: palette.textPrimary,
    fontFamily: "monospace",
    fontWeight: "700"
  },
  tabRow: {
    flexDirection: "row",
    gap: 8
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  actionButton: {
    minWidth: 122,
    height: 34,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: palette.frameBorder,
    backgroundColor: palette.panelRaised,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  actionButtonDisabled: {
    opacity: 0.6
  },
  actionButtonText: {
    color: palette.textPrimary,
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: "700"
  },
  statusText: {
    flex: 1,
    color: palette.textSecondary,
    fontFamily: "monospace",
    fontSize: 11,
    textAlign: "right"
  },
  tabButton: {
    minWidth: 84,
    height: 34,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: palette.frameBorder,
    backgroundColor: palette.panelInset,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8
  },
  tabButtonActive: {
    borderColor: palette.accent,
    backgroundColor: "#223a44"
  },
  tabText: {
    color: palette.textPrimary,
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "700"
  },
  body: {
    flex: 1,
    minHeight: 0,
    borderWidth: 2,
    borderColor: palette.frameBorder,
    borderRadius: 12,
    backgroundColor: palette.panelInset
  },
  scroll: {
    flex: 1
  },
  bodyContent: {
    flexGrow: 1,
    padding: 10,
    paddingBottom: 18
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "stretch"
  },
  rangeStack: {
    gap: 10
  },
  controlItemFull: {
    width: "100%"
  },
  controlItem50: {
    flexBasis: "49%",
    maxWidth: "49%"
  },
  controlItem25: {
    flexBasis: "24%",
    maxWidth: "24%"
  },
  rangeItemFullWidth: {
    width: "100%",
    alignSelf: "stretch"
  },
  servoHint: {
    color: palette.accent,
    fontFamily: "monospace",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    opacity: 0.75,
    paddingTop: 4
  }
});
