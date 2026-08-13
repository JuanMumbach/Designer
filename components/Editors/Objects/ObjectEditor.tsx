import { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import Button from '../../Button';
import { uploadFileToFirebase } from '../../../services/firebaseSetup';
import { useAuth } from '../../../services/AuthContext';
import { MaterialType, ObjectCategory } from '../../../services/api';
import ModelSlotsSection from './ModelSlotsSection';

export type ObjectFormData = {
  name: string;
  creatorId: string;
  categoryId: string | null;
  fileURL: string;
  sizeX: string;
  sizeY: string;
  sizeZ: string;
  objectProperties: string;
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
  onSave: (data: ObjectFormData, isEdit: boolean) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
  isEdit: boolean;
  disabled?: boolean;
  onPreviewUriChange?: (uri: string | null) => void;
  objectId?: string;
  materialTypes?: MaterialType[];
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
  objectId,
  materialTypes,
}: ObjectEditorProps) {
  const { backendUserId } = useAuth();

  const [name, setName] = useState(initial?.name ?? '');
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
  const [saving, setSaving] = useState(false);
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

      await onSave(
        {
          name: name.trim(),
          creatorId: initial?.creatorId ?? backendUserId ?? '',
          categoryId: categoryId || null,
          fileURL: finalUrl,
          sizeX: sizeX || '1',
          sizeY: sizeY || '1',
          sizeZ: sizeZ || '1',
          objectProperties: parts.join(';'),
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

  const availableCategories = categories.filter(
    (c) => c.parentCategoryId === null || c.id !== categoryId
  );

  const formContent = (
    <>
      <Text style={styles.headerTitle}>
        {disabled ? 'Object Form' : isEdit ? 'Edit Object' : 'New Object'}
      </Text>

      <Text style={styles.label}>Name *</Text>
      <TextInput
        style={[styles.input, disabled && styles.inputDisabled]}
        value={name}
        onChangeText={setName}
        placeholder="Object name"
        editable={!disabled}
      />

      {!disabled && (
        <>
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
        </>
      )}

      <Text style={styles.sectionTitle}>
        {isEdit ? 'Update Version Data' : 'Initial Version Data'}
      </Text>

      {!disabled && (
        <>
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
        </>
      )}

      <Text style={styles.label}>Size X</Text>
      <TextInput
        style={[styles.input, disabled && styles.inputDisabled]}
        value={sizeX}
        onChangeText={setSizeX}
        keyboardType="decimal-pad"
        placeholder="1.0"
        editable={!disabled}
      />

      <Text style={styles.label}>Size Y</Text>
      <TextInput
        style={[styles.input, disabled && styles.inputDisabled]}
        value={sizeY}
        onChangeText={setSizeY}
        keyboardType="decimal-pad"
        placeholder="1.0"
        editable={!disabled}
      />

      <Text style={styles.label}>Size Z</Text>
      <TextInput
        style={[styles.input, disabled && styles.inputDisabled]}
        value={sizeZ}
        onChangeText={setSizeZ}
        keyboardType="decimal-pad"
        placeholder="1.0"
        editable={!disabled}
      />

      {!disabled && (
        <>
          <Text style={styles.label}>Moving Behaviour</Text>
          <View style={styles.categoryRow}>
            <Pressable
              style={[
                styles.categoryChip,
                selectedBehaviour === '' && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedBehaviour('')}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedBehaviour === '' && styles.categoryChipTextActive,
                ]}
              >
                None
              </Text>
            </Pressable>
            {KNOWN_BEHAVIOURS.map((behaviour) => (
              <Pressable
                key={behaviour}
                style={[
                  styles.categoryChip,
                  selectedBehaviour === behaviour && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedBehaviour(behaviour)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    selectedBehaviour === behaviour &&
                      styles.categoryChipTextActive,
                  ]}
                >
                  {behaviour.charAt(0).toUpperCase() + behaviour.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Text style={styles.label}>Object Properties</Text>
      <TextInput
        style={[styles.input, styles.multilineInput, disabled && styles.inputDisabled]}
        value={objectProperties}
        onChangeText={setObjectProperties}
        placeholder="e.g. height:0.8"
        multiline
        editable={!disabled}
      />

      {!disabled && (
        <View style={styles.actions}>
          <Button label={saving ? 'Saving...' : 'Save'} onPress={handleSave} />
          <Pressable style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonLabel}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {!disabled && isEdit && onDelete && (
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonLabel}>Delete Object</Text>
        </Pressable>
      )}

      {isEdit && objectId && (
        <ModelSlotsSection
          objectId={objectId}
          fileUrl={pickedFile?.uri ?? initial?.fileURL}
          materialTypes={materialTypes ?? []}
          disabled={disabled}
        />
      )}
    </>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {formContent}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: 'white',
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
  inputDisabled: {
    backgroundColor: '#f3f4f6',
    color: '#9ca3af',
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
});
