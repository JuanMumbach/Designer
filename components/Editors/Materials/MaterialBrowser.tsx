import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useAccess } from '../../../services/AccessContext';
import { useAuth } from '../../../services/AuthContext';
import {
  createMaterial,
  updateMaterialPricing,
  createMaterialCategory,
  deleteMaterial,
  deleteMaterialCategory,
  MaterialCategory,
  MaterialMeta,
  MaterialData,
  MaterialType,
  renameMaterial,
  categorizeMaterial,
  categorizeMaterialType,
  createMaterialVersion,
  fetchMaterialVersion,
  fetchAllMaterialTypes,
  updateMaterialCategory,
  updateMaterial,
  fetchAllObjectModels,
  fetchObjectVersion,
  ObjectModel,
} from '../../../services/api';
import { ObjectTemplate } from '../../DesignScreen/3dView/DesignObjects';
import { MaterialSlotInfo } from '../../../services/materialSlots';
import { COLORS } from '@/constants/theme';
import MaterialEditor, { MaterialFormData } from './MaterialEditor';
import MaterialPreview from './MaterialPreview';
import CatalogueView, { CatalogueGroup, InspectorRow } from '../../Catalogue/CatalogueView';
import CategoryManagerPanel from '../CategoryManagerPanel';
import {
  createThumbnailCaptureApi,
  ThumbnailCaptureApi,
} from '../../../services/thumbnailCapture';

const VIEW_MODE_KEY = '@catalogue:materialsViewMode';
const UNCATEGORIZED_KEY = '__none__';

const GROUP_OPTIONS = [
  { key: 'category', label: 'Categoría' },
  { key: 'type', label: 'Tipo' },
];

function getCategoryPath(
  categoryId: string | null | undefined,
  allCategories: MaterialCategory[]
): string {
  if (!categoryId) return 'Sin categoría';
  const path: string[] = [];
  let current: MaterialCategory | undefined = allCategories.find(
    (c) => c.id === categoryId
  );
  while (current) {
    path.unshift(current.categoryName);
    current = allCategories.find((c) => c.id === current?.parentCategoryId);
  }
  return path.length ? path.join(' › ') : 'Sin categoría';
}

interface MaterialBrowserProps {
  materials: MaterialMeta[];
  categories: MaterialCategory[];
  onRefresh: () => void;
}

export default function MaterialBrowser({
  materials,
  categories,
  onRefresh,
}: MaterialBrowserProps) {
  const { canManageApplication } = useAccess();
  const { selectedWorkspaceId, backendUserId } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 700;

  const [query, setQuery] = useState('');
  const [groupBy, setGroupBy] = useState<'category' | 'type'>('category');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<MaterialMeta | null>(null);
  const [editingMaterialData, setEditingMaterialData] = useState<MaterialData | null>(null);
  const [editingDataFailed, setEditingDataFailed] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);

  const captureApi = useMemo<ThumbnailCaptureApi>(
    () => createThumbnailCaptureApi(),
    []
  );

  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const thumbnailAttemptedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const missing = materials
      .filter((m) => !(m.id in thumbnails))
      .filter((m) => !thumbnailAttemptedRef.current.has(m.id));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map((m) =>
        fetchMaterialVersion(m.id, m.lastVersion)
          .then((v) => (v.thumbnailURL ? ([m.id, v.thumbnailURL] as const) : null))
          .catch(() => null)
      )
    ).then((results) => {
      if (cancelled) return;
      setThumbnails((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r) next[r[0]] = r[1];
        }
        return next;
      });
    });
    for (const m of missing) thumbnailAttemptedRef.current.add(m.id);
    return () => {
      cancelled = true;
    };
  }, [materials, thumbnails]);

  useEffect(() => {
    let isMounted = true;
    fetchAllMaterialTypes()
      .then((types) => {
        if (isMounted) setMaterialTypes(types);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const [selectedTemplate, setSelectedTemplate] = useState<ObjectTemplate | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [discoveredSlots, setDiscoveredSlots] = useState<MaterialSlotInfo[]>([]);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [allModels, setAllModels] = useState<ObjectTemplate[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [previewTextureUri, setPreviewTextureUri] = useState<string | null>(null);
  const [liveScaleU, setLiveScaleU] = useState(1);
  const [liveScaleV, setLiveScaleV] = useState(1);

  useEffect(() => {
    if (editingMaterial) {
      setEditingDataFailed(false);
      fetchMaterialVersion(editingMaterial.id, editingMaterial.lastVersion)
        .then(data => {
          setEditingMaterialData(data);
          setEditingDataFailed(false);
          if (data.fileURL) {
            setPreviewTextureUri(data.fileURL);
          }
          setLiveScaleU(data.scaleU ?? 1);
          setLiveScaleV(data.scaleV ?? 1);
        })
        .catch(err => {
          console.warn('Failed to fetch material version data:', err);
          setEditingDataFailed(true);
        });
    } else {
      setEditingMaterialData(null);
      setEditingDataFailed(false);
      setPreviewTextureUri(null);
      setLiveScaleU(1);
      setLiveScaleV(1);
    }
  }, [editingMaterial]);

  const selectedMaterial = useMemo(
    () => materials.find((m) => m.id === selectedId) ?? null,
    [materials, selectedId]
  );

  const groups = useMemo((): CatalogueGroup[] => {
    const needle = query.trim().toLocaleLowerCase();
    const filtered = materials
      .filter((m) => m.name.toLocaleLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name));
    const map = new Map<string, CatalogueGroup>();
    for (const material of filtered) {
      const key = groupBy === 'category'
        ? material.categoryId ?? UNCATEGORIZED_KEY
        : material.typeId ?? UNCATEGORIZED_KEY;
      const label = groupBy === 'category'
        ? getCategoryPath(material.categoryId, categories)
        : material.type?.name ?? materialTypes.find((t) => t.id === material.typeId)?.name ?? 'Sin tipo';
      let group = map.get(key);
      if (!group) {
        group = { key, label, items: [] };
        map.set(key, group);
      }
      group.items.push({
        id: material.id,
        name: material.name,
        subtitle: `v${material.lastVersion}`,
        badge: material.type?.name,
        thumbnailUri: thumbnails[material.id],
      });
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.key === UNCATEGORIZED_KEY) return 1;
      if (b.key === UNCATEGORIZED_KEY) return -1;
      return a.label.localeCompare(b.label);
    });
  }, [materials, categories, materialTypes, query, groupBy, thumbnails]);

  const handleSaveMaterial = async (data: MaterialFormData, isEdit: boolean) => {
    if (isEdit && editingMaterial) {
      await updateMaterialPricing(editingMaterial.id, { costMultiplier: data.costMultiplier, pricePerSquareMeter: data.pricePerSquareMeter, boardWidthMm: data.boardWidthMm, boardHeightMm: data.boardHeightMm, cutSpacingMm: data.cutSpacingMm });
      if (data.name !== editingMaterial.name) {
        await renameMaterial({ id: editingMaterial.id, name: data.name });
      }
      const newCatId = data.categoryId || null;
      if (newCatId !== editingMaterial.categoryId) {
        await categorizeMaterial({ id: editingMaterial.id, categoryId: newCatId });
      }
      if (data.isPublic !== editingMaterial.isPublic) {
        await updateMaterial(editingMaterial.id, { isPublic: data.isPublic });
      }
      if (data.typeId !== editingMaterial.typeId) {
        await categorizeMaterialType({ id: editingMaterial.id, typeId: data.typeId });
      }
      if (data.fileURL || data.scaleU || data.scaleV || data.materialProperties) {
        const thumbnailURL = await captureApi.requestCapture('thumbnails/materials');
        await createMaterialVersion(editingMaterial.id, {
          fileURL: data.fileURL,
          scaleU: parseFloat(data.scaleU) || 1,
          scaleV: parseFloat(data.scaleV) || 1,
          materialProperties: data.materialProperties || undefined,
          creatorId: backendUserId ?? '',
          thumbnailURL: thumbnailURL || undefined,
        });
      }
    } else {
      const meta = await createMaterial({
        costMultiplier: data.costMultiplier,
        pricePerSquareMeter: data.pricePerSquareMeter,
        boardWidthMm: data.boardWidthMm,
        boardHeightMm: data.boardHeightMm,
        cutSpacingMm: data.cutSpacingMm,
        workspaceId: selectedWorkspaceId,
        isPublic: data.isPublic,
        name: data.name,
        creatorId: backendUserId ?? '',
        categoryId: data.categoryId || undefined,
      });
      if (data.typeId) {
        await categorizeMaterialType({ id: meta.id, typeId: data.typeId });
      }
      const thumbnailURL = await captureApi.requestCapture('thumbnails/materials');
      await createMaterialVersion(meta.id, {
        fileURL: data.fileURL,
        scaleU: parseFloat(data.scaleU) || 1,
        scaleV: parseFloat(data.scaleV) || 1,
        materialProperties: data.materialProperties || undefined,
        creatorId: backendUserId ?? '',
        thumbnailURL: thumbnailURL || undefined,
      });
    }
    setEditingMaterial(null);
    setShowCreator(false);
    onRefresh();
  };

  const handleDeleteMaterial = async () => {
    if (!editingMaterial) return;
    try {
      await deleteMaterial(editingMaterial.id);
      setEditingMaterial(null);
      setSelectedId(null);
      onRefresh();
    } catch {
      Alert.alert('Error', 'Failed to delete material.');
    }
  };

  const handleCreateCategory = async (name: string, parentId?: string) => {
    await createMaterialCategory({ categoryName: name, parentCategoryId: parentId });
    onRefresh();
  };

  const handleRenameCategory = async (id: string, name: string) => {
    await updateMaterialCategory(id, { categoryName: name });
    onRefresh();
  };

  const handleDeleteCategory = async (id: string) => {
    await deleteMaterialCategory(id);
    onRefresh();
  };

  const deletableCategoryIds = useMemo(
    () =>
      categories
        .filter((c) => {
          const childCats = categories.filter((cc) => cc.parentCategoryId === c.id);
          const childMats = materials.filter((m) => m.categoryId === c.id);
          return childCats.length === 0 && childMats.length === 0;
        })
        .map((c) => c.id),
    [categories, materials]
  );

  const loadModels = useCallback(async () => {
    if (allModels.length > 0) {
      setShowModelPicker(true);
      return;
    }
    setModelsLoading(true);
    try {
      const objectModels: ObjectModel[] = await fetchAllObjectModels();
      const templatesArray: ObjectTemplate[] = [];
      for (const model of objectModels) {
        try {
          const version = await fetchObjectVersion(model.id);
          templatesArray.push({
            id: model.id,
            version: version.version,
            name: model.name,
            modelUrl: version.fileURL,
            width: version.sizeX,
            height: version.sizeY,
            depth: version.sizeZ,
            categoryId: model.categoryId || undefined,
          });
        } catch {
          // skip models with failed version fetch
        }
      }
      setAllModels(templatesArray);
    } catch {
      Alert.alert('Error', 'Failed to load models.');
    } finally {
      setModelsLoading(false);
      setShowModelPicker(true);
    }
  }, [allModels.length]);

  const handleModelSelect = (template: ObjectTemplate) => {
    setSelectedTemplate(template);
    setSelectedSlot(null);
    setDiscoveredSlots([]);
    setShowModelPicker(false);
  };

  const handleSlotsDiscovered = (slots: MaterialSlotInfo[]) => {
    setDiscoveredSlots(slots);
  };

  const handleTextureChange = (uri: string | null) => {
    setPreviewTextureUri(uri);
  };

  const closeEditor = () => {
    setEditingMaterial(null);
    setEditingMaterialData(null);
    setEditingDataFailed(false);
    setShowCreator(false);
    setPreviewTextureUri(null);
    setSelectedTemplate(null);
    setSelectedSlot(null);
    setDiscoveredSlots([]);
  };

  const isActive = !!editingMaterial || showCreator;
  const isLoadingData = !!editingMaterial && !editingMaterialData && !editingDataFailed;

  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>Cargando datos del material…</Text>
    </View>
  );

  const renderEditor = () => {
    if (isLoadingData) return renderLoading();
    if (editingMaterial && editingDataFailed) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>No se pudo cargar el material.</Text>
          <Pressable style={styles.retryButton} onPress={() => setEditingMaterial({ ...editingMaterial })}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </Pressable>
          <Pressable style={styles.retryButton} onPress={closeEditor}>
            <Text style={styles.retryButtonText}>Volver al catálogo</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <MaterialEditor
        key={editingMaterial?.id ?? 'new'}
        isEdit={!!editingMaterial}
        initial={
          editingMaterial
            ? {
                name: editingMaterial.name,
                creatorId: editingMaterial.creatorId,
                categoryId: editingMaterial.categoryId ?? '',
                typeId: editingMaterial.typeId ?? '',
                fileURL: editingMaterialData?.fileURL ?? '',
                scaleU: editingMaterialData?.scaleU?.toString() ?? '1',
                scaleV: editingMaterialData?.scaleV?.toString() ?? '1',
                materialProperties: editingMaterialData?.materialProperties ?? '',
                isPublic: editingMaterial.isPublic,
                costMultiplier: editingMaterial.costMultiplier ?? 1,
                pricePerSquareMeter: editingMaterial.pricePerSquareMeter ?? null,
                boardWidthMm: editingMaterial.boardWidthMm ?? 2600,
                boardHeightMm: editingMaterial.boardHeightMm ?? 1600,
                cutSpacingMm: editingMaterial.cutSpacingMm ?? 3,
              }
            : undefined
        }
        categories={categories}
        materialTypes={materialTypes}
        onSave={handleSaveMaterial}
        onDelete={editingMaterial ? handleDeleteMaterial : undefined}
        onClose={closeEditor}
        onTextureChange={handleTextureChange}
        onScaleChange={(su, sv) => { setLiveScaleU(su); setLiveScaleV(sv); }}
      />
    );
  };

  const renderPreview = () => (
    <View style={styles.previewColumn}>
      <View style={styles.modelSelectorRow}>
        <Text style={styles.modelSelectorLabel} numberOfLines={1}>
          {selectedTemplate ? `Modelo: ${selectedTemplate.name}` : 'Modelo de vista previa'}
        </Text>
        <Pressable style={styles.selectModelButton} onPress={loadModels}>
          <Text style={styles.selectModelButtonLabel}>
            {selectedTemplate ? 'Cambiar' : 'Elegir modelo'}
          </Text>
        </Pressable>
      </View>
      <View style={styles.previewCanvas}>
        <MaterialPreview
          modelUrl={selectedTemplate?.modelUrl ?? null}
          textureUri={previewTextureUri}
          selectedSlot={selectedSlot}
          onSlotsDiscovered={handleSlotsDiscovered}
          scaleU={liveScaleU}
          scaleV={liveScaleV}
          captureApi={captureApi}
        />
      </View>
      {discoveredSlots.length > 0 && (
        <View style={styles.meshSlotsSection}>
          <Text style={styles.meshSlotsLabel}>Slots de textura</Text>
          <View style={styles.meshSlotsRow}>
            {discoveredSlots.map((slotInfo) => {
              const active = selectedSlot === slotInfo.slot;
              return (
                <Pressable
                  key={slotInfo.slot}
                  style={[styles.meshChip, active && styles.meshChipActive]}
                  onPress={() =>
                    setSelectedSlot(selectedSlot === slotInfo.slot ? null : slotInfo.slot)
                  }
                >
                  <Text style={[styles.meshChipText, active && styles.meshChipTextActive]}>
                    {slotInfo.displayName || `Slot ${slotInfo.slot}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
      {showModelPicker && (
        <View style={styles.modelPickerOverlay}>
          <View style={styles.modelPickerCard}>
            <Text style={styles.pickerTitle}>Elegí un modelo 3D para la vista previa</Text>
            {modelsLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.loadingText}>Cargando modelos…</Text>
              </View>
            ) : allModels.length === 0 ? (
              <Text style={styles.emptyText}>No hay modelos disponibles.</Text>
            ) : (
              <ScrollView style={styles.modelPickerList}>
                {allModels.map((model) => (
                  <Pressable
                    key={model.id}
                    style={styles.modelItem}
                    onPress={() => handleModelSelect(model)}
                  >
                    <View style={styles.modelItemInfo}>
                      <Text style={styles.modelItemName}>{model.name}</Text>
                      <Text style={styles.modelItemDims}>
                        {model.width} x {model.height} x {model.depth}
                      </Text>
                    </View>
                    <Text style={styles.selectArrow}>Elegir</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <Pressable style={styles.cancelModelPicker} onPress={() => setShowModelPicker(false)}>
              <Text style={styles.cancelButtonLabel}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      )}
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

  if (isActive) {
    return (
      <View style={[styles.container, isWide ? styles.editRow : styles.editColumn]}>
        <View style={isWide ? styles.previewWide : styles.previewNarrow}>
          {isLoadingData ? renderLoading() : renderPreview()}
        </View>
        <View style={isWide ? styles.editorWide : styles.editorNarrow}>{renderEditor()}</View>
      </View>
    );
  }

  const inspector = selectedMaterial ? (
    <View>
      <InspectorRow label="Nombre" value={selectedMaterial.name} />
      <InspectorRow label="Categoría" value={getCategoryPath(selectedMaterial.categoryId, categories)} />
      <InspectorRow label="Tipo" value={selectedMaterial.type?.name ?? 'Sin tipo'} />
      <InspectorRow label="Versión" value={`v${selectedMaterial.lastVersion}`} />
      <InspectorRow label="Visibilidad" value={selectedMaterial.isPublic ? 'Comunidad' : 'Privado'} />
      <InspectorRow
        label="Precio por m²"
        value={selectedMaterial.pricePerSquareMeter == null ? 'Pendiente' : String(selectedMaterial.pricePerSquareMeter)}
      />
    </View>
  ) : null;

  const headerActions = [
    { label: 'Nuevo material', onPress: () => setShowCreator(true), primary: true },
    ...(canManageApplication ? [{ label: 'Categorías', onPress: () => setShowCategoryManager(true) }] : []),
  ];

  return (
    <CatalogueView
      headerActions={headerActions}
      contextLabel={`${materials.length} materiales`}
      groups={groups}
      groupOptions={GROUP_OPTIONS}
      groupKey={groupBy}
      onGroupKeyChange={(key) => setGroupBy(key as 'category' | 'type')}
      query={query}
      onQueryChange={setQuery}
      searchPlaceholder="Buscar materiales por nombre"
      emptyText={query ? 'No hay materiales que coincidan con la búsqueda.' : 'Todavía no hay materiales. Creá el primero para comenzar.'}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onOpen={(id) => {
        const material = materials.find((m) => m.id === id);
        if (material) setEditingMaterial(material);
      }}
      openLabel="Editar"
      itemIcon="layers-outline"
      storageKey={VIEW_MODE_KEY}
      inspectorContent={inspector}
      inspectorEmptyText="Selecciona un material para ver sus detalles."
      inspectorActions={selectedMaterial ? { primary: { label: 'Editar', onPress: () => setEditingMaterial(selectedMaterial) } } : undefined}
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
    height: 380,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  editorWide: {
    width: 400,
    maxWidth: '45%',
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
  previewCanvas: {
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 14,
    paddingVertical: 30,
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
  },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: COLORS.border,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textHeading,
  },
  modelSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modelSelectorLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textHeading,
    flex: 1,
    marginRight: 8,
  },
  selectModelButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  selectModelButtonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.white,
  },
  meshSlotsSection: {
    marginTop: 12,
  },
  meshSlotsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textHeading,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  meshSlotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  meshChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  meshChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  meshChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textHeading,
  },
  meshChipTextActive: {
    color: COLORS.white,
  },
  modelPickerOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modelPickerCard: {
    width: 340,
    maxWidth: '100%',
    maxHeight: '90%',
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 30,
  },
  modelPickerList: {
    maxHeight: 300,
  },
  modelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgAlt,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modelItemInfo: {
    flex: 1,
    marginRight: 10,
  },
  modelItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textBody,
    marginBottom: 2,
  },
  modelItemDims: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  selectArrow: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  cancelModelPicker: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  cancelButtonLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
});
