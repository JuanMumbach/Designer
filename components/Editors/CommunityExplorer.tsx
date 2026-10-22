import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../../services/AuthContext';
import { fetchAllWorkspaces, Workspace } from '../../services/api';
import { useObjects } from '../../services/useObjects';
import { useMaterials } from '../../services/useMaterials';
import { COLORS } from '@/constants/theme';
import CatalogueView, { CatalogueGroup, InspectorRow } from '../Catalogue/CatalogueView';

type Kind = 'objects' | 'materials';

type PendingAction =
  | {
      type: 'clone';
      kind: Kind;
      id: string;
      name: string;
      versionId: number;
    }
  | {
      type: 'shortcut';
      kind: Kind;
      id: string;
      name: string;
    }
  | null;

interface PublicItem {
  id: string;
  name: string;
  lastVersion: number;
  creatorId?: string;
  type?: { name: string } | null;
}

const VIEW_MODE_KEY = '@catalogue:communityViewMode';

const TABS = [
  { key: 'objects', label: 'Módulos' },
  { key: 'materials', label: 'Materiales' },
];

export default function CommunityExplorer() {
  const { backendUserId, selectedWorkspaceId: contextSelectedWorkspaceId } = useAuth();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null
  );
  const [workspacesLoading, setWorkspacesLoading] = useState(true);
  const [kind, setKind] = useState<Kind>('objects');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
      if (pendingAction.type === 'clone') {
        const payload = {
          sourceId: pendingAction.id,
          versionId: pendingAction.versionId,
          creatorId: backendUserId ?? '',
        };
        if (pendingAction.kind === 'objects') await objectsQuery.cloneObject(payload);
        else await materialsQuery.cloneMaterial(payload);
        Alert.alert('Clonado', `"${pendingAction.name}" se clonó en tu espacio de trabajo.`);
      } else {
        if (pendingAction.kind === 'objects') await objectsQuery.addShortcut(pendingAction.id);
        else await materialsQuery.addShortcut(pendingAction.id);
        Alert.alert('Acceso directo', `"${pendingAction.name}" se agregó como acceso directo.`);
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

  const items: PublicItem[] = kind === 'objects'
    ? objectsQuery.publicObjects
    : materialsQuery.publicMaterials;
  const loading = kind === 'objects'
    ? objectsQuery.publicObjectsLoading
    : materialsQuery.publicMaterialsLoading;
  const queryError = kind === 'objects' ? objectsQuery.error : materialsQuery.error;

  const groups = useMemo((): CatalogueGroup[] => {
    const needle = query.trim().toLocaleLowerCase();
    const filtered = items
      .filter((item) => item.name.toLocaleLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!filtered.length) return [];
    return [
      {
        key: kind,
        label: kind === 'objects' ? 'Módulos públicos' : 'Materiales públicos',
        items: filtered.map((item) => ({
          id: item.id,
          name: item.name,
          subtitle: `v${item.lastVersion} · ${item.creatorId?.slice(0, 8) ?? ''}…`,
          badge: item.type?.name,
        })),
      },
    ];
  }, [items, kind, query]);

  const selectedItem = items.find((item) => item.id === selectedId) ?? null;

  const cloneAction = (item: PublicItem): PendingAction => ({
    type: 'clone',
    kind,
    id: item.id,
    name: item.name,
    versionId: item.lastVersion,
  });

  const shortcutAction = (item: PublicItem): PendingAction => ({
    type: 'shortcut',
    kind,
    id: item.id,
    name: item.name,
  });

  const handleTabChange = (key: string) => {
    setKind(key as Kind);
    setSelectedId(null);
  };

  const renderToolbar = () => (
    <View style={styles.workspaceBar}>
      <Text style={styles.workspaceLabel}>Espacio de trabajo destino</Text>
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
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{ws.name}</Text>
              </Pressable>
            );
          })
        )}
      </View>
    </View>
  );

  const renderPendingModal = () => {
    if (!pendingAction) return null;
    const isClone = pendingAction.type === 'clone';
    return (
      <Modal visible transparent animationType="fade" onRequestClose={() => setPendingAction(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {isClone ? 'Clonar a mi espacio de trabajo' : 'Agregar acceso directo'}
            </Text>
            <Text style={styles.modalText}>
              {isClone
                ? `Se creará una copia de "${pendingAction.name}" en tu espacio de trabajo actual. ¿Continuar?`
                : `Se vinculará "${pendingAction.name}" como acceso directo en tu espacio de trabajo. ¿Continuar?`}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setPendingAction(null)}
              >
                <Text style={styles.modalButtonTextSecondary}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.modalButton, styles.modalButtonPrimary]} onPress={runAction}>
                <Text style={styles.modalButtonTextPrimary}>Confirmar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const inspector = selectedItem ? (
    <View>
      <InspectorRow label="Nombre" value={selectedItem.name} />
      <InspectorRow label="Versión" value={`v${selectedItem.lastVersion}`} />
      <InspectorRow label="Creador" value={`${selectedItem.creatorId?.slice(0, 8) ?? ''}…`} />
      {!!selectedItem.type?.name && <InspectorRow label="Tipo" value={selectedItem.type.name} />}
    </View>
  ) : null;

  const isObjects = kind === 'objects';

  return (
    <>
      <CatalogueView
        contextLabel="Explorador de la comunidad"
        tabs={TABS}
        activeTab={kind}
        onTabChange={handleTabChange}
        toolbar={renderToolbar()}
        groups={groups}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder={isObjects ? 'Buscar módulos públicos' : 'Buscar materiales públicos'}
        loading={loading}
        loadingText="Cargando..."
        error={queryError ? (isObjects ? 'No se pudieron cargar los módulos públicos.' : 'No se pudieron cargar los materiales públicos.') : undefined}
        emptyText={query
          ? 'No hay resultados para la búsqueda.'
          : isObjects ? 'No hay módulos públicos disponibles.' : 'No hay materiales públicos disponibles.'}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onOpen={(id) => {
          const item = items.find((candidate) => candidate.id === id);
          if (item) requestAction(cloneAction(item));
        }}
        openLabel="Clonar"
        itemIcon={isObjects ? 'cube-outline' : 'layers-outline'}
        storageKey={VIEW_MODE_KEY}
        inspectorContent={inspector}
        inspectorEmptyText="Selecciona un elemento para clonarlo o agregarlo como acceso directo."
        inspectorActions={selectedItem ? {
          primary: { label: 'Clonar a mi espacio', onPress: () => requestAction(cloneAction(selectedItem)) },
          secondary: { label: 'Acceso directo', onPress: () => requestAction(shortcutAction(selectedItem)) },
        } : undefined}
      />
      {renderPendingModal()}
    </>
  );
}

const styles = StyleSheet.create({
  workspaceBar: {
    gap: 6,
  },
  workspaceLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textHeading,
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
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'white',
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
    color: '#111827',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 14,
    color: '#4b5563',
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
    backgroundColor: '#2563eb',
  },
  modalButtonSecondary: {
    backgroundColor: '#f3f4f6',
  },
  modalButtonTextPrimary: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtonTextSecondary: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
});