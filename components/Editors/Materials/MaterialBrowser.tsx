import { useState, useEffect, useCallback } from 'react';
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
import Button from '../../Button';
import {
  createMaterial,
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
import MaterialEditor, { MaterialFormData } from './MaterialEditor';
import MaterialPreview from './MaterialPreview';

function getBreadcrumbPath(
  categoryId: string | null,
  allCategories: MaterialCategory[]
): string {
  if (!categoryId) return 'Root';
  const path: string[] = [];
  let current: MaterialCategory | undefined = allCategories.find(
    (c) => c.id === categoryId
  );
  while (current) {
    path.unshift(current.categoryName);
    current = allCategories.find((c) => c.id === current?.parentCategoryId);
  }
  return 'Root > ' + path.join(' > ');
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
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 700;

  const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(
    null
  );
  const [categoryStack, setCategoryStack] = useState<string[]>([]);
  const [editingMaterial, setEditingMaterial] = useState<MaterialMeta | null>(null);
  const [editingMaterialData, setEditingMaterialData] = useState<MaterialData | null>(null);
  const [editingDataFailed, setEditingDataFailed] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);

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

  // ── Category manager state ──
  const [newCatName, setNewCatName] = useState('');
  const [newCatParent, setNewCatParent] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');

  // ── Lifted preview state (from MaterialEditor) ──
  const [selectedTemplate, setSelectedTemplate] = useState<ObjectTemplate | null>(null);
  const [selectedMesh, setSelectedMesh] = useState<string | null>(null);
  const [discoveredMeshes, setDiscoveredMeshes] = useState<string[]>([]);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [allModels, setAllModels] = useState<ObjectTemplate[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [previewTextureUri, setPreviewTextureUri] = useState<string | null>(null);
  const [liveScaleU, setLiveScaleU] = useState(1);
  const [liveScaleV, setLiveScaleV] = useState(1);

  // Fetch material version data when editing a material
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

  const rootCategories = categories.filter(
    (c) => c.parentCategoryId === null
  );
  const currentSubcategories = categories.filter(
    (c) => c.parentCategoryId === currentCategoryId
  );
  const materialsInCategory = materials.filter(
    (m) => m.categoryId === currentCategoryId
  );
  const uncategorizedMaterials = materials.filter((m) => !m.categoryId);

  const handleCategoryPress = (cat: MaterialCategory) => {
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

  const handleSaveMaterial = async (data: MaterialFormData, isEdit: boolean) => {
    if (isEdit && editingMaterial) {
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
        await createMaterialVersion(editingMaterial.id, {
          fileURL: data.fileURL,
          scaleU: parseFloat(data.scaleU) || 1,
          scaleV: parseFloat(data.scaleV) || 1,
          materialProperties: data.materialProperties || undefined,
          creatorId: data.creatorId || editingMaterial.creatorId,
        });
      }
    } else {
      const meta = await createMaterial({
        name: data.name,
        creatorId: data.creatorId,
        categoryId: data.categoryId || undefined,
      });
      if (data.typeId) {
        await categorizeMaterialType({ id: meta.id, typeId: data.typeId });
      }
      await createMaterialVersion(meta.id, {
        fileURL: data.fileURL,
        scaleU: parseFloat(data.scaleU) || 1,
        scaleV: parseFloat(data.scaleV) || 1,
        materialProperties: data.materialProperties || undefined,
        creatorId: data.creatorId,
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
      onRefresh();
    } catch {
      Alert.alert('Error', 'Failed to delete material.');
    }
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      await createMaterialCategory({
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
      await updateMaterialCategory(id, { categoryName: editingCatName.trim() });
      setEditingCatId(null);
      setEditingCatName('');
      onRefresh();
    } catch {
      Alert.alert('Error', 'Failed to rename category.');
    }
  };

  const handleDeleteCategory = (id: string) => {
    const confirm = () => {
      deleteMaterialCategory(id)
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

  // ── Lifted preview functions ──

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
    setSelectedMesh(null);
    setDiscoveredMeshes([]);
    setShowModelPicker(false);
  };

  const handleMeshesDiscovered = (names: string[]) => {
    setDiscoveredMeshes(names);
  };

  const handleTextureChange = (uri: string | null) => {
    setPreviewTextureUri(uri);
  };

  const isActive = editingMaterial || showCreator;
  const isLoadingData = editingMaterial && !editingMaterialData && !editingDataFailed;

  // ── Render helpers ──

  const renderEditor = () => {
    if (editingMaterial && isLoadingData) {
      return renderLoading();
    }
    return (
      <MaterialEditor
        key={editingMaterial?.id ?? 'new'}
        disabled={!isActive}
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
              }
            : undefined
        }
        categories={categories}
        materialTypes={materialTypes}
        onSave={handleSaveMaterial}
        onDelete={editingMaterial ? handleDeleteMaterial : undefined}
        onClose={() => {
          setEditingMaterial(null);
          setEditingMaterialData(null);
          setEditingDataFailed(false);
          setShowCreator(false);
          setPreviewTextureUri(null);
          setSelectedTemplate(null);
          setSelectedMesh(null);
          setDiscoveredMeshes([]);
        }}
        onTextureChange={handleTextureChange}
        onScaleChange={(su, sv) => { setLiveScaleU(su); setLiveScaleV(sv); }}
      />
    );
  };

  const renderBrowserList = () => {
    const hasContent =
      currentCategoryId === null
        ? rootCategories.length > 0 || uncategorizedMaterials.length > 0
        : currentSubcategories.length > 0 || materialsInCategory.length > 0;

    return (
      <>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <Text style={styles.breadcrumb} numberOfLines={1}>
            {getBreadcrumbPath(currentCategoryId, categories)}
          </Text>
        </View>

        <View style={styles.actionBar}>
          <Pressable style={styles.actionButton} onPress={() => setShowCreator(true)}>
            <Text style={styles.actionButtonText}>+ New Material</Text>
          </Pressable>
          <Pressable
            style={styles.actionButton}
            onPress={() => setShowCategoryManager(true)}
          >
            <Text style={styles.actionButtonText}>Categories</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.scrollView}>
          {!hasContent ? (
            <Text style={styles.emptyText}>No items in this category.</Text>
          ) : (
            <>
              {currentCategoryId === null &&
                rootCategories
                  .sort((a, b) => a.categoryName.localeCompare(b.categoryName))
                  .map((cat) => (
                    <Pressable
                      key={cat.id}
                      style={styles.folderItem}
                      onPress={() => handleCategoryPress(cat)}
                    >
                      <Text style={styles.folderIcon}>📁</Text>
                      <Text style={styles.folderText}>{cat.categoryName}</Text>
                    </Pressable>
                  ))}
              {currentCategoryId !== null &&
                currentSubcategories
                  .sort((a, b) => a.categoryName.localeCompare(b.categoryName))
                  .map((cat) => (
                    <Pressable
                      key={cat.id}
                      style={styles.folderItem}
                      onPress={() => handleCategoryPress(cat)}
                    >
                      <Text style={styles.folderIcon}>📁</Text>
                      <Text style={styles.folderText}>{cat.categoryName}</Text>
                    </Pressable>
                  ))}
              {currentCategoryId === null &&
                uncategorizedMaterials
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((mat) => (
                    <Pressable
                      key={mat.id}
                      style={styles.materialItem}
                      onPress={() => setEditingMaterial(mat)}
                    >
                      <View style={styles.materialInfo}>
                        <Text style={styles.materialName}>{mat.name}</Text>
                        <Text style={styles.materialMeta}>
                          v{mat.lastVersion} · {mat.creatorId.slice(0, 8)}…
                        </Text>
                        {mat.type?.name && (
                          <Text style={styles.materialType}>Type: {mat.type.name}</Text>
                        )}
                      </View>
                      <Text style={styles.editIcon}>✎</Text>
                    </Pressable>
                  ))}
              {currentCategoryId !== null &&
                materialsInCategory
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((mat) => (
                    <Pressable
                      key={mat.id}
                      style={styles.materialItem}
                      onPress={() => setEditingMaterial(mat)}
                    >
                      <View style={styles.materialInfo}>
                        <Text style={styles.materialName}>{mat.name}</Text>
                        <Text style={styles.materialMeta}>
                          v{mat.lastVersion} · {mat.creatorId.slice(0, 8)}…
                        </Text>
                        {mat.type?.name && (
                          <Text style={styles.materialType}>Type: {mat.type.name}</Text>
                        )}
                      </View>
                      <Text style={styles.editIcon}>✎</Text>
                    </Pressable>
                  ))}
            </>
          )}
        </ScrollView>
      </>
    );
  };

  const renderCategoryManager = () => {
    const deletableCats = categories.filter((c) => {
      const childCats = categories.filter((cc) => cc.parentCategoryId === c.id);
      const childMats = materials.filter((m) => m.categoryId === c.id);
      return childCats.length === 0 && childMats.length === 0;
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
      <View style={styles.modelSelectorRow}>
        <Text style={styles.modelSelectorLabel}>
          {selectedTemplate ? `Model: ${selectedTemplate.name}` : 'Preview Model'}
        </Text>
        <Pressable style={styles.selectModelButton} onPress={loadModels}>
          <Text style={styles.selectModelButtonLabel}>
            {selectedTemplate ? 'Change' : 'Select Model'}
          </Text>
        </Pressable>
      </View>
      <MaterialPreview
        modelUrl={selectedTemplate?.modelUrl ?? null}
        textureUri={previewTextureUri}
        selectedMesh={selectedMesh}
        onMeshesDiscovered={handleMeshesDiscovered}
        scaleU={liveScaleU}
        scaleV={liveScaleV}
      />
      {discoveredMeshes.length > 0 && (
        <View style={styles.meshSlotsSection}>
          <Text style={styles.meshSlotsLabel}>Texture Slots</Text>
          <View style={styles.meshSlotsRow}>
            {discoveredMeshes.map((meshName) => {
              const isActive = selectedMesh === meshName;
              return (
                <Pressable
                  key={meshName}
                  style={[styles.meshChip, isActive && styles.meshChipActive]}
                  onPress={() =>
                    setSelectedMesh(meshName === selectedMesh ? null : meshName)
                  }
                >
                  <Text
                    style={[
                      styles.meshChipText,
                      isActive && styles.meshChipTextActive,
                    ]}
                  >
                    {meshName}
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
            <Text style={styles.pickerTitle}>Select a 3D Model for Preview</Text>
            {modelsLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#2563eb" />
                <Text style={styles.loadingText}>Loading models...</Text>
              </View>
            ) : allModels.length === 0 ? (
              <Text style={styles.emptyText}>No models available.</Text>
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
                    <Text style={styles.selectArrow}>Select</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <Pressable
              style={styles.cancelModelPicker}
              onPress={() => setShowModelPicker(false)}
            >
              <Text style={styles.cancelButtonLabel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );

  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <Text style={styles.loadingText}>Loading material data…</Text>
    </View>
  );

  const renderWorkspace = () => {
    if (showCategoryManager) return <>{renderCategoryManager()}</>;
    if (isLoadingData) return renderLoading();
    if (isActive) return renderPreview();
    return <>{renderBrowserList()}</>;
  };

  const renderNarrow = () => {
    if (isActive || isLoadingData) {
      return (
        <ScrollView>
          {renderEditor()}
          {isLoadingData ? renderLoading() : renderPreview()}
        </ScrollView>
      );
    }
    return renderBrowserList();
  };

  // ── Main Render ──

  return (
    <View style={styles.container}>
      {isWide ? (
        <View style={styles.rowContainer}>
          <View style={styles.formColumn}>{renderEditor()}</View>
          <View style={styles.workspaceColumn}>{renderWorkspace()}</View>
        </View>
      ) : (
        renderNarrow()
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: 'white',
  },
  rowContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  formColumn: {
    width: 340,
    maxWidth: '35%',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  workspaceColumn: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
    marginRight: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  breadcrumb: {
    flex: 1,
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
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
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  folderIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  folderText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  materialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  materialInfo: {
    flex: 1,
    marginRight: 10,
  },
  materialName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  materialMeta: {
    fontSize: 11,
    color: '#6b7280',
  },
  materialType: {
    fontSize: 11,
    color: '#2563eb',
    fontWeight: '600',
    marginTop: 2,
  },
  editIcon: {
    fontSize: 18,
    color: '#2563eb',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 14,
    paddingVertical: 30,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
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
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  catInfo: {
    flex: 1,
  },
  catName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  catParent: {
    fontSize: 11,
    color: '#6b7280',
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
    backgroundColor: '#e5e7eb',
    marginLeft: 6,
  },
  deleteSmallButton: {
    backgroundColor: '#fecaca',
  },
  smallButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  // ── Preview styles (lifted from MaterialEditor) ──
  modelSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modelSelectorLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
    marginRight: 8,
  },
  selectModelButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#2563eb',
  },
  selectModelButtonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  meshSlotsSection: {
    marginTop: 12,
  },
  meshSlotsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
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
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  meshChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  meshChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  meshChipTextActive: {
    color: '#fff',
  },
  modelPickerOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modelPickerCard: {
    width: 340,
    maxHeight: '80%',
    backgroundColor: 'white',
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
    color: '#111827',
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
    backgroundColor: '#f9fafb',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modelItemInfo: {
    flex: 1,
    marginRight: 10,
  },
  modelItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 2,
  },
  modelItemDims: {
    fontSize: 11,
    color: '#6b7280',
  },
  selectArrow: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },
  cancelModelPicker: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  cancelButtonLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
});
