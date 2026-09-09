import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  deleteObjectMaterialType,
  fetchObjectVersion,
  MaterialType,
  ObjectMaterialType,
  updateObjectMaterialType,
} from "../../../services/api";
import { useModelMaterialTypes } from "../../../services/useModelMaterialTypes";

interface ModelSlotsSectionProps {
  objectId: string;
  materialTypes: MaterialType[];
  disabled?: boolean;
  onHighlightSlot?: (slot: number | null) => void;
}

interface EditKey {
  objectModelId: string;
  version: number;
  slot: number;
}

interface EditDraft {
  displayName: string;
  materialTypeId: string;
}

export default function ModelSlotsSection({
  objectId,
  materialTypes,
  disabled,
  onHighlightSlot,
}: ModelSlotsSectionProps) {
  const [version, setVersion] = useState<number | null>(null);
  const {
    materialTypes: slots,
    error: loadError,
    refresh,
  } = useModelMaterialTypes(objectId, version);

  const [editKey, setEditKey] = useState<EditKey | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setVersion(null);
    fetchObjectVersion(objectId)
      .then((data) => {
        if (isMounted) setVersion(data.version);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [objectId]);

  const startEdit = (slot: ObjectMaterialType) => {
    setEditKey({
      objectModelId: slot.objectModelId,
      version: slot.version,
      slot: slot.slot,
    });
    setEditDraft({
      displayName: slot.displayName,
      materialTypeId: slot.materialTypeId,
    });
    onHighlightSlot?.(slot.slot);
  };

  const closeEdit = () => {
    setEditKey(null);
    setEditDraft(null);
    onHighlightSlot?.(null);
  };

  const handleSaveEdit = async () => {
    if (!editKey || !editDraft) return;
    if (!editDraft.materialTypeId) {
      Alert.alert("Validation", "A material type is required.");
      return;
    }
    setSaving(true);
    try {
      await updateObjectMaterialType(
        editKey.objectModelId,
        editKey.version,
        editKey.slot,
        {
          displayName: editDraft.displayName.trim(),
          materialTypeId: editDraft.materialTypeId,
        }
      );
      closeEdit();
      await refresh();
    } catch {
      Alert.alert("Error", "Failed to save the slot.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (slot: ObjectMaterialType) => {
    const confirm = () => {
      deleteObjectMaterialType(slot.objectModelId, slot.version, slot.slot)
        .then(() => refresh())
        .catch(() => Alert.alert("Error", "Failed to delete the slot."));
    };
    if (typeof window !== "undefined" && window.confirm) {
      if (window.confirm(`Delete slot "${slot.displayName}"?`)) confirm();
    } else {
      Alert.alert("Delete Slot", "Are you sure you want to delete this slot?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: confirm },
      ]);
    }
  };

  const getTypeName = (id: string): string => {
    return materialTypes.find((t) => t.id === id)?.name ?? "Unknown";
  };

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Material Slots</Text>
      </View>

      {loadError && (
        <Text style={styles.errorText}>Failed to load slots: {loadError.message}</Text>
      )}

      {slots.length === 0 && !loadError && (
        <Text style={styles.emptyText}>
          No slots defined for this model yet.
        </Text>
      )}

      {slots.map((slot) => (
        <Pressable
          key={`${slot.objectModelId}-${slot.version}-${slot.slot}`}
          style={styles.slotRow}
          onPress={() => onHighlightSlot?.(slot.slot === editKey?.slot ? null : slot.slot)}
          disabled={disabled}
        >
          <View style={styles.slotInfo}>
            <Text style={styles.slotName}>{slot.displayName}</Text>
            <Text style={styles.slotMeta}>Slot {slot.slot}</Text>
            <Text style={styles.slotMeta}>
              Type: {slot.materialTypeName ?? getTypeName(slot.materialTypeId)}
            </Text>
          </View>
          {!disabled && (
            <View style={styles.slotActions}>
              <Pressable style={styles.actionButton} onPress={() => startEdit(slot)}>
                <Text style={styles.actionButtonText}>Edit</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => handleDelete(slot)}
              >
                <Text style={styles.actionButtonText}>Del</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      ))}

      {editKey && editDraft && (
        <View style={styles.form}>
          <Text style={styles.label}>Slot</Text>
          <Text style={styles.readOnlyValue}>{editKey.slot}</Text>

          <Text style={styles.label}>Display Name *</Text>
          <TextInput
            style={styles.input}
            value={editDraft.displayName}
            onChangeText={(text) => setEditDraft((prev) => (prev ? { ...prev, displayName: text } : prev))}
            placeholder="Countertop, Doors..."
          />

          <Text style={styles.label}>Material Type *</Text>
          <View style={styles.chipRow}>
            {materialTypes.map((type) => (
              <Pressable
                key={type.id}
                style={[
                  styles.chip,
                  editDraft.materialTypeId === type.id && styles.chipActive,
                ]}
                onPress={() =>
                  setEditDraft((prev) =>
                    prev ? { ...prev, materialTypeId: type.id } : prev
                  )
                }
              >
                <Text
                  style={[
                    styles.chipText,
                    editDraft.materialTypeId === type.id && styles.chipTextActive,
                  ]}
                >
                  {type.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.formActions}>
            <Pressable style={styles.saveButton} onPress={handleSaveEdit} disabled={saving}>
              <Text style={styles.saveButtonText}>
                {saving ? "Saving..." : "Save Slot"}
              </Text>
            </Pressable>
            <Pressable style={styles.cancelButton} onPress={closeEdit}>
              <Text style={styles.cancelButtonLabel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  errorText: {
    fontSize: 12,
    color: "#dc2626",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    fontStyle: "italic",
    color: "#9ca3af",
    marginBottom: 8,
  },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  slotInfo: {
    flex: 1,
    marginRight: 8,
  },
  slotName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 2,
  },
  slotMeta: {
    fontSize: 11,
    color: "#6b7280",
  },
  slotActions: {
    flexDirection: "row",
    gap: 6,
  },
  actionButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "#e5e7eb",
  },
  deleteButton: {
    backgroundColor: "#fecaca",
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#374151",
  },
  form: {
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 6,
    marginTop: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  readOnlyValue: {
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#fff",
    borderColor: "#e5e7eb",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 4,
  },
  input: {
    height: 44,
    borderColor: "#e5e7eb",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    fontSize: 14,
    color: "#111827",
    marginBottom: 4,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 4,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#e5e7eb",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  chipActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  chipTextActive: {
    color: "#fff",
  },
  formActions: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#16a34a",
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  cancelButtonLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
  },
});
