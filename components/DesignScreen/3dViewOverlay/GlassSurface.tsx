import React from "react";
import { BlurView } from "expo-blur";
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { GLASS } from "@/constants/theme";

export default function GlassSurface({
  children,
  style,
  blurIntensity = 45,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  blurIntensity?: number;
}) {
  if (Platform.OS === "web") {
    return (
      <View
        style={[
          styles.base,
          { backdropFilter: `blur(${GLASS.blur}px)` } as ViewStyle,
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <BlurView intensity={blurIntensity} tint="dark" style={[styles.base, style]}>
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: GLASS.bg,
    borderWidth: 1,
    borderColor: GLASS.border,
    overflow: "hidden",
  },
});
