import { COLORS, GLASS, RADII } from "@/constants/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, ViewProps } from "react-native";
import { MaterialMeta } from "../../../services/api";
import { DesignMaterialSlot } from "../../../services/designMaterialDefaults";
import { AppliedMaterial, GlobalMaterials, resolveGlobalMaterials } from "../3dView/DesignObjects";
import GlassSurface from "./GlassSurface";

function MaterialThumb({
  uri,
  label,
  size,
}: {
  uri?: string;
  label: string;
  size: number;
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.thumb, { width: size, height: size }]}
        contentFit="cover"
        transition={150}
      />
    );
  }
  return (
    <View style={[styles.thumb, styles.thumbFallback, { width: size, height: size }]}>
      <Text style={[styles.thumbFallbackText, { fontSize: size * 0.4 }]}>{label.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

export default function MaterialsWidget({
  designSlots,
  globalMaterials,
  materialDataById,
  materials,
  expanded,
  onToggleExpanded,
  activeCardId,
  onCardActivate,
  onCardDismiss,
  onRequestPicker,
  onResetSlot,
  compact = false,
}: {
  designSlots: DesignMaterialSlot[];
  globalMaterials: GlobalMaterials;
  materialDataById: Record<string, AppliedMaterial>;
  materials: MaterialMeta[];
  expanded: boolean;
  onToggleExpanded: () => void;
  activeCardId: string | null;
  onCardActivate: (slotKey: string) => void;
  onCardDismiss: () => void;
  onRequestPicker: (slotKey: string) => void;
  onResetSlot: (slotKey: string) => void;
  compact?: boolean;
}) {
  const resolved = useMemo(() => resolveGlobalMaterials(globalMaterials), [globalMaterials]);

  const thumbUri = (slotKey: string): string | undefined => {
    const materialId = resolved[slotKey];
    if (!materialId) return undefined;
    return materialDataById[materialId]?.fileURL;
  };

  const materialName = (slotKey: string): string => {
    const materialId = resolved[slotKey];
    if (!materialId) return "Default";
    return materials.find(m => m.id === materialId)?.name ?? "Default";
  };

  const webTooltip = (label: string) =>
    ({ ...({ title: label } as unknown as ViewProps), accessibilityLabel: label });

  const mainSlot = designSlots[0];
  const collapsedSize = compact ? 40 : 48;
  const rowSize = compact ? 30 : 36;

  const renderInfo = (slot: DesignMaterialSlot) => (
    <View style={styles.info}>
      <Text style={styles.slotLabel} numberOfLines={1}>{slot.label}</Text>
      <Text style={styles.materialLabel} numberOfLines={1}>{materialName(slot.key)}</Text>
    </View>
  );

  const renderCard = (slot: DesignMaterialSlot, size: number, interactive: boolean) => {
    const isActive = interactive && activeCardId === slot.key;
    const actionClusterWidth = size * 2 + 8;
    const fadeTail = 24;
    const fadeWidth = actionClusterWidth + fadeTail;
    const solidFraction = actionClusterWidth / fadeWidth;
    return (
      <Pressable
        key={slot.key}
        style={({ pressed }) => [
          styles.previewRow,
          { height: size + 12 },
          isActive && styles.previewRowActive,
          pressed && styles.rowPressed,
        ]}
        onPress={interactive ? (isActive ? onCardDismiss : () => onCardActivate(slot.key)) : onToggleExpanded}
      >
        {isActive ? (
          <Pressable onPress={onCardDismiss} style={styles.thumbPress}>
            <MaterialThumb uri={thumbUri(slot.key)} label={slot.label} size={size} />
          </Pressable>
        ) : (
          <MaterialThumb uri={thumbUri(slot.key)} label={slot.label} size={size} />
        )}
        {renderInfo(slot)}
        {isActive ? (
          <View style={styles.actionButtons} pointerEvents="box-none">
            <LinearGradient
              colors={[GLASS.bg, GLASS.bg, "rgba(255, 255, 255, 0)"]}
              locations={[0, solidFraction, 1]}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 0 }}
              style={[styles.actionFade, { width: fadeWidth }]}
              pointerEvents="none"
            />
            <Pressable
              style={({ pressed }) => [styles.iconButton, { width: size, height: size }, pressed && styles.iconButtonPressed]}
              onPress={() => onRequestPicker(slot.key)}
              {...webTooltip("Change material")}
            >
              <Ionicons name="create-outline" size={Math.round(size * 0.5)} color={GLASS.text} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.iconButton, { width: size, height: size }, pressed && styles.iconButtonPressed]}
              onPress={() => onResetSlot(slot.key)}
              {...webTooltip("Reset to default")}
            >
              <Ionicons name="arrow-undo-outline" size={Math.round(size * 0.5)} color={GLASS.text} />
            </Pressable>
          </View>
        ) : (
          interactive && <Text style={styles.rowChevron}>›</Text>
        )}
      </Pressable>
    );
  };

  return (
    <GlassSurface style={styles.widget}>
      <Pressable
        style={({ pressed }) => [styles.headerRow, pressed && styles.rowPressed]}
        onPress={onToggleExpanded}
      >
        <Text style={styles.headerText}>Materials</Text>
        <Text style={styles.chevron}>{expanded ? "▴" : "▾"}</Text>
      </Pressable>
      <View style={styles.divider} />

      {expanded ? (
        <View style={styles.body}>
          {designSlots.map(slot => renderCard(slot, rowSize, true))}
        </View>
      ) : (
        mainSlot && (
          <View style={styles.body}>
            {renderCard(mainSlot, collapsedSize, false)}
          </View>
        )
      )}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  widget: {
    width: 240,
    borderRadius: RADII.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  headerText: {
    color: GLASS.text,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  chevron: {
    color: GLASS.textMuted,
    fontSize: 12,
    marginLeft: 6,
  },
  divider: {
    height: 1,
    backgroundColor: GLASS.border,
  },
  body: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 2,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: RADII.md,
  },
  previewRowActive: {
    backgroundColor: GLASS.bgInput,
  },
  rowPressed: {
    backgroundColor: GLASS.bgPressed,
  },
  thumbPress: {
    borderRadius: RADII.sm,
  },
  actionButtons: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionFade: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
  },
  iconButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADII.sm,
    backgroundColor: GLASS.bgPressed,
    borderWidth: 1,
    borderColor: GLASS.borderStrong,
  },
  iconButtonPressed: {
    backgroundColor: GLASS.borderStrong,
  },
  info: {
    flex: 1,
  },
  slotLabel: {
    color: GLASS.text,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  materialLabel: {
    color: GLASS.textMuted,
    fontSize: 11,
  },
  rowChevron: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: "600",
  },
  thumb: {
    borderRadius: RADII.sm,
    borderWidth: 1,
    borderColor: GLASS.borderStrong,
    backgroundColor: GLASS.bgInput,
  },
  thumbFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  thumbFallbackText: {
    color: GLASS.textMuted,
    fontWeight: "700",
  },
});
