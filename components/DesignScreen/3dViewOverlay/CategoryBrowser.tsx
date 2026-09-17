import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Button from "../../Button";
import { ObjectTemplate } from "../3dView/DesignObjects";
import { ObjectCategory } from "../../../services/api";
import { COLORS, RADII } from "@/constants/theme";

interface CategoryBrowserProps {
  objectTemplates: ObjectTemplate[];
  categories: ObjectCategory[];
  addObjectAction: (objectType: ObjectTemplate) => void;
}

interface CategoryItemProps {
  category: ObjectCategory;
  onPress: () => void;
}

function CategoryItem({ category, onPress }: CategoryItemProps) {
  return (
    <TouchableOpacity style={styles.folderItem} onPress={onPress}>
      <Text style={styles.folderIcon}>📁</Text>
      <Text style={styles.folderText}>{category.categoryName}</Text>
    </TouchableOpacity>
  );
}

interface ObjectItemProps {
  object: ObjectTemplate;
  onSelect: () => void;
}

function ObjectItem({ object, onSelect }: ObjectItemProps) {
  return (
    <View style={styles.objectItem}>
      <View style={styles.objectInfo}>
        <Text style={styles.objectName}>{object.name}</Text>
        <Text style={styles.objectDimensions}>
          W: {object.width}  H: {object.height}  D: {object.depth}
        </Text>
      </View>
      <Button label="Select" onPress={onSelect} />
    </View>
  );
}

function getBreadcrumbPath(
  categoryId: string | null,
  categories: ObjectCategory[]
): string {
  if (!categoryId) return "Root";

  const path: string[] = [];
  let current: ObjectCategory | undefined = categories.find(c => c.id === categoryId);

  while (current) {
    path.unshift(current.categoryName);
    current = categories.find(c => c.id === current?.parentCategoryId);
  }

  return "Root > " + path.join(" > ");
}

export default function CategoryBrowser({
  objectTemplates,
  categories,
  addObjectAction,
}: CategoryBrowserProps) {
  const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(null);
  const [categoryStack, setCategoryStack] = useState<string[]>([]);

  const rootCategories = categories.filter(c => c.parentCategoryId === null);
  const currentSubcategories = categories.filter(
    c => c.parentCategoryId === currentCategoryId
  );
  const objectsInCurrentCategory = objectTemplates.filter(
    m => m.categoryId === currentCategoryId
  );
  const uncategorizedObjects = objectTemplates.filter(m => !m.categoryId);

  const handleCategoryPress = (category: ObjectCategory) => {
    setCategoryStack(prev => [...prev, category.id]);
    setCurrentCategoryId(category.id);
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

  const hasContent =
    currentCategoryId === null
      ? rootCategories.length > 0 || uncategorizedObjects.length > 0
      : currentSubcategories.length > 0 || objectsInCurrentCategory.length > 0;

  if (categories.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.breadcrumb}>Root</Text>
        </View>
        <ScrollView style={styles.scrollView}>
          {objectTemplates.map(obj => (
            <ObjectItem
              key={obj.id}
              object={obj}
              onSelect={() => addObjectAction(obj)}
            />
          ))}
          {objectTemplates.length === 0 && (
            <Text style={styles.emptyText}>No furniture models available.</Text>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.breadcrumb} numberOfLines={1}>
          {getBreadcrumbPath(currentCategoryId, categories)}
        </Text>
      </View>

      <ScrollView style={styles.scrollView}>
        {!hasContent ? (
          <Text style={styles.emptyText}>No items in this category.</Text>
        ) : (
          <>
            {currentCategoryId === null &&
              rootCategories.map(cat => (
                <CategoryItem
                  key={cat.id}
                  category={cat}
                  onPress={() => handleCategoryPress(cat)}
                />
              ))}
            {currentCategoryId !== null &&
              currentSubcategories.map(cat => (
              <CategoryItem
                key={cat.id}
                category={cat}
                onPress={() => handleCategoryPress(cat)}
              />
            ))}
            {currentCategoryId === null &&
              uncategorizedObjects.map(obj => (
                <ObjectItem
                  key={obj.id}
                  object={obj}
                  onSelect={() => addObjectAction(obj)}
                />
              ))}
            {objectsInCurrentCategory.map(obj => (
              <ObjectItem
                key={obj.id}
                object={obj}
                onSelect={() => addObjectAction(obj)}
              />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 300,
    maxHeight: "70%",
    minHeight: 260,
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
  objectItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bg,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: RADII.lg,
    marginBottom: 8,
    borderWidth: 1,
    borderBottomColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  objectInfo: {
    flex: 1,
    marginRight: 10,
  },
  objectName: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textBody,
    marginBottom: 4,
  },
  objectDimensions: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  emptyText: {
    textAlign: "center",
    color: COLORS.textMuted,
    fontSize: 14,
    paddingVertical: 30,
  },
});
