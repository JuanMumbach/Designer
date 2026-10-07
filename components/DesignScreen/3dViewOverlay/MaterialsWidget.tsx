import React, { useMemo } from "react";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GLASS, RADII } from "@/constants/theme";
import { GlobalMaterials, AppliedMaterial, resolveGlobalMaterials } from "../3dView/DesignObjects";
import { DesignMaterialSlot } from "../../../services/designMaterialDefaults";
import GlassSurface from "./GlassSurface";

function MaterialThumb({
  uri,
  label,
  size,
  editable,
  onPress,
}: {
  uri?: string;
  label: string;
  size: number;
  editable?: boolean;
  onPress?: () => void;
}) {
  const thumb = uri ? (
    <Image source={{ uri }} style={[styles.thumb, { width: size, height: size }]} contentFit="cover" transition={150} />
  ) : (
    <View style={[styles.thumb, styles.thumbFallback, { width: size, height: size }]}>
      <Text style={[styles.thumbFallbackText, { fontSize: size * 0.45 }]}>{label.charAt(0).toUpperCase()}</Text>
    </View>
  );

  if (!editable) return thumb;
  return <Pressable onPress={onPress}>{thumb}</Pressable>;
}

export default function MaterialsWidget({
  designSlots,
  globalMaterials,
  materialDataById,
  expanded,
  onToggle,
  compact = false,
}: {
  designSlots: DesignMaterialSlot[];
  globalMaterials: GlobalMaterials;
  materialDataById: Record<string, AppliedMaterial>;
  expanded: boolean;
  onToggle: (slotKey?: string) => void;
  compact?: boolean;
}) {
  const resolved = useMemo(() => resolveGlobalMaterials(globalMaterials), [globalMaterials]);

  const thumbUri = (slotKey: string): string | undefined => {
    const materialId = resolved[slotKey];
    if (!materialId) return undefined;
    return materialDataById[materialId]?.fileURL;
  };

  const thumbs = designSlots.map(slot => (
    <MaterialThumb
      key={slot.key}
      uri={thumbUri(slot.key)}
      label={slot.label}
      size={compact ? 24 : 30}
      editable={!compact}
      onPress={() => onToggle(slot.key)}
    />
  ));

  if (compact) {
    return (
      <Pressable onPress={() => onToggle()}>
        <GlassSurface style={styles.compactWidget}>
          {thumbs}
        </GlassSurface>
      </Pressable>
    );
  }

  return (
    <GlassSurface style={styles.widget}>
      <Pressable style={styles.labelRow} onPress={() => onToggle()}>
        <Text style={styles.labelText}>Materials</Text>
        <Text style={styles.chevron}>{expanded ? "▴" : "▾"}</Text>
      </Pressable>
      <View style={styles.divider} />
      <View style={styles.thumbRow}>
        {thumbs.slice(0, 2)}
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  widget: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADII.full,
    paddingVertical: 6,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  compactWidget: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: RADII.full,
    paddingVertical: 7,
    paddingHorizontal: 9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  labelText: {
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
    width: 1,
    height: 22,
    backgroundColor: GLASS.border,
    marginHorizontal: 10,
  },
  thumbRow: {
    flexDirection: "row",
    gap: 6,
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
