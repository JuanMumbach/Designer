import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import WorkspaceAdmin from '@/components/Editors/Workspaces/WorkspaceAdmin';
import {
  createWorkspace,
  fetchAllWorkspaces,
  Workspace,
} from '@/services/api';
import { useAuth } from '@/services/AuthContext';
import { COLORS, commonStyles, RADII } from '@/constants/theme';

export default function WorkspacesScreen() {
  const { backendUserId, selectedWorkspaceId: contextSelectedWorkspaceId } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [showNewWorkspace, setShowNewWorkspace] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadWorkspaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ws = await fetchAllWorkspaces();
      setWorkspaces(ws);
      setSelectedWorkspaceId((prev) => {
        if (prev) return prev;
        if (
          contextSelectedWorkspaceId &&
          ws.some((w) => w.id === contextSelectedWorkspaceId)
        ) {
          return contextSelectedWorkspaceId;
        }
        return null;
      });
    } catch {
      setError('Failed to load workspaces.');
    } finally {
      setLoading(false);
    }
  }, [contextSelectedWorkspaceId]);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const handleCreateWorkspace = async () => {
    const name = newWorkspaceName.trim();
    if (!name) return;
    if (!backendUserId) {
      Alert.alert('Validation', 'You must be logged in to create a workspace.');
      return;
    }
    setCreating(true);
    try {
      const ws = await createWorkspace({ name, creatorId: backendUserId });
      setWorkspaces((prev) => [...prev, ws]);
      setSelectedWorkspaceId(ws.id);
      setNewWorkspaceName('');
      setShowNewWorkspace(false);
    } catch {
      Alert.alert('Error', 'Failed to create workspace.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading workspaces…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={loadWorkspaces}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.pickerSection}>
        <Text style={commonStyles.label}>Workspace</Text>
        {workspaces.length > 0 ? (
          <View style={commonStyles.chipRow}>
            {workspaces.map((ws) => (
              <Pressable
                key={ws.id}
                style={[
                  commonStyles.chip,
                  selectedWorkspaceId === ws.id && commonStyles.chipActive,
                ]}
                onPress={() => setSelectedWorkspaceId(ws.id)}
              >
                <Text
                  style={[
                    commonStyles.chipText,
                    selectedWorkspaceId === ws.id && commonStyles.chipTextActive,
                  ]}
                >
                  {ws.name}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={[commonStyles.chip, showNewWorkspace && commonStyles.chipActive]}
              onPress={() => setShowNewWorkspace((v) => !v)}
            >
              <Text
                style={[commonStyles.chipText, showNewWorkspace && commonStyles.chipTextActive]}
              >
                + New
              </Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.emptyText}>No workspaces found. Create one below.</Text>
        )}
        {(showNewWorkspace || workspaces.length === 0) && (
          <ScrollView keyboardShouldPersistTaps="handled">
            <TextInput
              style={[commonStyles.input, styles.inlineInput]}
              value={newWorkspaceName}
              onChangeText={setNewWorkspaceName}
              placeholder="New workspace name"
            />
            <Pressable
              style={({ pressed }) => [
                styles.createButton,
                pressed && styles.createButtonPressed,
              ]}
              onPress={handleCreateWorkspace}
              disabled={creating}
            >
              <Text style={styles.createButtonText}>
                {creating ? 'Creating…' : 'Create Workspace'}
              </Text>
            </Pressable>
          </ScrollView>
        )}
      </View>

      {selectedWorkspaceId ? (
        <WorkspaceAdmin workspaceId={selectedWorkspaceId} />
      ) : (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Select or create a workspace to manage members and roles.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...commonStyles.screen,
  },
  pickerSection: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  center: {
    ...commonStyles.center,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textMuted,
    fontSize: 14,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: RADII.md,
    backgroundColor: COLORS.secondary,
  },
  retryText: {
    color: COLORS.textHeading,
    fontSize: 13,
    fontWeight: '600',
  },
  inlineInput: {
    marginTop: 12,
    marginBottom: 10,
  },
  createButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: RADII.md,
    backgroundColor: COLORS.primary,
    marginBottom: 8,
  },
  createButtonPressed: {
    backgroundColor: COLORS.primaryPressed,
  },
  createButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 12,
  },
});