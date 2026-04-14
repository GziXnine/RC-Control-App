import React, { useEffect, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  PanResponder,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle
} from "react-native";

import { palette } from "../theme/palette";

interface DualRangeBarProps {
  label: string;
  min: number;
  max: number;
  lowValue: number;
  highValue: number;
  onChange: (nextLow: number, nextHigh: number) => void;
  onDragStateChange?: (dragging: boolean) => void;
  variant?: "card" | "flat";
  style?: StyleProp<ViewStyle>;
  valuePlacement?: "below" | "header";
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

export function DualRangeBar({
  label,
  min,
  max,
  lowValue,
  highValue,
  onChange,
  onDragStateChange,
  variant = "card",
  style,
  valuePlacement = "below"
}: DualRangeBarProps): React.JSX.Element {
  const [trackWidth, setTrackWidth] = useState(1);
  const activeThumbRef = useRef<"low" | "high">("low");
  const dragStartLowRef = useRef(lowValue);
  const dragStartHighRef = useRef(highValue);
  const dragActivatedRef = useRef(false);
  const trackWidthRef = useRef(1);
  const minRef = useRef(min);
  const maxRef = useRef(max);
  const lowRef = useRef(lowValue);
  const highRef = useRef(highValue);
  const spanRef = useRef(Math.max(1, max - min));
  const onChangeRef = useRef(onChange);
  const DRAG_ACTIVATION_PX = 4;

  useEffect(() => {
    minRef.current = min;
    maxRef.current = max;
    lowRef.current = lowValue;
    highRef.current = highValue;
    spanRef.current = Math.max(1, max - min);
    onChangeRef.current = onChange;
  }, [highValue, lowValue, max, min, onChange]);

  const span = Math.max(1, max - min);

  const toRatio = (value: number): number => clamp((value - min) / span, 0, 1);

  const lowRatio = toRatio(lowValue);
  const highRatio = toRatio(highValue);

  const onLayout = (event: LayoutChangeEvent): void => {
    const safeWidth = Math.max(1, event.nativeEvent.layout.width);
    trackWidthRef.current = safeWidth;
    setTrackWidth(safeWidth);
  };

  const updateValue = (deltaX: number): void => {
    if (trackWidthRef.current <= 2) {
      return;
    }

    const nextDelta = Math.round((deltaX / trackWidthRef.current) * spanRef.current);
    if (activeThumbRef.current === "low") {
      const nextLow = clamp(
        dragStartLowRef.current + nextDelta,
        minRef.current,
        dragStartHighRef.current,
      );
      onChangeRef.current(nextLow, dragStartHighRef.current);
    } else {
      const nextHigh = clamp(
        dragStartHighRef.current + nextDelta,
        dragStartLowRef.current,
        maxRef.current,
      );
      onChangeRef.current(dragStartLowRef.current, nextHigh);
    }
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        onDragStateChange?.(true);
        dragActivatedRef.current = false;
        dragStartLowRef.current = lowRef.current;
        dragStartHighRef.current = highRef.current;
        const locationX = evt.nativeEvent.locationX;
        const liveTrackWidth = Math.max(1, trackWidthRef.current);
        const liveSpan = Math.max(1, spanRef.current);
        const lowX = ((lowRef.current - minRef.current) / liveSpan) * liveTrackWidth;
        const highX = ((highRef.current - minRef.current) / liveSpan) * liveTrackWidth;
        activeThumbRef.current = Math.abs(locationX - lowX) < Math.abs(locationX - highX) ? "low" : "high";
      },
      onPanResponderMove: (_, gestureState) => {
        if (!dragActivatedRef.current) {
          if (Math.abs(gestureState.dx) < DRAG_ACTIVATION_PX) {
            return;
          }

          dragActivatedRef.current = true;
        }

        updateValue(gestureState.dx);
      },
      onPanResponderRelease: () => {
        dragActivatedRef.current = false;
        onDragStateChange?.(false);
      },
      onPanResponderTerminate: () => {
        dragActivatedRef.current = false;
        onDragStateChange?.(false);
      }
    })
  ).current;

  const isFlat = variant === "flat";
  const showHeaderValue = valuePlacement === "header";

  return (
    <View style={[styles.wrapper, isFlat && styles.wrapperFlat, style]}>
      {showHeaderValue ? (
        <View style={[styles.headerRow, isFlat && styles.headerRowFlat]}>
          <Text style={[styles.label, isFlat && styles.labelFlat, styles.labelHeader]}>{label}</Text>
          <Text style={[styles.value, isFlat && styles.valueFlat, styles.valueHeader]}>{`${lowValue} - ${highValue}`}</Text>
        </View>
      ) : (
        <Text style={[styles.label, isFlat && styles.labelFlat]}>{label}</Text>
      )}
      <View style={[styles.track, isFlat && styles.trackFlat]} onLayout={onLayout} {...responder.panHandlers}>
        <View
          style={[
            styles.rangeFill,
            {
              left: lowRatio * trackWidth,
              width: Math.max(4, (highRatio - lowRatio) * trackWidth)
            }
          ]}
        />
        <View style={[styles.thumb, { left: lowRatio * trackWidth - 14 }]} />
        <View style={[styles.thumb, { left: highRatio * trackWidth - 14 }]} />
      </View>
      {!showHeaderValue ? (
        <Text style={[styles.value, isFlat && styles.valueFlat]}>{`${lowValue} - ${highValue}`}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderWidth: 2,
    borderColor: palette.frameBorder,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: palette.panelInset,
    gap: 8
  },
  wrapperFlat: {
    borderWidth: 0,
    backgroundColor: "transparent",
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 2
  },
  headerRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  headerRowFlat: {
    marginBottom: 2
  },
  label: {
    color: palette.textSecondary,
    fontFamily: "monospace",
    fontSize: 12
  },
  labelHeader: {
    textAlign: "left"
  },
  labelFlat: {
    marginBottom: 2
  },
  track: {
    height: 22,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: palette.knobDark,
    backgroundColor: "#191f23"
  },
  trackFlat: {
    backgroundColor: "#131b21"
  },
  rangeFill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: palette.accent,
    opacity: 0.9
  },
  thumb: {
    position: "absolute",
    top: -7,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.knob,
    borderWidth: 2,
    borderColor: palette.knobDark
  },
  value: {
    color: palette.textPrimary,
    fontFamily: "monospace",
    fontSize: 14,
    textAlign: "right"
  },
  valueFlat: {
    marginTop: 0
  },
  valueHeader: {
    marginTop: 0,
    textAlign: "right"
  }
});
