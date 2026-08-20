import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Button from '../../Button';
import {
  fetchAllProjects,
  fetchAllWorkspaces,
  fetchProject,
  fetchProjectVersion,
  Project,
  Workspace,
} from '../../../services/api';
import {
  loadProjectFromCloud,
  ProjectStateDTO,
} from '../../../services/projectStorage';

interface ProjectLoaderProps {
  requiresConfirm: boolean;
  onLoaded: (projectState: ProjectStateDTO) => void;
  onClose: () => void;
}

export default function ProjectLoader({
  requiresConfirm,
  onLoaded,
  onClose,
}: ProjectLoaderProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        const [ws, pr] = await Promise.all([
          fetchAllWorkspaces(),
          fetchAllProjects(),
        ]);
        if (!mounted) return;
        setWorkspaces(ws);
        setProjects(pr);
        if (ws.length > 0) {
          setSelectedWorkspaceId((prev) => prev ?? ws[0].id);
        }
      } catch {
        if (mounted) Alert.alert('Error', 'Failed to load workspaces/projects.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const doLoad = async () => {
    if (!selectedProjectId) return;
    setLoadingLatest(true);
    try {
      const project = await fetchProject(selectedProjectId);
      if (!project.lastVersion) {
        Alert.alert('Info', 'This project has no saved versions.');
        return;
      }
      const version = await fetchProjectVersion(project.id, project.lastVersion);
      const projectState = await loadProjectFromCloud(version.fileURL);
      if (projectState) {
        onLoaded(projectState);
        onClose();
      }
    } catch (err) {
      console.error('Cloud load failed:', err);
      Alert.alert('Error', 'Failed to load project from cloud.');
    } finally {
      setLoadingLatest(false);
    }
  };

  const handleLoad = () => {
    if (!selectedProjectId) {
      Alert.alert('Validation', 'Select a project to load.');
      return;
    }
    if (!requiresConfirm) {
      doLoad();
      return;
    }
    const message = 'Loading will replace the current scene. Continue?';
    if (Platform.OS === 'web') {
      if (window.confirm(message)) doLoad();
    } else {
      Alert.alert('Load Project', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Load', onPress: doLoad },
      ]);
    }
  };

  const selectWorkspace = (id: string) => {
    setSelectedWorkspaceId(id);
    setSelectedProjectId(null);
  };

  const workspaceProjects = selectedWorkspaceId
    ? projects.filter((p) => p.workspaceId === selectedWorkspaceId)
    : [];

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Load from Cloud</Text>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading workspaces…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
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
                  onPress={() => selectWorkspace(ws.id)}
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
            </View>
          ) : (
            <Text style={styles.emptyText}>
              No workspaces found. Save a project first.
            </Text>
          )}

          <Text style={styles.label}>Project</Text>
          {workspaceProjects.length > 0 ? (
            <View style={styles.projectList}>
              {workspaceProjects.map((p) => (
                <Pressable
                  key={p.id}
                  style={[
                    styles.projectRow,
                    selectedProjectId === p.id && styles.projectRowActive,
                  ]}
                  onPress={() => setSelectedProjectId(p.id)}
                >
                  <Text
                    style={[
                      styles.projectName,
                      selectedProjectId === p.id && styles.projectNameActive,
                    ]}
                  >
                    {p.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>
              No projects in this workspace.
            </Text>
          )}

          <Text style={styles.hint}>Loads the latest saved version.</Text>

          <View style={styles.footer}>
            <Button
              label={loadingLatest ? 'Loading...' : 'Load Latest'}
              onPress={handleLoad}
            />
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonLabel}>Cancel</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 320,
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#6b7280',
  },
  scrollContent: {
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginTop: 12,
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
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  chipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  chipTextActive: {
    color: '#fff',
  },
  emptyText: {
    fontSize: 13,
    color: '#6b7280',
    marginVertical: 6,
  },
  projectList: {
    gap: 6,
    marginBottom: 6,
  },
  projectRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  projectRowActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  projectName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  projectNameActive: {
    color: '#fff',
  },
  hint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 10,
  },
  footer: {
    marginTop: 20,
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
});