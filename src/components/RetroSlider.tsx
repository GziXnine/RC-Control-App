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

export function RetroSlider({
  label,
  value,
  min,
  max,
  vertical = false,
  onChange,
  onDragStateChange,
  variant = "card",
  style
}: RetroSliderProps): React.JSX.Element {
  const [trackLength, setTrackLength] = useState(1);
  const valueRef = useRef(value);
  const trackLengthRef = useRef(1);
  const minRef = useRef(min);
  const spanRef = useRef(Math.max(1, max - min));
  const verticalRef = useRef(vertical);
  const onChangeRef = useRef(onChange);

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

  const updateFromLocation = (location: number): void => {
    const liveTrackLength = Math.max(1, trackLengthRef.current);
    if (liveTrackLength <= 2) {
      return;
    }

    const ratioRaw = verticalRef.current
      ? 1 - location / liveTrackLength
      : location / liveTrackLength;

    const ratio = clamp(ratioRaw, 0, 1);
    const next = Math.round(minRef.current + ratio * spanRef.current);
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
      onPanResponderGrant: (evt) => {
        onDragStateChange?.(true);
        const location = verticalRef.current
          ? evt.nativeEvent.locationY
          : evt.nativeEvent.locationX;
        updateFromLocation(location);
      },
      onPanResponderMove: (evt) => {
        const location = verticalRef.current
          ? evt.nativeEvent.locationY
          : evt.nativeEvent.locationX;
        updateFromLocation(location);
      },
      onPanResponderRelease: () => {
        onDragStateChange?.(false);
      },
      onPanResponderTerminate: () => {
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

  const ratio = valueToRatio(valueRef.current);
  const thumbOffset = clamp(ratio * trackLength, 0, trackLength);
  const isFlat = variant === "flat";

  return (
    <View style={[styles.wrapper, isFlat && styles.wrapperFlat, style]}>
      <Text style={[styles.label, isFlat && styles.labelFlat]}>{label}</Text>
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
                  height: thumbOffset,
                  bottom: 0,
                  left: 0,
                  right: 0
                }
              : {
                  width: thumbOffset,
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
                  bottom: thumbOffset - 16,
                  left: -9
                }
              : {
                  left: thumbOffset - 16,
                  top: -9
                }
          ]}
        />
      </View>
      <Text style={[styles.value, isFlat && styles.valueFlat]}>{valueRef.current}</Text>
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
  label: {
    fontFamily: "monospace",
    fontSize: 12,
    color: palette.textSecondary,
    marginBottom: 8
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
    width: 26,
    flex: 1,
    minHeight: 90
  },
  trackHorizontal: {
    height: 26,
    minWidth: 180,
    width: "100%"
  },
  fill: {
    position: "absolute",
    backgroundColor: palette.accent,
    opacity: 0.9
  },
  thumb: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.knob,
    borderWidth: 3,
    borderColor: palette.knobDark,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 4
  }
});
