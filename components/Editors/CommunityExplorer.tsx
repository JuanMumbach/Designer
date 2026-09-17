import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../../services/AuthContext';
import { fetchAllWorkspaces, Workspace } from '../../services/api';
import { useObjects } from '../../services/useObjects';
import { useMaterials } from '../../services/useMaterials';
import Button from '../Button';
import { COLORS } from '@/constants/theme';

type PendingAction =
  | {
      type: 'cloneObject';
      id: string;
      name: string;
      versionId: number;
    }
  | {
      type: 'cloneMaterial';
      id: string;
      name: string;
      versionId: number;
    }
  | {
      type: 'addObjectShortcut';
      id: string;
      name: string;
    }
  | {
      type: 'addMaterialShortcut';
      id: string;
      name: string;
    }
  | null;

export default function CommunityExplorer() {
  const { backendUserId, selectedWorkspaceId: contextSelectedWorkspaceId } = useAuth();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null
  );
  const [workspacesLoading, setWorkspacesLoading] = useState(true);

  const objectsQuery = useObjects(selectedWorkspaceId ?? undefined);
  const materialsQuery = useMaterials(selectedWorkspaceId ?? undefined);

  useEffect(() => {
    let mounted = true;
    fetchAllWorkspaces()
      .then((ws) => {
        if (!mounted) return;
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
      })
      .catch(() => {
        if (mounted) Alert.alert('Error', 'No se pudieron cargar los espacios de trabajo.');
      })
      .finally(() => {
        if (mounted) setWorkspacesLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [contextSelectedWorkspaceId]);

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const runAction = useCallback(async () => {
    if (!pendingAction) return;
    setPendingAction(null);
    try {
      switch (pendingAction.type) {
        case 'cloneObject':
          await objectsQuery.cloneObject({
            sourceId: pendingAction.id,
            versionId: pendingAction.versionId,
            creatorId: backendUserId ?? '',
          });
          Alert.alert('Clonado', `"${pendingAction.name}" se clonó en tu espacio de trabajo.`);
          break;
        case 'cloneMaterial':
          await materialsQuery.cloneMaterial({
            sourceId: pendingAction.id,
            versionId: pendingAction.versionId,
            creatorId: backendUserId ?? '',
          });
          Alert.alert('Clonado', `"${pendingAction.name}" se clonó en tu espacio de trabajo.`);
          break;
        case 'addObjectShortcut':
          await objectsQuery.addShortcut(pendingAction.id);
          Alert.alert('Acceso directo', `"${pendingAction.name}" se agregó como acceso directo.`);
          break;
        case 'addMaterialShortcut':
          await materialsQuery.addShortcut(pendingAction.id);
          Alert.alert('Acceso directo', `"${pendingAction.name}" se agregó como acceso directo.`);
          break;
      }
    } catch {
      Alert.alert('Error', 'No se pudo completar la operación.');
    }
  }, [pendingAction, backendUserId, objectsQuery, materialsQuery]);

  const requestAction = (action: PendingAction) => {
    if (!selectedWorkspaceId) {
      Alert.alert('Atención', 'Selecciona un espacio de trabajo primero.');
      return;
    }
    setPendingAction(action);
  };

  const renderPendingModal = () => {
    if (!pendingAction) return null;
    const titles: Record<string, string> = {
      cloneObject: 'Clonar a mi espacio de trabajo',
      cloneMaterial: 'Clonar a mi espacio de trabajo',
      addObjectShortcut: 'Agregar acceso directo',
      addMaterialShortcut: 'Agregar acceso directo',
    };
    const descriptions: Record<string, string> = {
      cloneObject:
        `Se creará una copia de "${pendingAction.name}" en tu espacio de trabajo actual. ¿Continuar?`,
      cloneMaterial:
        `Se creará una copia de "${pendingAction.name}" en tu espacio de trabajo actual. ¿Continuar?`,
      addObjectShortcut:
        `Se vinculará "${pendingAction.name}" como acceso directo en tu espacio de trabajo. ¿Continuar?`,
      addMaterialShortcut:
        `Se vinculará "${pendingAction.name}" como acceso directo en tu espacio de trabajo. ¿Continuar?`,
    };
    return (
      <Modal
        visible
        transparent
        animationType="fade"
        onRequestClose={() => setPendingAction(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{titles[pendingAction.type]}</Text>
            <Text style={styles.modalText}>{descriptions[pendingAction.type]}</Text>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setPendingAction(null)}
              >
                <Text style={styles.modalButtonTextSecondary}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={runAction}
              >
                <Text style={styles.modalButtonTextPrimary}>Confirmar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderWorkspacePicker = () => {
    return (
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Explorador de la Comunidad</Text>
        <Text style={styles.headerSubtitle}>Espacio de trabajo</Text>
        <View style={styles.chipRow}>
          {workspacesLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : workspaces.length === 0 ? (
            <Text style={styles.emptyText}>No hay espacios de trabajo disponibles.</Text>
          ) : (
            workspaces.map((ws) => {
              const isActive = selectedWorkspaceId === ws.id;
              return (
                <Pressable
                  key={ws.id}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => setSelectedWorkspaceId(ws.id)}
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                    {ws.name}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      </View>
    );
  };

  const renderBrowserLists = () => {
    const objects = objectsQuery.publicObjects;
    const materials = materialsQuery.publicMaterials;
    const objsLoading = objectsQuery.publicObjectsLoading;
    const matsLoading = materialsQuery.publicMaterialsLoading;
    const objsError = objectsQuery.error;
    const matsError = materialsQuery.error;

    const renderObjectsSection = () => {
      if (objsLoading) {
        return (
          <View style={styles.centerRow}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        );
      }
      if (objsError) {
        console.warn('Failed to load public objects:', objsError);
        return <Text style={styles.emptyText}>No se pudieron cargar los objetos públicos.</Text>;
      }
      if (objects.length === 0) {
        return <Text style={styles.emptyText}>No hay objetos públicos disponibles.</Text>;
      }
      return objects.map((item) => (
        <View key={item.id} style={styles.resourceCard}>
          <View style={styles.resourceInfo}>
            <Text style={styles.resourceName}>{item.name}</Text>
            <Text style={styles.resourceMeta}>
              v{item.lastVersion} · {item.creatorId?.slice(0, 8)}…
            </Text>
          </View>
          <View style={styles.resourceActions}>
            <Button
              label="Clone to my Workspace"
              onPress={() =>
                requestAction({
                  type: 'cloneObject',
                  id: item.id,
                  name: item.name,
                  versionId: item.lastVersion,
                })
              }
            />
            <Button
              label="Add Shortcut"
              onPress={() =>
                requestAction({
                  type: 'addObjectShortcut',
                  id: item.id,
                  name: item.name,
                })
              }
            />
          </View>
        </View>
      ));
    };

    const renderMaterialsSection = () => {
      if (matsLoading) {
        return (
          <View style={styles.centerRow}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        );
      }
      if (matsError) {
        console.warn('Failed to load public materials:', matsError);
        return <Text style={styles.emptyText}>No se pudieron cargar los materiales públicos.</Text>;
      }
      if (materials.length === 0) {
        return <Text style={styles.emptyText}>No hay materiales públicos disponibles.</Text>;
      }
      return materials.map((item) => (
        <View key={item.id} style={styles.resourceCard}>
          <View style={styles.resourceInfo}>
            <Text style={styles.resourceName}>{item.name}</Text>
            <Text style={styles.resourceMeta}>
              v{item.lastVersion} · {item.creatorId?.slice(0, 8)}…
            </Text>
            {item.type?.name && (
              <Text style={styles.resourceType}>Type: {item.type.name}</Text>
            )}
          </View>
          <View style={styles.resourceActions}>
            <Button
              label="Clone to my Workspace"
              onPress={() =>
                requestAction({
                  type: 'cloneMaterial',
                  id: item.id,
                  name: item.name,
                  versionId: item.lastVersion,
                })
              }
            />
            <Button
              label="Add Shortcut"
              onPress={() =>
                requestAction({
                  type: 'addMaterialShortcut',
                  id: item.id,
                  name: item.name,
                })
              }
            />
          </View>
        </View>
      ));
    };

    return (
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Objetos públicos</Text>
        {renderObjectsSection()}

        <Text style={[styles.sectionTitle, styles.sectionSpacing]}>Materiales públicos</Text>
        {renderMaterialsSection()}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {renderWorkspacePicker()}
      <View style={styles.contentColumn}>{renderBrowserLists()}</View>
      {renderPendingModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: COLORS.bg,
  },
  contentColumn: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bgAlt,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textHeading,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textHeading,
  },
  chipTextActive: {
    color: COLORS.white,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  centerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textHeading,
    marginTop: 4,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionSpacing: {
    marginTop: 24,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 14,
    paddingVertical: 20,
  },
  resourceCard: {
    backgroundColor: COLORS.bg,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resourceInfo: {
    marginBottom: 10,
  },
  resourceName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textBody,
    marginBottom: 4,
  },
  resourceMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  resourceType: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  resourceActions: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  modalText: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 20,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  modalButtonPrimary: {
    backgroundColor: COLORS.primary,
  },
  modalButtonSecondary: {
    backgroundColor: COLORS.surfaceAlt,
  },
  modalButtonTextPrimary: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtonTextSecondary: {
    color: COLORS.textHeading,
    fontSize: 14,
    fontWeight: '600',
  },
});