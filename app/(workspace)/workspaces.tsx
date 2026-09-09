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
        <ActivityIndicator size="large" color="#ffd33d" />
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
        <Text style={styles.label}>Workspace</Text>
        {workspaces.length > 0 ? (
          <View style={styles.chipRow}>
            {workspaces.map((ws) => (
              <Pressable
                key={ws.id}
                style={[
                  styles.chip,
                  selectedWorkspaceId === ws.id && styles.chipActive,
                ]}
                onPress={() => setSelectedWorkspaceId(ws.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedWorkspaceId === ws.id && styles.chipTextActive,
                  ]}
                >
                  {ws.name}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.chip, showNewWorkspace && styles.chipActive]}
              onPress={() => setShowNewWorkspace((v) => !v)}
            >
              <Text
                style={[styles.chipText, showNewWorkspace && styles.chipTextActive]}
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
              style={styles.inlineInput}
              value={newWorkspaceName}
              onChangeText={setNewWorkspaceName}
              placeholder="New workspace name"
            />
            <Pressable
              style={styles.createButton}
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
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  pickerSection: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 12,
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
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
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
  emptyText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    paddingVertical: 12,
  },
  inlineInput: {
    height: 44,
    borderColor: '#2d2d44',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#1e1e2f',
    fontSize: 14,
    color: '#ffffff',
    marginTop: 12,
    marginBottom: 10,
  },
  createButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    marginBottom: 8,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
