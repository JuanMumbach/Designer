import React from "react";
import { Pressable, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Button from "../../Button";
import { DesignObject } from "../3dView/DesignObjects";
import { COLORS, GLASS, RADII } from "@/constants/theme";
import GlassSurface from "./GlassSurface";

interface FurnitureInstancesManagerProps {
  furnitureInstances: DesignObject[];
  onFurnitureSelect: (object: DesignObject) => void;
  onClose: () => void;
  containerStyle?: StyleProp<ViewStyle>;
}

export default function FurnitureInstancesManager({
  furnitureInstances,
  onFurnitureSelect,
  onClose,
  containerStyle,
}: FurnitureInstancesManagerProps) {
  return (
    <GlassSurface style={[styles.container, containerStyle]}>
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Scene Objects</Text>
          <Text style={styles.headerCount}>
            {furnitureInstances.length} {furnitureInstances.length === 1 ? "module" : "modules"} in room
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.closeBtn, pressed && styles.itemPressed]}
          onPress={onClose}
        >
          <Ionicons name="close" size={18} color={GLASS.textMuted} />
        </Pressable>
      </View>

      <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollContent}>
        {furnitureInstances.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="cube-outline" size={36} color={GLASS.textFaint} />
            <Text style={styles.emptyText}>No objects in the room yet.</Text>
            <Text style={styles.emptySubtext}>Use &quot;+ Add Module&quot; to place furniture.</Text>
          </View>
        ) : (
          furnitureInstances.map((obj, index) => {
            const posX = obj.position?.[0]?.toFixed(2) ?? "0";
            const posY = obj.position?.[1]?.toFixed(2) ?? "0";
            const posZ = obj.position?.[2]?.toFixed(2) ?? "0";

            return (
              <Pressable
                key={obj.id || index}
                style={({ pressed }) => [styles.cardItem, pressed && styles.itemPressed]}
                onPress={() => onFurnitureSelect(obj)}
              >
                <View style={styles.cardIconWrap}>
                  <Ionicons name="cube-outline" size={20} color={COLORS.primary} />
                </View>
                <View style={styles.infoContainer}>
                  <Text style={styles.itemName} numberOfLines={1}>{obj.name}</Text>
                  <Text style={styles.itemMeta} numberOfLines={1}>
                    Pos: ({posX}, {posY}, {posZ})
                  </Text>
                  <View style={styles.badgesRow}>
                    <Text style={styles.badge}>
                      {obj.dimensions[0]} × {obj.dimensions[1]} × {obj.dimensions[2]} m
                    </Text>
                  </View>
                </View>

                <Pressable
                  style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}
                  onPress={() => onFurnitureSelect(obj)}
                >
                  <Text style={styles.editBtnText}>Edit</Text>
                </Pressable>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Done" onPress={onClose} />
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 320,
    maxHeight: "75%",
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
  headerCount: {
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
  scrollList: {
    maxHeight: 380,
  },
  scrollContent: {
    padding: 12,
    gap: 8,
  },
  cardItem: {
    backgroundColor: GLASS.bgInput,
    borderRadius: RADII.lg,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: GLASS.border,
    gap: 10,
  },
  cardIconWrap: {
    width: 34,
    height: 34,
    borderRadius: RADII.md,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  infoContainer: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "700",
    color: GLASS.text,
  },
  itemMeta: {
    fontSize: 11,
    color: GLASS.textMuted,
    marginTop: 1,
  },
  badgesRow: {
    flexDirection: "row",
    marginTop: 4,
  },
  badge: {
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: "600",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: RADII.sm,
    overflow: "hidden",
  },
  editBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.primary,
  },
  editBtnPressed: {
    backgroundColor: COLORS.primaryPressed,
  },
  editBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    gap: 6,
  },
  emptyText: {
    color: GLASS.text,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },
  emptySubtext: {
    color: GLASS.textMuted,
    fontSize: 12,
  },
  footer: {
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: GLASS.border,
    paddingVertical: 10,
    backgroundColor: GLASS.bgStrong,
  },
  itemPressed: {
    backgroundColor: GLASS.bgPressed,
  },
});
