import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import React from "react";
import { StyleSheet, View } from "react-native";
import { COLORS, RADII } from "../constants/theme";

export default function Thumbnail({
  uri,
  size = 40,
  icon = "image-outline",
  radius = RADII.sm,
}: {
  uri?: string | null;
  size?: number;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  radius?: number;
}) {
  const shape = { width: size, height: size, borderRadius: radius };
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={shape}
        contentFit="cover"
        transition={150}
      />
    );
  }
  return (
    <View style={[styles.placeholder, shape]}>
      <Ionicons name={icon} size={size * 0.5} color={COLORS.textFaint} />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: COLORS.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
});