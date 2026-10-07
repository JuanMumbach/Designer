import React, { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, View } from "react-native";
import { GLASS, RADII } from "@/constants/theme";
import GlassSurface from "./GlassSurface";

export default function BottomSheet({
  children,
  onClose,
  maxHeight,
}: {
  children: React.ReactNode;
  onClose: () => void;
  maxHeight: number;
}) {
  const translateY = useRef(new Animated.Value(maxHeight)).current;
  const [grabberVisible, setGrabberVisible] = useState(false);

  useEffect(() => {
    setGrabberVisible(true);
    Animated.timing(translateY, {
      toValue: 0,
      duration: 260,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [translateY]);

  return (
    <View style={styles.root}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <Animated.View style={[styles.sheetWrap, { transform: [{ translateY }] }]}>
        <GlassSurface style={[styles.sheet, { maxHeight }]}>
          {grabberVisible && <View style={styles.grabber} />}
          {children}
        </GlassSurface>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 150,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GLASS.scrim,
  },
  sheetWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    width: "100%",
    borderTopLeftRadius: RADII.sheet,
    borderTopRightRadius: RADII.sheet,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
    paddingTop: 8,
    paddingBottom: 24,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: GLASS.borderStrong,
    alignSelf: "center",
    marginBottom: 6,
  },
});
