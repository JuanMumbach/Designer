import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import Button from '../Button';
import { uploadFileToFirebase } from '../../services/firebaseSetup';
import { useAuth } from '../../services/AuthContext';
import {
  fetchAllObjectModels,
  fetchObjectVersion,
  MaterialCategory,
  ObjectModel,
} from '../../services/api';
import { ObjectTemplate } from '../DesignScreen/3dView/DesignObjects';
import MaterialPreview from './MaterialPreview';

export type MaterialFormData = {
  name: string;
  creatorId: string;
  categoryId: string | null;
  fileURL: string;
  scaleU: string;
  scaleV: string;
  materialProperties: string;
};

interface MaterialEditorProps {
  initial?: Partial<MaterialFormData>;
  categories: MaterialCategory[];
  onSave: (data: MaterialFormData, isEdit: boolean) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
  isEdit: boolean;
}

export default function MaterialEditor({
  initial,
  categories,
  onSave,
  onDelete,
  onClose,
  isEdit,
}: MaterialEditorProps) {
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 700;

  const [name, setName] = useState(initial?.name ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [fileURL] = useState(initial?.fileURL ?? '');
  const [scaleU, setScaleU] = useState(initial?.scaleU ?? '1');
  const [scaleV, setScaleV] = useState(initial?.scaleV ?? '1');
  const [materialProperties, setMaterialProperties] = useState(
    initial?.materialProperties ?? ''
  );
  const [saving, setSaving] = useState(false);
  const [pickedFile, setPickedFile] = useState<{
    uri: string;
    name: string;
  } | null>(null);

  const [selectedTemplate, setSelectedTemplate] = useState<ObjectTemplate | null>(null);
  const [selectedMesh, setSelectedMesh] = useState<string | null>(null);
  const [discoveredMeshes, setDiscoveredMeshes] = useState<string[]>([]);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [allModels, setAllModels] = useState<ObjectTemplate[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  const loadModels = useCallback(async () => {
    if (allModels.length > 0) {
      setShowModelPicker(true);
      return;
    }
    setModelsLoading(true);
    try {
      const objectModels: ObjectModel[] = await fetchAllObjectModels();
      const templatesArray: ObjectTemplate[] = [];
      for (const model of objectModels) {
        try {
          const version = await fetchObjectVersion(model.id);
          templatesArray.push({
            id: model.id,
            version: version.version,
            name: model.name,
            modelUrl: version.fileURL,
            width: version.sizeX,
            height: version.sizeY,
            depth: version.sizeZ,
            categoryId: model.categoryId || undefined,
          });
        } catch {
          // skip models with failed version fetch
        }
      }
      setAllModels(templatesArray);
    } catch {
      Alert.alert('Error', 'Failed to load models.');
    } finally {
      setModelsLoading(false);
      setShowModelPicker(true);
    }
  }, [allModels.length]);

  const handleModelSelect = (template: ObjectTemplate) => {
    setSelectedTemplate(template);
    setSelectedMesh(null);
    setDiscoveredMeshes([]);
    setShowModelPicker(false);
  };

  const handleMeshesDiscovered = (names: string[]) => {
    setDiscoveredMeshes(names);
  };

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
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Name is required.');
      return;
    }
    if (!isEdit && !user?.uid) {
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
          creatorId: initial?.creatorId ?? user?.uid ?? '',
          categoryId: categoryId || null,
          fileURL: finalUrl,
          scaleU: scaleU || '1',
          scaleV: scaleV || '1',
          materialProperties: materialProperties.trim(),
        },
        isEdit
      );
      onClose();
    } catch {
      // error handled by caller
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

  const formContent = (
    <>
      <Text style={styles.headerTitle}>
        {isEdit ? 'Edit Material' : 'New Material'}
      </Text>

      <Text style={styles.label}>Name *</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Material name"
      />

      <Text style={styles.label}>Category</Text>
      <View style={styles.categoryRow}>
        <Pressable
          style={[
            styles.categoryChip,
            categoryId === '' && styles.categoryChipActive,
          ]}
          onPress={() => setCategoryId('')}
        >
          <Text
            style={[
              styles.categoryChipText,
              categoryId === '' && styles.categoryChipTextActive,
            ]}
          >
            None
          </Text>
        </Pressable>
        {availableCategories.map((cat) => (
          <Pressable
            key={cat.id}
            style={[
              styles.categoryChip,
              categoryId === cat.id && styles.categoryChipActive,
            ]}
            onPress={() => setCategoryId(cat.id)}
          >
            <Text
              style={[
                styles.categoryChipText,
                categoryId === cat.id && styles.categoryChipTextActive,
              ]}
            >
              {cat.categoryName}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>
        {isEdit ? 'Update Version Data' : 'Initial Version Data'}
      </Text>

      <Text style={styles.label}>File</Text>
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
              ? `Selected: ${pickedFile.name}`
              : fileURL
                ? '\u2713 File loaded'
                : 'No file selected'}
          </Text>
          {pickedFile && (
            <Pressable
              onPress={() => setPickedFile(null)}
              hitSlop={8}
              style={styles.clearButton}
            >
              <Text style={styles.clearButtonLabel}>{'\u2715'}</Text>
            </Pressable>
          )}
        </View>
        <Pressable
          style={styles.pickButton}
          onPress={handlePickFile}
          disabled={saving}
        >
          <Text style={styles.pickButtonLabel}>
            {pickedFile || fileURL ? 'Change' : 'Pick File'}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Scale U</Text>
      <TextInput
        style={styles.input}
        value={scaleU}
        onChangeText={setScaleU}
        keyboardType="decimal-pad"
        placeholder="1.0"
      />

      <Text style={styles.label}>Scale V</Text>
      <TextInput
        style={styles.input}
        value={scaleV}
        onChangeText={setScaleV}
        keyboardType="decimal-pad"
        placeholder="1.0"
      />

      <Text style={styles.label}>Material Properties</Text>
      <TextInput
        style={[styles.input, styles.multilineInput]}
        value={materialProperties}
        onChangeText={setMaterialProperties}
        placeholder="e.g. roughness:0.5;metalness:0.1"
        multiline
      />

      <View style={styles.actions}>
        <Button label={saving ? 'Saving...' : 'Save'} onPress={handleSave} />
        <Pressable style={styles.cancelButton} onPress={onClose}>
          <Text style={styles.cancelButtonLabel}>Cancel</Text>
        </Pressable>
      </View>

      {isEdit && onDelete && (
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonLabel}>Delete Material</Text>
        </Pressable>
      )}
    </>
  );

  const previewContent = (
    <>
      <View style={styles.modelSelectorRow}>
        <Text style={styles.modelSelectorLabel}>
          {selectedTemplate ? `Model: ${selectedTemplate.name}` : 'Preview Model'}
        </Text>
        <Pressable style={styles.selectModelButton} onPress={loadModels}>
          <Text style={styles.selectModelButtonLabel}>
            {selectedTemplate ? 'Change' : 'Select Model'}
          </Text>
        </Pressable>
      </View>
      <MaterialPreview
        modelUrl={selectedTemplate?.modelUrl ?? null}
        textureUri={pickedFile?.uri ?? null}
        selectedMesh={selectedMesh}
        onMeshesDiscovered={handleMeshesDiscovered}
      />
      {discoveredMeshes.length > 0 && (
        <View style={styles.meshSlotsSection}>
          <Text style={styles.meshSlotsLabel}>Texture Slots</Text>
          <View style={styles.meshSlotsRow}>
            {discoveredMeshes.map((meshName) => {
              const isActive = selectedMesh === meshName;
              return (
                <Pressable
                  key={meshName}
                  style={[styles.meshChip, isActive && styles.meshChipActive]}
                  onPress={() =>
                    setSelectedMesh(meshName === selectedMesh ? null : meshName)
                  }
                >
                  <Text
                    style={[
                      styles.meshChipText,
                      isActive && styles.meshChipTextActive,
                    ]}
                  >
                    {meshName}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </>
  );

  return (
    <View style={styles.container}>
      {isWide ? (
        <View style={styles.rowContainer}>
          <View style={styles.formColumn}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
            >
              {formContent}
            </ScrollView>
          </View>
          <View style={styles.previewColumn}>
            {previewContent}
          </View>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          {formContent}
          <View style={styles.previewRow}>
            {previewContent}
          </View>
        </ScrollView>
      )}
      {showModelPicker && (
        <View style={styles.modelPickerOverlay}>
          <View style={styles.modelPickerCard}>
            <Text style={styles.pickerTitle}>Select a 3D Model for Preview</Text>
            {modelsLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#2563eb" />
                <Text style={styles.loadingText}>Loading models...</Text>
              </View>
            ) : allModels.length === 0 ? (
              <Text style={styles.emptyText}>No models available.</Text>
            ) : (
              <ScrollView style={styles.modelPickerList}>
                {allModels.map((model) => (
                  <Pressable
                    key={model.id}
                    style={styles.modelItem}
                    onPress={() => handleModelSelect(model)}
                  >
                    <View style={styles.modelItemInfo}>
                      <Text style={styles.modelItemName}>{model.name}</Text>
                      <Text style={styles.modelItemDims}>
                        {model.width} x {model.height} x {model.depth}
                      </Text>
                    </View>
                    <Text style={styles.selectArrow}>Select</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <Pressable
              style={styles.cancelModelPicker}
              onPress={() => setShowModelPicker(false)}
            >
              <Text style={styles.cancelButtonLabel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: 'white',
  },
  rowContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  formColumn: {
    width: 340,
    maxWidth: '35%',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  previewColumn: {
    flex: 1,
    padding: 16,
  },
  previewRow: {
    height: 350,
    marginTop: 16,
    marginBottom: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginTop: 20,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 44,
    borderColor: '#e5e7eb',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    fontSize: 14,
    color: '#111827',
  },
  multilineInput: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  categoryChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  categoryChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  actions: {
    marginTop: 24,
    gap: 10,
    alignItems: 'center',
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  cancelButtonLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  deleteButton: {
    marginTop: 24,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#dc2626',
  },
  deleteButtonLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
    borderColor: '#e5e7eb',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
  },
  fileInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#9ca3af',
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
    color: '#6b7280',
  },
  pickButton: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickButtonLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  modelPickerOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modelPickerCard: {
    width: 340,
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 30,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 30,
  },
  modelPickerList: {
    maxHeight: 300,
  },
  modelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modelItemInfo: {
    flex: 1,
    marginRight: 10,
  },
  modelItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 2,
  },
  modelItemDims: {
    fontSize: 11,
    color: '#6b7280',
  },
  selectArrow: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },
  cancelModelPicker: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  modelSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modelSelectorLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
    marginRight: 8,
  },
  selectModelButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#2563eb',
  },
  selectModelButtonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  meshSlotsSection: {
    marginTop: 12,
  },
  meshSlotsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  meshSlotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  meshChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  meshChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  meshChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  meshChipTextActive: {
    color: '#fff',
  },
});
