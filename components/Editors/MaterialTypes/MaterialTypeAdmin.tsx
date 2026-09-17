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
import Button from '../../Button';
import {
  createMaterialType,
  deleteMaterialType,
  MaterialType,
  updateMaterialType,
} from '../../../services/api';
import { MaterialTypeUsage } from '../../../services/useMaterialTypes';
import { COLORS, commonStyles, RADII } from '../../../constants/theme';

interface MaterialTypeAdminProps {
  materialTypes: MaterialType[];
  usageByType: (typeId: string) => MaterialTypeUsage;
  onRefresh: () => void;
}

export default function MaterialTypeAdmin({
  materialTypes,
  usageByType,
  onRefresh,
}: MaterialTypeAdminProps) {
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingDescription, setEditingDescription] = useState('');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createMaterialType({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
      });
      setNewName('');
      setNewDescription('');
      onRefresh();
    } catch {
      Alert.alert('Error', 'Failed to create material type.');
    }
  };

  const handleRename = async (id: string) => {
    if (!editingName.trim()) return;
    try {
      await updateMaterialType(id, {
        name: editingName.trim(),
        description: editingDescription.trim() || null,
      });
      setEditingId(null);
      setEditingName('');
      setEditingDescription('');
      onRefresh();
    } catch {
      Alert.alert('Error', 'Failed to update material type.');
    }
  };

  const handleDelete = (type: MaterialType) => {
    const usage = usageByType(type.id);
    const confirm = () => {
      if (usage.slotCount > 0) {
        Alert.alert(
          'Cannot delete',
          `This type is used by ${usage.slotCount} slot(s). Remove the slots first.`
        );
        return;
      }
      deleteMaterialType(type.id)
        .then(() => onRefresh())
        .catch((err: Error & { status?: number }) => {
          if (err.status === 500) {
            Alert.alert(
              'Cannot delete',
              'This type is used by one or more slots and cannot be deleted.'
            );
          } else {
            Alert.alert('Error', 'Failed to delete material type.');
          }
        });
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this material type?')) confirm();
    } else {
      Alert.alert('Delete Material Type', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirm },
      ]);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>Material Types</Text>
      <Text style={styles.headerSubtitle}>
        Manage the coarse material classifications (MDF, Granite, Glass, …) used by model slots.
      </Text>

      <Text style={styles.sectionTitle}>Create Type</Text>
      <TextInput
        style={styles.input}
        value={newName}
        onChangeText={setNewName}
        placeholder="Type name (e.g. MDF)"
        placeholderTextColor={COLORS.textFaint}
      />
      <TextInput
        style={[styles.input, styles.multilineInput]}
        value={newDescription}
        onChangeText={setNewDescription}
        placeholder="Description (optional)"
        placeholderTextColor={COLORS.textFaint}
        multiline
      />
      <Button label="Create" onPress={handleCreate} />

      {materialTypes.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 28 }]}>
            Existing Types
          </Text>
          {materialTypes.map((type) => {
            const usage = usageByType(type.id);
            const isEditing = editingId === type.id;
            return (
              <View key={type.id} style={styles.typeRow}>
                {isEditing ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={editingName}
                      onChangeText={setEditingName}
                    />
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={editingDescription}
                      onChangeText={setEditingDescription}
                      placeholder="Description"
                      placeholderTextColor={COLORS.textFaint}
                    />
                    <View style={styles.editActions}>
                      <Pressable
                        style={styles.smallButton}
                        onPress={() => handleRename(type.id)}
                      >
                        <Text style={styles.smallButtonText}>Save</Text>
                      </Pressable>
                      <Pressable
                        style={styles.smallButton}
                        onPress={() => setEditingId(null)}
                      >
                        <Text style={styles.smallButtonText}>Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <>
                    <View style={styles.typeInfo}>
                      <Text style={styles.typeName}>{type.name}</Text>
                      {type.description ? (
                        <Text style={styles.typeDescription} numberOfLines={2}>
                          {type.description}
                        </Text>
                      ) : null}
                      <Text style={styles.typeUsage}>
                        {usage.slotCount > 0
                          ? `Used by ${usage.slotCount} slot(s)`
                          : 'Not used by any slot'}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.smallButton}
                      onPress={() => {
                        setEditingId(type.id);
                        setEditingName(type.name);
                        setEditingDescription(type.description ?? '');
                      }}
                    >
                      <Text style={styles.smallButtonText}>Rename</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.smallButton, styles.deleteSmallButton]}
                      onPress={() => handleDelete(type)}
                    >
                      <Text style={styles.smallButtonText}>Del</Text>
                    </Pressable>
                  </>
                )}
              </View>
            );
          })}
        </>
      )}

      {materialTypes.length === 0 && (
        <Text style={styles.emptyText}>
          No material types yet. Create MDF, Granite, Glass, … so model slots have an allowed type to pick from.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    ...commonStyles.screen,
  },
  content: {
    padding: 24,
    backgroundColor: COLORS.bg,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 24,
    lineHeight: 19,
  },
  sectionTitle: {
    ...commonStyles.sectionTitle,
  },
  input: {
    ...commonStyles.input,
  },
  multilineInput: {
    ...commonStyles.multilineInput,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgAlt,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADII.md,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typeInfo: {
    flex: 1,
  },
  typeName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textBody,
  },
  typeDescription: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  typeUsage: {
    fontSize: 11,
    color: COLORS.textFaint,
    marginTop: 2,
  },
  editRow: {
    flex: 1,
  },
  editActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  smallButton: {
    ...commonStyles.smallButton,
  },
  deleteSmallButton: {
    ...commonStyles.deleteSmallButton,
  },
  smallButtonText: {
    ...commonStyles.smallButtonText,
  },
  emptyText: {
    ...commonStyles.emptyText,
  },
});