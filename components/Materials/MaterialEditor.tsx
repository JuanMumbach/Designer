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
import Button from '../Button';
import { MaterialCategory } from '../../services/api';

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
  const [name, setName] = useState(initial?.name ?? '');
  const [creatorId, setCreatorId] = useState(initial?.creatorId ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [fileURL, setFileURL] = useState(initial?.fileURL ?? '');
  const [scaleU, setScaleU] = useState(initial?.scaleU ?? '1');
  const [scaleV, setScaleV] = useState(initial?.scaleV ?? '1');
  const [materialProperties, setMaterialProperties] = useState(
    initial?.materialProperties ?? ''
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Name is required.');
      return;
    }
    if (!isEdit && !creatorId.trim()) {
      Alert.alert('Validation', 'Creator ID is required.');
      return;
    }

    setSaving(true);
    try {
      await onSave(
        {
          name: name.trim(),
          creatorId: creatorId.trim(),
          categoryId: categoryId || null,
          fileURL: fileURL.trim(),
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

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
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

        {!isEdit && (
          <>
            <Text style={styles.label}>Creator ID *</Text>
            <TextInput
              style={styles.input}
              value={creatorId}
              onChangeText={setCreatorId}
              placeholder="e.g. 3fa85f64-5717-4562-b3fc-2c963f66afa6"
            />
          </>
        )}

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

        <Text style={styles.label}>File URL</Text>
        <TextInput
          style={styles.input}
          value={fileURL}
          onChangeText={setFileURL}
          placeholder="https://..."
        />

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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 340,
    maxHeight: '90%',
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden',
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
});
