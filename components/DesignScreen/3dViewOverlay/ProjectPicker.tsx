import { useEffect, useState } from 'react';
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
import Button from '../../Button';
import {
  createWorkspace,
  fetchAllProjects,
  fetchAllWorkspaces,
  Project,
  Workspace,
} from '../../../services/api';
import {
  createProjectInCloud,
  ProjectStateDTO,
  saveProjectToCloud,
} from '../../../services/projectStorage';

interface ProjectPickerProps {
  projectState: ProjectStateDTO;
  creatorId: string | null;
  onClose: () => void;
  onSaved?: (project: Project) => void;
}

export default function ProjectPicker({
  projectState,
  creatorId,
  onClose,
  onSaved,
}: ProjectPickerProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [newProjectName, setNewProjectName] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [showNewWorkspace, setShowNewWorkspace] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const handleCreateWorkspace = async () => {
    const name = newWorkspaceName.trim();
    if (!name) return;
    if (!creatorId) {
      Alert.alert('Validation', 'You must be logged in to create a workspace.');
      return;
    }
    try {
      const ws = await createWorkspace({ name, creatorId });
      setWorkspaces((prev) => [...prev, ws]);
      setSelectedWorkspaceId(ws.id);
      setSelectedProjectId(null);
      setNewWorkspaceName('');
      setShowNewWorkspace(false);
    } catch {
      Alert.alert('Error', 'Failed to create workspace.');
    }
  };

  const handleSave = async () => {
    if (!creatorId) {
      Alert.alert('Validation', 'You must be logged in to save projects.');
      return;
    }
    if (!selectedWorkspaceId) {
      Alert.alert('Validation', 'Select or create a workspace first.');
      return;
    }
    const isNewProject = !selectedProjectId;
    if (isNewProject && !newProjectName.trim()) {
      Alert.alert('Validation', 'Select a project or enter a new project name.');
      return;
    }

    setSaving(true);
    try {
      let project: Project | undefined;
      if (isNewProject) {
        const result = await createProjectInCloud(projectState, {
          name: newProjectName.trim(),
          workspaceId: selectedWorkspaceId,
          creatorId,
        });
        project = result.project;
      } else {
        await saveProjectToCloud(projectState, selectedProjectId, creatorId);
        project = projects.find((p) => p.id === selectedProjectId);
      }
      if (project) onSaved?.(project);
      onClose();
    } catch (err) {
      console.error('Cloud save failed:', err);
      Alert.alert('Error', 'Failed to save project to cloud.');
    } finally {
      setSaving(false);
    }
  };

  const selectWorkspace = (id: string) => {
    setSelectedWorkspaceId(id);
    setSelectedProjectId(null);
  };

  const selectProject = (id: string) => {
    setSelectedProjectId(id);
    setNewProjectName('');
  };

  const workspaceProjects = selectedWorkspaceId
    ? projects.filter((p) => p.workspaceId === selectedWorkspaceId)
    : [];

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Save to Cloud</Text>

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
              <Pressable
                style={[
                  styles.chip,
                  showNewWorkspace && styles.chipActive,
                ]}
                onPress={() => setShowNewWorkspace((v) => !v)}
              >
                <Text
                  style={[
                    styles.chipText,
                    showNewWorkspace && styles.chipTextActive,
                  ]}
                >
                  + New
                </Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.emptyText}>
              No workspaces found. Create one below.
            </Text>
          )}
          {(showNewWorkspace || workspaces.length === 0) && (
            <View style={styles.inlineRow}>
              <TextInput
                style={[styles.input, styles.inlineInput]}
                value={newWorkspaceName}
                onChangeText={setNewWorkspaceName}
                placeholder="Workspace name"
              />
              <Pressable
                style={styles.smallButton}
                onPress={handleCreateWorkspace}
                disabled={saving}
              >
                <Text style={styles.smallButtonText}>Create</Text>
              </Pressable>
            </View>
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
                  onPress={() => selectProject(p.id)}
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

          <Text style={styles.label}>Or create a new project</Text>
          <TextInput
            style={styles.input}
            value={newProjectName}
            onChangeText={(text) => {
              setNewProjectName(text);
              if (selectedProjectId) setSelectedProjectId(null);
            }}
            placeholder="New project name"
          />

          <View style={styles.footer}>
            <Button
              label={saving ? 'Saving...' : 'Save to Cloud'}
              onPress={handleSave}
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
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  inlineInput: {
    flex: 1,
    marginBottom: 0,
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
    marginBottom: 10,
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
  smallButton: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});