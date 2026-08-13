import { useState, useEffect } from 'react';
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
  createObject,
  createObjectCategory,
  deleteObject,
  deleteObjectCategory,
  MaterialType,
  ObjectCategory,
  ObjectModel,
  ObjectVersion,
  renameObject,
  categorizeObject,
  createObjectVersion,
  fetchObjectVersion,
  updateObjectCategory,
} from '../../../services/api';
import ObjectEditor, { ObjectFormData } from './ObjectEditor';
import ObjectPreview from './ObjectPreview';

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
}

export default function ObjectBrowser({
  objects,
  categories,
  onRefresh,
  materialTypes,
}: ObjectBrowserProps) {
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 700;

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

  // Fetch object version data when editing an object
  useEffect(() => {
    if (editingObject) {
      setEditingDataFailed(false);
      fetchObjectVersion(editingObject.id)
        .then(data => {
          setEditingObjectVersion(data);
          setEditingDataFailed(false);
          if (data.fileURL) {
            setPreviewUri(data.fileURL);
          }
        })
        .catch(err => {
          console.warn('Failed to fetch object version data:', err);
          setEditingDataFailed(true);
        });
    } else {
      setEditingObjectVersion(null);
      setEditingDataFailed(false);
      setPreviewUri(null);
    }
  }, [editingObject]);

  const rootCategories = categories.filter(
    (c) => c.parentCategoryId === null
  );
  const currentSubcategories = categories.filter(
    (c) => c.parentCategoryId === currentCategoryId
  );
  const objectsInCategory = objects.filter(
    (o) => o.categoryId === currentCategoryId
  );
  const uncategorizedObjects = objects.filter((o) => !o.categoryId);

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

  const handleSaveObject = async (data: ObjectFormData, isEdit: boolean) => {
    if (isEdit && editingObject) {
      if (data.name !== editingObject.name) {
        await renameObject({ id: editingObject.id, name: data.name });
      }
      const newCatId = data.categoryId || null;
      if (newCatId !== editingObject.categoryId) {
        await categorizeObject({ id: editingObject.id, categoryId: newCatId });
      }
      if (data.fileURL || data.sizeX || data.sizeY || data.sizeZ || data.objectProperties) {
        await createObjectVersion(editingObject.id, {
          fileURL: data.fileURL,
          sizeX: parseFloat(data.sizeX) || 1,
          sizeY: parseFloat(data.sizeY) || 1,
          sizeZ: parseFloat(data.sizeZ) || 1,
          objectProperties: data.objectProperties || undefined,
          creatorId: data.creatorId || editingObject.creatorId,
        });
      }
    } else {
      const meta = await createObject({
        name: data.name,
        creatorId: data.creatorId,
        categoryId: data.categoryId || undefined,
      });
      await createObjectVersion(meta.id, {
        fileURL: data.fileURL,
        sizeX: parseFloat(data.sizeX) || 1,
        sizeY: parseFloat(data.sizeY) || 1,
        sizeZ: parseFloat(data.sizeZ) || 1,
        objectProperties: data.objectProperties || undefined,
        creatorId: data.creatorId,
      });
    }
    setEditingObject(null);
    setShowCreator(false);
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

  const renderEditor = () => {
    if (editingObject && isLoadingData) {
      return renderLoading();
    }
    return (
      <ObjectEditor
        key={editingObject?.id ?? 'new'}
        disabled={!isActive}
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
              }
            : undefined
        }
        categories={categories}
        objectId={editingObject?.id}
        materialTypes={materialTypes}
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
    const hasContent =
      currentCategoryId === null
        ? rootCategories.length > 0 || uncategorizedObjects.length > 0
        : currentSubcategories.length > 0 || objectsInCategory.length > 0;

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
            <Text style={styles.actionButtonText}>+ New Object</Text>
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
                uncategorizedObjects
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((obj) => (
                    <Pressable
                      key={obj.id}
                      style={styles.objectItem}
                      onPress={() => setEditingObject(obj)}
                    >
                      <View style={styles.objectInfo}>
                        <Text style={styles.objectName}>{obj.name}</Text>
                        <Text style={styles.objectMeta}>
                          v{obj.lastVersion} · {obj.creatorId.slice(0, 8)}…
                        </Text>
                      </View>
                      <Text style={styles.editIcon}>✎</Text>
                    </Pressable>
                  ))}
              {currentCategoryId !== null &&
                objectsInCategory
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((obj) => (
                    <Pressable
                      key={obj.id}
                      style={styles.objectItem}
                      onPress={() => setEditingObject(obj)}
                    >
                      <View style={styles.objectInfo}>
                        <Text style={styles.objectName}>{obj.name}</Text>
                        <Text style={styles.objectMeta}>
                          v{obj.lastVersion} · {obj.creatorId.slice(0, 8)}…
                        </Text>
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
      <ObjectPreview uri={previewUri} />
    </View>
  );

  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#2563eb" />
      <Text style={styles.loadingText}>Loading object data…</Text>
    </View>
  );

  const renderWorkspace = () => {
    if (showCategoryManager) return <>{renderCategoryManager()}</>;
    if (isLoadingData) return renderLoading();
    if (isActive) return renderPreview();
    return <>{renderBrowserList()}</>;
  };

  const renderNarrow = () => {
    if (showCategoryManager) return renderCategoryManager();
    if (isActive || isLoadingData) {
      return (
        <ScrollView>
          {isLoadingData ? renderLoading() : (
            <View style={styles.previewRow}>
              <ObjectPreview uri={previewUri} />
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
      {isWide ? (
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
  },
  workspaceColumn: {
    flex: 1,
    padding: 16,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
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
  objectItem: {
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
  objectInfo: {
    flex: 1,
    marginRight: 10,
  },
  objectName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  objectMeta: {
    fontSize: 11,
    color: '#6b7280',
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
});
