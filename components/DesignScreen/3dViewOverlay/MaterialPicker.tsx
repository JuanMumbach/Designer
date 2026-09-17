import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Button from "../../Button";
import { MaterialCategory, MaterialMeta, fetchMaterialVersion, MaterialData } from "../../../services/api";
import { COLORS, RADII } from "@/constants/theme";

interface MaterialPickerProps {
  materials: MaterialMeta[];
  categories: MaterialCategory[];
  onSelect: (materialMeta: MaterialMeta, materialData: MaterialData) => Promise<void>;
  onClose: () => void;
}

function getBreadcrumbPath(categoryId: string | null, categories: MaterialCategory[]): string {
  if (!categoryId) return "Root";
  const path: string[] = [];
  let current = categories.find(c => c.id === categoryId);
  while (current) {
    path.unshift(current.categoryName);
    current = current.parentCategoryId ? categories.find(c => c.id === current!.parentCategoryId) : undefined;
  }
  return "Root > " + path.join(" > ");
}

export default function MaterialPicker({ materials, categories, onSelect, onClose }: MaterialPickerProps) {
  const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(null);
  const [categoryStack, setCategoryStack] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rootCategories = categories.filter(c => c.parentCategoryId === null);
  const currentSubcategories = categories.filter(c => c.parentCategoryId === currentCategoryId);
  const materialsInCategory = materials.filter(m => m.categoryId === currentCategoryId);
  const uncategorizedMaterials = materials.filter(m => !m.categoryId);

  const handleCategoryPress = (cat: MaterialCategory) => {
    setCategoryStack(prev => [...prev, cat.id]);
    setCurrentCategoryId(cat.id);
  };

  const handleBack = () => {
    if (categoryStack.length === 0) {
      setCurrentCategoryId(null);
    } else {
      const newStack = [...categoryStack];
      newStack.pop();
      setCategoryStack(newStack);
      setCurrentCategoryId(newStack.length > 0 ? newStack[newStack.length - 1] : null);
    }
  };

  const handleMaterialPress = async (material: MaterialMeta) => {
    setSelectedId(material.id);
    try {
      const materialData = await fetchMaterialVersion(material.id, material.lastVersion);
      await onSelect(material, materialData);
    } catch {
      setSelectedId(null);
    }
  };

  const hasContent = currentCategoryId === null
    ? rootCategories.length > 0 || uncategorizedMaterials.length > 0
    : currentSubcategories.length > 0 || materialsInCategory.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
        <Text style={styles.breadcrumb} numberOfLines={1}>
          {getBreadcrumbPath(currentCategoryId, categories)}
        </Text>
      </View>

      <ScrollView style={styles.scrollView}>
        {!hasContent ? (
          <Text style={styles.emptyText}>No materials in this category.</Text>
        ) : (
          <>
            {currentCategoryId === null && rootCategories
              .sort((a, b) => a.categoryName.localeCompare(b.categoryName))
              .map(cat => (
                <Pressable key={cat.id} style={styles.folderItem} onPress={() => handleCategoryPress(cat)}>
                  <Text style={styles.folderIcon}>📁</Text>
                  <Text style={styles.folderText}>{cat.categoryName}</Text>
                </Pressable>
              ))}
            {currentCategoryId !== null && currentSubcategories
              .sort((a, b) => a.categoryName.localeCompare(b.categoryName))
              .map(cat => (
                <Pressable key={cat.id} style={styles.folderItem} onPress={() => handleCategoryPress(cat)}>
                  <Text style={styles.folderIcon}>📁</Text>
                  <Text style={styles.folderText}>{cat.categoryName}</Text>
                </Pressable>
              ))}
            {currentCategoryId === null && uncategorizedMaterials
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(mat => (
                <Pressable
                  key={mat.id}
                  style={[styles.materialItem, selectedId === mat.id && styles.materialItemSelected]}
                  onPress={() => handleMaterialPress(mat)}
                  disabled={!!selectedId}
                >
                  <View style={styles.materialInfo}>
                    <Text style={styles.materialName}>{mat.name}</Text>
                    <Text style={styles.materialMeta}>v{mat.lastVersion}</Text>
                  </View>
                  <Text style={styles.selectIcon}>{selectedId === mat.id ? "..." : "→"}</Text>
                </Pressable>
              ))}
            {materialsInCategory
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(mat => (
                <Pressable
                  key={mat.id}
                  style={[styles.materialItem, selectedId === mat.id && styles.materialItemSelected]}
                  onPress={() => handleMaterialPress(mat)}
                  disabled={!!selectedId}
                >
                  <View style={styles.materialInfo}>
                    <Text style={styles.materialName}>{mat.name}</Text>
                    <Text style={styles.materialMeta}>v{mat.lastVersion}</Text>
                  </View>
                  <Text style={styles.selectIcon}>{selectedId === mat.id ? "..." : "→"}</Text>
                </Pressable>
              ))}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Cancel" onPress={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 300,
    maxHeight: "85%",
    backgroundColor: COLORS.bg,
    borderRadius: RADII.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bgAlt,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.border,
    marginRight: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textHeading,
  },
  breadcrumb: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  folderItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surfaceAlt,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: RADII.lg,
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
    fontWeight: "600",
    color: COLORS.textBody,
  },
  materialItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bg,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: RADII.lg,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  materialItemSelected: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },
  materialInfo: {
    flex: 1,
    marginRight: 10,
  },
  materialName: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textBody,
    marginBottom: 4,
  },
  materialMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  selectIcon: {
    fontSize: 18,
    color: COLORS.primary,
  },
  emptyText: {
    textAlign: "center",
    color: COLORS.textMuted,
    fontSize: 14,
    paddingVertical: 30,
  },
  footer: {
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});
