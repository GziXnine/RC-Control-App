import "react-native-gesture-handler";

import { StatusBar } from "expo-status-bar";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ControlScreen } from "./src/screens/ControlScreen";

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" hidden />
      <ControlScreen />
    </SafeAreaProvider>
  );
}
