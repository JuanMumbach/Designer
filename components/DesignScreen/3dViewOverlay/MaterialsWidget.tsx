import { COLORS, GLASS, RADII } from "@/constants/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, ViewProps } from "react-native";
import { MaterialMeta } from "../../../services/api";
import { DesignMaterialSlot } from "../../../services/designMaterialDefaults";
import { ActiveHandleUsage, HandleTypeOption } from "../../../services/variants";
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
  handleOptions = [],
  activeHandleUsages = [],
  defaultHandleType,
  onSelectDefaultHandleType,
  onReplaceHandleType,
  hasHandleInstanceOverrides = false,
  onClearHandleOverrides,
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
  handleOptions?: HandleTypeOption[];
  activeHandleUsages?: ActiveHandleUsage[];
  defaultHandleType?: string | null;
  onSelectDefaultHandleType?: (handleType: string | null) => void;
  onReplaceHandleType?: (sourceHandleKey: string, targetHandleKey: string) => void;
  hasHandleInstanceOverrides?: boolean;
  onClearHandleOverrides?: () => void;
  compact?: boolean;
}) {
  const [replacingHandleKey, setReplacingHandleKey] = useState<string | null>(null);
  const resolved = useMemo(() => resolveGlobalMaterials(globalMaterials), [globalMaterials]);

  useEffect(() => {
    if (!replacingHandleKey) return;
    if (!activeHandleUsages.some((u) => u.key === replacingHandleKey)) {
      setReplacingHandleKey(null);
    }
  }, [activeHandleUsages, replacingHandleKey]);

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

  const activeHandleLabel = useMemo(() => {
    if (activeHandleUsages.length > 1) {
      return activeHandleUsages.map((u) => u.label).join(", ");
    }
    if (activeHandleUsages.length === 1) {
      return activeHandleUsages[0].label;
    }
    return "No handles in design";
  }, [activeHandleUsages]);

  return (
    <GlassSurface style={styles.widget}>
      <Pressable
        style={({ pressed }) => [styles.headerRow, pressed && styles.rowPressed]}
        onPress={onToggleExpanded}
      >
        <Text style={styles.headerText}>Materials & Handles</Text>
        <Text style={styles.chevron}>{expanded ? "▴" : "▾"}</Text>
      </Pressable>
      <View style={styles.divider} />

      {expanded ? (
        <View style={styles.body}>
          {designSlots.map(slot => renderCard(slot, rowSize, true))}
          <View style={styles.sectionDivider} />
          <View style={styles.handlesSection}>
            <View style={styles.handlesHeader}>
              <Text style={styles.handlesTitle}>Handles</Text>
              <Text style={styles.handlesSummary} numberOfLines={1}>
                {activeHandleLabel}
              </Text>
            </View>
            {activeHandleUsages.length > 0 && onReplaceHandleType ? (
              <View style={styles.inUseContainer}>
                <View style={styles.inUseList}>
                  {activeHandleUsages.map((usage) => {
                    const isReplacing = replacingHandleKey === usage.key;
                    return (
                      <View key={usage.key} style={styles.inUseItemWrap}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.inUseRow,
                            isReplacing && styles.inUseRowActive,
                            pressed && styles.rowPressed,
                          ]}
                          onPress={() =>
                            setReplacingHandleKey((prev) =>
                              prev === usage.key ? null : usage.key
                            )
                          }
                        >
                          <View style={styles.inUseInfo}>
                            <Text style={styles.inUseLabel} numberOfLines={1}>
                              {usage.label}
                            </Text>
                            <View style={styles.inUseCountBadge}>
                              <Text style={styles.inUseCountText}>{usage.count}</Text>
                            </View>
                          </View>
                          <View style={styles.inUseAction}>
                            <Ionicons
                              name="swap-horizontal-outline"
                              size={13}
                              color={isReplacing ? COLORS.primary : GLASS.textMuted}
                            />
                            <Text
                              style={[
                                styles.inUseActionText,
                                isReplacing && styles.inUseActionTextActive,
                              ]}
                            >
                              {isReplacing ? "Cancel" : "Replace"}
                            </Text>
                          </View>
                        </Pressable>
                        {isReplacing && (
                          <View style={styles.replacePickerBox}>
                            <Text style={styles.replacePromptText} numberOfLines={1}>
                              Replace {usage.label} with:
                            </Text>
                            <View style={styles.handlesChips}>
                              {handleOptions.map((opt) => {
                                const isCurrent = opt.key === usage.key;
                                return (
                                  <Pressable
                                    key={opt.key}
                                    style={({ pressed }) => [
                                      styles.handleChip,
                                      isCurrent && styles.handleChipActive,
                                      pressed && styles.rowPressed,
                                    ]}
                                    onPress={() => {
                                      if (!isCurrent) {
                                        onReplaceHandleType(usage.key, opt.key);
                                      }
                                      setReplacingHandleKey(null);
                                    }}
                                  >
                                    <Text
                                      style={[
                                        styles.handleChipText,
                                        isCurrent && styles.handleChipTextActive,
                                      ]}
                                      numberOfLines={1}
                                    >
                                      {opt.label}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : (
              <Text style={styles.handlesEmptyText}>
                No handle variants found in modules
              </Text>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.body}>
          {mainSlot && renderCard(mainSlot, collapsedSize, false)}
          <Pressable
            style={({ pressed }) => [
              styles.previewRow,
              { height: collapsedSize + 6 },
              pressed && styles.rowPressed,
            ]}
            onPress={onToggleExpanded}
          >
            <View style={[styles.thumb, styles.thumbFallback, { width: collapsedSize, height: collapsedSize }]}>
              <Ionicons name="options-outline" size={Math.round(collapsedSize * 0.45)} color={GLASS.textMuted} />
            </View>
            <View style={styles.info}>
              <Text style={styles.slotLabel} numberOfLines={1}>Handles</Text>
              <Text style={styles.materialLabel} numberOfLines={1}>{activeHandleLabel}</Text>
            </View>
          </Pressable>
        </View>
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
  sectionDivider: {
    height: 1,
    backgroundColor: GLASS.border,
    marginVertical: 6,
    marginHorizontal: 4,
  },
  handlesSection: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 8,
  },
  handlesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  handlesTitle: {
    color: GLASS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  handlesSummary: {
    color: GLASS.textMuted,
    fontSize: 11,
    flexShrink: 1,
  },
  handlesEmptyText: {
    color: GLASS.textFaint,
    fontSize: 11,
    fontStyle: "italic",
  },
  subSectionLabel: {
    color: GLASS.textMuted,
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  inUseContainer: {
    gap: 5,
  },
  inUseList: {
    gap: 4,
  },
  inUseItemWrap: {
    gap: 4,
  },
  inUseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: RADII.sm,
    borderWidth: 1,
    borderColor: GLASS.border,
    backgroundColor: GLASS.bgInput,
    gap: 6,
  },
  inUseRowActive: {
    borderColor: COLORS.primary,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
  },
  inUseInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  inUseLabel: {
    color: GLASS.text,
    fontSize: 11,
    fontWeight: "600",
    flexShrink: 1,
  },
  inUseCountBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: GLASS.bgPressed,
    borderWidth: 1,
    borderColor: GLASS.borderStrong,
  },
  inUseCountText: {
    color: GLASS.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  inUseAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  inUseActionText: {
    color: GLASS.textMuted,
    fontSize: 10,
    fontWeight: "600",
  },
  inUseActionTextActive: {
    color: COLORS.primary,
    fontWeight: "700",
  },
  replacePickerBox: {
    padding: 7,
    borderRadius: RADII.sm,
    backgroundColor: GLASS.bgPressed,
    borderWidth: 1,
    borderColor: GLASS.borderStrong,
    gap: 6,
  },
  replacePromptText: {
    color: GLASS.textMuted,
    fontSize: 10,
    fontWeight: "600",
  },
  defaultHandlesBlock: {
    gap: 5,
  },
  handlesChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  handleChip: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: RADII.sm,
    borderWidth: 1,
    borderColor: GLASS.border,
    backgroundColor: GLASS.bgInput,
  },
  handleChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: "rgba(37, 99, 235, 0.15)",
  },
  handleChipText: {
    color: GLASS.text,
    fontSize: 11,
    fontWeight: "500",
  },
  handleChipTextActive: {
    color: COLORS.primary,
    fontWeight: "700",
  },
  clearOverridesButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADII.sm,
    backgroundColor: "rgba(37, 99, 235, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.25)",
  },
  clearOverridesText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "600",
  },
});
