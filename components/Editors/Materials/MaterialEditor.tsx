import React, { useEffect, useState } from 'react';
import { parseBudgetNumber } from '../../../services/budget';
import { defaultBoardSettings, validateBoardSettings } from '../../../services/materialParts';
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
import { MaterialCategory, MaterialType } from '../../../services/api';
import FormPanel, { formStyles } from '../FormPanel';

export type MaterialFormData = {
  pricePerSquareMeter: number | null;
  boardWidthMm: number;
  boardHeightMm: number;
  cutSpacingMm: number;
  costMultiplier: number;
  name: string;
  creatorId: string;
  categoryId: string | null;
  typeId: string | null;
  fileURL: string;
  scaleU: string;
  scaleV: string;
  materialProperties: string;
  isPublic: boolean;
};

interface MaterialEditorProps {
  initial?: Partial<MaterialFormData>;
  categories: MaterialCategory[];
  materialTypes: MaterialType[];
  onSave: (data: MaterialFormData, isEdit: boolean) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
  isEdit: boolean;
  disabled?: boolean;
  onTextureChange?: (uri: string | null) => void;
  onScaleChange?: (scaleU: number, scaleV: number) => void;
}

const TABS = [
  { key: 'general', label: 'General' },
  { key: 'texture', label: 'Textura' },
  { key: 'pricing', label: 'Precio' },
];

export default function MaterialEditor({
  initial,
  categories,
  materialTypes,
  onSave,
  onDelete,
  onClose,
  isEdit,
  disabled,
  onTextureChange,
  onScaleChange,
}: MaterialEditorProps) {
  const { backendUserId } = useAuth();

  const [tab, setTab] = useState('general');
  const [name, setName] = useState(initial?.name ?? '');
  const [costMultiplier, setCostMultiplier] = useState(String(initial?.costMultiplier ?? 1));
  const [pricePerSquareMeter, setPricePerSquareMeter] = useState(initial?.pricePerSquareMeter == null ? '' : String(initial.pricePerSquareMeter));
  const [boardWidthMm, setBoardWidthMm] = useState(String(initial?.boardWidthMm ?? defaultBoardSettings.boardWidthMm));
  const [boardHeightMm, setBoardHeightMm] = useState(String(initial?.boardHeightMm ?? defaultBoardSettings.boardHeightMm));
  const [cutSpacingMm, setCutSpacingMm] = useState(String(initial?.cutSpacingMm ?? defaultBoardSettings.cutSpacingMm));
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [typeId, setTypeId] = useState(initial?.typeId ?? '');
  const [fileURL, setFileURL] = useState(initial?.fileURL ?? '');
  const [scaleU, setScaleU] = useState(initial?.scaleU ?? '1');
  const [scaleV, setScaleV] = useState(initial?.scaleV ?? '1');
  const [materialProperties, setMaterialProperties] = useState(
    initial?.materialProperties ?? ''
  );
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? false);
  const [pendingPublicValue, setPendingPublicValue] = useState<boolean | null>(null);
  useEffect(() => {
    if (!onScaleChange) return;
    const su = parseFloat(scaleU);
    const sv = parseFloat(scaleV);
    if (!isNaN(su) && !isNaN(sv)) {
      onScaleChange(su, sv);
    }
  }, [scaleU, scaleV, onScaleChange]);

  const [saving, setSaving] = useState(false);
  const [pickedFile, setPickedFile] = useState<{
    uri: string;
    name: string;
  } | null>(null);

  const handlePickFile = async () => {
    const file = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      copyToCacheDirectory: true,
    });
    if (file.canceled) return;
    setPickedFile({
      uri: file.assets[0].uri,
      name: file.assets[0].name,
    });
    onTextureChange?.(file.assets[0].uri);
  };

  const handleSave = async () => {
    const price = pricePerSquareMeter.trim() ? parseBudgetNumber(pricePerSquareMeter) : null;
    const width = parseBudgetNumber(boardWidthMm, 100000, true);
    const height = parseBudgetNumber(boardHeightMm, 100000, true);
    const spacing = parseBudgetNumber(cutSpacingMm, 1000);
    if (price === undefined || width === undefined || height === undefined || spacing === undefined || validateBoardSettings({ boardWidthMm: width, boardHeightMm: height, cutSpacingMm: spacing })) { setTab('pricing'); Alert.alert('Material', 'Revisá el precio por m², las medidas de placa y la separación de cortes.'); return; }
    const parsedMultiplier = parseBudgetNumber(costMultiplier, 1e6, true);
    if (parsedMultiplier === undefined) { setTab('pricing'); Alert.alert('Presupuesto', 'El multiplicador debe ser mayor que 0 y hasta 1.000.000.'); return; }
    if (!name.trim()) {
      setTab('general');
      Alert.alert('Validation', 'Name is required.');
      return;
    }
    if (!isEdit && !backendUserId) {
      Alert.alert('Validation', 'You must be logged in to create materials.');
      return;
    }

    setSaving(true);
    try {
      let finalUrl = fileURL.trim();
      if (pickedFile) {
        finalUrl = await uploadFileToFirebase(
          pickedFile.uri,
          'materials',
          pickedFile.name
        );
      }

      await onSave(
        {
          name: name.trim(),
          creatorId: initial?.creatorId ?? backendUserId ?? '',
          categoryId: categoryId || null,
          typeId: typeId || null,
          fileURL: finalUrl,
          scaleU: scaleU || '1',
          scaleV: scaleV || '1',
          materialProperties: materialProperties.trim(),
          costMultiplier: parsedMultiplier,
          pricePerSquareMeter: price,
          boardWidthMm: width,
          boardHeightMm: height,
          cutSpacingMm: spacing,
          isPublic,
        },
        isEdit
      );
      onClose();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!onDelete) return;
    const message = 'Are you sure you want to delete this material?';
    if (Platform.OS === 'web') {
      if (window.confirm(message)) onDelete();
    } else {
      Alert.alert('Delete Material', message, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(),
        },
      ]);
    }
  };

  const availableCategories = categories.filter(
    (c) => c.parentCategoryId === null || c.id !== categoryId
  );

  const handleRequestPublicChange = (value: boolean) => {
    setPendingPublicValue(value);
  };

  const confirmPublicChange = () => {
    if (pendingPublicValue !== null) {
      setIsPublic(pendingPublicValue);
    }
    setPendingPublicValue(null);
  };

  const inputsDisabled = disabled || saving;

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

  const renderNumberField = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    placeholder?: string
  ) => (
    <View style={[formStyles.field, formStyles.rowItem]}>
      <Text style={formStyles.label}>{label}</Text>
      <TextInput
        style={[formStyles.input, inputsDisabled && formStyles.inputDisabled]}
        value={value}
        onChangeText={onChange}
        editable={!inputsDisabled}
        keyboardType="decimal-pad"
        accessibilityLabel={label}
        placeholder={placeholder}
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
          placeholder="Nombre del material"
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
        <Text style={formStyles.label}>Tipo de material</Text>
        {renderChips(
          materialTypes.map((type) => ({ id: type.id, label: type.name })),
          typeId,
          setTypeId
        )}
      </View>
      <Toggle
        label="Compartir en la comunidad (público)"
        value={isPublic}
        onValueChange={handleRequestPublicChange}
      />
    </>
  );

  const renderTexture = () => (
    <>
      <View style={formStyles.field}>
        <Text style={formStyles.label}>Archivo de textura</Text>
        <View style={styles.fileRow}>
          <View style={styles.fileInfo}>
            <Text
              style={[
                styles.fileInfoText,
                (pickedFile ?? fileURL) && styles.fileInfoTextLoaded,
              ]}
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
                  onTextureChange?.(null);
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
        {renderNumberField('Escala U', scaleU, setScaleU, '1.0')}
        {renderNumberField('Escala V', scaleV, setScaleV, '1.0')}
      </View>
      <View style={formStyles.field}>
        <Text style={formStyles.label}>Propiedades del material</Text>
        <TextInput
          style={[formStyles.input, formStyles.multiline, inputsDisabled && formStyles.inputDisabled]}
          value={materialProperties}
          onChangeText={setMaterialProperties}
          placeholder="ej. roughness:0.5;metalness:0.1"
          multiline
          editable={!inputsDisabled}
        />
      </View>
    </>
  );

  const renderPricing = () => (
    <>
      {renderNumberField('Precio por m² (vacío = pendiente)', pricePerSquareMeter, setPricePerSquareMeter, 'Precio por m²')}
      <View style={formStyles.row}>
        {renderNumberField('Ancho de placa (mm)', boardWidthMm, setBoardWidthMm)}
        {renderNumberField('Alto de placa (mm)', boardHeightMm, setBoardHeightMm)}
      </View>
      {renderNumberField('Separación entre cortes (mm)', cutSpacingMm, setCutSpacingMm)}
      {renderNumberField('Factor para conceptos manuales (sin despiece)', costMultiplier, setCostMultiplier)}
    </>
  );

  return (
    <>
      <FormPanel
        title={isEdit ? 'Editar material' : 'Nuevo material'}
        tabs={TABS}
        activeTab={tab}
        onTabChange={setTab}
        primaryAction={{ label: saving ? 'Guardando...' : 'Guardar', onPress: handleSave, disabled: inputsDisabled }}
        secondaryAction={{ label: 'Cancelar', onPress: onClose, disabled: saving }}
        dangerAction={isEdit && onDelete ? { label: 'Eliminar', onPress: handleDelete, disabled: inputsDisabled } : undefined}
      >
        {tab === 'general' && renderGeneral()}
        {tab === 'texture' && renderTexture()}
        {tab === 'pricing' && renderPricing()}
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
              {pendingPublicValue ? 'Hacer público el material' : 'Hacer privado el material'}
            </Text>
            <Text style={styles.modalText}>
              {pendingPublicValue
                ? 'Este material será visible para la comunidad y otros usuarios podrán clonarlo o agregarlo como acceso directo. ¿Continuar?'
                : 'Este material dejará de ser visible para la comunidad. ¿Continuar?'}
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
