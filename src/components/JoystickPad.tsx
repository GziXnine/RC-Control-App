import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View
} from "react-native";

import { palette } from "../theme/palette";

interface JoystickPadProps {
  onMove: (x: number, y: number) => void;
  onRelease: () => void;
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

export function JoystickPad({ onMove, onRelease }: JoystickPadProps): React.JSX.Element {
  const [size, setSize] = useState(220);
  const knobOffset = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const useNativeDriver = Platform.OS !== "web";
  const onMoveRef = useRef(onMove);
  const onReleaseRef = useRef(onRelease);
  const latestStickRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const repeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    onMoveRef.current = onMove;
    onReleaseRef.current = onRelease;
  }, [onMove, onRelease]);

  const stopRepeat = (): void => {
    if (repeatTimerRef.current !== null) {
      clearInterval(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
  };

  const startRepeat = (): void => {
    if (repeatTimerRef.current !== null) {
      return;
    }

    repeatTimerRef.current = setInterval(() => {
      if (!draggingRef.current) {
        return;
      }

      const point = latestStickRef.current;
      onMoveRef.current(point.x, point.y);
    }, 20);
  };

  useEffect(() => {
    return () => {
      stopRepeat();
    };
  }, []);

  const geometry = useMemo(() => {
    const handleRadius = 30;
    const radius = Math.max(70, size * 0.5 - handleRadius - 10);
    return { radius, handleRadius };
  }, [size]);

  const processPoint = (dx: number, dy: number): void => {
    const distance = Math.sqrt(dx * dx + dy * dy);
    const clampRatio = distance > geometry.radius ? geometry.radius / distance : 1;

    const x = dx * clampRatio;
    const y = dy * clampRatio;

    knobOffset.setValue({ x, y });

    const normalizedX = clamp(x / geometry.radius, -1, 1);
    const normalizedY = clamp(-y / geometry.radius, -1, 1);
    latestStickRef.current = { x: normalizedX, y: normalizedY };
    onMoveRef.current(normalizedX, normalizedY);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        knobOffset.stopAnimation();
        draggingRef.current = true;
        latestStickRef.current = { x: 0, y: 0 };
        startRepeat();
      },
      onPanResponderMove: (_, gestureState) => {
        processPoint(gestureState.dx, gestureState.dy);
      },
      onPanResponderRelease: () => {
        draggingRef.current = false;
        stopRepeat();
        Animated.spring(knobOffset, {
          toValue: { x: 0, y: 0 },
          bounciness: 10,
          speed: 18,
          useNativeDriver
        }).start();
        onReleaseRef.current();
      },
      onPanResponderTerminate: () => {
        draggingRef.current = false;
        stopRepeat();
        Animated.spring(knobOffset, {
          toValue: { x: 0, y: 0 },
          bounciness: 8,
          speed: 16,
          useNativeDriver
        }).start();
        onReleaseRef.current();
      }
    })
  ).current;

  const onLayout = (event: LayoutChangeEvent): void => {
    const availableWidth = Math.max(0, event.nativeEvent.layout.width - 20);
    const availableHeight = Math.max(0, event.nativeEvent.layout.height - 56);
    const nextSize = Math.min(availableWidth, availableHeight);
    if (nextSize > 140) {
      setSize(nextSize);
    }
  };

  return (
    <View style={styles.wrapper} onLayout={onLayout}>
      <Text style={styles.title}>DRIVE STICK</Text>
      <View style={[styles.pad, { width: size, height: size }]} {...panResponder.panHandlers}>
        <View style={[styles.ring, { width: size - 12, height: size - 12, borderRadius: (size - 12) / 2 }]} />
        <View style={styles.crosshairHorizontal} />
        <View style={styles.crosshairVertical} />
        <Animated.View
          style={[
            styles.knob,
            {
              transform: [{ translateX: knobOffset.x }, { translateY: knobOffset.y }]
            }
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: palette.panelInset,
    borderWidth: 2,
    borderColor: palette.frameBorder,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    overflow: "hidden"
  },
  title: {
    color: palette.textSecondary,
    fontFamily: "monospace",
    marginBottom: 10,
    fontSize: 13
  },
  pad: {
    borderRadius: 999,
    borderWidth: 3,
    borderColor: palette.knobDark,
    backgroundColor: "#20252b",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  ring: {
    position: "absolute",
    borderWidth: 2,
    borderColor: palette.frameBorder,
    opacity: 0.45
  },
  crosshairHorizontal: {
    position: "absolute",
    width: "100%",
    height: 2,
    backgroundColor: palette.frameBorder,
    opacity: 0.4
  },
  crosshairVertical: {
    position: "absolute",
    height: "100%",
    width: 2,
    backgroundColor: palette.frameBorder,
    opacity: 0.4
  },
  knob: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: palette.knob,
    borderWidth: 4,
    borderColor: palette.knobDark,
    elevation: 5
  }
});
