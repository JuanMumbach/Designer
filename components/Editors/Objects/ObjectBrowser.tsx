import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useAccess } from '../../../services/AccessContext';
import { useAuth } from '../../../services/AuthContext';
import Button from '../../Button';
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
import Thumbnail from '../../Thumbnail';
import {
  createThumbnailCaptureApi,
  ThumbnailCaptureApi,
} from '../../../services/thumbnailCapture';
import { resolveDefaultSlotTextures } from '../../../services/designMaterialDefaults';
import { AppliedMaterial } from '@/components/DesignScreen/3dView/DesignObjects';
import { COLORS } from '@/constants/theme';
import { ModelBudgetEntry } from '../../../services/budget';
import { MaterialPart, materialPartsArea } from '../../../services/materialParts';

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

function getBreadcrumbPath(
  categoryId: string | null,
  allCategories: ObjectCategory[]
): string {
  if (!categoryId) return 'Root';
  const path: string[] = [];
  let current: ObjectCategory | undefined = allCategories.find(
    (c) => c.id === categoryId
  );
  while (current) {
    path.unshift(current.categoryName);
    current = allCategories.find((c) => c.id === current?.parentCategoryId);
  }
  return 'Root > ' + path.join(' > ');
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
  const [sort, setSort] = useState<'name' | 'recent'>('name');
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [moduleDetails, setModuleDetails] = useState<Record<string, { count: number; area: number; failed?: boolean }>>({});
  const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(
    null
  );
  const [categoryStack, setCategoryStack] = useState<string[]>([]);
  const [editingObject, setEditingObject] = useState<ObjectModel | null>(null);
  const [editingObjectVersion, setEditingObjectVersion] = useState<ObjectVersion | null>(null);
  const [editingDataFailed, setEditingDataFailed] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  // ── Category manager state ──
  const [newCatName, setNewCatName] = useState('');
  const [newCatParent, setNewCatParent] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');

  // ── Preview URI state (set by ObjectEditor callback) ──
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [highlightSlot, setHighlightSlot] = useState<number | null>(null);
  const [pendingSlotAssignment, setPendingSlotAssignment] =
    useState<SlotAssignmentRequest | null>(null);
  const [slotTextures, setSlotTextures] = useState<
    Record<number, AppliedMaterial> | null
  >(null);
  const assignmentVersionCreatedRef = useRef(false);

  const rootCategories = categories.filter(
    (c) => c.parentCategoryId === null
  );
  const currentSubcategories = categories.filter(
    (c) => c.parentCategoryId === currentCategoryId
  );

  const visibleObjects = useMemo(() => objects.filter((object) => (search.trim() || (currentCategoryId === null ? !object.categoryId : object.categoryId === currentCategoryId)) && object.name.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : b.lastUpdate.localeCompare(a.lastUpdate)), [objects, search, currentCategoryId, sort]);

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

  const handleCategoryPress = (cat: ObjectCategory) => {
    setCategoryStack((prev) => [...prev, cat.id]);
    setCurrentCategoryId(cat.id);
  };

  const handleBack = () => {
    if (categoryStack.length === 0) {
      setCurrentCategoryId(null);
    } else {
      const newStack = [...categoryStack];
      newStack.pop();
      setCategoryStack(newStack);
      setCurrentCategoryId(
        newStack.length > 0 ? newStack[newStack.length - 1] : null
      );
    }
  };

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

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      await createObjectCategory({
        categoryName: newCatName.trim(),
        parentCategoryId: newCatParent || undefined,
      });
      setNewCatName('');
      setNewCatParent('');
      onRefresh();
    } catch {
      Alert.alert('Error', 'Failed to create category.');
    }
  };

  const handleRenameCategory = async (id: string) => {
    if (!editingCatName.trim()) return;
    try {
      await updateObjectCategory(id, { categoryName: editingCatName.trim() });
      setEditingCatId(null);
      setEditingCatName('');
      onRefresh();
    } catch {
      Alert.alert('Error', 'Failed to rename category.');
    }
  };

  const handleDeleteCategory = (id: string) => {
    const confirm = () => {
      deleteObjectCategory(id)
        .then(() => {
          setEditingCatId(null);
          onRefresh();
        })
        .catch(() => Alert.alert('Error', 'Failed to delete category.'));
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this category?')) confirm();
    } else {
      Alert.alert('Delete Category', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirm },
      ]);
    }
  };

  const isActive = editingObject || showCreator;
  const isLoadingData = editingObject && !editingObjectVersion && !editingDataFailed;

  // ── Render helpers ──

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
    if (editingObject && editingDataFailed) return <View style={styles.loadingContainer}><Text style={styles.loadingText}>No se pudo cargar el módulo. No se guardaron cambios.</Text><Pressable accessibilityRole="button" style={styles.actionButton} onPress={() => setEditingObject({ ...editingObject })}><Text style={styles.actionButtonText}>Reintentar</Text></Pressable><Pressable accessibilityRole="button" style={styles.backButton} onPress={() => setEditingObject(null)}><Text style={styles.backButtonText}>Volver al catálogo</Text></Pressable></View>;
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
        onClose={() => {
          setEditingObject(null);
          setEditingObjectVersion(null);
          setEditingDataFailed(false);
          setShowCreator(false);
          setPreviewUri(null);
        }}
        onPreviewUriChange={(uri) => setPreviewUri(uri)}
      />
    );
  };

  const renderBrowserList = () => {
    const folders = search.trim() ? [] : currentCategoryId === null ? rootCategories : currentSubcategories;
    return <>
      <View style={styles.managerIntro}><Text style={styles.managerTitle}>Módulos</Text><Text style={styles.managerDescription}>Catálogo, despiece y costos por material. {objects.length} módulos disponibles.</Text></View>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" style={styles.backButton} onPress={handleBack}><Text style={styles.backButtonText}>← Volver</Text></Pressable>
        <Text style={styles.breadcrumb} numberOfLines={1}>{getBreadcrumbPath(currentCategoryId, categories)}</Text>
      </View>
      <View style={styles.actionBar}>
        <Pressable accessibilityRole="button" style={styles.actionButton} onPress={() => setShowCreator(true)}><Text style={styles.actionButtonText}>+ Nuevo módulo</Text></Pressable>
        {canManageApplication && <Pressable accessibilityRole="button" style={styles.actionButton} onPress={() => setShowCategoryManager(true)}><Text style={styles.actionButtonText}>Categorías</Text></Pressable>}
        <Pressable accessibilityRole="button" style={styles.backButton} onPress={() => { thumbnailAttemptedRef.current.clear(); setCatalogRevision((value) => value + 1); onRefresh(); }}><Text style={styles.backButtonText}>Actualizar</Text></Pressable>
      </View>
      <View style={styles.searchBar}>
        <TextInput accessibilityLabel="Buscar módulos" style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Buscar módulos en todo el catálogo…" />
        <Pressable accessibilityRole="button" style={styles.backButton} onPress={() => setSort(sort === 'name' ? 'recent' : 'name')}><Text style={styles.backButtonText}>{sort === 'name' ? 'A–Z' : 'Recientes'}</Text></Pressable>
      </View>
      <ScrollView style={styles.scrollView}>
        {folders.sort((a, b) => a.categoryName.localeCompare(b.categoryName)).map((category) => <Pressable accessibilityRole="button" key={category.id} style={styles.folderItem} onPress={() => handleCategoryPress(category)}><Text style={styles.folderIcon}>▦</Text><Text style={styles.folderText}>{category.categoryName}</Text><Text style={styles.editIcon}>→</Text></Pressable>)}
        {!visibleObjects.length && !folders.length && <Text style={styles.emptyText}>{search ? 'No hay módulos que coincidan con la búsqueda.' : 'Esta categoría no tiene módulos. Creá el primero para comenzar.'}</Text>}
        <View style={styles.moduleGrid}>{visibleObjects.map((object) => <Pressable accessibilityRole="button" accessibilityLabel={'Editar módulo ' + object.name} key={object.id} style={styles.moduleCard} onPress={() => setEditingObject(object)}>
          <View style={styles.cardPreview}><Thumbnail uri={thumbnails[object.id]} size={80} icon="cube-outline" /></View>
          <Text style={styles.objectName} numberOfLines={2}>{object.name}</Text>
          <Text style={styles.objectMeta}>Versión {object.lastVersion} · {object.isPublic ? 'Comunidad' : 'Privado'}</Text>
          <Text style={styles.areaBadge}>{moduleDetails[object.id]?.failed ? 'Despiece no disponible' : moduleDetails[object.id]?.count ? moduleDetails[object.id].count + ' piezas · ' + moduleDetails[object.id].area.toLocaleString('es-AR', { maximumFractionDigits: 4 }) + ' m²' : moduleDetails[object.id] ? 'Despiece pendiente' : 'Cargando despiece…'}</Text>
          <Text style={styles.cardEdit}>Editar módulo →</Text>
        </Pressable>)}</View>
      </ScrollView>
    </>;
  };

  const renderCategoryManager = () => {
    const deletableCats = categories.filter((c) => {
      const childCats = categories.filter((cc) => cc.parentCategoryId === c.id);
      const childObjs = objects.filter((o) => o.categoryId === c.id);
      return childCats.length === 0 && childObjs.length === 0;
    });

    return (
      <>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => setShowCategoryManager(false)}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Manage Categories</Text>
        </View>

        <ScrollView style={styles.scrollView}>
          <Text style={styles.sectionTitle}>Create Category</Text>
          <TextInput
            style={styles.input}
            value={newCatName}
            onChangeText={setNewCatName}
            placeholder="Category name"
          />
          <Text style={styles.label}>Parent (optional)</Text>
          <View style={styles.chipRow}>
            <Pressable
              style={[styles.chip, newCatParent === '' && styles.chipActive]}
              onPress={() => setNewCatParent('')}
            >
              <Text style={[styles.chipText, newCatParent === '' && styles.chipTextActive]}>
                None
              </Text>
            </Pressable>
            {categories.map((cat) => (
              <Pressable
                key={cat.id}
                style={[styles.chip, newCatParent === cat.id && styles.chipActive]}
                onPress={() => setNewCatParent(cat.id)}
              >
                <Text
                  style={[styles.chipText, newCatParent === cat.id && styles.chipTextActive]}
                >
                  {cat.categoryName}
                </Text>
              </Pressable>
            ))}
          </View>
          <Button label="Create" onPress={handleCreateCategory} />

          {categories.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
                Existing Categories
              </Text>
              {categories.map((cat) => {
                const isEditing = editingCatId === cat.id;
                const parentName = cat.parentCategoryId
                  ? categories.find((c) => c.id === cat.parentCategoryId)
                      ?.categoryName ?? '?'
                  : 'None';
                const canDelete = deletableCats.some((d) => d.id === cat.id);

                return (
                  <View key={cat.id} style={styles.categoryRow}>
                    {isEditing ? (
                      <View style={styles.editCatRow}>
                        <TextInput
                          style={[styles.input, { flex: 1 }]}
                          value={editingCatName}
                          onChangeText={setEditingCatName}
                        />
                        <Pressable
                          style={styles.smallButton}
                          onPress={() => handleRenameCategory(cat.id)}
                        >
                          <Text style={styles.smallButtonText}>Save</Text>
                        </Pressable>
                        <Pressable
                          style={styles.smallButton}
                          onPress={() => setEditingCatId(null)}
                        >
                          <Text style={styles.smallButtonText}>Cancel</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <>
                        <View style={styles.catInfo}>
                          <Text style={styles.catName}>{cat.categoryName}</Text>
                          <Text style={styles.catParent}>Parent: {parentName}</Text>
                        </View>
                        <Pressable
                          style={styles.smallButton}
                          onPress={() => {
                            setEditingCatId(cat.id);
                            setEditingCatName(cat.categoryName);
                          }}
                        >
                          <Text style={styles.smallButtonText}>Rename</Text>
                        </Pressable>
                        {canDelete && (
                          <Pressable
                            style={[styles.smallButton, styles.deleteSmallButton]}
                            onPress={() => handleDeleteCategory(cat.id)}
                          >
                            <Text style={styles.smallButtonText}>Del</Text>
                          </Pressable>
                        )}
                      </>
                    )}
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      </>
    );
  };

  const renderPreview = () => (
    <View style={styles.workspaceColumn}>
      <ObjectPreview
        uri={previewUri}
        highlightSlot={highlightSlot}
        captureApi={captureApi}
        slotTextures={slotTextures ?? undefined}
        onReadyChange={handlePreviewReady}
      />
    </View>
  );

  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>Loading object data…</Text>
    </View>
  );

  const renderWorkspace = () => {
    if (showCategoryManager && canManageApplication) return <>{renderCategoryManager()}</>;
    if (isLoadingData) return renderLoading();
    if (isActive) return renderPreview();
    return <>{renderBrowserList()}</>;
  };

  const renderNarrow = () => {
    if (showCategoryManager && canManageApplication) return renderCategoryManager();
    if (isActive || isLoadingData) {
      return (
        <ScrollView>
          {isLoadingData ? renderLoading() : (
            <View style={styles.previewRow}>
              <ObjectPreview
                uri={previewUri}
                highlightSlot={highlightSlot}
                captureApi={captureApi}
                slotTextures={slotTextures ?? undefined}
                onReadyChange={handlePreviewReady}
              />
            </View>
          )}
          {renderEditor()}
        </ScrollView>
      );
    }
    return renderBrowserList();
  };

  // ── Main Render ──

  return (
    <View style={styles.container}>
      {isWide && (isActive || isLoadingData) ? (
        <View style={styles.rowContainer}>
          <View style={styles.workspaceColumn}>{renderWorkspace()}</View>
          <View style={styles.formColumn}>{renderEditor()}</View>
        </View>
      ) : (
        renderNarrow()
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  managerIntro: { padding: 16, gap: 6, backgroundColor: COLORS.bgAlt },
  managerTitle: { fontSize: 26, fontWeight: '700', color: COLORS.text },
  managerDescription: { fontSize: 13, color: COLORS.textMuted },
  searchBar: { flexDirection: 'row', padding: 12, gap: 8, alignItems: 'center' },
  searchInput: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: COLORS.borderStrong, padding: 10, borderRadius: 8, color: COLORS.text },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingBottom: 24 },
  moduleCard: { flexBasis: 250, flexGrow: 1, maxWidth: 400, minWidth: 220, padding: 16, gap: 9, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, backgroundColor: COLORS.surface },
  cardPreview: { height: 110, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bgAlt, borderRadius: 8 },
  areaBadge: { padding: 8, backgroundColor: COLORS.primarySoft, color: COLORS.primary, borderRadius: 6, fontSize: 12, fontWeight: '600' },
  cardEdit: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: COLORS.bg,
  },
  rowContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  formColumn: {
    width: '52%',
    minWidth: 400,
    maxWidth: '60%',
  },
  workspaceColumn: {
    flex: 1,
    padding: 16,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  previewRow: {
    height: 250,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bgAlt,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: COLORS.border,
    marginRight: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textHeading,
  },
  breadcrumb: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  folderIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  folderText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textBody,
  },
  objectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  objectInfo: {
    flex: 1,
    marginRight: 10,
  },
  objectThumb: {
    marginRight: 10,
  },
  objectName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textBody,
    marginBottom: 4,
  },
  objectMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  editIcon: {
    fontSize: 18,
    color: COLORS.primary,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 14,
    paddingVertical: 30,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textHeading,
    marginBottom: 12,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 44,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: COLORS.bgAlt,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textHeading,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgAlt,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  catInfo: {
    flex: 1,
  },
  catName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textBody,
  },
  catParent: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  editCatRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smallButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: COLORS.border,
    marginLeft: 6,
  },
  deleteSmallButton: {
    backgroundColor: COLORS.danger,
  },
  smallButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textHeading,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
});
