import { useCallback, useEffect, useState } from 'react';
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
  addWorkspaceMember,
  createWorkspaceRole,
  deleteWorkspaceRole,
  fetchAllWorkspaceRoles,
  fetchWorkspaceMembers,
  removeWorkspaceMember,
  updateWorkspaceMember,
  updateWorkspaceRole,
  WorkspaceMember,
  WorkspaceRole,
} from '../../../services/api';

interface WorkspaceAdminProps {
  workspaceId: string;
}

export default function WorkspaceAdmin({ workspaceId }: WorkspaceAdminProps) {
  const [roles, setRoles] = useState<WorkspaceRole[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingRoleName, setEditingRoleName] = useState('');
  const [editingRoleDescription, setEditingRoleDescription] = useState('');

  const [newMemberUserId, setNewMemberUserId] = useState('');
  const [newMemberRoleId, setNewMemberRoleId] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, m] = await Promise.all([
        fetchAllWorkspaceRoles(),
        fetchWorkspaceMembers(workspaceId),
      ]);
      setRoles(r);
      setMembers(m);
    } catch (e) {
      setError((e as Error).message || 'Failed to load workspace data.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const confirm = (message: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(message)) onConfirm();
    } else {
      Alert.alert('Confirm', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'OK', onPress: onConfirm },
      ]);
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;
    try {
      await createWorkspaceRole({
        name: newRoleName.trim(),
        description: newRoleDescription.trim() || undefined,
      });
      setNewRoleName('');
      setNewRoleDescription('');
      await reload();
    } catch {
      Alert.alert('Error', 'Failed to create workspace role.');
    }
  };

  const handleUpdateRole = async (id: string) => {
    if (!editingRoleName.trim()) return;
    try {
      await updateWorkspaceRole(id, {
        name: editingRoleName.trim(),
        description: editingRoleDescription.trim() || null,
      });
      setEditingRoleId(null);
      await reload();
    } catch {
      Alert.alert('Error', 'Failed to update workspace role.');
    }
  };

  const handleDeleteRole = (role: WorkspaceRole) => {
    confirm(`Delete role "${role.name}"?`, async () => {
      try {
        await deleteWorkspaceRole(role.id);
        await reload();
      } catch {
        Alert.alert(
          'Cannot delete',
          'This role may be assigned to members or is otherwise in use.'
        );
      }
    });
  };

  const handleAddMember = async () => {
    const userId = newMemberUserId.trim();
    if (!userId) {
      Alert.alert('Validation', 'Enter the user GUID to add.');
      return;
    }
    if (!newMemberRoleId) {
      Alert.alert('Validation', 'Select a role for the new member.');
      return;
    }
    if (members.some((m) => m.userId === userId)) {
      Alert.alert('Validation', 'That user is already a member of this workspace.');
      return;
    }
    try {
      await addWorkspaceMember({ userId, workspaceId, roleId: newMemberRoleId });
      setNewMemberUserId('');
      setNewMemberRoleId('');
      await reload();
    } catch {
      Alert.alert('Error', 'Failed to add member to workspace.');
    }
  };

  const handleChangeMemberRole = async (member: WorkspaceMember, roleId: string) => {
    try {
      await updateWorkspaceMember(member.userId, workspaceId, { roleId });
      await reload();
    } catch {
      Alert.alert('Error', 'Failed to update member role.');
    }
  };

  const handleRemoveMember = (member: WorkspaceMember) => {
    confirm(`Remove member "${member.username ?? member.userId}" from this workspace?`, async () => {
      try {
        await removeWorkspaceMember(member.userId, workspaceId);
        await reload();
      } catch {
        Alert.alert('Error', 'Failed to remove member from workspace.');
      }
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading workspace…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={reload}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerSubtitle}>
        Manage the workspace roles and their assigned members.
      </Text>

      {/* ── Roles ── */}
      <Text style={styles.sectionTitle}>Workspace Roles</Text>
      <TextInput
        style={styles.input}
        value={newRoleName}
        onChangeText={setNewRoleName}
        placeholder="Role name (e.g. Admin)"
      />
      <TextInput
        style={[styles.input, styles.multilineInput]}
        value={newRoleDescription}
        onChangeText={setNewRoleDescription}
        placeholder="Description (optional)"
        multiline
      />
      <Button label="Create Role" onPress={handleCreateRole} />

      {roles.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Existing Roles</Text>
          {roles.map((role) => {
            const isEditing = editingRoleId === role.id;
            return (
              <View key={role.id} style={styles.row}>
                {isEditing ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={editingRoleName}
                      onChangeText={setEditingRoleName}
                    />
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={editingRoleDescription}
                      onChangeText={setEditingRoleDescription}
                      placeholder="Description"
                    />
                    <View style={styles.editActions}>
                      <Pressable
                        style={styles.smallButton}
                        onPress={() => handleUpdateRole(role.id)}
                      >
                        <Text style={styles.smallButtonText}>Save</Text>
                      </Pressable>
                      <Pressable
                        style={styles.smallButton}
                        onPress={() => setEditingRoleId(null)}
                      >
                        <Text style={styles.smallButtonText}>Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <>
                    <View style={styles.info}>
                      <Text style={styles.name}>{role.name}</Text>
                      {role.description ? (
                        <Text style={styles.description} numberOfLines={2}>
                          {role.description}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      style={styles.smallButton}
                      onPress={() => {
                        setEditingRoleId(role.id);
                        setEditingRoleName(role.name);
                        setEditingRoleDescription(role.description ?? '');
                      }}
                    >
                      <Text style={styles.smallButtonText}>Rename</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.smallButton, styles.deleteSmallButton]}
                      onPress={() => handleDeleteRole(role)}
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

      {roles.length === 0 && (
        <Text style={styles.emptyText}>
          No workspace roles yet. Create Admin, Editor, Viewer, … so members have a role to assign.
        </Text>
      )}

      {/* ── Members ── */}
      <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Members</Text>
      <TextInput
        style={styles.input}
        value={newMemberUserId}
        onChangeText={setNewMemberUserId}
        placeholder="User GUID to add"
        autoCapitalize="none"
      />
      <Text style={styles.label}>Role</Text>
      <View style={styles.chipRow}>
        {roles.map((role) => (
          <Pressable
            key={role.id}
            style={[styles.chip, newMemberRoleId === role.id && styles.chipActive]}
            onPress={() => setNewMemberRoleId(role.id)}
          >
            <Text
              style={[styles.chipText, newMemberRoleId === role.id && styles.chipTextActive]}
            >
              {role.name}
            </Text>
          </Pressable>
        ))}
      </View>
      <Button label="Add Member" onPress={handleAddMember} />

      {members.length > 0 ? (
        <View style={styles.memberList}>
          {members.map((member) => (
            <View key={member.userId} style={styles.memberRow}>
              <View style={styles.info}>
                <Text style={styles.name}>
                  {member.username ?? member.userId}
                </Text>
                <Text style={styles.description} numberOfLines={1}>
                  Current role: {member.roleName ?? '—'}
                </Text>
                <Text style={styles.usage}>User ID: {member.userId}</Text>
              </View>
              <View style={styles.roleSelector}>
                <Text style={styles.label}>Role</Text>
                <View style={styles.chipRow}>
                  {roles.map((role) => (
                    <Pressable
                      key={role.id}
                      style={[
                        styles.chip,
                        member.roleId === role.id && styles.chipActive,
                      ]}
                      onPress={() => handleChangeMemberRole(member, role.id)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          member.roleId === role.id && styles.chipTextActive,
                        ]}
                      >
                        {role.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <Pressable
                style={[styles.smallButton, styles.deleteSmallButton]}
                onPress={() => handleRemoveMember(member)}
              >
                <Text style={styles.smallButtonText}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>No members in this workspace yet.</Text>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 24,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  errorText: {
    color: '#f87171',
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  retryText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
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
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 6,
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
  row: {
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
  info: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  description: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  usage: {
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#1e1e2f',
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  chipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  chipTextActive: {
    color: '#fff',
  },
  memberList: {
    gap: 8,
  },
  memberRow: {
    backgroundColor: '#1e1e2f',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  roleSelector: {
    marginTop: 8,
  },
});
