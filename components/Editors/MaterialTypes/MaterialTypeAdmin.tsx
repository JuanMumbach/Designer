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
      />
      <TextInput
        style={[styles.input, styles.multilineInput]}
        value={newDescription}
        onChangeText={setNewDescription}
        placeholder="Description (optional)"
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
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    padding: 24,
    backgroundColor: '#1a1a2e',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 24,
    lineHeight: 19,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 44,
    borderColor: '#2d2d44',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#1e1e2f',
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 10,
  },
  multilineInput: {
    height: 70,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e2f',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  typeInfo: {
    flex: 1,
  },
  typeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  typeDescription: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  typeUsage: {
    fontSize: 11,
    color: '#64748b',
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
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#334155',
    marginLeft: 6,
  },
  deleteSmallButton: {
    backgroundColor: '#7f1d1d',
  },
  smallButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 14,
    paddingVertical: 30,
    lineHeight: 20,
  },
});