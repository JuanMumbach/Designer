import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useAccess } from '../../../services/AccessContext';
import { useAuth } from '../../../services/AuthContext';
import {
  createObject,
  createObjectCategory,
  createObjectMaterialType,
  deleteObject,
  deleteObjectCategory,
  MaterialMeta,
  MaterialType,
  ObjectCategory,
  ObjectModel,
  ObjectVersion,
  renameObject,
  categorizeObject,
  createObjectVersion,
  fetchObjectVersion,
  fetchModelMaterialTypes,
  updateObjectVersion,
  updateObjectCategory,
  updateObject,
} from '../../../services/api';
import ObjectEditor, { ObjectFormData } from './ObjectEditor';
import ObjectPreview from './ObjectPreview';
import SlotAssignmentPanel, { SlotDraft } from './SlotAssignmentPanel';
import CatalogueView, { CatalogueGroup, InspectorRow } from '../../Catalogue/CatalogueView';
import CategoryManagerPanel from '../CategoryManagerPanel';
import {
  createThumbnailCaptureApi,
  ThumbnailCaptureApi,
} from '../../../services/thumbnailCapture';
import { resolveDefaultSlotTextures } from '../../../services/designMaterialDefaults';
import { AppliedMaterial } from '@/components/DesignScreen/3dView/DesignObjects';
import { COLORS } from '@/constants/theme';
import { ModelBudgetEntry } from '../../../services/budget';
import { MaterialPart, materialPartsArea } from '../../../services/materialParts';

const VIEW_MODE_KEY = '@catalogue:objectsViewMode';
const UNCATEGORIZED_KEY = '__none__';

const GROUP_OPTIONS = [
  { key: 'category', label: 'Categoría' },
  { key: 'recent', label: 'Recientes' },
];


interface PendingVersionData {
  budgetEntries: ModelBudgetEntry[];
  materialParts: MaterialPart[];
  fileURL: string;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  objectProperties?: string;
  creatorId: string;
}

interface SlotAssignmentRequest {
  objectId: string;
  fileUrl: string;
  pendingVersion: PendingVersionData;
}

function getCategoryPath(
  categoryId: string | null | undefined,
  allCategories: ObjectCategory[]
): string {
  if (!categoryId) return 'Sin categoría';
  const path: string[] = [];
  let current: ObjectCategory | undefined = allCategories.find(
    (c) => c.id === categoryId
  );
  while (current) {
    path.unshift(current.categoryName);
    current = allCategories.find((c) => c.id === current?.parentCategoryId);
  }
  return path.length ? path.join(' › ') : 'Sin categoría';
}

interface ObjectBrowserProps {
  objects: ObjectModel[];
  categories: ObjectCategory[];
  onRefresh: () => void;
  materialTypes?: MaterialType[];
  materials?: MaterialMeta[];
}

export default function ObjectBrowser({
  objects,
  categories,
  onRefresh,
  materialTypes,
  materials,
}: ObjectBrowserProps) {
  const { canManageApplication } = useAccess();
  const { selectedWorkspaceId, backendUserId } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 900;

  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState<'category' | 'recent'>('category');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [moduleDetails, setModuleDetails] = useState<Record<string, { count: number; area: number; failed?: boolean }>>({});
  const [editingObject, setEditingObject] = useState<ObjectModel | null>(null);
  const [editingObjectVersion, setEditingObjectVersion] = useState<ObjectVersion | null>(null);
  const [editingDataFailed, setEditingDataFailed] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);


  // ── Preview URI state (set by ObjectEditor callback) ──
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [highlightSlot, setHighlightSlot] = useState<number | null>(null);
  const [pendingSlotAssignment, setPendingSlotAssignment] =
    useState<SlotAssignmentRequest | null>(null);
  const [slotTextures, setSlotTextures] = useState<
    Record<number, AppliedMaterial> | null
  >(null);
  const assignmentVersionCreatedRef = useRef(false);


  const visibleObjects = useMemo(() => objects.filter((object) => object.name.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => groupBy === 'recent' ? b.lastUpdate.localeCompare(a.lastUpdate) : a.name.localeCompare(b.name)), [objects, search, groupBy]);

  const captureApi = useMemo<ThumbnailCaptureApi>(
    () => createThumbnailCaptureApi(),
    []
  );

  const captureReadyRef = useRef(false);
  const captureReadyWaitersRef = useRef<(() => void)[]>([]);

  const handlePreviewReady = useCallback((ready: boolean) => {
    captureReadyRef.current = ready;
    if (ready) {
      const waiters = captureReadyWaitersRef.current;
      captureReadyWaitersRef.current = [];
      waiters.forEach((resolve) => resolve());
    }
  }, []);

  const waitForCaptureReady = useCallback((timeoutMs = 5000) => {
    return new Promise<void>((resolve) => {
      if (captureReadyRef.current) {
        resolve();
        return;
      }
      let settled = false;
      const waiters = captureReadyWaitersRef.current;
      waiters.push(() => {
        if (!settled) {
          settled = true;
          resolve();
        }
      });
      setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve();
        }
      }, timeoutMs);
    });
  }, []);

  // ── Thumbnail URLs per listed object (latest version) ──
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const thumbnailAttemptedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const attempted = thumbnailAttemptedRef.current;
    const missing = visibleObjects.filter((object) => !attempted.has(object.id + ':' + object.lastVersion));
    if (!missing.length) return;
    let active = true;
    let finished = false;
    missing.forEach((object) => attempted.add(object.id + ':' + object.lastVersion));
    Promise.all(missing.map((object) => fetchObjectVersion(object.id).then((version) => ({ id: object.id, version })).catch(() => ({ id: object.id, version: null })))).then((results) => {
      if (!active) return;
      finished = true;
      setThumbnails((previous) => { const next = { ...previous }; for (const row of results) if (row?.version?.thumbnailURL) next[row.id] = row.version.thumbnailURL; return next; });
      setModuleDetails((previous) => { const next = { ...previous }; for (const row of results) if (row) { if (!row.version) { next[row.id] = { count: 0, area: 0, failed: true }; continue; } const parts = row.version.materialParts ?? []; next[row.id] = { count: parts.reduce((sum, part) => sum + part.quantity, 0), area: materialPartsArea(parts) }; } return next; });
    });
    return () => { active = false; if (!finished) missing.forEach((object) => attempted.delete(object.id + ':' + object.lastVersion)); };
  }, [visibleObjects, catalogRevision]);

  useEffect(() => {
    let active = true;
    setEditingObjectVersion(null);
    setEditingDataFailed(false);
    setHighlightSlot(null);
    if (editingObject) {
      fetchObjectVersion(editingObject.id).then((data) => {
        if (!active) return;
        setEditingObjectVersion(data);
        setPreviewUri(data.fileURL || null);
      }).catch(() => { if (active) setEditingDataFailed(true); });
    } else setPreviewUri(null);
    return () => { active = false; };
  }, [editingObject]);



  const handleSaveObject = async (
    data: ObjectFormData,
    isEdit: boolean
  ): Promise<{
    slotAssignment?: SlotAssignmentRequest;
  }> => {
    let request: SlotAssignmentRequest | null = null;


    if (isEdit && editingObject) {
      if (data.name !== editingObject.name) {
        await renameObject({ id: editingObject.id, name: data.name });
      }
      const newCatId = data.categoryId || null;
      if (newCatId !== editingObject.categoryId) {
        await categorizeObject({ id: editingObject.id, categoryId: newCatId });
      }
      if (data.isPublic !== editingObject.isPublic) {
        await updateObject(editingObject.id, { isPublic: data.isPublic });
      }
      const current = editingObjectVersion;
      const changed =
        data.fileURL !== (current?.fileURL ?? '') ||
        parseFloat(data.sizeX) !== (current?.sizeX ?? 1) ||
        parseFloat(data.sizeY) !== (current?.sizeY ?? 1) ||
        parseFloat(data.sizeZ) !== (current?.sizeZ ?? 1) ||
        data.objectProperties !== (current?.objectProperties ?? '');

      if (!changed && current && (JSON.stringify(data.budgetEntries) !== JSON.stringify(current.budgetEntries ?? []) || JSON.stringify(data.materialParts) !== JSON.stringify(current.materialParts ?? []))) {
        await updateObjectVersion(editingObject.id, current.version, { budgetEntries: data.budgetEntries,
              materialParts: data.materialParts });
      }

      if (changed) {
        if (data.fileURL) {
          request = {
            objectId: editingObject.id,
            fileUrl: data.fileURL,
            pendingVersion: {
              fileURL: data.fileURL,
              sizeX: parseFloat(data.sizeX) || 1,
              sizeY: parseFloat(data.sizeY) || 1,
              sizeZ: parseFloat(data.sizeZ) || 1,
              objectProperties: data.objectProperties || undefined,
              budgetEntries: data.budgetEntries,
              materialParts: data.materialParts,
              creatorId: backendUserId ?? '',
            },
          };
        } else {
          await createObjectVersion(editingObject.id, {
            fileURL: data.fileURL,
            sizeX: parseFloat(data.sizeX) || 1,
            sizeY: parseFloat(data.sizeY) || 1,
            sizeZ: parseFloat(data.sizeZ) || 1,
            objectProperties: data.objectProperties || undefined,
              budgetEntries: data.budgetEntries,
              materialParts: data.materialParts,
            creatorId: backendUserId ?? '',
          });
        }
      }
    } else {
      const meta = await createObject({
        workspaceId: selectedWorkspaceId,
        isPublic: data.isPublic,
        name: data.name,
        creatorId: backendUserId ?? '',
        categoryId: data.categoryId || undefined,
      });
      if (data.fileURL) {
        request = {
          objectId: meta.id,
          fileUrl: data.fileURL,
          pendingVersion: {
            fileURL: data.fileURL,
            sizeX: parseFloat(data.sizeX) || 1,
            sizeY: parseFloat(data.sizeY) || 1,
            sizeZ: parseFloat(data.sizeZ) || 1,
            objectProperties: data.objectProperties || undefined,
              budgetEntries: data.budgetEntries,
              materialParts: data.materialParts,
            creatorId: backendUserId ?? '',
          },
        };
      } else {
        await createObjectVersion(meta.id, {
          fileURL: data.fileURL,
          sizeX: parseFloat(data.sizeX) || 1,
          sizeY: parseFloat(data.sizeY) || 1,
          sizeZ: parseFloat(data.sizeZ) || 1,
          objectProperties: data.objectProperties || undefined,
              budgetEntries: data.budgetEntries,
              materialParts: data.materialParts,
          creatorId: backendUserId ?? '',
        });
      }
    }

    if (request) {
      setPendingSlotAssignment(request);
      setSlotTextures(null);
      setHighlightSlot(null);
      return { slotAssignment: request };
    }

    if (editingObject) setModuleDetails((previous) => ({ ...previous, [editingObject.id]: { count: data.materialParts.reduce((sum, part) => sum + part.quantity, 0), area: materialPartsArea(data.materialParts) } }));
    setEditingObject(null);
    setShowCreator(false);
    onRefresh();
    return {};
  };

  const handleAssignmentSave = async (slots: SlotDraft[]) => {
    if (!pendingSlotAssignment) return;
    const { objectId, pendingVersion } = pendingSlotAssignment;
    const thumbnailURL = await captureApi.requestCapture('thumbnails/objects');
    const versionResult = await createObjectVersion(objectId, {
      ...pendingVersion,
      thumbnailURL: thumbnailURL || undefined,
    });
    assignmentVersionCreatedRef.current = true;
    for (const slot of slots) {
      await createObjectMaterialType({
        objectModelId: objectId,
        version: versionResult.version,
        slot: slot.materialIndex,
        materialTypeId: slot.materialTypeId,
        displayName: slot.displayName,
      });
    }
  };

  const handleAssignmentComplete = async () => {
    if (pendingSlotAssignment && !assignmentVersionCreatedRef.current) {
      try {
        await createObjectVersion(pendingSlotAssignment.objectId, {
          ...pendingSlotAssignment.pendingVersion,
        });
      } catch (err) {
        console.warn('Failed to create fallback object version:', err);
      }
    }
    assignmentVersionCreatedRef.current = false;
    setPendingSlotAssignment(null);
    setSlotTextures(null);
    setHighlightSlot(null);
    setEditingObject(null);
    setEditingObjectVersion(null);
    setShowCreator(false);
    setPreviewUri(null);
    onRefresh();
  };

  const handleDeleteObject = async () => {
    if (!editingObject) return;
    try {
      await deleteObject(editingObject.id);
      setEditingObject(null);
      onRefresh();
    } catch {
      Alert.alert('Error', 'Failed to delete object.');
    }
  };

  const handleRegenerateThumbnail = async () => {
    if (!editingObject || !editingObjectVersion) return;
    const objectId = editingObject.id;
    const version = editingObjectVersion.version;
    try {
      const versionSlots = await fetchModelMaterialTypes(objectId, version);
      const textures = await resolveDefaultSlotTextures(
        versionSlots.map((s) => ({
          slot: s.slot,
          materialTypeId: s.materialTypeId,
        })),
        materialTypes ?? [],
        materials ?? []
      );

      if (Object.keys(textures).length > 0) {
        captureReadyRef.current = false;
        setSlotTextures(textures);
        await waitForCaptureReady();
      }

      const thumbnailURL = await captureApi.requestCapture('thumbnails/objects');
      if (thumbnailURL) {
        await updateObjectVersion(objectId, version, { thumbnailURL });
        setThumbnails((prev) => ({ ...prev, [objectId]: thumbnailURL }));
      }
    } catch (err) {
      console.warn('Failed to regenerate thumbnail:', err);
      Alert.alert('Error', 'Failed to regenerate the thumbnail.');
      throw err;
    } finally {
      setSlotTextures(null);
    }
  };

  const handleCreateCategory = async (name: string, parentId?: string) => {
    await createObjectCategory({ categoryName: name, parentCategoryId: parentId });
    onRefresh();
  };

  const handleRenameCategory = async (id: string, name: string) => {
    await updateObjectCategory(id, { categoryName: name });
    onRefresh();
  };

  const handleDeleteCategory = async (id: string) => {
    await deleteObjectCategory(id);
    onRefresh();
  };

  const deletableCategoryIds = useMemo(
    () =>
      categories
        .filter((c) => {
          const childCats = categories.filter((cc) => cc.parentCategoryId === c.id);
          const childObjs = objects.filter((o) => o.categoryId === c.id);
          return childCats.length === 0 && childObjs.length === 0;
        })
        .map((c) => c.id),
    [categories, objects]
  );

  const closeEditor = () => {
    setEditingObject(null);
    setEditingObjectVersion(null);
    setEditingDataFailed(false);
    setShowCreator(false);
    setPreviewUri(null);
  };

  const isActive = !!editingObject || showCreator || !!pendingSlotAssignment;
  const isLoadingData = !!editingObject && !editingObjectVersion && !editingDataFailed;

  const selectedObject = useMemo(
    () => objects.find((object) => object.id === selectedId) ?? null,
    [objects, selectedId]
  );

  const describeModule = (id: string) => {
    const details = moduleDetails[id];
    if (!details) return 'Cargando despiece…';
    if (details.failed) return 'Despiece no disponible';
    if (!details.count) return 'Despiece pendiente';
    return details.count + ' piezas · ' + details.area.toLocaleString('es-AR', { maximumFractionDigits: 4 }) + ' m²';
  };

  const groups = useMemo((): CatalogueGroup[] => {
    const map = new Map<string, CatalogueGroup>();
    for (const object of visibleObjects) {
      const key = groupBy === 'category' ? object.categoryId ?? UNCATEGORIZED_KEY : 'recent';
      const label = groupBy === 'category' ? getCategoryPath(object.categoryId, categories) : 'Recientes';
      let group = map.get(key);
      if (!group) {
        group = { key, label, items: [] };
        map.set(key, group);
      }
      group.items.push({
        id: object.id,
        name: object.name,
        subtitle: 'v' + object.lastVersion + ' · ' + (object.isPublic ? 'Comunidad' : 'Privado'),
        badge: describeModule(object.id),
        thumbnailUri: thumbnails[object.id],
      });
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.key === UNCATEGORIZED_KEY) return 1;
      if (b.key === UNCATEGORIZED_KEY) return -1;
      return a.label.localeCompare(b.label);
    });
  }, [visibleObjects, categories, groupBy, thumbnails, moduleDetails]);

  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>Cargando datos del módulo…</Text>
    </View>
  );

  const renderSlotAssignment = () => {
    if (!pendingSlotAssignment) return null;
    return (
      <SlotAssignmentPanel
        fileUrl={pendingSlotAssignment.fileUrl}
        materialTypes={materialTypes ?? []}
        materials={materials}
        onHighlightSlot={setHighlightSlot}
        onSlotTexturesChange={setSlotTextures}
        onSave={handleAssignmentSave}
        onComplete={handleAssignmentComplete}
      />
    );
  };

  const renderEditor = () => {
    if (pendingSlotAssignment) {
      return renderSlotAssignment();
    }
    if (editingObject && isLoadingData) {
      return renderLoading();
    }
    if (editingObject && editingDataFailed) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>No se pudo cargar el módulo. No se guardaron cambios.</Text>
          <Pressable accessibilityRole="button" style={styles.actionButton} onPress={() => setEditingObject({ ...editingObject })}>
            <Text style={styles.actionButtonText}>Reintentar</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.backButton} onPress={closeEditor}>
            <Text style={styles.backButtonText}>Volver al catálogo</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <ObjectEditor
        key={editingObject?.id ?? 'new'}
        disabled={!isActive || editingDataFailed}
        isEdit={!!editingObject}
        initial={
          editingObject
            ? {
                name: editingObject.name,
                creatorId: editingObject.creatorId,
                categoryId: editingObject.categoryId ?? '',
                fileURL: editingObjectVersion?.fileURL ?? '',
                sizeX: editingObjectVersion?.sizeX?.toString() ?? '1',
                sizeY: editingObjectVersion?.sizeY?.toString() ?? '1',
                sizeZ: editingObjectVersion?.sizeZ?.toString() ?? '1',
                objectProperties: (editingObjectVersion?.objectProperties
                  ? typeof editingObjectVersion.objectProperties === 'string'
                    ? editingObjectVersion.objectProperties
                    : JSON.stringify(editingObjectVersion.objectProperties)
                  : ''),
                isPublic: editingObject.isPublic,
                budgetEntries: editingObjectVersion?.budgetEntries ?? [],
                materialParts: editingObjectVersion?.materialParts ?? [],
              }
            : undefined
        }
        categories={categories}
        materialTypes={materialTypes}
        objectId={editingObject?.id}
        onHighlightSlot={setHighlightSlot}
        onRegenerateThumbnail={
          editingObject ? handleRegenerateThumbnail : undefined
        }
        onSave={handleSaveObject}
        onDelete={editingObject ? handleDeleteObject : undefined}
        onClose={closeEditor}
        onPreviewUriChange={(uri) => setPreviewUri(uri)}
      />
    );
  };

  const renderPreview = () => (
    <View style={styles.previewColumn}>
      <ObjectPreview
        uri={previewUri}
        highlightSlot={highlightSlot}
        captureApi={captureApi}
        slotTextures={slotTextures ?? undefined}
        onReadyChange={handlePreviewReady}
      />
    </View>
  );

  if (showCategoryManager && canManageApplication) {
    return (
      <View style={styles.container}>
        <CategoryManagerPanel
          categories={categories}
          deletableIds={deletableCategoryIds}
          onCreate={handleCreateCategory}
          onRename={handleRenameCategory}
          onDelete={handleDeleteCategory}
          onClose={() => setShowCategoryManager(false)}
        />
      </View>
    );
  }

  if (isActive || isLoadingData) {
    return (
      <View style={[styles.container, isWide ? styles.editRow : styles.editColumn]}>
        <View style={isWide ? styles.previewWide : styles.previewNarrow}>
          {isLoadingData ? renderLoading() : renderPreview()}
        </View>
        <View style={isWide ? styles.editorWide : styles.editorNarrow}>{renderEditor()}</View>
      </View>
    );
  }

  const inspector = selectedObject ? (
    <View>
      <InspectorRow label="Nombre" value={selectedObject.name} />
      <InspectorRow label="Categoría" value={getCategoryPath(selectedObject.categoryId, categories)} />
      <InspectorRow label="Versión" value={'v' + selectedObject.lastVersion} />
      <InspectorRow label="Visibilidad" value={selectedObject.isPublic ? 'Comunidad' : 'Privado'} />
      <InspectorRow label="Despiece" value={describeModule(selectedObject.id)} />
    </View>
  ) : null;

  const headerActions = [
    { label: 'Nuevo módulo', onPress: () => setShowCreator(true), primary: true },
    ...(canManageApplication ? [{ label: 'Categorías', onPress: () => setShowCategoryManager(true) }] : []),
    {
      label: 'Actualizar',
      onPress: () => {
        thumbnailAttemptedRef.current.clear();
        setCatalogRevision((value) => value + 1);
        onRefresh();
      },
    },
  ];

  return (
    <CatalogueView
      headerActions={headerActions}
      contextLabel={objects.length + ' módulos · despiece y costos por material'}
      groups={groups}
      groupOptions={GROUP_OPTIONS}
      groupKey={groupBy}
      onGroupKeyChange={(key) => setGroupBy(key as 'category' | 'recent')}
      query={search}
      onQueryChange={setSearch}
      searchPlaceholder="Buscar módulos en todo el catálogo…"
      emptyText={search ? 'No hay módulos que coincidan con la búsqueda.' : 'Todavía no hay módulos. Creá el primero para comenzar.'}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onOpen={(id) => {
        const object = objects.find((item) => item.id === id);
        if (object) setEditingObject(object);
      }}
      openLabel="Editar"
      itemIcon="cube-outline"
      storageKey={VIEW_MODE_KEY}
      inspectorContent={inspector}
      inspectorEmptyText="Selecciona un módulo para ver sus detalles."
      inspectorActions={selectedObject ? { primary: { label: 'Editar', onPress: () => setEditingObject(selectedObject) } } : undefined}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: COLORS.bg,
  },
  editRow: {
    flexDirection: 'row',
  },
  editColumn: {
    flexDirection: 'column',
  },
  previewWide: {
    flex: 1,
  },
  previewNarrow: {
    height: 340,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  editorWide: {
    width: '45%',
    minWidth: 400,
    maxWidth: '60%',
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border,
  },
  editorNarrow: {
    flex: 1,
  },
  previewColumn: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: COLORS.border,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textHeading,
  },
});
