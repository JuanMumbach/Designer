import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { createObjectMaterialType, MaterialType } from '../../../services/api';
import { extractGlbParts, readGlbBytes } from '../../../services/glbParts';

interface SlotAssignmentModalProps {
  objectId: string;
  version: number;
  fileUrl: string;
  materialTypes: MaterialType[];
  onComplete: () => void;
}

interface SlotDraft {
  materialIndex: number;
  materialName: string | null;
  displayName: string;
  materialTypeId: string;
}

function chipLabel(type: MaterialType): string {
  return type.name.toLowerCase().trim() === 'default'
    ? 'Cualquiera'
    : type.name;
}

export default function SlotAssignmentModal({
  objectId,
  version,
  fileUrl,
  materialTypes,
  onComplete,
}: SlotAssignmentModalProps) {
  const [slots, setSlots] = useState<SlotDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const materialTypesRef = useRef(materialTypes);
  materialTypesRef.current = materialTypes;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const bytes = await readGlbBytes(fileUrl);
        const extracted = extractGlbParts(bytes);
        const drafts: SlotDraft[] = [];
        const seen = new Set<number>();
        for (const part of extracted) {
          if (part.materialIndex < 0 || seen.has(part.materialIndex)) continue;
          seen.add(part.materialIndex);
          drafts.push({
            materialIndex: part.materialIndex,
            materialName: part.materialName,
            displayName: part.displayName,
            materialTypeId: '',
          });
        }
        if (isMounted) {
          const defaultType = materialTypesRef.current.find(
            (t) => t.name.toLowerCase().trim() === 'default'
          );
          if (defaultType) {
            for (const draft of drafts) {
              if (draft.displayName.toLowerCase().trim() === 'default') {
                draft.materialTypeId = defaultType.id;
              }
            }
          }
          setSlots(drafts);
        }
      } catch (err) {
        if (isMounted) {
          Alert.alert(
            'Error',
            (err as Error).message || 'Failed to read the .glb file.'
          );
          onCompleteRef.current();
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [fileUrl]);

  const handleSelectType = (materialIndex: number, typeId: string) => {
    setSlots((prev) =>
      prev.map((s) => (s.materialIndex === materialIndex ? { ...s, materialTypeId: typeId } : s))
    );
  };

  const handleSave = async () => {
    const invalid = slots.filter((s) => !s.materialTypeId);
    if (invalid.length > 0) {
      Alert.alert(
        'Validation',
        `Select a material type for ${invalid.length} slot(s): ${invalid
          .slice(0, 3)
          .map((s) => s.displayName)
          .join(', ')}${invalid.length > 3 ? '…' : ''}.`
      );
      return;
    }
    setSaving(true);
    try {
      for (const slot of slots) {
        await createObjectMaterialType({
          objectModelId: objectId,
          version,
          slot: slot.materialIndex,
          materialTypeId: slot.materialTypeId,
          displayName: slot.displayName,
        });
      }
      onComplete();
    } catch {
      Alert.alert('Error', 'Failed to save the material slots.');
    } finally {
      setSaving(false);
    }
  };

  const allAssigned =
    slots.length > 0 && slots.every((s) => s.materialTypeId);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Asignar tipos de material</Text>
          <Text style={styles.subtitle}>
            El modelo 3D tiene {slots.length} material(es). Asigna un tipo a cada
            slot antes de continuar.
          </Text>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.loadingText}>Leyendo el modelo 3D…</Text>
            </View>
          ) : materialTypes.length === 0 ? (
            <Text style={styles.warnText}>
              No existen tipos de material. Crea uno primero.
            </Text>
          ) : (
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              {slots.map((slot) => (
                <View key={slot.materialIndex} style={styles.slotRow}>
                  <View style={styles.slotHeader}>
                    <Text style={styles.slotName}>
                      #{slot.materialIndex} {slot.materialName ?? 'Unnamed material'}
                    </Text>
                    <Text style={styles.slotMeta}>{slot.displayName}</Text>
                  </View>
                  <View style={styles.chipRow}>
                    {materialTypes.map((type) => (
                      <Pressable
                        key={type.id}
                        style={[
                          styles.chip,
                          slot.materialTypeId === type.id && styles.chipActive,
                        ]}
                        onPress={() => handleSelectType(slot.materialIndex, type.id)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            slot.materialTypeId === type.id && styles.chipTextActive,
                          ]}
                        >
                          {chipLabel(type)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          <Pressable
            style={[styles.saveButton, (!allAssigned || saving) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!allAssigned || saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '85%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 12,
  },
  warnText: {
    fontSize: 13,
    color: '#b45309',
    textAlign: 'center',
    paddingVertical: 24,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 4,
  },
  slotRow: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  slotHeader: {
    marginBottom: 8,
  },
  slotName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  slotMeta: {
    fontSize: 11,
    color: '#6b7280',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  chipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  chipTextActive: {
    color: '#fff',
  },
  saveButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#16a34a',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});