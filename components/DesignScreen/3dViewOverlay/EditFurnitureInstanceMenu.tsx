import Button from "@/components/Button";
import { useCallback, useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput, View, ViewStyle } from "react-native";
import { DesignObject, GlobalMaterials, MaterialOverrides, resolveGlobalMaterials } from "../3dView/DesignObjects";
import { MaterialCategory, MaterialMeta, MaterialData, ObjectMaterialType } from "../../../services/api";
import { MaterialSlotInfo } from "../../../services/materialSlots";
import { DesignMaterialSlot, designSlotByKey, isMaterialRef, normalizeTypeName } from "../../../services/designMaterialDefaults";
import MaterialPicker from "./MaterialPicker";
import { COLORS, GLASS, RADII } from "@/constants/theme";
import GlassSurface from "./GlassSurface";

export default function EditFurnitureInstanceMenu({object, onEditComplete, onDelete, materials, materialCategories, globalMaterials, designSlots, slotTypesByModel, typeToDesignSlot, containerStyle} : {
        object : DesignObject,
        onEditComplete : (id: string, updates: { name: string, position: [number, number, number], materialOverrides?: MaterialOverrides }) => void,
        onDelete? : (id: string) => void,
        materials: MaterialMeta[],
        materialCategories: MaterialCategory[],
        globalMaterials: GlobalMaterials,
        designSlots: DesignMaterialSlot[],
        slotTypesByModel: Record<string, ObjectMaterialType[]>,
        typeToDesignSlot: Record<string, string>,
        containerStyle?: StyleProp<ViewStyle>,
    }){

    const [name, onChangeName] = useState(object.name);
    const [positionX, setPositionX] = useState(object.position?.[0]?.toString() ?? '0');
    const [positionY, setPositionY] = useState(object.position?.[1]?.toString() ?? '0');
    const [positionZ, setPositionZ] = useState(object.position?.[2]?.toString() ?? '0');
    const [dirtyOverrides, setDirtyOverrides] = useState<Record<number, string>>(object.materialOverrides || {});
    const [editingSlot, setEditingSlot] = useState<number | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);

    const slotTypeRows: ObjectMaterialType[] = slotTypesByModel[`${object.modelId}:${object.version}`] ?? [];

    const slotList: MaterialSlotInfo[] = (() => {
        if (slotTypeRows.length > 0) {
            return slotTypeRows.map((t) => ({
                slot: t.slot,
                displayName: t.displayName || `Slot ${t.slot}`,
            }));
        }
        return object.slots ?? [];
    })();

    const handleSave = () => {
        onEditComplete(object.id, {
            name: name,
            position: [
                parseFloat(positionX) || 0,
                parseFloat(positionY) || 0,
                parseFloat(positionZ) || 0
            ],
            materialOverrides: dirtyOverrides,
        });
    };

    const handleDelete = () => {
        if (Platform.OS === 'web') {
            if (window.confirm('Are you sure you want to delete this object?')) {
                if (onDelete) onDelete(object.id);
            }
        } else {
            Alert.alert('Delete Object', 'Are you sure you want to delete this object?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => {
                    if (onDelete) onDelete(object.id);
                }},
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
        return materials.find(m => m.id === materialId)?.name ?? 'Unknown';
    };

    const resolvedGlobals = useMemo(() => resolveGlobalMaterials(globalMaterials), [globalMaterials]);

    const getInheritedMaterialId = (slot: number, slotInfo: MaterialSlotInfo): { materialId: string, designKey?: string } | undefined => {
        const slotType = slotTypeRows.find(t => t.slot === slot);
        const typeName = slotType?.materialTypeName || slotType?.materialTypeId || '';
        const designKey = typeName ? typeToDesignSlot[normalizeTypeName(typeName)] : undefined;
        if (designKey) {
            const gid = resolvedGlobals[designKey];
            if (gid && !gid.startsWith('ref:')) return { materialId: gid, designKey };
        }
        const explicit = resolvedGlobals[slotInfo.displayName];
        if (explicit && !explicit.startsWith('ref:')) return { materialId: explicit };
        const sanitized = resolvedGlobals[slotInfo.displayName];
        return sanitized && !sanitized.startsWith('ref:') ? { materialId: sanitized } : undefined;
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
            return 'Default';
        }
        if (isMaterialRef(override)) {
            const designKey = override.substring(4);
            const designLabel = designSlotByKey(designSlots, designKey)?.label ?? designKey;
            const targetId = resolvedGlobals[designKey];
            return targetId && !targetId.startsWith('ref:')
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
                        <Text style={styles.backLabel}>← Back</Text>
                    </Pressable>
                    <Text style={styles.headerTitle}>Assign {slotList.find(s => s.slot === editingSlot)?.displayName || `Slot ${editingSlot}`}</Text>
                </View>
                <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                    <Text style={styles.sectionTitle}>Design materials</Text>
                    {designSlots.map(slot => {
                        const isActive = dirtyOverrides[editingSlot] === `ref:${slot.key}`;
                        const targetId = resolvedGlobals[slot.key];
                        const summary = targetId && !targetId.startsWith('ref:') ? getMaterialName(targetId) : 'Not set';
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
                        <Text style={styles.browseLabel}>Browse catalog…</Text>
                    </Pressable>
                </ScrollView>
            </GlassSurface>
        );
    }

    return (
    <GlassSurface style={[styles.container, containerStyle]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <TextInput style={styles.input} onChangeText={onChangeName} value={name} placeholder={object.name} placeholderTextColor={GLASS.textFaint} />
        <Text style={styles.typeText}>Type: {object.name}</Text>
        <Text>Type: {object.name}</Text>
        <Text style={styles.label}>Position X</Text>
              <TextInput style={styles.input}
                onChangeText={setPositionX}
                value={positionX}
                keyboardType="numeric"
              />
        <Text style={styles.label}>Position Y</Text>
                <TextInput style={styles.input}
                    onChangeText={setPositionY}
                    value={positionY}
                    keyboardType="numeric"
                />
        <Text style={styles.label}>Position Z</Text>
                <TextInput style={styles.input}
                    onChangeText={setPositionZ}
                    value={positionZ}
                    keyboardType="numeric"
                />

        {slotList.length > 0 && (
            <>
                <Text style={styles.sectionTitle}>Textures</Text>
                {slotList.map(slotInfo => {
                    const hasOverride = dirtyOverrides[slotInfo.slot] !== undefined;
                    return (
                        <View key={slotInfo.slot} style={styles.textureRow}>
                            <View style={styles.textureInfo}>
                                <Text style={styles.textureMeshName}>{slotInfo.displayName || `Slot ${slotInfo.slot}`}</Text>
                                <Text style={styles.textureStatus}>
                                    {describeSlot(slotInfo)}
                                </Text>
                            </View>
                            <View style={styles.textureActions}>
                                <Pressable
                                    style={styles.textureButton}
                                    onPress={() => setEditingSlot(slotInfo.slot)}
                                >
                                    <Text style={styles.textureButtonLabel}>Change</Text>
                                </Pressable>
                                {hasOverride && (
                                    <Pressable
                                        style={styles.textureResetButton}
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

        <Button label="Save Changes" onPress={handleSave} />
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonLabel}>Delete Object</Text>
        </Pressable>
      </ScrollView>
    </GlassSurface>
    );
};

const styles = StyleSheet.create({
  container: {
    width: 300,
    maxHeight: '100%',
    borderRadius: RADII.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  label: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '700',
    color: GLASS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  typeText: {
    fontSize: 13,
    color: GLASS.textMuted,
  },
  input: {
    height: 44,
    borderColor: GLASS.border,
    borderWidth: 1,
    borderRadius: RADII.md,
    paddingHorizontal: 12,
    marginBottom: 10,
    backgroundColor: GLASS.bgInput,
    fontSize: 14,
    color: GLASS.text,
  },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 12,
    fontSize: 14,
    fontWeight: '700',
    color: GLASS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textureRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '600',
    color: GLASS.text,
    marginBottom: 2,
  },
  textureStatus: {
    fontSize: 11,
    color: GLASS.textMuted,
  },
  textureActions: {
    flexDirection: 'row',
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
    fontWeight: '600',
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
    fontWeight: '600',
    color: GLASS.text,
  },
  discoveringText: {
    marginTop: 12,
    fontStyle: 'italic',
    color: GLASS.textFaint,
    fontSize: 13,
    textAlign: 'center',
  },
  deleteButton: {
    borderRadius: RADII.md,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    backgroundColor: COLORS.dangerStrong,
  },
  deleteButtonLabel: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  chooseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  backButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  backLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: GLASS.text,
    marginRight: 40,
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
    backgroundColor: 'rgba(37, 99, 235, 0.35)',
  },
  designSlotLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: GLASS.text,
  },
  designSlotSummary: {
    fontSize: 11,
    color: GLASS.textMuted,
    marginTop: 2,
  },
  browseButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.30)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.4)',
    marginBottom: 8,
  },
  browseLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
});