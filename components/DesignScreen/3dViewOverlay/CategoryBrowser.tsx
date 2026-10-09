import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ObjectTemplate } from "../3dView/DesignObjects";
import { ObjectCategory } from "../../../services/api";
import { COLORS, GLASS, RADII } from "@/constants/theme";
import GlassSurface from "./GlassSurface";
import Thumbnail from "../../Thumbnail";

interface CategoryBrowserProps {
  objectTemplates: ObjectTemplate[];
  categories: ObjectCategory[];
  addObjectAction: (objectType: ObjectTemplate) => void;
  onClose?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  wide?: boolean;
}

interface CategoryItemProps {
  category: ObjectCategory;
  count: number;
  onPress: () => void;
  wide?: boolean;
}

function CategoryItem({ category, count, onPress, wide }: CategoryItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.folderItem,
        wide && styles.folderItemWide,
        pressed && styles.itemPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.folderIconWrap}>
        <Ionicons name="folder-outline" size={20} color={COLORS.primary} />
      </View>
      <View style={styles.folderInfo}>
        <Text style={styles.folderText} numberOfLines={1}>
          {category.categoryName}
        </Text>
        <Text style={styles.folderCount}>
          {count} {count === 1 ? "module" : "modules"}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={GLASS.textMuted} />
    </Pressable>
  );
}

interface ObjectItemProps {
  object: ObjectTemplate;
  onSelect: () => void;
  wide?: boolean;
}

function ObjectItem({ object, onSelect, wide }: ObjectItemProps) {
  const dimensionsLabel = `${object.width} × ${object.height} × ${object.depth} m`;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.objectCard,
        wide && styles.objectCardWide,
        pressed && styles.itemPressed,
      ]}
      onPress={onSelect}
    >
      <View style={styles.thumbnailContainer}>
        <Thumbnail
          uri={object.thumbnailUrl}
          width="100%"
          height={wide ? 100 : 76}
          icon="cube-outline"
          radius={RADII.md}
        />
        <View style={styles.dimensionBadge}>
          <Text style={styles.dimensionBadgeText}>{dimensionsLabel}</Text>
        </View>
      </View>

      <View style={styles.cardBottom}>
        <Text style={styles.objectName} numberOfLines={1}>
          {object.name}
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.addButtonPressed,
          ]}
          onPress={onSelect}
        >
          <Ionicons name="add" size={16} color={COLORS.white} />
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function getBreadcrumbPath(
  categoryId: string | null,
  categories: ObjectCategory[]
): string {
  if (!categoryId) return "All Categories";

  const path: string[] = [];
  let current: ObjectCategory | undefined = categories.find(c => c.id === categoryId);

  while (current) {
    path.unshift(current.categoryName);
    current = categories.find(c => c.id === current?.parentCategoryId);
  }

  return "All > " + path.join(" > ");
}

export default function CategoryBrowser({
  objectTemplates,
  categories,
  addObjectAction,
  onClose,
  containerStyle,
  wide,
}: CategoryBrowserProps) {
  const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(null);
  const [categoryStack, setCategoryStack] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const rootCategories = useMemo(
    () => categories.filter(c => c.parentCategoryId === null),
    [categories]
  );

  const currentSubcategories = useMemo(
    () => categories.filter(c => c.parentCategoryId === currentCategoryId),
    [categories, currentCategoryId]
  );

  const objectsInCurrentCategory = useMemo(
    () => objectTemplates.filter(m => m.categoryId === currentCategoryId),
    [objectTemplates, currentCategoryId]
  );

  const uncategorizedObjects = useMemo(
    () => objectTemplates.filter(m => !m.categoryId),
    [objectTemplates]
  );

  const categoryCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const cat of categories) {
      const count = objectTemplates.filter(o => o.categoryId === cat.id).length;
      map.set(cat.id, count);
    }
    return map;
  }, [categories, objectTemplates]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return objectTemplates.filter(o => o.name.toLowerCase().includes(q));
  }, [searchQuery, objectTemplates]);

  const handleCategoryPress = (category: ObjectCategory) => {
    setCategoryStack(prev => [...prev, category.id]);
    setCurrentCategoryId(category.id);
  };

  const handleBack = () => {
    if (categoryStack.length <= 1) {
      setCategoryStack([]);
      setCurrentCategoryId(null);
    } else {
      const nextStack = [...categoryStack];
      nextStack.pop();
      setCategoryStack(nextStack);
      setCurrentCategoryId(nextStack[nextStack.length - 1]);
    }
  };

  return (
    <GlassSurface style={[styles.container, wide && styles.containerWide, containerStyle]}>
      <View style={styles.header}>
        {currentCategoryId !== null && (
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && styles.itemPressed]}
            onPress={handleBack}
          >
            <Ionicons name="arrow-back" size={16} color={GLASS.text} />
          </Pressable>
        )}
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Add Module</Text>
          <Text style={styles.breadcrumb} numberOfLines={1}>
            {getBreadcrumbPath(currentCategoryId, categories)}
          </Text>
        </View>
        {onClose && (
          <Pressable
            style={({ pressed }) => [styles.closeButton, pressed && styles.itemPressed]}
            onPress={onClose}
          >
            <Ionicons name="close" size={18} color={GLASS.textMuted} />
          </Pressable>
        )}
      </View>

      <View style={styles.searchBarWrap}>
        <Ionicons name="search" size={16} color={GLASS.textFaint} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search modules..."
          placeholderTextColor={GLASS.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery !== "" && (
          <Pressable onPress={() => setSearchQuery("")} hitSlop={6}>
            <Ionicons name="close-circle" size={16} color={GLASS.textMuted} />
          </Pressable>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          wide && styles.scrollContentWide,
        ]}
      >
        {searchResults !== null ? (
          searchResults.length === 0 ? (
            <Text style={styles.emptyText}>No modules match "{searchQuery}".</Text>
          ) : (
            searchResults.map(obj => (
              <ObjectItem
                key={obj.id}
                object={obj}
                wide={wide}
                onSelect={() => addObjectAction(obj)}
              />
            ))
          )
        ) : (
          <>
            {currentCategoryId === null &&
              rootCategories.map(cat => (
                <CategoryItem
                  key={cat.id}
                  category={cat}
                  count={categoryCountMap.get(cat.id) ?? 0}
                  wide={wide}
                  onPress={() => handleCategoryPress(cat)}
                />
              ))}

            {currentCategoryId !== null &&
              currentSubcategories.map(cat => (
                <CategoryItem
                  key={cat.id}
                  category={cat}
                  count={categoryCountMap.get(cat.id) ?? 0}
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

            {currentCategoryId === null &&
              rootCategories.length === 0 &&
              uncategorizedObjects.length === 0 && (
                <Text style={styles.emptyText}>No furniture models available.</Text>
              )}

            {currentCategoryId !== null &&
              currentSubcategories.length === 0 &&
              objectsInCurrentCategory.length === 0 && (
                <Text style={styles.emptyText}>No items in this category.</Text>
              )}
          </>
        )}
      </ScrollView>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 320,
    maxHeight: "75%",
    minHeight: 280,
    borderRadius: RADII.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
    overflow: "hidden",
  },
  containerWide: {
    width: "88%",
    maxWidth: 780,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: GLASS.border,
    backgroundColor: GLASS.bgStrong,
    gap: 10,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: GLASS.text,
    letterSpacing: 0.2,
  },
  breadcrumb: {
    fontSize: 11,
    color: GLASS.textMuted,
    fontWeight: "500",
    marginTop: 1,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: RADII.md,
    backgroundColor: GLASS.bgInput,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: RADII.md,
    backgroundColor: GLASS.bgInput,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GLASS.bgInput,
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: GLASS.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: GLASS.text,
    paddingVertical: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    gap: 10,
  },
  scrollContentWide: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: 12,
  },
  folderItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GLASS.bgInput,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: GLASS.border,
    gap: 12,
  },
  folderItemWide: {
    width: "48%",
    flexGrow: 1,
  },
  folderIconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADII.md,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  folderInfo: {
    flex: 1,
  },
  folderText: {
    fontSize: 14,
    fontWeight: "700",
    color: GLASS.text,
  },
  folderCount: {
    fontSize: 11,
    color: GLASS.textMuted,
    marginTop: 2,
  },
  objectCard: {
    backgroundColor: GLASS.bgStrong,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: GLASS.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  objectCardWide: {
    width: "31%",
    minWidth: 200,
    flexGrow: 1,
  },
  thumbnailContainer: {
    position: "relative",
    width: "100%",
    backgroundColor: COLORS.surfaceAlt,
  },
  dimensionBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(17, 24, 39, 0.75)",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: RADII.sm,
  },
  dimensionBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  objectName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: GLASS.text,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADII.md,
  },
  addButtonPressed: {
    backgroundColor: COLORS.primaryPressed,
  },
  addButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },
  itemPressed: {
    backgroundColor: GLASS.bgPressed,
  },
  emptyText: {
    textAlign: "center",
    color: GLASS.textMuted,
    fontSize: 13,
    paddingVertical: 32,
    width: "100%",
  },
});
