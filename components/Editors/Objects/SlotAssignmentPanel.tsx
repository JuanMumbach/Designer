import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FormPanel from '../FormPanel';
import {
  fetchMaterialVersion,
  MaterialMeta,
  MaterialType,
} from '../../../services/api';
import { extractGlbParts, readGlbBytes } from '../../../services/glbParts';
import {
  collectDefaultGlobalMaterials,
  designMaterialsConfig,
  normalizeTypeName,
} from '../../../services/designMaterialDefaults';
import { AppliedMaterial } from '@/components/DesignScreen/3dView/DesignObjects';

export interface SlotDraft {
  materialIndex: number;
  materialName: string | null;
  displayName: string;
  materialTypeId: string;
}

interface SlotAssignmentPanelProps {
  fileUrl: string;
  materialTypes: MaterialType[];
  materials?: MaterialMeta[];
  onSave: (slots: SlotDraft[]) => Promise<void>;
  onComplete: () => void;
  onHighlightSlot?: (slot: number | null) => void;
  onSlotTexturesChange?: (
    textures: Record<number, AppliedMaterial> | null
  ) => void;
}

function chipLabel(type: MaterialType): string {
  return type.name.toLowerCase().trim() === 'default'
    ? 'Cualquiera'
    : type.name;
}

export default function SlotAssignmentPanel({
  fileUrl,
  materialTypes,
  materials,
  onSave,
  onComplete,
  onHighlightSlot,
  onSlotTexturesChange,
}: SlotAssignmentPanelProps) {
  const [slots, setSlots] = useState<SlotDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const materialTypesRef = useRef(materialTypes);
  materialTypesRef.current = materialTypes;
  const materialsRef = useRef(materials);
  materialsRef.current = materials;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onSlotTexturesChangeRef = useRef(onSlotTexturesChange);
  onSlotTexturesChangeRef.current = onSlotTexturesChange;
  const texturesRequestIdRef = useRef(0);
  const materialDataCacheRef = useRef<Map<string, AppliedMaterial>>(new Map());

  const resolvedGlobals = useMemo(
    () =>
      collectDefaultGlobalMaterials(
        designMaterialsConfig.designMaterialSlots,
        materials ?? [],
        materialTypes
      ),
    [materials, materialTypes]
  );
  const resolvedGlobalsRef = useRef(resolvedGlobals);
  resolvedGlobalsRef.current = resolvedGlobals;

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
          resolveTextures(drafts);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl]);

  const ensureMaterialData = async (
    materialId: string
  ): Promise<AppliedMaterial | null> => {
    if (!materialId) return null;
    const cached = materialDataCacheRef.current.get(materialId);
    if (cached) return cached;
    const meta = (materialsRef.current ?? []).find((m) => m.id === materialId);
    if (!meta) return null;
    try {
      const data = await fetchMaterialVersion(materialId, meta.lastVersion);
      if (data?.fileURL) {
        const applied: AppliedMaterial = {
          fileURL: data.fileURL,
          scaleU: Number(data.scaleU) || 1,
          scaleV: Number(data.scaleV) || 1,
        };
        materialDataCacheRef.current.set(materialId, applied);
        return applied;
      }
    } catch (err) {
      console.warn('Failed to fetch material data for object preview:', err);
    }
    return null;
  };

  const resolveTextures = async (current: SlotDraft[]) => {
    const requestId = ++texturesRequestIdRef.current;
    const textures: Record<number, AppliedMaterial> = {};
    for (const slot of current) {
      if (!slot.materialTypeId) continue;
      const type = materialTypesRef.current.find(
        (t) => t.id === slot.materialTypeId
      );
      if (!type) continue;
      const key = normalizeTypeName(type.name);
      const designSlot = designMaterialsConfig.designMaterialSlots.find(
        (s) => normalizeTypeName(s.type) === key
      );
      if (!designSlot) continue;
      const materialId = resolvedGlobalsRef.current[designSlot.key];
      if (!materialId) continue;
      const applied = await ensureMaterialData(materialId);
      if (applied) textures[slot.materialIndex] = applied;
    }
    if (requestId !== texturesRequestIdRef.current) return;
    onSlotTexturesChangeRef.current?.(
      Object.keys(textures).length > 0 ? textures : null
    );
  };

  const materialForType = (typeId: string): string | null => {
    if (!typeId) return null;
    const type = materialTypes.find((t) => t.id === typeId);
    if (!type) return null;
    const key = normalizeTypeName(type.name);
    const slot = designMaterialsConfig.designMaterialSlots.find(
      (s) => normalizeTypeName(s.type) === key
    );
    if (!slot) return null;
    const materialId = resolvedGlobals[slot.key];
    const material = (materials ?? []).find((m) => m.id === materialId);
    return material ? `${slot.label} (${material.name})` : slot.label;
  };

  const handleSelectType = (materialIndex: number, typeId: string) => {
    onHighlightSlot?.(materialIndex);
    const next = slots.map((s) =>
      s.materialIndex === materialIndex ? { ...s, materialTypeId: typeId } : s
    );
    setSlots(next);
    resolveTextures(next);
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
    onHighlightSlot?.(null);
    try {
      await onSaveRef.current(slots);
      onHighlightSlot?.(null);
      onSlotTexturesChangeRef.current?.(null);
      onCompleteRef.current();
    } catch {
      Alert.alert('Error', 'Failed to save the material slots.');
    } finally {
      setSaving(false);
    }
  };

  const allAssigned = slots.length > 0 && slots.every((s) => s.materialTypeId);

  return (
    <FormPanel
      title="Asignar tipos de material"
      subtitle={`El modelo 3D tiene ${slots.length} material(es). Asigna un tipo a cada slot antes de continuar.`}
      primaryAction={{
        label: saving ? 'Guardando…' : 'Guardar',
        onPress: handleSave,
        disabled: !allAssigned || saving,
      }}
    >
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
        slots.map((slot) => (
          <View key={slot.materialIndex} style={styles.slotRow}>
            <View style={styles.slotHeader}>
              <Text style={styles.slotName}>
                #{slot.materialIndex} {slot.materialName ?? 'Unnamed material'}
              </Text>
              <Text style={styles.slotMeta}>{slot.displayName}</Text>
              <Text style={styles.slotMaterial}>
                Material:{' '}
                {materialForType(slot.materialTypeId) ?? 'Selecciona un tipo'}
              </Text>
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
        ))
      )}
    </FormPanel>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: '#fff',
  },
  headerBox: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 12,
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
    flex: 1,
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingBottom: 8,
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
  slotMaterial: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
    marginTop: 4,
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
    marginHorizontal: 24,
    marginTop: 8,
    marginBottom: 24,
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