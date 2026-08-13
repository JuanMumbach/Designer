import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  createObjectMaterialType,
  deleteObjectMaterialType,
  fetchObjectVersion,
  MaterialType,
  ObjectMaterialType,
  updateObjectMaterialType,
} from "../../../services/api";
import { useModelMaterialTypes } from "../../../services/useModelMaterialTypes";
import { extractGlbParts, readGlbBytes } from "../../../services/glbParts";

interface ModelSlotsSectionProps {
  objectId: string;
  fileUrl?: string;
  materialTypes: MaterialType[];
  disabled?: boolean;
}

interface ImportPartDraft {
  key: string;
  materialIndex: number;
  materialName: string | null;
  displayName: string;
  included: boolean;
  materialTypeId: string;
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
  fileUrl,
  materialTypes,
  disabled,
}: ModelSlotsSectionProps) {
  const [version, setVersion] = useState<number | null>(null);
  const {
    materialTypes: slots,
    error: loadError,
    refresh,
  } = useModelMaterialTypes(objectId, version);

  const [editKey, setEditKey] = useState<EditKey | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [parts, setParts] = useState<ImportPartDraft[]>([]);
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

  useEffect(() => {
    if (!importOpen) {
      setParts([]);
    }
  }, [importOpen]);

  const startEdit = (slot: ObjectMaterialType) => {
    setImportOpen(false);
    setEditKey({
      objectModelId: slot.objectModelId,
      version: slot.version,
      slot: slot.slot,
    });
    setEditDraft({
      displayName: slot.displayName,
      materialTypeId: slot.materialTypeId,
    });
  };

  const closeEdit = () => {
    setEditKey(null);
    setEditDraft(null);
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

  const startImport = async () => {
    if (!fileUrl) return;
    setImportOpen(true);
    setImportLoading(true);
    try {
      const bytes = await readGlbBytes(fileUrl);
      const extracted = extractGlbParts(bytes);
      const drafts: ImportPartDraft[] = [];
      const seen = new Set<number>();
      for (const part of extracted) {
        if (part.materialIndex < 0 || seen.has(part.materialIndex)) continue;
        seen.add(part.materialIndex);
        const existing = slots.find((s) => s.slot === part.materialIndex);
        drafts.push({
          key: `${part.materialIndex}`,
          materialIndex: part.materialIndex,
          materialName: part.materialName,
          displayName: part.displayName,
          included: true,
          materialTypeId: existing?.materialTypeId ?? "",
        });
      }
      setParts(drafts);
    } catch (err) {
      Alert.alert("Error", (err as Error).message || "Failed to read the .glb file.");
      setImportOpen(false);
    } finally {
      setImportLoading(false);
    }
  };

  const handleTogglePart = (key: string) => {
    setParts((prev) =>
      prev.map((p) => (p.key === key ? { ...p, included: !p.included } : p))
    );
  };

  const handleSaveAll = async () => {
    const selected = parts.filter((p) => p.included);
    if (selected.length === 0) {
      Alert.alert("Validation", "No parts selected.");
      return;
    }
    const invalid = selected.filter((p) => !p.materialTypeId);
    if (invalid.length > 0) {
      Alert.alert(
        "Validation",
        `Select a material type for ${invalid.length} part(s): ${invalid
          .slice(0, 3)
          .map((p) => p.displayName)
          .join(", ")}${invalid.length > 3 ? "…" : ""}.`
      );
      return;
    }
    if (version == null) return;
    setSaving(true);
    try {
      for (const part of selected) {
        const existing = slots.find((s) => s.slot === part.materialIndex);
        if (existing) {
          await updateObjectMaterialType(
            existing.objectModelId,
            existing.version,
            existing.slot,
            {
              displayName: part.displayName,
              materialTypeId: part.materialTypeId,
            }
          );
        } else {
          await createObjectMaterialType({
            objectModelId: objectId,
            version,
            slot: part.materialIndex,
            materialTypeId: part.materialTypeId,
            displayName: part.displayName,
          });
        }
      }
      setImportOpen(false);
      await refresh();
    } catch {
      Alert.alert("Error", "Failed to save the slots.");
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
        {!disabled && fileUrl && (
          <Pressable
            style={styles.addButton}
            onPress={importOpen ? () => setImportOpen(false) : startImport}
            disabled={importLoading}
          >
            <Text style={styles.addButtonText}>
              {importLoading
                ? "Reading GLB…"
                : importOpen
                  ? "Cancel"
                  : "Import from GLB"}
            </Text>
          </Pressable>
        )}
      </View>

      {!fileUrl && !disabled && (
        <Text style={styles.emptyText}>
          Pick or load a .glb file to import its material slots.
        </Text>
      )}

      {loadError && (
        <Text style={styles.errorText}>Failed to load slots: {loadError.message}</Text>
      )}

      {slots.length === 0 && !loadError && (
        <Text style={styles.emptyText}>
          No slots defined for this model yet.
        </Text>
      )}

      {slots.map((slot) => (
        <View key={`${slot.objectModelId}-${slot.version}-${slot.slot}`} style={styles.slotRow}>
          <View style={styles.slotInfo}>
            <Text style={styles.slotName}>{slot.displayName}</Text>
            <Text style={styles.slotMeta}>Slot {slot.slot}</Text>
            <Text style={styles.slotMeta}>
              Type: {slot.materialTypeName ?? getTypeName(slot.materialTypeId)}
            </Text>
          </View>
          {!disabled && !importOpen && (
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
        </View>
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

      {importOpen && !importLoading && parts.length === 0 && (
        <Text style={styles.emptyText}>
          No mesh parts found in this .glb file.
        </Text>
      )}

      {importOpen && parts.length > 0 && (
        <View style={styles.form}>
          <Text style={styles.importHint}>
            Parts are detected from the .glb and identified by their material index in
            the file. Select a material type for each part.
          </Text>

          {materialTypes.length === 0 && (
            <Text style={styles.warnText}>
              No material types exist yet. Create them under Ajustes de Entorno → Tipos before saving.
            </Text>
          )}

          {parts.map((part) => (
            <View key={part.key} style={styles.importPartRow}>
              <Pressable
                style={styles.importToggle}
                onPress={() => handleTogglePart(part.key)}
              >
                <Text style={styles.importToggleText}>{part.included ? "✓" : ""}</Text>
              </Pressable>
              <View style={styles.importPartBody}>
                <View style={styles.importPartHeader}>
                  <View style={styles.importPartTitle}>
                    <Text style={[styles.importPartName, !part.included && styles.importPartMuted]}>
                      #{part.materialIndex} {part.materialName ?? "Unnamed material"}
                    </Text>
                    <Text style={[styles.slotMeta, !part.included && styles.importPartMuted]}>
                      {part.displayName}
                    </Text>
                  </View>
                  {!part.included && (
                    <Text style={styles.importSkipped}>Skipped</Text>
                  )}
                </View>

                {part.included && (
                  <View style={styles.chipRow}>
                    {materialTypes.map((type) => (
                      <Pressable
                        key={type.id}
                        style={[
                          styles.chip,
                          part.materialTypeId === type.id && styles.chipActive,
                        ]}
                        onPress={() =>
                          setParts((prev) =>
                            prev.map((p) =>
                              p.key === part.key ? { ...p, materialTypeId: type.id } : p
                            )
                          )
                        }
                      >
                        <Text
                          style={[
                            styles.chipText,
                            part.materialTypeId === type.id && styles.chipTextActive,
                          ]}
                        >
                          {type.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            </View>
          ))}

          <View style={styles.formActions}>
            <Pressable style={styles.saveButton} onPress={handleSaveAll} disabled={saving}>
              <Text style={styles.saveButtonText}>
                {saving ? "Saving..." : "Save All Slots"}
              </Text>
            </Pressable>
            <Pressable style={styles.cancelButton} onPress={() => setImportOpen(false)}>
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
  addButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "#2563eb",
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  errorText: {
    fontSize: 12,
    color: "#dc2626",
    marginBottom: 8,
  },
  warnText: {
    fontSize: 12,
    color: "#b45309",
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 13,
    fontStyle: "italic",
    color: "#9ca3af",
    marginBottom: 8,
  },
  importHint: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 12,
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
  importPartRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
    gap: 8,
  },
  importToggle: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#9ca3af",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  importToggleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#16a34a",
  },
  importPartBody: {
    flex: 1,
  },
  importPartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  importPartTitle: {
    flex: 1,
    marginRight: 8,
  },
  importPartName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 2,
  },
  importPartMuted: {
    color: "#9ca3af",
  },
  importSkipped: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
  },
});
