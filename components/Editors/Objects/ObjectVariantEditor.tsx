import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { COLORS, RADII } from '../../../constants/theme';
import FormPanel, { formStyles } from '../FormPanel';
import Toggle from '../../Toggle';
import BudgetEntriesEditor, { budgetEntryDrafts, readBudgetEntryDrafts } from '../../DesignScreen/Budget/BudgetEntriesEditor';
import MaterialPartsEditor, { materialPartDrafts, readMaterialPartDrafts } from './MaterialPartsEditor';
import { useAuth } from '../../../services/AuthContext';
import { uploadFileToFirebase } from '../../../services/firebaseSetup';
import { createObjectVariant, updateObjectVariant } from '../../../services/api';
import { ModelBudgetEntry } from '../../../services/budget';
import { MaterialPart } from '../../../services/materialParts';
import {
  BudgetEntriesDelta,
  defaultHandleGroupLabel,
  isHandleVariantGroup,
  MaterialPartsDelta,
  normalizeHandleKey,
  normalizeHandlePosition,
  ObjectVariant,
  parseVariantProperties,
  serializeVariantProperties,
  stripHandlePositionSuffix,
} from '../../../services/variants';

type VariantTab = 'general' | 'model' | 'parts' | 'costs';

export default function ObjectVariantEditor({
  objectId,
  version,
  variant,
  baseParts,
  baseEntries,
  slots,
  onClose,
  onSaved,
  onPreviewUriChange,
}: {
  objectId: string;
  version: number;
  variant: ObjectVariant | null;
  baseParts: MaterialPart[];
  baseEntries: ModelBudgetEntry[];
  slots: { slot: number; displayName: string }[];
  onClose: () => void;
  onSaved: () => void;
  onPreviewUriChange?: (uri: string | null) => void;
}) {
  const { backendUserId } = useAuth();
  const parsed = variant ? parseVariantProperties(variant.variantProperties) : undefined;
  const [tab, setTab] = useState<VariantTab>('general');
  const [name, setName] = useState(variant?.name ?? '');
  const [mode, setMode] = useState<'additive' | 'replace'>(variant?.mode ?? 'additive');
  const [group, setGroup] = useState(parsed?.baseGroup || parsed?.group || 'handles');
  const [handlePosition, setHandlePosition] = useState(parsed?.handlePosition || '');
  const [label, setLabel] = useState(parsed?.label || 'Tiradores');
  const [handleType, setHandleType] = useState(parsed?.handleType || '');
  const [allowNone, setAllowNone] = useState(parsed?.allowNone ?? true);
  const [fileURL] = useState(variant?.fileURL ?? '');
  const [pickedFile, setPickedFile] = useState<{ uri: string; name: string } | null>(null);
  const [removedParts, setRemovedParts] = useState<Set<string>>(
    () => new Set(variant?.materialPartsDelta?.remove ?? [])
  );
  const [removedEntries, setRemovedEntries] = useState<Set<string>>(
    () => new Set(variant?.budgetEntriesDelta?.remove ?? [])
  );
  const [addedParts, setAddedParts] = useState(() => materialPartDrafts(variant?.materialPartsDelta?.add ?? []));
  const [addedEntries, setAddedEntries] = useState(() => budgetEntryDrafts(variant?.budgetEntriesDelta?.add ?? []));
  const [saving, setSaving] = useState(false);

  const normalizedPos = isHandleVariantGroup(group)
    ? normalizeHandlePosition(handlePosition)
    : undefined;
  const autoNameForKey = normalizedPos ? stripHandlePositionSuffix(name) : name;

  const handleSelectHandlePosition = (nextPos: string) => {
    const prevAutoLabel = defaultHandleGroupLabel(normalizeHandlePosition(handlePosition));
    setHandlePosition(nextPos);
    const trimmedLabel = label.trim();
    if (
      !trimmedLabel ||
      trimmedLabel === 'Tiradores' ||
      trimmedLabel === 'Tiradores Superiores' ||
      trimmedLabel === 'Tiradores Inferiores' ||
      trimmedLabel === prevAutoLabel
    ) {
      setLabel(defaultHandleGroupLabel(normalizeHandlePosition(nextPos)));
    }
  };

  const toggleIn = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handlePickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (res.canceled) return;
    setPickedFile({ uri: res.assets[0].uri, name: res.assets[0].name });
    onPreviewUriChange?.(res.assets[0].uri);
  };

  const handleClose = () => {
    onPreviewUriChange?.(null);
    onClose();
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Validación', 'El nombre de la variante es obligatorio.'); return; }
    if (!group.trim()) { Alert.alert('Validación', 'El identificador de grupo es obligatorio.'); return; }
    if (!pickedFile && !fileURL.trim()) { Alert.alert('Validación', 'Debés seleccionar el archivo 3D (GLB).'); return; }
    const parts = readMaterialPartDrafts(addedParts);
    if (parts.error && addedParts.length > 0) { Alert.alert('Despiece', parts.error); return; }
    const entries = readBudgetEntryDrafts(addedEntries);
    if (entries.error && addedEntries.length > 0) { Alert.alert('Extras', entries.error); return; }

    const basePartIds = new Set(baseParts.map((p) => p.id));
    const baseEntryIds = new Set(baseEntries.map((e) => e.id));
    const partsDelta: MaterialPartsDelta = {
      add: parts.parts,
      replace: variant?.materialPartsDelta?.replace,
      remove: Array.from(removedParts).filter((id) => basePartIds.has(id)),
    };
    const budgetDelta: BudgetEntriesDelta = {
      add: entries.entries,
      replace: variant?.budgetEntriesDelta?.replace,
      remove: Array.from(removedEntries).filter((id) => baseEntryIds.has(id)),
    };

    setSaving(true);
    try {
      const finalUrl = pickedFile
        ? await uploadFileToFirebase(pickedFile.uri, 'models', pickedFile.name)
        : fileURL.trim();
      const effectiveHandleType = handleType.trim()
        ? normalizeHandleKey(handleType)
        : isHandleVariantGroup(group)
          ? normalizeHandleKey(autoNameForKey)
          : undefined;
      const variantProperties = serializeVariantProperties({
        group: group.trim().toLowerCase(),
        label: label.trim(),
        allowNone,
        handleType: effectiveHandleType,
        handlePosition: normalizedPos,
        raw: parsed?.raw,
      });
      const payload = {
        name: name.trim(),
        mode,
        fileUrl: finalUrl,
        variantProperties,
        materialPartsDelta: partsDelta,
        budgetEntriesDelta: budgetDelta,
      };
      if (variant) await updateObjectVariant(variant.id, payload);
      else await createObjectVariant(objectId, version, { ...payload, creatorId: backendUserId || '' });
      onPreviewUriChange?.(null);
      onSaved();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar la variante.');
    } finally {
      setSaving(false);
    }
  };

  const renderChip = (active: boolean, text: string, onPress: () => void) => (
    <Pressable key={text} style={[formStyles.chip, active && formStyles.chipActive]} onPress={onPress} disabled={saving}>
      <Text style={[formStyles.chipText, active && formStyles.chipTextActive]}>{text}</Text>
    </Pressable>
  );

  const renderBaseRow = (id: string, title: string, detail: string, removed: boolean, onToggle: () => void) => (
    <View key={id} style={[styles.baseRow, removed && styles.baseRowRemoved]}>
      <View style={styles.baseInfo}>
        <Text style={[styles.baseTitle, removed && styles.baseTextRemoved]} numberOfLines={1}>{title || 'Sin nombre'}</Text>
        <Text style={[styles.baseDetail, removed && styles.baseTextRemoved]} numberOfLines={1}>{detail}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        style={[styles.toggleBtn, removed ? styles.toggleBtnRestore : styles.toggleBtnRemove]}
        onPress={onToggle}
        disabled={saving}
      >
        <Text style={[styles.toggleBtnText, removed ? styles.toggleTextRestore : styles.toggleTextRemove]}>
          {removed ? 'Reactivar' : 'Desactivar'}
        </Text>
      </Pressable>
    </View>
  );

  const slotName = (slot: number | null | undefined) => {
    if (slot == null) return 'Costo fijo';
    return slots.find((s) => s.slot === slot)?.displayName ?? `Slot ${slot}`;
  };

  const renderGeneral = () => (
    <>
      <View style={formStyles.field}>
        <Text style={formStyles.label}>Nombre *</Text>
        <TextInput style={formStyles.input} value={name} onChangeText={setName} placeholder="ej. Tirador Recto Negro" editable={!saving} />
      </View>
      <View style={formStyles.field}>
        <Text style={formStyles.label}>Modo</Text>
        <View style={formStyles.chipRow}>
          {renderChip(mode === 'additive', '+ Aditiva (superpuesta)', () => setMode('additive'))}
          {renderChip(mode === 'replace', 'Reemplazo (sustituye geometría)', () => setMode('replace'))}
        </View>
      </View>
      <View style={formStyles.row}>
        <View style={[formStyles.field, formStyles.rowItem]}>
          <Text style={formStyles.label}>Grupo *</Text>
          <TextInput style={formStyles.input} value={group} onChangeText={setGroup} placeholder="ej. handles, legs" autoCapitalize="none" editable={!saving} />
        </View>
        <View style={[formStyles.field, formStyles.rowItem]}>
          <Text style={formStyles.label}>Etiqueta visible</Text>
          <TextInput style={formStyles.input} value={label} onChangeText={setLabel} placeholder="ej. Tiradores, Patas" editable={!saving} />
        </View>
      </View>
      {isHandleVariantGroup(group) && (
        <View style={formStyles.field}>
          <Text style={formStyles.label}>Ubicación del tirador (para muebles con múltiples tiradores)</Text>
          <View style={formStyles.chipRow}>
            {renderChip(
              normalizedPos === undefined,
              'General (único)',
              () => handleSelectHandlePosition('')
            )}
            {renderChip(
              normalizedPos === 'top',
              'Superior (top)',
              () => handleSelectHandlePosition('top')
            )}
            {renderChip(
              normalizedPos === 'bottom',
              'Inferior (bottom)',
              () => handleSelectHandlePosition('bottom')
            )}
          </View>
          <TextInput
            style={[formStyles.input, styles.handlePositionInput]}
            value={handlePosition}
            onChangeText={handleSelectHandlePosition}
            placeholder="Opcional: top, bottom, central..."
            autoCapitalize="none"
            editable={!saving}
          />
        </View>
      )}
      {(isHandleVariantGroup(group) || Boolean(handleType.trim())) && (
        <View style={formStyles.field}>
          <Text style={formStyles.label}>Identificador global de tirador</Text>
          <TextInput
            style={formStyles.input}
            value={handleType}
            onChangeText={setHandleType}
            placeholder={
              autoNameForKey.trim()
                ? `ej. ${normalizeHandleKey(autoNameForKey)} (auto desde nombre)`
                : 'ej. recto-negro'
            }
            autoCapitalize="none"
            editable={!saving}
          />
        </View>
      )}
      <Toggle label="Permitir opción 'Ninguno' para este grupo" value={allowNone} onValueChange={setAllowNone} />
    </>
  );

  const renderModel = () => (
    <View style={formStyles.field}>
      <Text style={formStyles.label}>Archivo 3D (.glb) *</Text>
      <View style={styles.fileRow}>
        <View style={styles.fileInfo}>
          <Text style={[styles.fileInfoText, (pickedFile || fileURL) && styles.fileInfoTextLoaded]} numberOfLines={1}>
            {pickedFile ? `Seleccionado: ${pickedFile.name}` : fileURL ? '\u2713 Archivo cargado' : 'Sin archivo'}
          </Text>
          {pickedFile && (
            <Pressable hitSlop={8} onPress={() => { setPickedFile(null); onPreviewUriChange?.(null); }}>
              <Text style={styles.clearText}>{'\u2715'}</Text>
            </Pressable>
          )}
        </View>
        <Pressable style={styles.pickBtn} onPress={handlePickFile} disabled={saving}>
          <Text style={styles.pickBtnText}>{pickedFile || fileURL ? 'Cambiar' : 'Elegir'}</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderParts = () => (
    <>
      <Text style={formStyles.label}>Despiece del módulo base</Text>
      <Text style={[formStyles.hint, styles.sectionHint]}>Desactivá las partes que esta variante no utiliza.</Text>
      <View style={styles.baseList}>
        {baseParts.length === 0 ? (
          <Text style={formStyles.hint}>El módulo no tiene partes de despiece.</Text>
        ) : (
          baseParts.map((p) =>
            renderBaseRow(
              p.id,
              p.name,
              `${p.widthMm} × ${p.heightMm} mm · x${p.quantity} · ${slotName(p.materialSlot)}`,
              removedParts.has(p.id),
              () => toggleIn(setRemovedParts, p.id)
            )
          )
        )}
      </View>
      <Text style={[formStyles.label, styles.addedTitle]}>Partes agregadas por la variante</Text>
      <MaterialPartsEditor drafts={addedParts} onChange={setAddedParts} slots={slots} disabled={saving} />
    </>
  );

  const renderCosts = () => (
    <>
      <Text style={formStyles.label}>Extras del módulo base</Text>
      <Text style={[formStyles.hint, styles.sectionHint]}>Desactivá los conceptos que esta variante no incluye.</Text>
      <View style={styles.baseList}>
        {baseEntries.length === 0 ? (
          <Text style={formStyles.hint}>El módulo no tiene conceptos de presupuesto.</Text>
        ) : (
          baseEntries.map((e) =>
            renderBaseRow(
              e.id,
              e.name,
              `$ ${e.basePrice} · ${slotName(e.materialSlot)}`,
              removedEntries.has(e.id),
              () => toggleIn(setRemovedEntries, e.id)
            )
          )
        )}
      </View>
      <Text style={[formStyles.label, styles.addedTitle]}>Conceptos agregados por la variante</Text>
      <BudgetEntriesEditor drafts={addedEntries} onChange={setAddedEntries} slots={slots} disabled={saving} />
    </>
  );

  const renderTab = () => {
    if (tab === 'general') return renderGeneral();
    if (tab === 'model') return renderModel();
    if (tab === 'parts') return renderParts();
    return renderCosts();
  };

  return (
    <FormPanel
      title={variant ? `Editar variante: ${variant.name}` : 'Nueva variante'}
      tabs={[
        { key: 'general', label: 'General' },
        { key: 'model', label: 'Modelo 3D' },
        { key: 'parts', label: 'Despiece' },
        { key: 'costs', label: 'Extras' },
      ]}
      activeTab={tab}
      onTabChange={(key) => setTab(key as VariantTab)}
      primaryAction={{ label: saving ? 'Guardando...' : 'Guardar variante', onPress: handleSave, disabled: saving }}
      secondaryAction={{ label: 'Volver', onPress: handleClose, disabled: saving }}
    >
      {renderTab()}
    </FormPanel>
  );
}

const styles = StyleSheet.create({
  handlePositionInput: {
    marginTop: 8,
  },
  sectionHint: {
    marginBottom: 10,
  },
  baseList: {
    gap: 8,
  },
  baseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgAlt,
  },
  baseRowRemoved: {
    backgroundColor: '#374151',
    borderColor: '#1f2937',
  },
  baseInfo: {
    flex: 1,
  },
  baseTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textHeading,
  },
  baseDetail: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  baseTextRemoved: {
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADII.sm,
    borderWidth: 1,
  },
  toggleBtnRemove: {
    borderColor: '#dc2626',
  },
  toggleBtnRestore: {
    borderColor: '#4ade80',
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  toggleTextRemove: {
    color: '#dc2626',
  },
  toggleTextRestore: {
    color: '#4ade80',
  },
  addedTitle: {
    marginTop: 18,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fileInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: COLORS.bgAlt,
  },
  fileInfoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textFaint,
  },
  fileInfoTextLoaded: {
    color: '#16a34a',
  },
  clearText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  pickBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
});
