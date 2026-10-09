import Button from "@/components/Button";
import { useCallback, useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput, View, ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { DesignObject, GlobalMaterials, MaterialOverrides, resolveGlobalMaterials } from "../3dView/DesignObjects";
import { MaterialCategory, MaterialMeta, MaterialData, ObjectMaterialType } from "../../../services/api";
import { MaterialSlotInfo } from "../../../services/materialSlots";
import { DesignMaterialSlot, designSlotByKey, isMaterialRef, normalizeTypeName } from "../../../services/designMaterialDefaults";
import MaterialPicker from "./MaterialPicker";
import { COLORS, GLASS, RADII } from "@/constants/theme";
import GlassSurface from "./GlassSurface";

export default function EditFurnitureInstanceMenu({
  object,
  onEditComplete,
  onDelete,
  onClose,
  materials,
  materialCategories,
  globalMaterials,
  designSlots,
  slotTypesByModel,
  typeToDesignSlot,
  containerStyle,
}: {
  object: DesignObject;
  onEditComplete: (id: string, updates: { name: string; position: [number, number, number]; materialOverrides?: MaterialOverrides }) => void;
  onDelete?: (id: string) => void;
  onClose?: () => void;
  materials: MaterialMeta[];
  materialCategories: MaterialCategory[];
  globalMaterials: GlobalMaterials;
  designSlots: DesignMaterialSlot[];
  slotTypesByModel: Record<string, ObjectMaterialType[]>;
  typeToDesignSlot: Record<string, string>;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const [name, onChangeName] = useState(object.name);
  const [positionX, setPositionX] = useState(object.position?.[0]?.toFixed(2) ?? "0.00");
  const [positionY, setPositionY] = useState(object.position?.[1]?.toFixed(2) ?? "0.00");
  const [positionZ, setPositionZ] = useState(object.position?.[2]?.toFixed(2) ?? "0.00");
  const [dirtyOverrides, setDirtyOverrides] = useState<Record<number, string>>(object.materialOverrides || {});
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const slotTypeRows: ObjectMaterialType[] = slotTypesByModel[`${object.modelId}:${object.version}`] ?? [];

  const slotList: MaterialSlotInfo[] = (() => {
    if (slotTypeRows.length > 0) {
      return slotTypeRows.map(t => ({
        slot: t.slot,
        displayName: t.displayName || `Slot ${t.slot}`,
      }));
    }
    return object.slots ?? [];
  })();

  const stepCoord = (setter: React.Dispatch<React.SetStateAction<string>>, delta: number) => {
    setter(prev => {
      const val = parseFloat(prev) || 0;
      return (Math.round((val + delta) * 100) / 100).toFixed(2);
    });
  };

  const handleSave = () => {
    onEditComplete(object.id, {
      name: name,
      position: [
        parseFloat(positionX) || 0,
        parseFloat(positionY) || 0,
        parseFloat(positionZ) || 0,
      ],
      materialOverrides: dirtyOverrides,
    });
  };

  const handleDelete = () => {
    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to delete this object?")) {
        if (onDelete) onDelete(object.id);
      }
    } else {
      Alert.alert("Delete Object", "Are you sure you want to delete this object?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            if (onDelete) onDelete(object.id);
          },
        },
      ]);
    }
  };

  const handleMaterialSelect = useCallback(async (_materialMeta: MaterialMeta, _materialData: MaterialData) => {
    const slot = editingSlot;
    if (slot === null || slot === undefined) return;
    setDirtyOverrides(prev => ({ ...prev, [slot]: _materialMeta.id }));
    setPickerOpen(false);
    setEditingSlot(null);
  }, [editingSlot]);

  const handleForceDesignSlot = (slot: number, designKey: string) => {
    setDirtyOverrides(prev => ({ ...prev, [slot]: `ref:${designKey}` }));
    setEditingSlot(null);
  };

  const handleResetSlot = (slot: number) => {
    setDirtyOverrides(prev => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
  };

  const getMaterialName = (materialId: string): string => {
    return materials.find(m => m.id === materialId)?.name ?? "Unknown";
  };

  const resolvedGlobals = useMemo(() => resolveGlobalMaterials(globalMaterials), [globalMaterials]);

  const getInheritedMaterialId = (slot: number, slotInfo: MaterialSlotInfo): { materialId: string; designKey?: string } | undefined => {
    const slotType = slotTypeRows.find(t => t.slot === slot);
    const typeName = slotType?.materialTypeName || slotType?.materialTypeId || "";
    const designKey = typeName ? typeToDesignSlot[normalizeTypeName(typeName)] : undefined;
    if (designKey) {
      const gid = resolvedGlobals[designKey];
      if (gid && !gid.startsWith("ref:")) return { materialId: gid, designKey };
    }
    const explicit = resolvedGlobals[slotInfo.displayName];
    if (explicit && !explicit.startsWith("ref:")) return { materialId: explicit };
    const sanitized = resolvedGlobals[slotInfo.displayName];
    return sanitized && !sanitized.startsWith("ref:") ? { materialId: sanitized } : undefined;
  };

  const describeSlot = (slotInfo: MaterialSlotInfo): string => {
    const override = dirtyOverrides[slotInfo.slot];
    if (override === undefined) {
      const inherited = getInheritedMaterialId(slotInfo.slot, slotInfo);
      if (inherited) {
        const designLabel = inherited.designKey ? designSlotByKey(designSlots, inherited.designKey)?.label : undefined;
        return designLabel
          ? `Inherited: ${designLabel} (${getMaterialName(inherited.materialId)})`
          : `Inherited: ${getMaterialName(inherited.materialId)}`;
      }
      return "Default";
    }
    if (isMaterialRef(override)) {
      const designKey = override.substring(4);
      const designLabel = designSlotByKey(designSlots, designKey)?.label ?? designKey;
      const targetId = resolvedGlobals[designKey];
      return targetId && !targetId.startsWith("ref:")
        ? `Forced: ${designLabel} (${getMaterialName(targetId)})`
        : `Forced: ${designLabel}`;
    }
    return `Custom: ${getMaterialName(override)}`;
  };

  if (pickerOpen && editingSlot !== null) {
    return (
      <MaterialPicker
        materials={materials}
        categories={materialCategories}
        onSelect={handleMaterialSelect}
        onClose={() => setPickerOpen(false)}
        containerStyle={containerStyle}
      />
    );
  }

  if (editingSlot !== null) {
    return (
      <GlassSurface style={[styles.container, containerStyle]}>
        <View style={styles.chooseHeader}>
          <Pressable style={styles.backButton} onPress={() => setEditingSlot(null)}>
            <Ionicons name="arrow-back" size={16} color={COLORS.primary} />
            <Text style={styles.backLabel}>Back</Text>
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Assign {slotList.find(s => s.slot === editingSlot)?.displayName || `Slot ${editingSlot}`}
          </Text>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>Design materials</Text>
          {designSlots.map(slot => {
            const isActive = dirtyOverrides[editingSlot] === `ref:${slot.key}`;
            const targetId = resolvedGlobals[slot.key];
            const summary = targetId && !targetId.startsWith("ref:") ? getMaterialName(targetId) : "Not set";
            return (
              <Pressable
                key={slot.key}
                style={[styles.designSlotItem, isActive && styles.designSlotItemActive]}
                onPress={() => handleForceDesignSlot(editingSlot, slot.key)}
              >
                <Text style={styles.designSlotLabel}>{slot.label}</Text>
                <Text style={styles.designSlotSummary}>{summary}</Text>
              </Pressable>
            );
          })}
          <Text style={styles.sectionTitle}>Custom</Text>
          <Pressable style={styles.browseButton} onPress={() => setPickerOpen(true)}>
            <Ionicons name="search" size={16} color={COLORS.primary} style={styles.browseIcon} />
            <Text style={styles.browseLabel}>Browse catalog…</Text>
          </Pressable>
        </ScrollView>
      </GlassSurface>
    );
  }

  return (
    <GlassSurface style={[styles.container, containerStyle]}>
      <View style={styles.menuHeader}>
        <View style={styles.menuHeaderInfo}>
          <Text style={styles.menuTitle}>Edit Module</Text>
          <Text style={styles.menuSubtitle} numberOfLines={1}>{object.name}</Text>
        </View>
        {onClose && (
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={18} color={GLASS.textMuted} />
          </Pressable>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          onChangeText={onChangeName}
          value={name}
          placeholder={object.name}
          placeholderTextColor={GLASS.textFaint}
        />

        <Text style={styles.sectionTitle}>Coordinates (m)</Text>
        <View style={styles.coordsRow}>
          {/* Coordinate X */}
          <View style={styles.coordCol}>
            <View style={styles.coordHeader}>
              <View style={[styles.axisBadge, styles.axisBadgeX]}>
                <Text style={styles.axisBadgeText}>X</Text>
              </View>
              <View style={styles.stepperWrap}>
                <Pressable
                  style={({ pressed }) => [styles.stepperBtn, pressed && styles.stepperBtnPressed]}
                  onPress={() => stepCoord(setPositionX, -0.05)}
                  hitSlop={4}
                >
                  <Text style={styles.stepperText}>−</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.stepperBtn, pressed && styles.stepperBtnPressed]}
                  onPress={() => stepCoord(setPositionX, 0.05)}
                  hitSlop={4}
                >
                  <Text style={styles.stepperText}>+</Text>
                </Pressable>
              </View>
            </View>
            <TextInput
              style={styles.coordInput}
              onChangeText={setPositionX}
              value={positionX}
              keyboardType="numeric"
            />
          </View>

          {/* Coordinate Y */}
          <View style={styles.coordCol}>
            <View style={styles.coordHeader}>
              <View style={[styles.axisBadge, styles.axisBadgeY]}>
                <Text style={styles.axisBadgeText}>Y</Text>
              </View>
              <View style={styles.stepperWrap}>
                <Pressable
                  style={({ pressed }) => [styles.stepperBtn, pressed && styles.stepperBtnPressed]}
                  onPress={() => stepCoord(setPositionY, -0.05)}
                  hitSlop={4}
                >
                  <Text style={styles.stepperText}>−</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.stepperBtn, pressed && styles.stepperBtnPressed]}
                  onPress={() => stepCoord(setPositionY, 0.05)}
                  hitSlop={4}
                >
                  <Text style={styles.stepperText}>+</Text>
                </Pressable>
              </View>
            </View>
            <TextInput
              style={styles.coordInput}
              onChangeText={setPositionY}
              value={positionY}
              keyboardType="numeric"
            />
          </View>

          {/* Coordinate Z */}
          <View style={styles.coordCol}>
            <View style={styles.coordHeader}>
              <View style={[styles.axisBadge, styles.axisBadgeZ]}>
                <Text style={styles.axisBadgeText}>Z</Text>
              </View>
              <View style={styles.stepperWrap}>
                <Pressable
                  style={({ pressed }) => [styles.stepperBtn, pressed && styles.stepperBtnPressed]}
                  onPress={() => stepCoord(setPositionZ, -0.05)}
                  hitSlop={4}
                >
                  <Text style={styles.stepperText}>−</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.stepperBtn, pressed && styles.stepperBtnPressed]}
                  onPress={() => stepCoord(setPositionZ, 0.05)}
                  hitSlop={4}
                >
                  <Text style={styles.stepperText}>+</Text>
                </Pressable>
              </View>
            </View>
            <TextInput
              style={styles.coordInput}
              onChangeText={setPositionZ}
              value={positionZ}
              keyboardType="numeric"
            />
          </View>
        </View>

        {slotList.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Textures</Text>
            {slotList.map(slotInfo => {
              const hasOverride = dirtyOverrides[slotInfo.slot] !== undefined;
              return (
                <View key={slotInfo.slot} style={styles.textureRow}>
                  <View style={styles.textureInfo}>
                    <Text style={styles.textureMeshName} numberOfLines={1}>
                      {slotInfo.displayName || `Slot ${slotInfo.slot}`}
                    </Text>
                    <Text style={styles.textureStatus} numberOfLines={1}>
                      {describeSlot(slotInfo)}
                    </Text>
                  </View>
                  <View style={styles.textureActions}>
                    <Pressable
                      style={({ pressed }) => [styles.textureButton, pressed && styles.itemPressed]}
                      onPress={() => setEditingSlot(slotInfo.slot)}
                    >
                      <Text style={styles.textureButtonLabel}>Change</Text>
                    </Pressable>
                    {hasOverride && (
                      <Pressable
                        style={({ pressed }) => [styles.textureResetButton, pressed && styles.itemPressed]}
                        onPress={() => handleResetSlot(slotInfo.slot)}
                      >
                        <Text style={styles.textureResetLabel}>Reset</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}

        {slotList.length === 0 && (
          <Text style={styles.discoveringText}>Discovering textures...</Text>
        )}

        <View style={styles.actionRow}>
          <Button label="Save Changes" onPress={handleSave} />
        </View>

        <Pressable
          style={({ pressed }) => [styles.deleteButton, pressed && styles.deleteButtonPressed]}
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={16} color={COLORS.dangerStrong} />
          <Text style={styles.deleteButtonLabel}>Delete Object</Text>
        </Pressable>
      </ScrollView>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 320,
    maxHeight: "100%",
    borderRadius: RADII.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
    overflow: "hidden",
  },
  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: GLASS.border,
    backgroundColor: GLASS.bgStrong,
  },
  menuHeaderInfo: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: GLASS.text,
  },
  menuSubtitle: {
    fontSize: 12,
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
  scroll: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  label: {
    marginBottom: 6,
    fontSize: 11,
    fontWeight: "700",
    color: GLASS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    height: 40,
    borderColor: GLASS.border,
    borderWidth: 1,
    borderRadius: RADII.md,
    paddingHorizontal: 12,
    marginBottom: 14,
    backgroundColor: GLASS.bgInput,
    fontSize: 14,
    color: GLASS.text,
  },
  sectionTitle: {
    marginTop: 6,
    marginBottom: 10,
    fontSize: 11,
    fontWeight: "700",
    color: GLASS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  coordsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
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
  axisBadgeX: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  axisBadgeY: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
  },
  axisBadgeZ: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
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
  textureRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GLASS.bgInput,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADII.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: GLASS.border,
  },
  textureInfo: {
    flex: 1,
    marginRight: 8,
  },
  textureMeshName: {
    fontSize: 13,
    fontWeight: "600",
    color: GLASS.text,
    marginBottom: 2,
  },
  textureStatus: {
    fontSize: 11,
    color: GLASS.textMuted,
  },
  textureActions: {
    flexDirection: "row",
    gap: 6,
  },
  textureButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.primary,
  },
  textureButtonLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.white,
  },
  textureResetButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: RADII.sm,
    backgroundColor: GLASS.bgPressed,
    borderWidth: 1,
    borderColor: GLASS.borderStrong,
  },
  textureResetLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: GLASS.text,
  },
  discoveringText: {
    marginVertical: 10,
    fontStyle: "italic",
    color: GLASS.textFaint,
    fontSize: 13,
    textAlign: "center",
  },
  actionRow: {
    marginTop: 10,
    alignItems: "center",
  },
  deleteButton: {
    flexDirection: "row",
    gap: 6,
    borderRadius: RADII.md,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    backgroundColor: "rgba(220, 38, 38, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.25)",
  },
  deleteButtonPressed: {
    backgroundColor: "rgba(220, 38, 38, 0.16)",
  },
  deleteButtonLabel: {
    color: COLORS.dangerStrong,
    fontSize: 13,
    fontWeight: "600",
  },
  chooseHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: GLASS.border,
    backgroundColor: GLASS.bgStrong,
    gap: 8,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  backLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primary,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    color: GLASS.text,
    marginRight: 32,
  },
  designSlotItem: {
    backgroundColor: GLASS.bgInput,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADII.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: GLASS.border,
  },
  designSlotItemActive: {
    borderColor: COLORS.primary,
    backgroundColor: "rgba(37, 99, 235, 0.15)",
  },
  designSlotLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: GLASS.text,
  },
  designSlotSummary: {
    fontSize: 11,
    color: GLASS.textMuted,
    marginTop: 2,
  },
  browseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.4)",
    marginBottom: 8,
  },
  browseIcon: {
    marginRight: 2,
  },
  browseLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },
  itemPressed: {
    backgroundColor: GLASS.bgPressed,
  },
});