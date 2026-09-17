import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Button from "../../Button";
import { MaterialCategory, MaterialMeta } from "../../../services/api";
import { GlobalMaterials, isMaterialAlias } from "../3dView/DesignObjects";
import { DesignMaterialSlot } from "../../../services/designMaterialDefaults";
import MaterialPicker from "./MaterialPicker";
import { COLORS, RADII } from "@/constants/theme";

function getSlotLabel(designSlots: DesignMaterialSlot[], key: string): string {
    return designSlots.find(s => s.key === key)?.label ?? key;
}

export default function GlobalMaterialSettings({
    globalMaterials,
    onGlobalMaterialsChange,
    materials,
    materialCategories,
    designSlots,
    onClose
}: {
    globalMaterials: GlobalMaterials,
    onGlobalMaterialsChange: (materials: GlobalMaterials) => void,
    materials: MaterialMeta[],
    materialCategories: MaterialCategory[],
    designSlots: DesignMaterialSlot[],
    onClose: () => void,
}) {
    const [editingSlot, setEditingSlot] = useState<string | null>(null);
    const editingSlotRef = useRef<string | null>(null);
    editingSlotRef.current = editingSlot;
    const [pickerOpen, setPickerOpen] = useState(false);

    const getMaterialName = (materialId: string): string => {
        return materials.find(m => m.id === materialId)?.name ?? 'Unknown';
    };

    const describeAssignment = (slot: string): string => {
        const value = globalMaterials[slot];
        if (!value) return 'Default';
        if (isMaterialAlias(value)) {
            return `⇄ ${getSlotLabel(designSlots, value.substring(4))}`;
        }
        return getMaterialName(value);
    };

    const handleCustomSelect = async (materialMeta: MaterialMeta) => {
        const slot = editingSlotRef.current;
        if (!slot) return;
        onGlobalMaterialsChange({ ...globalMaterials, [slot]: materialMeta.id });
        setPickerOpen(false);
        setEditingSlot(null);
    };

    const handleResetSlot = (slot: string) => {
        const next = { ...globalMaterials };
        delete next[slot];
        onGlobalMaterialsChange(next);
    };

    if (pickerOpen && editingSlotRef.current) {
        return (
            <MaterialPicker
                materials={materials}
                categories={materialCategories}
                onSelect={handleCustomSelect}
                onClose={() => setPickerOpen(false)}
            />
        );
    }

    if (editingSlot) {
        return (
            <View style={styles.container}>
                <Text style={styles.headerTitle}>Assign {getSlotLabel(designSlots, editingSlot)}</Text>
                <Text style={styles.sectionHint}>Choose a catalog material</Text>
                <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                    <Pressable style={styles.browseButton} onPress={() => setPickerOpen(true)}>
                        <Text style={styles.browseLabel}>Browse catalog…</Text>
                    </Pressable>
                </ScrollView>
                <View style={styles.footer}>
                    <Button label="Back" onPress={() => setEditingSlot(null)} />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.headerTitle}>Default Materials</Text>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                {designSlots.map(slot => {
                    const value = globalMaterials[slot.key];
                    return (
                        <View key={slot.key} style={styles.row}>
                            <View style={styles.rowInfo}>
                                <Text style={styles.rowLabel}>{slot.label}</Text>
                                <Text style={styles.rowStatus}>{describeAssignment(slot.key)}</Text>
                            </View>
                            <View style={styles.rowActions}>
                                <Pressable style={styles.changeButton} onPress={() => setEditingSlot(slot.key)}>
                                    <Text style={styles.changeLabel}>Change</Text>
                                </Pressable>
                                {value !== undefined && (
                                    <Pressable style={styles.resetButton} onPress={() => handleResetSlot(slot.key)}>
                                        <Text style={styles.resetLabel}>Reset</Text>
                                    </Pressable>
                                )}
                            </View>
                        </View>
                    );
                })}
            </ScrollView>
            <View style={styles.footer}>
                <Button label="Done" onPress={onClose} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 300,
        maxHeight: '100%',
        backgroundColor: COLORS.bg,
        borderRadius: RADII.xl,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
        overflow: 'hidden',
    },
    scroll: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    scrollContent: {
        paddingBottom: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text,
        marginTop: 16,
        marginBottom: 4,
        textAlign: 'center',
    },
    sectionHint: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.textHeading,
        marginTop: 14,
        marginBottom: 8,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.bgAlt,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: RADII.md,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    rowInfo: {
        flex: 1,
        marginRight: 8,
    },
    rowLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textBody,
        marginBottom: 2,
    },
    rowStatus: {
        fontSize: 11,
        color: COLORS.textMuted,
    },
    rowActions: {
        flexDirection: 'row',
        gap: 6,
    },
    changeButton: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: RADII.sm,
        backgroundColor: COLORS.primary,
    },
    changeLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.white,
    },
    resetButton: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: RADII.sm,
        backgroundColor: COLORS.surfaceAlt,
        borderWidth: 1,
        borderColor: COLORS.borderStrong,
    },
    resetLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textMuted,
    },
    browseButton: {
        alignItems: 'center',
        backgroundColor: COLORS.primarySoft,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: RADII.lg,
        borderWidth: 1,
        borderColor: COLORS.primaryBorder,
        marginBottom: 8,
    },
    browseLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.primary,
    },
    footer: {
        alignItems: 'center',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
});