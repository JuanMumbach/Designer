import React, { useEffect, useState } from 'react';
import BudgetEntriesEditor, { budgetEntryDrafts, readBudgetEntryDrafts } from '../../DesignScreen/Budget/BudgetEntriesEditor';
import { ModelBudgetEntry } from '../../../services/budget';
import { MaterialPart } from '../../../services/materialParts';
import MaterialPartsEditor, { materialPartDrafts, readMaterialPartDrafts } from './MaterialPartsEditor';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import Toggle from '../../Toggle';
import { COLORS } from '../../../constants/theme';
import { uploadFileToFirebase } from '../../../services/firebaseSetup';
import { useAuth } from '../../../services/AuthContext';
import { fetchModelMaterialTypes, fetchObjectVersion, MaterialType, ObjectCategory } from '../../../services/api';
import ModelSlotsSection from './ModelSlotsSection';
import FormPanel, { formStyles } from '../FormPanel';

export type ObjectFormData = {
  materialParts: MaterialPart[];
  budgetEntries: ModelBudgetEntry[];
  name: string;
  creatorId: string;
  categoryId: string | null;
  fileURL: string;
  sizeX: string;
  sizeY: string;
  sizeZ: string;
  objectProperties: string;
  isPublic: boolean;
};

const KNOWN_BEHAVIOURS = ['counter', 'cupboard', 'free'];

function parseInitialProperties(props: string): {
  behaviour: string;
  other: string;
} {
  let behaviour = '';
  const otherSegments: string[] = [];

  for (const segment of props.split(';')) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) {
      otherSegments.push(trimmed);
      continue;
    }
    const key = trimmed.slice(0, colonIndex).trim().toLowerCase();
    const value = trimmed.slice(colonIndex + 1).trim();
    if (key === 'moving-behavior') {
      if (KNOWN_BEHAVIOURS.includes(value)) {
        behaviour = value;
      } else {
        otherSegments.push(trimmed);
      }
    } else {
      otherSegments.push(trimmed);
    }
  }

  return { behaviour, other: otherSegments.join(';') };
}

interface ObjectEditorProps {
  initial?: Partial<ObjectFormData>;
  categories: ObjectCategory[];
  onSave: (
    data: ObjectFormData,
    isEdit: boolean
  ) => Promise<{
    slotAssignment?: { objectId: string; fileUrl: string };
  }>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
  isEdit: boolean;
  disabled?: boolean;
  onPreviewUriChange?: (uri: string | null) => void;
  materialTypes?: MaterialType[];
  objectId?: string;
  onHighlightSlot?: (slot: number | null) => void;
  onRegenerateThumbnail?: () => Promise<void>;
}

export default function ObjectEditor({
  initial,
  categories,
  onSave,
  onDelete,
  onClose,
  isEdit,
  disabled,
  onPreviewUriChange,
  materialTypes,
  objectId,
  onHighlightSlot,
  onRegenerateThumbnail,
}: ObjectEditorProps) {
  const { backendUserId } = useAuth();

  const [name, setName] = useState(initial?.name ?? '');
  const [budgetDrafts, setBudgetDrafts] = useState(() => budgetEntryDrafts(initial?.budgetEntries ?? []));
  const [partDrafts, setPartDrafts] = useState(() => materialPartDrafts(initial?.materialParts ?? []));
  const [tab, setTab] = useState<'general' | 'model' | 'parts' | 'costs' | 'materials'>('general');
  const [budgetSlots, setBudgetSlots] = useState<{ slot: number; displayName: string }[]>([]);
  useEffect(() => {
    let active = true;
    setBudgetSlots([]);
    if (objectId) fetchObjectVersion(objectId).then((version) => fetchModelMaterialTypes(objectId, version.version))
      .then((slots) => { if (active) setBudgetSlots(slots); }).catch(() => {});
    return () => { active = false; };
  }, [objectId]);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [fileURL, setFileURL] = useState(initial?.fileURL ?? '');
  const [sizeX, setSizeX] = useState(initial?.sizeX ?? '1');
  const [sizeY, setSizeY] = useState(initial?.sizeY ?? '1');
  const [sizeZ, setSizeZ] = useState(initial?.sizeZ ?? '1');
  const parsedInitial = parseInitialProperties(initial?.objectProperties ?? '');
  const [selectedBehaviour, setSelectedBehaviour] = useState(
    parsedInitial.behaviour
  );
  const [objectProperties, setObjectProperties] = useState(
    parsedInitial.other
  );
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? false);
  const [pendingPublicValue, setPendingPublicValue] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [pickedFile, setPickedFile] = useState<{
    uri: string;
    name: string;
  } | null>(null);

  const handlePickFile = async () => {
    const file = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (file.canceled) return;
    setPickedFile({
      uri: file.assets[0].uri,
      name: file.assets[0].name,
    });
    onPreviewUriChange?.(file.assets[0].uri);
  };

  const handleSave = async () => {
    const materialBreakdown = readMaterialPartDrafts(partDrafts);
    if (materialBreakdown.error) { Alert.alert('Despiece', materialBreakdown.error); return; }
    const budget = readBudgetEntryDrafts(budgetDrafts);
    if (budget.error) { Alert.alert('Presupuesto', budget.error); return; }
    if (!name.trim()) {
      Alert.alert('Validation', 'Name is required.');
      return;
    }
    if (!isEdit && !backendUserId) {
      Alert.alert('Validation', 'You must be logged in to create objects.');
      return;
    }

    setSaving(true);
    try {
      let finalUrl = fileURL.trim();
      if (pickedFile) {
        finalUrl = await uploadFileToFirebase(
          pickedFile.uri,
          'models',
          pickedFile.name
        );
      }

      const manualProps = objectProperties.trim();
      const parts: string[] = [];
      if (selectedBehaviour) {
        parts.push(`moving-behavior:${selectedBehaviour}`);
      }
      if (manualProps) {
        parts.push(manualProps);
      }

      const result = await onSave(
        {
          name: name.trim(),
          creatorId: initial?.creatorId ?? backendUserId ?? '',
          categoryId: categoryId || null,
          fileURL: finalUrl,
          sizeX: sizeX || '1',
          sizeY: sizeY || '1',
          sizeZ: sizeZ || '1',
          objectProperties: parts.join(';'),
          budgetEntries: budget.entries,
          materialParts: materialBreakdown.parts,
          isPublic,
        },
        isEdit
      );
      setSaving(false);
      if (result?.slotAssignment) {
        // Panel is hosted by the parent; keep this editor mounted until save completes.
      } else {
        onClose();
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!onDelete) return;
    const message = 'Are you sure you want to delete this object?';
    if (Platform.OS === 'web') {
      if (window.confirm(message)) onDelete();
    } else {
      Alert.alert('Delete Object', message, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(),
        },
      ]);
    }
  };

  const handleRegenerateThumbnail = async () => {
    if (!onRegenerateThumbnail) return;
    setRegenerating(true);
    try {
      await onRegenerateThumbnail();
    } catch {
      // error handled by caller
    } finally {
      setRegenerating(false);
    }
  };

  const availableCategories = categories.filter(
    (c) => c.parentCategoryId === null || c.id !== categoryId
  );

  const handleRequestPublicChange = (value: boolean) => {
    if (!value) {
      setPendingPublicValue(false);
      return;
    }
    setPendingPublicValue(true);
  };

  const confirmPublicChange = () => {
    if (pendingPublicValue !== null) {
      setIsPublic(pendingPublicValue);
    }
    setPendingPublicValue(null);
  };

  const inputsDisabled = disabled || saving;

  const tabs = [
    { key: 'general', label: 'General' },
    { key: 'model', label: 'Modelo 3D' },
    { key: 'parts', label: 'Despiece' },
    { key: 'costs', label: 'Extras' },
    { key: 'materials', label: 'Materiales' },
  ];

  const renderChips = (
    options: { id: string; label: string }[],
    value: string,
    onChange: (id: string) => void
  ) => (
    <View style={formStyles.chipRow}>
      {[{ id: '', label: 'Ninguno' }, ...options].map((option) => {
        const active = value === option.id;
        return (
          <Pressable
            key={option.id || 'none'}
            style={[formStyles.chip, active && formStyles.chipActive]}
            onPress={() => onChange(option.id)}
          >
            <Text style={[formStyles.chipText, active && formStyles.chipTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderSizeField = (label: string, value: string, onChange: (value: string) => void) => (
    <View style={[formStyles.field, formStyles.rowItem]}>
      <Text style={formStyles.label}>{label}</Text>
      <TextInput
        style={[formStyles.input, inputsDisabled && formStyles.inputDisabled]}
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder="1.0"
        editable={!inputsDisabled}
      />
    </View>
  );

  const renderGeneral = () => (
    <>
      <View style={formStyles.field}>
        <Text style={formStyles.label}>Nombre *</Text>
        <TextInput
          style={[formStyles.input, inputsDisabled && formStyles.inputDisabled]}
          value={name}
          onChangeText={setName}
          placeholder="Nombre del módulo"
          editable={!inputsDisabled}
        />
      </View>
      <View style={formStyles.field}>
        <Text style={formStyles.label}>Categoría</Text>
        {renderChips(
          availableCategories.map((cat) => ({ id: cat.id, label: cat.categoryName })),
          categoryId,
          setCategoryId
        )}
      </View>
      <View style={formStyles.field}>
        <Text style={formStyles.label}>Comportamiento de movimiento</Text>
        {renderChips(
          KNOWN_BEHAVIOURS.map((behaviour) => ({
            id: behaviour,
            label: behaviour.charAt(0).toUpperCase() + behaviour.slice(1),
          })),
          selectedBehaviour,
          setSelectedBehaviour
        )}
      </View>
      <Toggle
        label="Compartir en la comunidad (público)"
        value={isPublic}
        onValueChange={handleRequestPublicChange}
      />
    </>
  );

  const renderModel = () => (
    <>
      <View style={formStyles.field}>
        <Text style={formStyles.label}>Archivo del modelo</Text>
        <View style={styles.fileRow}>
          <View style={styles.fileInfo}>
            <Text
              style={[styles.fileInfoText, (pickedFile ?? fileURL) && styles.fileInfoTextLoaded]}
              numberOfLines={1}
            >
              {pickedFile
                ? `Seleccionado: ${pickedFile.name}`
                : fileURL
                  ? '\u2713 Archivo cargado'
                  : 'Sin archivo'}
            </Text>
            {pickedFile && (
              <Pressable
                onPress={() => {
                  setPickedFile(null);
                  onPreviewUriChange?.(null);
                }}
                hitSlop={8}
                style={styles.clearButton}
              >
                <Text style={styles.clearButtonLabel}>{'\u2715'}</Text>
              </Pressable>
            )}
          </View>
          <Pressable style={styles.pickButton} onPress={handlePickFile} disabled={saving}>
            <Text style={styles.pickButtonLabel}>{pickedFile || fileURL ? 'Cambiar' : 'Elegir'}</Text>
          </Pressable>
        </View>
      </View>
      <View style={formStyles.row}>
        {renderSizeField('Ancho (X)', sizeX, setSizeX)}
        {renderSizeField('Alto (Y)', sizeY, setSizeY)}
        {renderSizeField('Prof. (Z)', sizeZ, setSizeZ)}
      </View>
      <View style={formStyles.field}>
        <Text style={formStyles.label}>Propiedades del objeto</Text>
        <TextInput
          style={[formStyles.input, formStyles.multiline, inputsDisabled && formStyles.inputDisabled]}
          value={objectProperties}
          onChangeText={setObjectProperties}
          placeholder="ej. height:0.8"
          multiline
          editable={!inputsDisabled}
        />
      </View>
      {isEdit && !!onRegenerateThumbnail && (
        <Pressable
          style={[styles.regenerateButton, (regenerating || pickedFile) && styles.regenerateButtonDisabled]}
          onPress={handleRegenerateThumbnail}
          disabled={regenerating || saving || !!pickedFile}
        >
          <Text style={styles.regenerateButtonLabel}>
            {regenerating ? 'Regenerando miniatura…' : 'Regenerar miniatura'}
          </Text>
        </Pressable>
      )}
    </>
  );

  const renderTab = () => {
    if (tab === 'general') return renderGeneral();
    if (tab === 'model') return renderModel();
    if (tab === 'parts') {
      return <MaterialPartsEditor drafts={partDrafts} onChange={setPartDrafts} slots={budgetSlots} disabled={inputsDisabled} />;
    }
    if (tab === 'costs') {
      return (
        <>
          <Text style={[formStyles.label, styles.costsTitle]}>Costos adicionales del módulo</Text>
          <Text style={[formStyles.hint, styles.costsHint]}>Los materiales definidos en Despiece se calculan por m². Los conceptos vinculados a esos mismos slots se reemplazan para evitar duplicarlos. Los costos fijos siempre se suman.</Text>
          <BudgetEntriesEditor drafts={budgetDrafts} onChange={setBudgetDrafts} slots={budgetSlots} disabled={inputsDisabled} />
        </>
      );
    }
    return isEdit && objectId
      ? <ModelSlotsSection objectId={objectId} materialTypes={materialTypes ?? []} disabled={disabled} onHighlightSlot={onHighlightSlot} />
      : <Text style={formStyles.hint}>Guardá el modelo 3D para descubrir y asignar los materiales de sus slots.</Text>;
  };

  return (
    <>
      <FormPanel
        title={isEdit ? 'Editar módulo' : 'Nuevo módulo'}
        tabs={tabs}
        activeTab={tab}
        onTabChange={(key) => setTab(key as typeof tab)}
        primaryAction={{ label: saving ? 'Guardando...' : 'Guardar', onPress: handleSave, disabled: inputsDisabled }}
        secondaryAction={{ label: 'Cancelar', onPress: onClose, disabled: saving }}
        dangerAction={isEdit && onDelete ? { label: 'Eliminar', onPress: handleDelete, disabled: inputsDisabled } : undefined}
      >
        {renderTab()}
      </FormPanel>

      <Modal
        visible={pendingPublicValue !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingPublicValue(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {pendingPublicValue ? 'Hacer público el objeto' : 'Hacer privado el objeto'}
            </Text>
            <Text style={styles.modalText}>
              {pendingPublicValue
                ? 'Este objeto será visible para la comunidad y otros usuarios podrán clonarlo o agregarlo como acceso directo. ¿Continuar?'
                : 'Este objeto dejará de ser visible para la comunidad. ¿Continuar?'}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setPendingPublicValue(null)}
              >
                <Text style={styles.modalButtonTextSecondary}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={confirmPublicChange}
              >
                <Text style={styles.modalButtonTextPrimary}>Confirmar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  costsTitle: {
    marginBottom: 6,
  },
  costsHint: {
    marginBottom: 12,
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
  clearButton: {
    marginLeft: 4,
    padding: 2,
  },
  clearButtonLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  pickButton: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickButtonLabel: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  regenerateButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  regenerateButtonDisabled: {
    opacity: 0.5,
  },
  regenerateButtonLabel: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  modalButtonPrimary: {
    backgroundColor: '#2563eb',
  },
  modalButtonSecondary: {
    backgroundColor: '#f3f4f6',
  },
  modalButtonTextPrimary: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtonTextSecondary: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
});
