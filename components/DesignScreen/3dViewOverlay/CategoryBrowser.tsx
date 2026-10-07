import { useState } from "react";
import { ScrollView, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import Button from "../../Button";
import { ObjectTemplate } from "../3dView/DesignObjects";
import { ObjectCategory } from "../../../services/api";
import { GLASS, RADII } from "@/constants/theme";
import GlassSurface from "./GlassSurface";

interface CategoryBrowserProps {
  objectTemplates: ObjectTemplate[];
  categories: ObjectCategory[];
  addObjectAction: (objectType: ObjectTemplate) => void;
  containerStyle?: StyleProp<ViewStyle>;
  wide?: boolean;
}

interface CategoryItemProps {
  category: ObjectCategory;
  onPress: () => void;
}

function CategoryItem({ category, onPress, wide }: CategoryItemProps & { wide?: boolean }) {
  return (
    <TouchableOpacity style={[styles.folderItem, wide && styles.wideItem]} onPress={onPress}>
      <Text style={styles.folderIcon}>📁</Text>
      <Text style={styles.folderText}>{category.categoryName}</Text>
    </TouchableOpacity>
  );
}

interface ObjectItemProps {
  object: ObjectTemplate;
  onSelect: () => void;
}

function ObjectItem({ object, onSelect, wide }: ObjectItemProps & { wide?: boolean }) {
  return (
    <View style={[styles.objectItem, wide && styles.wideItem]}>
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
  containerStyle,
  wide,
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
      <GlassSurface style={[styles.container, containerStyle]}>
        <View style={styles.header}>
          <Text style={styles.breadcrumb}>Root</Text>
        </View>
        <ScrollView style={styles.scrollView} contentContainerStyle={wide ? styles.scrollContentWide : undefined}>
          {objectTemplates.map(obj => (
            <ObjectItem
              key={obj.id}
              object={obj}
              wide={wide}
              onSelect={() => addObjectAction(obj)}
            />
          ))}
          {objectTemplates.length === 0 && (
            <Text style={styles.emptyText}>No furniture models available.</Text>
          )}
        </ScrollView>
      </GlassSurface>
    );
  }

  return (
    <GlassSurface style={[styles.container, containerStyle]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.breadcrumb} numberOfLines={1}>
          {getBreadcrumbPath(currentCategoryId, categories)}
        </Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={wide ? styles.scrollContentWide : undefined}>
        {!hasContent ? (
          <Text style={styles.emptyText}>No items in this category.</Text>
        ) : (
          <>
            {currentCategoryId === null &&
              rootCategories.map(cat => (
                <CategoryItem
                  key={cat.id}
                  category={cat}
                  wide={wide}
                  onPress={() => handleCategoryPress(cat)}
                />
              ))}
            {currentCategoryId !== null &&
              currentSubcategories.map(cat => (
              <CategoryItem
                key={cat.id}
                category={cat}
                wide={wide}
                onPress={() => handleCategoryPress(cat)}
              />
            ))}
            {currentCategoryId === null &&
              uncategorizedObjects.map(obj => (
                <ObjectItem
                  key={obj.id}
                  object={obj}
                  wide={wide}
                  onSelect={() => addObjectAction(obj)}
                />
              ))}
            {objectsInCurrentCategory.map(obj => (
              <ObjectItem
                key={obj.id}
                object={obj}
                wide={wide}
                onSelect={() => addObjectAction(obj)}
              />
            ))}
          </>
        )}
      </ScrollView>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 300,
    maxHeight: "70%",
    minHeight: 260,
    borderRadius: RADII.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: GLASS.border,
    backgroundColor: GLASS.bgStrong,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADII.sm,
    backgroundColor: GLASS.bgPressed,
    marginRight: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: GLASS.text,
  },
  breadcrumb: {
    flex: 1,
    fontSize: 13,
    color: GLASS.textMuted,
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  scrollContentWide: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "flex-start",
  },
  wideItem: {
    flexGrow: 1,
    flexBasis: 220,
    marginBottom: 0,
  },
  folderItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GLASS.bgInput,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: RADII.lg,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: GLASS.border,
  },
  folderIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  folderText: {
    fontSize: 15,
    fontWeight: "600",
    color: GLASS.text,
  },
  objectItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GLASS.bgInput,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: RADII.lg,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: GLASS.border,
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
    color: GLASS.text,
    marginBottom: 4,
  },
  objectDimensions: {
    fontSize: 11,
    color: GLASS.textMuted,
  },
  emptyText: {
    textAlign: "center",
    color: GLASS.textMuted,
    fontSize: 14,
    paddingVertical: 30,
  },
});
