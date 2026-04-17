import React, { useEffect, useMemo, useRef, useState } from "react";
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

interface RetroSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  vertical?: boolean;
  onChange: (value: number) => void;
  onDragStateChange?: (dragging: boolean) => void;
  variant?: "card" | "flat";
  style?: StyleProp<ViewStyle>;
  valuePlacement?: "below" | "header";
}

const TRACK_THICKNESS = 26;
const THUMB_SIZE = 36;
const THUMB_RADIUS = THUMB_SIZE / 2;
const THUMB_CROSS_OFFSET = Math.round((TRACK_THICKNESS - THUMB_SIZE) / 2);

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

export function RetroSlider({
  label,
  value,
  min,
  max,
  vertical = false,
  onChange,
  onDragStateChange,
  variant = "card",
  style,
  valuePlacement = "below"
}: RetroSliderProps): React.JSX.Element {
  const [trackLength, setTrackLength] = useState(1);
  const valueRef = useRef(value);
  const dragStartValueRef = useRef(value);
  const dragActivatedRef = useRef(false);
  const trackLengthRef = useRef(1);
  const minRef = useRef(min);
  const spanRef = useRef(Math.max(1, max - min));
  const verticalRef = useRef(vertical);
  const onChangeRef = useRef(onChange);
  const DRAG_ACTIVATION_PX = 4;

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    minRef.current = min;
    spanRef.current = Math.max(1, max - min);
    verticalRef.current = vertical;
    onChangeRef.current = onChange;
  }, [max, min, onChange, vertical]);

  const span = useMemo(() => Math.max(1, max - min), [max, min]);

  const valueToRatio = (input: number): number => {
    return clamp((input - min) / span, 0, 1);
  };

  const updateFromDelta = (deltaPx: number): void => {
    const liveTrackLength = Math.max(1, trackLengthRef.current);
    if (liveTrackLength <= 2) {
      return;
    }

    const liveTravel = Math.max(1, liveTrackLength - THUMB_SIZE);
    const ratioDelta = deltaPx / liveTravel;
    const spanValue = spanRef.current;
    const next = clamp(
      Math.round(dragStartValueRef.current + ratioDelta * spanValue),
      minRef.current,
      minRef.current + spanValue,
    );

    if (next !== valueRef.current) {
      valueRef.current = next;
      onChangeRef.current(next);
    }
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        onDragStateChange?.(true);
        dragStartValueRef.current = valueRef.current;
        dragActivatedRef.current = false;
      },
      onPanResponderMove: (_, gestureState) => {
        const deltaPx = verticalRef.current ? -gestureState.dy : gestureState.dx;
        if (!dragActivatedRef.current) {
          if (Math.abs(deltaPx) < DRAG_ACTIVATION_PX) {
            return;
          }

          dragActivatedRef.current = true;
        }

        updateFromDelta(deltaPx);
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

  const onTrackLayout = (event: LayoutChangeEvent): void => {
    const length = vertical
      ? event.nativeEvent.layout.height
      : event.nativeEvent.layout.width;
    const safeLength = Math.max(1, length);
    trackLengthRef.current = safeLength;
    setTrackLength(safeLength);
  };

  const ratio = valueToRatio(value);
  const thumbTravel = Math.max(0, trackLength - THUMB_SIZE);
  const thumbOffset = clamp(ratio * thumbTravel, 0, thumbTravel);
  const fillOffset = clamp(thumbOffset + THUMB_RADIUS, 0, trackLength);
  const isFlat = variant === "flat";
  const showHeaderValue = valuePlacement === "header";

  return (
    <View style={[styles.wrapper, isFlat && styles.wrapperFlat, style]}>
      {showHeaderValue ? (
        <View style={[styles.headerRow, isFlat && styles.headerRowFlat]}>
          <Text style={[styles.label, isFlat && styles.labelFlat, styles.labelHeader]}>{label}</Text>
          <Text style={[styles.value, isFlat && styles.valueFlat, styles.valueHeader]}>{value}</Text>
        </View>
      ) : (
        <Text style={[styles.label, isFlat && styles.labelFlat]}>{label}</Text>
      )}
      <View
        style={[
          styles.track,
          vertical ? styles.trackVertical : styles.trackHorizontal,
          isFlat && styles.trackFlat
        ]}
        onLayout={onTrackLayout}
        {...responder.panHandlers}
      >
        <View
          style={[
            styles.fill,
            vertical
              ? {
                height: fillOffset,
                bottom: 0,
                left: 0,
                right: 0
              }
              : {
                width: fillOffset,
                top: 0,
                bottom: 0,
                left: 0
              }
          ]}
        />
        <View
          style={[
            styles.thumb,
            vertical
              ? {
                bottom: thumbOffset - 2,
                left: THUMB_CROSS_OFFSET - 2
              }
              : {
                left: thumbOffset - 2,
                top: THUMB_CROSS_OFFSET - 3
              }
          ]}
        />
      </View>
      {!showHeaderValue ? (
        <Text style={[styles.value, isFlat && styles.valueFlat]}>{value}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: palette.panelInset,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: palette.frameBorder,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "space-between",
    minWidth: 0
  },
  wrapperFlat: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderRadius: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    justifyContent: "flex-start"
  },
  headerRow: {
    width: "96%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8
  },
  headerRowFlat: {
    marginBottom: 6
  },
  label: {
    fontFamily: "monospace",
    fontSize: 12,
    color: palette.textSecondary,
    marginBottom: 8
  },
  labelHeader: {
    marginBottom: 0,
    textAlign: "left"
  },
  labelFlat: {
    marginBottom: 6,
    textAlign: "center"
  },
  value: {
    fontFamily: "monospace",
    fontSize: 15,
    color: palette.textPrimary,
    marginTop: 8
  },
  valueFlat: {
    marginTop: 6,
    textAlign: "center"
  },
  valueHeader: {
    marginTop: 0,
    textAlign: "right"
  },
  track: {
    borderRadius: 10,
    borderWidth: 2,
    borderColor: palette.knobDark,
    backgroundColor: "#191f23",
    overflow: "visible"
  },
  trackFlat: {
    backgroundColor: "#131b21"
  },
  trackVertical: {
    width: TRACK_THICKNESS,
    flex: 1,
    minHeight: 90
  },
  trackHorizontal: {
    height: TRACK_THICKNESS,
    minWidth: 180,
    width: "97%"
  },
  fill: {
    position: "absolute",
    backgroundColor: palette.accent,
    borderRadius: 8,
    opacity: 0.9
  },
  thumb: {
    position: "absolute",
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_RADIUS,
    backgroundColor: palette.knob,
    borderWidth: 3,
    borderColor: palette.knobDark,
    elevation: 4
  }
});
