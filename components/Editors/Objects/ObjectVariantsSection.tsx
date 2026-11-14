import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { COLORS, RADII } from '../../../constants/theme';
import { formStyles } from '../FormPanel';
import Toggle from '../../Toggle';
import { useAuth } from '../../../services/AuthContext';
import { uploadFileToFirebase } from '../../../services/firebaseSetup';
import {
  createObjectVariant,
  deleteObjectVariant,
  fetchObjectVariants,
  fetchObjectVersion,
  updateObjectVariant,
  updateObjectVersion,
} from '../../../services/api';
import {
  BudgetEntriesDelta,
  MaterialPartsDelta,
  ObjectVariant,
  parseDefaultVariantsSegment,
  parseVariantProperties,
  serializeDefaultVariantsSegment,
  serializeVariantProperties,
} from '../../../services/variants';

interface ObjectVariantsSectionProps {
  objectId: string;
  disabled?: boolean;
}

interface VariantGroupItem {
  group: string;
  label: string;
  allowNone: boolean;
  variants: ObjectVariant[];
}

export default function ObjectVariantsSection({
  objectId,
  disabled,
}: ObjectVariantsSectionProps) {
  const { backendUserId } = useAuth();
  const [version, setVersion] = useState<number | null>(null);
  const [versionProperties, setVersionProperties] = useState<string>('');
  const [variants, setVariants] = useState<ObjectVariant[]>([]);
  const [loading, setLoading] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ObjectVariant | null>(null);
  const [formName, setFormName] = useState('');
  const [formMode, setFormMode] = useState<'additive' | 'replace'>('additive');
  const [formGroup, setFormGroup] = useState('handles');
  const [formLabel, setFormLabel] = useState('Tiradores');
  const [formAllowNone, setFormAllowNone] = useState(true);
  const [formFileURL, setFormFileURL] = useState('');
  const [formPartsDeltaJson, setFormPartsDeltaJson] = useState('');
  const [formBudgetDeltaJson, setFormBudgetDeltaJson] = useState('');
  const [pickedFile, setPickedFile] = useState<{ uri: string; name: string } | null>(null);
  const [savingVariant, setSavingVariant] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const verData = await fetchObjectVersion(objectId);
      setVersion(verData.version);
      let rawProps = '';
      if (typeof verData.objectProperties === 'string') {
        rawProps = verData.objectProperties;
      } else if (verData.objectProperties && typeof verData.objectProperties === 'object') {
        const parts: string[] = [];
        if (verData.objectProperties.movingBehaviour) {
          parts.push(`moving-behavior:${verData.objectProperties.movingBehaviour}`);
        }
        if (verData.objectProperties.height !== undefined) {
          parts.push(`height:${verData.objectProperties.height}`);
        }
        if (verData.objectProperties.defaultVariants) {
          const seg = serializeDefaultVariantsSegment(verData.objectProperties.defaultVariants);
          if (seg) parts.push(seg);
        }
        rawProps = parts.join(';');
      }
      setVersionProperties(rawProps);
      const varList = await fetchObjectVariants(objectId, verData.version);
      setVariants(varList);
    } catch {
      setVariants([]);
    } finally {
      setLoading(false);
    }
  }, [objectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const defaultVariants = parseDefaultVariantsSegment(versionProperties);

  const groups: VariantGroupItem[] = React.useMemo(() => {
    const map = new Map<string, VariantGroupItem>();
    for (const v of variants) {
      const parsed = parseVariantProperties(v.variantProperties);
      const grp = parsed.group || 'default';
      let entry = map.get(grp);
      if (!entry) {
        entry = {
          group: grp,
          label: parsed.label || grp,
          allowNone: parsed.allowNone ?? true,
          variants: [],
        };
        map.set(grp, entry);
      }
      entry.variants.push(v);
    }
    return Array.from(map.values());
  }, [variants]);

  const handleSetDefaultVariant = async (groupName: string, variantId: string | null) => {
    if (!version) return;
    const nextDefaults = { ...defaultVariants, [groupName]: variantId };
    const seg = serializeDefaultVariantsSegment(nextDefaults);

    const filtered = versionProperties
      .split(';')
      .map((s) => s.trim())
      .filter((s) => Boolean(s) && !s.toLowerCase().startsWith('default-variants:'))
      .join(';');

    const nextProps = seg ? (filtered ? `${filtered};${seg}` : seg) : filtered;

    try {
      await updateObjectVersion(objectId, version, { objectProperties: nextProps });
      setVersionProperties(nextProps);
    } catch {
      Alert.alert('Error', 'No se pudo actualizar la variante predeterminada.');
    }
  };

  const handleOpenCreate = () => {
    setEditingVariant(null);
    setFormName('');
    setFormMode('additive');
    setFormGroup('handles');
    setFormLabel('Tiradores');
    setFormAllowNone(true);
    setFormFileURL('');
    setFormPartsDeltaJson('');
    setFormBudgetDeltaJson('');
    setPickedFile(null);
    setModalVisible(true);
  };

  const handleOpenEdit = (v: ObjectVariant) => {
    const parsed = parseVariantProperties(v.variantProperties);
    setEditingVariant(v);
    setFormName(v.name);
    setFormMode(v.mode);
    setFormGroup(parsed.group || 'handles');
    setFormLabel(parsed.label || 'Tiradores');
    setFormAllowNone(parsed.allowNone ?? true);
    setFormFileURL(v.fileURL || '');
    setFormPartsDeltaJson(
      v.materialPartsDelta ? JSON.stringify(v.materialPartsDelta, null, 2) : ''
    );
    setFormBudgetDeltaJson(
      v.budgetEntriesDelta ? JSON.stringify(v.budgetEntriesDelta, null, 2) : ''
    );
    setPickedFile(null);
    setModalVisible(true);
  };

  const handlePickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (res.canceled) return;
    setPickedFile({
      uri: res.assets[0].uri,
      name: res.assets[0].name,
    });
  };

  const handleSaveVariant = async () => {
    if (!version) return;
    if (!formName.trim()) {
      Alert.alert('Validación', 'El nombre de la variante es obligatorio.');
      return;
    }
    if (!formGroup.trim()) {
      Alert.alert('Validación', 'El identificador de grupo es obligatorio.');
      return;
    }
    if (!pickedFile && !formFileURL.trim()) {
      Alert.alert('Validación', 'Debés seleccionar o indicar la URL del archivo 3D (GLB).');
      return;
    }

    let parsedPartsDelta: MaterialPartsDelta | undefined;
    if (formPartsDeltaJson.trim()) {
      try {
        parsedPartsDelta = JSON.parse(formPartsDeltaJson.trim());
      } catch {
        Alert.alert('Validación', 'El formato JSON de despiece delta es inválido.');
        return;
      }
    }

    let parsedBudgetDelta: BudgetEntriesDelta | undefined;
    if (formBudgetDeltaJson.trim()) {
      try {
        parsedBudgetDelta = JSON.parse(formBudgetDeltaJson.trim());
      } catch {
        Alert.alert('Validación', 'El formato JSON de extras delta es inválido.');
        return;
      }
    }

    setSavingVariant(true);
    try {
      let finalUrl = formFileURL.trim();
      if (pickedFile) {
        finalUrl = await uploadFileToFirebase(pickedFile.uri, 'models', pickedFile.name);
      }

      const serializedProps = serializeVariantProperties({
        group: formGroup.trim().toLowerCase(),
        label: formLabel.trim(),
        allowNone: formAllowNone,
      });

      if (editingVariant) {
        await updateObjectVariant(editingVariant.id, {
          name: formName.trim(),
          mode: formMode,
          fileUrl: finalUrl,
          variantProperties: serializedProps,
          materialPartsDelta: parsedPartsDelta,
          budgetEntriesDelta: parsedBudgetDelta,
        });
      } else {
        await createObjectVariant(objectId, version, {
          name: formName.trim(),
          mode: formMode,
          fileUrl: finalUrl,
          variantProperties: serializedProps,
          materialPartsDelta: parsedPartsDelta,
          budgetEntriesDelta: parsedBudgetDelta,
          creatorId: backendUserId || '',
        });
      }

      setModalVisible(false);
      await loadData();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar la variante.');
    } finally {
      setSavingVariant(false);
    }
  };

  const handleDeleteVariant = (v: ObjectVariant) => {
    const doDelete = async () => {
      try {
        await deleteObjectVariant(v.id);
        const parsed = parseVariantProperties(v.variantProperties);
        const grp = parsed.group || 'default';
        if (defaultVariants[grp] === v.id) {
          await handleSetDefaultVariant(grp, null);
        }
        await loadData();
      } catch {
        Alert.alert('Error', 'No se pudo eliminar la variante.');
      }
    };

    const msg = `¿Seguro que deseás eliminar la variante "${v.name}"?`;
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) {
        doDelete();
      }
    } else {
      Alert.alert('Eliminar variante', msg, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>Accesorios y Variantes</Text>
          <Text style={styles.subtitle}>
            Configurá variaciones geométricas y accesorios intercambiables para este módulo.
          </Text>
        </View>
        <Pressable
          style={[styles.addBtn, (disabled || !version) && styles.addBtnDisabled]}
          disabled={disabled || !version}
          onPress={handleOpenCreate}
        >
          <Text style={styles.addBtnText}>+ Nueva variante</Text>
        </Pressable>
      </View>

      {loading ? (
        <Text style={styles.loadingText}>Cargando variantes...</Text>
      ) : groups.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No hay variantes configuradas para este módulo. Podés agregar tiradores, patas o acabados alternativos.
          </Text>
        </View>
      ) : (
        groups.map((group) => {
          const currentDefault = defaultVariants[group.group] ?? null;
          return (
            <View key={group.group} style={styles.groupCard}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>{group.label}</Text>
                <Text style={styles.groupIdBadge}>grupo: {group.group}</Text>
              </View>

              <View style={styles.defaultRow}>
                <Text style={styles.defaultLabel}>Predeterminada:</Text>
                <View style={styles.defaultChips}>
                  {group.allowNone && (
                    <Pressable
                      style={[styles.defaultChip, currentDefault === null && styles.defaultChipActive]}
                      disabled={disabled}
                      onPress={() => handleSetDefaultVariant(group.group, null)}
                    >
                      <Text
                        style={[
                          styles.defaultChipText,
                          currentDefault === null && styles.defaultChipTextActive,
                        ]}
                      >
                        Ninguno
                      </Text>
                    </Pressable>
                  )}
                  {group.variants.map((v) => {
                    const isDef = currentDefault === v.id;
                    return (
                      <Pressable
                        key={v.id}
                        style={[styles.defaultChip, isDef && styles.defaultChipActive]}
                        disabled={disabled}
                        onPress={() => handleSetDefaultVariant(group.group, v.id)}
                      >
                        <Text style={[styles.defaultChipText, isDef && styles.defaultChipTextActive]}>
                          {v.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.variantList}>
                {group.variants.map((v) => (
                  <View key={v.id} style={styles.variantItem}>
                    <View style={styles.variantItemHeader}>
                      <View style={styles.variantTitleRow}>
                        <Text style={styles.variantName}>{v.name}</Text>
                        <View
                          style={[
                            styles.modeBadge,
                            v.mode === 'replace' ? styles.modeBadgeReplace : styles.modeBadgeAdditive,
                          ]}
                        >
                          <Text style={styles.modeBadgeText}>
                            {v.mode === 'replace' ? 'Reemplazo' : '+ Aditiva'}
                          </Text>
                        </View>
                        {defaultVariants[group.group] === v.id && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Predeterminada</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.variantActions}>
                        <Pressable
                          style={styles.actionBtn}
                          disabled={disabled}
                          onPress={() => handleOpenEdit(v)}
                        >
                          <Text style={styles.actionBtnText}>Editar</Text>
                        </Pressable>
                        <Pressable
                          style={styles.actionBtn}
                          disabled={disabled}
                          onPress={() => handleDeleteVariant(v)}
                        >
                          <Text style={styles.deleteBtnText}>Eliminar</Text>
                        </Pressable>
                      </View>
                    </View>
                    {!!v.fileURL && (
                      <Text style={styles.fileUrlText} numberOfLines={1}>
                        Modelo: {v.fileURL.split('/').pop()?.split('?')[0] || v.fileURL}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
          );
        })
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={styles.modalTitle}>
                {editingVariant ? 'Editar Variante' : 'Nueva Variante'}
              </Text>

              <View style={formStyles.field}>
                <Text style={formStyles.label}>Nombre *</Text>
                <TextInput
                  style={formStyles.input}
                  value={formName}
                  onChangeText={setFormName}
                  placeholder="ej. Tirador Recto Negro"
                />
              </View>

              <View style={formStyles.field}>
                <Text style={formStyles.label}>Modo</Text>
                <View style={formStyles.chipRow}>
                  <Pressable
                    style={[formStyles.chip, formMode === 'additive' && formStyles.chipActive]}
                    onPress={() => setFormMode('additive')}
                  >
                    <Text
                      style={[
                        formStyles.chipText,
                        formMode === 'additive' && formStyles.chipTextActive,
                      ]}
                    >
                      + Aditiva (superpuesta)
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[formStyles.chip, formMode === 'replace' && formStyles.chipActive]}
                    onPress={() => setFormMode('replace')}
                  >
                    <Text
                      style={[
                        formStyles.chipText,
                        formMode === 'replace' && formStyles.chipTextActive,
                      ]}
                    >
                      Reemplazo (sustituye geometría)
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={formStyles.row}>
                <View style={[formStyles.field, formStyles.rowItem]}>
                  <Text style={formStyles.label}>Identificador de grupo *</Text>
                  <TextInput
                    style={formStyles.input}
                    value={formGroup}
                    onChangeText={setFormGroup}
                    placeholder="ej. handles, legs"
                    autoCapitalize="none"
                  />
                </View>
                <View style={[formStyles.field, formStyles.rowItem]}>
                  <Text style={formStyles.label}>Etiqueta visible</Text>
                  <TextInput
                    style={formStyles.input}
                    value={formLabel}
                    onChangeText={setFormLabel}
                    placeholder="ej. Tiradores, Patas"
                  />
                </View>
              </View>

              <View style={styles.toggleRow}>
                <Toggle
                  label="Permitir opción 'Ninguno' para este grupo"
                  value={formAllowNone}
                  onValueChange={setFormAllowNone}
                />
              </View>

              <View style={formStyles.field}>
                <Text style={formStyles.label}>Archivo 3D (.glb)</Text>
                <View style={styles.filePickerRow}>
                  <View style={styles.fileInfo}>
                    <Text style={styles.fileInfoText} numberOfLines={1}>
                      {pickedFile
                        ? pickedFile.name
                        : formFileURL
                          ? formFileURL.split('/').pop()?.split('?')[0] || formFileURL
                          : 'Sin archivo seleccionado'}
                    </Text>
                  </View>
                  <Pressable style={styles.pickBtn} onPress={handlePickFile}>
                    <Text style={styles.pickBtnText}>
                      {pickedFile || formFileURL ? 'Cambiar' : 'Elegir'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={formStyles.field}>
                <Text style={formStyles.label}>Deltas de Despiece (JSON opcional)</Text>
                <TextInput
                  style={[formStyles.input, formStyles.multiline]}
                  value={formPartsDeltaJson}
                  onChangeText={setFormPartsDeltaJson}
                  placeholder={'{\n  "add": [...],\n  "replace": [...],\n  "remove": [...]\n}'}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={formStyles.field}>
                <Text style={formStyles.label}>Deltas de Presupuesto/Extras (JSON opcional)</Text>
                <TextInput
                  style={[formStyles.input, formStyles.multiline]}
                  value={formBudgetDeltaJson}
                  onChangeText={setFormBudgetDeltaJson}
                  placeholder={'{\n  "add": [...],\n  "replace": [...],\n  "remove": [...]\n}'}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalCancelBtn}
                  disabled={savingVariant}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalCancelBtnText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalSaveBtn, savingVariant && styles.modalSaveBtnDisabled]}
                  disabled={savingVariant}
                  onPress={handleSaveVariant}
                >
                  <Text style={styles.modalSaveBtnText}>
                    {savingVariant ? 'Guardando...' : 'Guardar variante'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textHeading,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  addBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.primary,
  },
  addBtnDisabled: {
    opacity: 0.5,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.textMuted,
    paddingVertical: 12,
  },
  emptyContainer: {
    padding: 16,
    backgroundColor: COLORS.bgAlt,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  groupCard: {
    backgroundColor: COLORS.bgAlt,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 12,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textHeading,
  },
  groupIdBadge: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  defaultRow: {
    gap: 6,
  },
  defaultLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textHeading,
    textTransform: 'uppercase',
  },
  defaultChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  defaultChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  defaultChipActive: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },
  defaultChipText: {
    fontSize: 11,
    color: COLORS.textHeading,
  },
  defaultChipTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  variantList: {
    gap: 8,
  },
  variantItem: {
    backgroundColor: COLORS.bg,
    borderRadius: RADII.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    gap: 6,
  },
  variantItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  variantTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  variantName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  modeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADII.sm,
  },
  modeBadgeAdditive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  modeBadgeReplace: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textHeading,
  },
  defaultBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADII.sm,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  variantActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.danger,
  },
  fileUrlText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: COLORS.bg,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    elevation: 8,
  },
  modalScroll: {
    gap: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textHeading,
    marginBottom: 8,
  },
  toggleRow: {
    marginBottom: 10,
  },
  filePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fileInfo: {
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: COLORS.bgAlt,
    borderRadius: RADII.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fileInfoText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  pickBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  pickBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textHeading,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textHeading,
  },
  modalSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADII.md,
    backgroundColor: COLORS.primary,
  },
  modalSaveBtnDisabled: {
    opacity: 0.5,
  },
  modalSaveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
});
