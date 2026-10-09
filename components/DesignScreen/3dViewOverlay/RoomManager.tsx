import React from "react";
import { Pressable, StyleProp, StyleSheet, Text, TextInput, View, ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Button from "../../Button";
import { Room3dProps } from "../3dView/Room3d";
import { COLORS, GLASS, RADII } from "@/constants/theme";
import GlassSurface from "./GlassSurface";

interface RoomManagerProps {
  room3dProps: Room3dProps;
  setRoom3d: React.Dispatch<React.SetStateAction<Room3dProps>>;
  onClose: () => void;
  containerStyle?: StyleProp<ViewStyle>;
}

export default function RoomManager({
  room3dProps,
  setRoom3d,
  onClose,
  containerStyle,
}: RoomManagerProps) {
  const handleUpdateRoom = (key: keyof Room3dProps, value: string) => {
    const numericValue = parseFloat(value);
    if (isNaN(numericValue) || numericValue <= 0) return;

    setRoom3d(prevRoom => ({
      ...prevRoom,
      [key]: numericValue,
    }));
  };

  const stepDimension = (key: "width" | "height" | "depth", delta: number) => {
    setRoom3d(prevRoom => {
      const current = prevRoom[key];
      const next = Math.max(1, Math.round((current + delta) * 10) / 10);
      return {
        ...prevRoom,
        [key]: next,
      };
    });
  };

  const toggleWall = (key: "leftWall" | "rightWall") => {
    setRoom3d(prevRoom => ({
      ...prevRoom,
      [key]: !prevRoom[key],
    }));
  };

  return (
    <GlassSurface style={[styles.container, containerStyle]}>
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Room Dimensions</Text>
          <Text style={styles.headerSubtitle}>Floor & walls size</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.closeBtn, pressed && styles.itemPressed]}
          onPress={onClose}
        >
          <Ionicons name="close" size={18} color={GLASS.textMuted} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text style={styles.sectionTitle}>Dimensions (m)</Text>
        <View style={styles.coordsRow}>
          {/* Width */}
          <View style={styles.coordCol}>
            <View style={styles.coordHeader}>
              <View style={[styles.axisBadge, styles.badgeW]}>
                <Text style={styles.axisBadgeText}>W</Text>
              </View>
              <View style={styles.stepperWrap}>
                <Pressable
                  style={({ pressed }) => [styles.stepperBtn, pressed && styles.stepperBtnPressed]}
                  onPress={() => stepDimension("width", -0.5)}
                  hitSlop={4}
                >
                  <Text style={styles.stepperText}>−</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.stepperBtn, pressed && styles.stepperBtnPressed]}
                  onPress={() => stepDimension("width", 0.5)}
                  hitSlop={4}
                >
                  <Text style={styles.stepperText}>+</Text>
                </Pressable>
              </View>
            </View>
            <TextInput
              keyboardType="numeric"
              placeholder="5.0"
              placeholderTextColor={GLASS.textFaint}
              onChangeText={text => handleUpdateRoom("width", text)}
              value={room3dProps.width.toString()}
              style={styles.coordInput}
            />
          </View>

          {/* Height */}
          <View style={styles.coordCol}>
            <View style={styles.coordHeader}>
              <View style={[styles.axisBadge, styles.badgeH]}>
                <Text style={styles.axisBadgeText}>H</Text>
              </View>
              <View style={styles.stepperWrap}>
                <Pressable
                  style={({ pressed }) => [styles.stepperBtn, pressed && styles.stepperBtnPressed]}
                  onPress={() => stepDimension("height", -0.5)}
                  hitSlop={4}
                >
                  <Text style={styles.stepperText}>−</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.stepperBtn, pressed && styles.stepperBtnPressed]}
                  onPress={() => stepDimension("height", 0.5)}
                  hitSlop={4}
                >
                  <Text style={styles.stepperText}>+</Text>
                </Pressable>
              </View>
            </View>
            <TextInput
              keyboardType="numeric"
              placeholder="2.8"
              placeholderTextColor={GLASS.textFaint}
              onChangeText={text => handleUpdateRoom("height", text)}
              value={room3dProps.height.toString()}
              style={styles.coordInput}
            />
          </View>

          {/* Depth */}
          <View style={styles.coordCol}>
            <View style={styles.coordHeader}>
              <View style={[styles.axisBadge, styles.badgeD]}>
                <Text style={styles.axisBadgeText}>D</Text>
              </View>
              <View style={styles.stepperWrap}>
                <Pressable
                  style={({ pressed }) => [styles.stepperBtn, pressed && styles.stepperBtnPressed]}
                  onPress={() => stepDimension("depth", -0.5)}
                  hitSlop={4}
                >
                  <Text style={styles.stepperText}>−</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.stepperBtn, pressed && styles.stepperBtnPressed]}
                  onPress={() => stepDimension("depth", 0.5)}
                  hitSlop={4}
                >
                  <Text style={styles.stepperText}>+</Text>
                </Pressable>
              </View>
            </View>
            <TextInput
              keyboardType="numeric"
              placeholder="4.0"
              placeholderTextColor={GLASS.textFaint}
              onChangeText={text => handleUpdateRoom("depth", text)}
              value={room3dProps.depth.toString()}
              style={styles.coordInput}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Side Walls</Text>
        <View style={styles.wallToggleRow}>
          <Pressable
            style={[styles.wallPill, room3dProps.leftWall && styles.wallPillActive]}
            onPress={() => toggleWall("leftWall")}
          >
            <Ionicons
              name={room3dProps.leftWall ? "checkmark-circle" : "ellipse-outline"}
              size={16}
              color={room3dProps.leftWall ? COLORS.primary : GLASS.textMuted}
            />
            <Text style={[styles.wallPillText, room3dProps.leftWall && styles.wallPillTextActive]}>
              Left Wall
            </Text>
          </Pressable>

          <Pressable
            style={[styles.wallPill, room3dProps.rightWall && styles.wallPillActive]}
            onPress={() => toggleWall("rightWall")}
          >
            <Ionicons
              name={room3dProps.rightWall ? "checkmark-circle" : "ellipse-outline"}
              size={16}
              color={room3dProps.rightWall ? COLORS.primary : GLASS.textMuted}
            />
            <Text style={[styles.wallPillText, room3dProps.rightWall && styles.wallPillTextActive]}>
              Right Wall
            </Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Button label="Done" onPress={onClose} />
        </View>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 320,
    borderRadius: RADII.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: GLASS.border,
    backgroundColor: GLASS.bgStrong,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: GLASS.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: GLASS.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: RADII.sm,
    backgroundColor: GLASS.bgInput,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    padding: 16,
  },
  sectionTitle: {
    marginBottom: 8,
    fontSize: 11,
    fontWeight: "700",
    color: GLASS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  coordsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  coordCol: {
    flex: 1,
    backgroundColor: GLASS.bgInput,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: GLASS.border,
    padding: 6,
  },
  coordHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  axisBadge: {
    width: 18,
    height: 18,
    borderRadius: RADII.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeW: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
  },
  badgeH: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
  },
  badgeD: {
    backgroundColor: "rgba(168, 85, 247, 0.15)",
  },
  axisBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: GLASS.text,
  },
  stepperWrap: {
    flexDirection: "row",
    gap: 3,
  },
  stepperBtn: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: GLASS.bgPressed,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnPressed: {
    backgroundColor: GLASS.borderStrong,
  },
  stepperText: {
    fontSize: 12,
    fontWeight: "700",
    color: GLASS.text,
    lineHeight: 14,
  },
  coordInput: {
    height: 32,
    paddingHorizontal: 4,
    fontSize: 13,
    fontWeight: "600",
    color: GLASS.text,
    textAlign: "center",
  },
  wallToggleRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  wallPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADII.md,
    backgroundColor: GLASS.bgInput,
    borderWidth: 1,
    borderColor: GLASS.border,
  },
  wallPillActive: {
    backgroundColor: "rgba(37, 99, 235, 0.10)",
    borderColor: COLORS.primary,
  },
  wallPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: GLASS.textMuted,
  },
  wallPillTextActive: {
    color: COLORS.primary,
    fontWeight: "700",
  },
  footer: {
    alignItems: "center",
    marginTop: 4,
  },
  itemPressed: {
    backgroundColor: GLASS.bgPressed,
  },
});