import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ObjectTemplate } from "../3dView/DesignObjects";
import { ObjectCategory } from "../../../services/api";
import { COLORS, GLASS, RADII } from "@/constants/theme";
import GlassSurface from "./GlassSurface";
import Thumbnail from "../../Thumbnail";
import { getBreadcrumbPath } from "./categoryUtils";

interface ModuleCatalogueProps {
  objectTemplates: ObjectTemplate[];
  categories: ObjectCategory[];
  addObjectAction: (objectType: ObjectTemplate) => void;
  onClose?: () => void;
}

function SquareCard({
  object,
  selected,
  onPress,
}: {
  object: ObjectTemplate;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.square,
        selected && styles.squareSelected,
        pressed && styles.itemPressed,
      ]}
      onPress={onPress}
    >
      <Thumbnail
        uri={object.thumbnailUrl}
        size={56}
        icon="cube-outline"
        radius={RADII.sm}
      />
      {selected && (
        <View style={styles.squareCheck}>
          <Ionicons name="checkmark" size={12} color={COLORS.white} />
        </View>
      )}
    </Pressable>
  );
}

function SquareFolder({
  category,
  onPress,
}: {
  category: ObjectCategory;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.square,
        styles.squareFolder,
        pressed && styles.itemPressed,
      ]}
      onPress={onPress}
    >
      <Ionicons name="folder" size={26} color={COLORS.primary} />
      <Text style={styles.squareFolderText} numberOfLines={1}>
        {category.categoryName}
      </Text>
    </Pressable>
  );
}

function DetailCard({
  object,
  selected,
  onSelect,
  onAdd,
}: {
  object: ObjectTemplate;
  selected: boolean;
  onSelect: () => void;
  onAdd: () => void;
}) {
  const dimensionsLabel = `${object.width} × ${object.height} × ${object.depth} m`;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.detailCard,
        selected && styles.detailCardSelected,
        pressed && styles.itemPressed,
      ]}
      onPress={onSelect}
    >
      <View style={styles.thumbnailContainer}>
        <Thumbnail
          uri={object.thumbnailUrl}
          width="100%"
          height={100}
          icon="cube-outline"
          radius={RADII.md}
        />
        <View style={styles.dimensionBadge}>
          <Text style={styles.dimensionBadgeText}>{dimensionsLabel}</Text>
        </View>
      </View>

      <View style={styles.detailBottom}>
        <Text style={styles.objectName} numberOfLines={1}>
          {object.name}
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.addButtonPressed,
          ]}
          onPress={onAdd}
        >
          <Ionicons name="add" size={16} color={COLORS.white} />
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function Inspector({
  object,
  onAdd,
  expanded,
}: {
  object: ObjectTemplate | null;
  onAdd: () => void;
  expanded: boolean;
}) {
  if (!object) {
    return (
      <View style={[styles.inspector, expanded && styles.inspectorExpanded]}>
        <View style={styles.inspectorEmptyIcon}>
          <Ionicons name="cube-outline" size={20} color={GLASS.textFaint} />
        </View>
        <Text style={styles.inspectorEmptyText}>Select a module to preview</Text>
      </View>
    );
  }

  if (expanded) {
    return (
      <View style={[styles.inspector, styles.inspectorExpanded]}>
        <Thumbnail
          uri={object.thumbnailUrl}
          width={140}
          height={140}
          icon="cube-outline"
          radius={RADII.md}
        />
        <Text style={styles.inspectorNameExpanded} numberOfLines={2}>
          {object.name}
        </Text>
        <Text style={styles.inspectorDimsExpanded}>
          {object.width} × {object.height} × {object.depth} m
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.inspectorAdd,
            styles.inspectorAddExpanded,
            pressed && styles.inspectorAddPressed,
          ]}
          onPress={onAdd}
        >
          <Ionicons name="add" size={16} color={COLORS.white} />
          <Text style={styles.inspectorAddText}>Add to scene</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.inspector}>
      <Thumbnail
        uri={object.thumbnailUrl}
        width={56}
        height={56}
        icon="cube-outline"
        radius={RADII.md}
      />
      <View style={styles.inspectorInfo}>
        <Text style={styles.inspectorName} numberOfLines={1}>
          {object.name}
        </Text>
        <Text style={styles.inspectorDims} numberOfLines={1}>
          {object.width} × {object.height} × {object.depth} m
        </Text>
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.inspectorAdd,
          pressed && styles.inspectorAddPressed,
        ]}
        onPress={onAdd}
      >
        <Ionicons name="add" size={16} color={COLORS.white} />
        <Text style={styles.inspectorAddText}>Add</Text>
      </Pressable>
    </View>
  );
}

export default function ModuleCatalogue({
  objectTemplates,
  categories,
  addObjectAction,
  onClose,
}: ModuleCatalogueProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [cardSize, setCardSize] = useState<"compact" | "large">("compact");
  const [selectedObject, setSelectedObject] = useState<ObjectTemplate | null>(null);
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

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return objectTemplates.filter(o => o.name.toLowerCase().includes(q));
  }, [searchQuery, objectTemplates]);

  const handleCategoryPress = (category: ObjectCategory) => {
    setSelectedObject(null);
    setCategoryStack(prev => [...prev, category.id]);
    setCurrentCategoryId(category.id);
  };

  const handleBack = () => {
    setSelectedObject(null);
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

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setSelectedObject(null);
  };

  const renderObject = (obj: ObjectTemplate) => {
    const isSelected = selectedObject?.id === obj.id;
    if (isExpanded && cardSize === "large") {
      return (
        <DetailCard
          key={obj.id}
          object={obj}
          selected={isSelected}
          onSelect={() => setSelectedObject(obj)}
          onAdd={() => addObjectAction(obj)}
        />
      );
    }
    return (
      <SquareCard
        key={obj.id}
        object={obj}
        selected={isSelected}
        onPress={() => setSelectedObject(obj)}
      />
    );
  };

  const items: React.ReactNode[] = [];
  if (searchResults !== null) {
    if (searchResults.length === 0) {
      items.push(
        <Text key="empty" style={styles.emptyText}>
          No modules match &quot;{searchQuery}&quot;.
        </Text>
      );
    } else {
      searchResults.forEach(obj => items.push(renderObject(obj)));
    }
  } else {
    const folders = currentCategoryId === null ? rootCategories : currentSubcategories;
    const objects =
      currentCategoryId === null ? uncategorizedObjects : objectsInCurrentCategory;

    folders.forEach(cat =>
      items.push(
        <SquareFolder
          key={cat.id}
          category={cat}
          onPress={() => handleCategoryPress(cat)}
        />
      )
    );
    objects.forEach(obj => items.push(renderObject(obj)));

    if (folders.length === 0 && objects.length === 0) {
      items.push(
        <Text key="empty" style={styles.emptyText}>
          {currentCategoryId === null
            ? "No furniture models available."
            : "No items in this category."}
        </Text>
      );
    }
  }

  return (
    <GlassSurface
      style={[
        styles.container,
        isExpanded ? styles.containerExpanded : styles.containerShort,
      ]}
    >
      <View style={styles.header}>
        {currentCategoryId !== null && (
          <Pressable
            style={({ pressed }) => [styles.iconButton, pressed && styles.itemPressed]}
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

        <View style={styles.searchBarWrap}>
          <Ionicons name="search" size={16} color={GLASS.textFaint} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={handleSearchChange}
            placeholder="Search modules..."
            placeholderTextColor={GLASS.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery !== "" && (
            <Pressable onPress={() => handleSearchChange("")} hitSlop={6}>
              <Ionicons name="close-circle" size={16} color={GLASS.textMuted} />
            </Pressable>
          )}
        </View>

        {isExpanded && (
          <View style={styles.densityToggle}>
            <Pressable
              style={[
                styles.densityButton,
                cardSize === "compact" && styles.densityButtonActive,
              ]}
              onPress={() => setCardSize("compact")}
            >
              <Ionicons
                name="grid-outline"
                size={14}
                color={cardSize === "compact" ? COLORS.primary : GLASS.textMuted}
              />
            </Pressable>
            <Pressable
              style={[
                styles.densityButton,
                cardSize === "large" && styles.densityButtonActive,
              ]}
              onPress={() => setCardSize("large")}
            >
              <Ionicons
                name="albums-outline"
                size={14}
                color={cardSize === "large" ? COLORS.primary : GLASS.textMuted}
              />
            </Pressable>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.iconButton, pressed && styles.itemPressed]}
          onPress={() => setIsExpanded(prev => !prev)}
        >
          <Ionicons
            name={isExpanded ? "contract-outline" : "expand-outline"}
            size={18}
            color={GLASS.text}
          />
        </Pressable>

        {onClose && (
          <Pressable
            style={({ pressed }) => [styles.iconButton, pressed && styles.itemPressed]}
            onPress={onClose}
          >
            <Ionicons name="close" size={18} color={GLASS.textMuted} />
          </Pressable>
        )}
      </View>

      <View style={styles.body}>
        {isExpanded ? (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.gridContent}>
            {items}
          </ScrollView>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.scroll}
            contentContainerStyle={styles.rowContent}
          >
            {items}
          </ScrollView>
        )}

        <Inspector
          object={selectedObject}
          onAdd={() => selectedObject && addObjectAction(selectedObject)}
          expanded={isExpanded}
        />
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADII.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
    overflow: "hidden",
  },
  containerShort: {
    width: "80%",
    maxWidth: 960,
    height: 168,
  },
  containerExpanded: {
    width: "86%",
    maxWidth: 1120,
    height: "86%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: GLASS.border,
    backgroundColor: GLASS.bgStrong,
    gap: 10,
  },
  headerTitleWrap: {
    minWidth: 120,
    maxWidth: 220,
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
  searchBarWrap: {
    flex: 1,
    maxWidth: 420,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GLASS.bgInput,
    paddingHorizontal: 12,
    height: 36,
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
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: RADII.md,
    backgroundColor: GLASS.bgInput,
    alignItems: "center",
    justifyContent: "center",
  },
  densityToggle: {
    flexDirection: "row",
    backgroundColor: GLASS.bgInput,
    borderRadius: RADII.md,
    padding: 2,
    gap: 2,
  },
  densityButton: {
    width: 30,
    height: 28,
    borderRadius: RADII.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  densityButtonActive: {
    backgroundColor: COLORS.primarySoft,
  },
  body: {
    flex: 1,
    flexDirection: "row",
  },
  scroll: {
    flex: 1,
  },
  rowContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  gridContent: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
  },
  square: {
    width: 64,
    height: 64,
    borderRadius: RADII.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GLASS.bgStrong,
    borderWidth: 1,
    borderColor: GLASS.border,
    overflow: "hidden",
  },
  squareSelected: {
    borderColor: COLORS.primary,
    borderWidth: 2,
    backgroundColor: COLORS.primarySoft,
  },
  squareFolder: {
    width: 78,
    gap: 2,
  },
  squareFolderText: {
    fontSize: 9,
    fontWeight: "600",
    color: GLASS.textMuted,
    maxWidth: 70,
    textAlign: "center",
  },
  squareCheck: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  inspector: {
    width: 248,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    borderLeftWidth: 1,
    borderLeftColor: GLASS.border,
    backgroundColor: GLASS.bgInput,
  },
  inspectorInfo: {
    flex: 1,
  },
  inspectorEmptyIcon: {
    width: 40,
    height: 40,
    borderRadius: RADII.md,
    backgroundColor: GLASS.bgStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  inspectorEmptyText: {
    flex: 1,
    fontSize: 11,
    color: GLASS.textMuted,
  },
  inspectorName: {
    fontSize: 13,
    fontWeight: "700",
    color: GLASS.text,
  },
  inspectorDims: {
    fontSize: 11,
    color: GLASS.textMuted,
    marginTop: 2,
  },
  inspectorExpanded: {
    width: 288,
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  inspectorNameExpanded: {
    fontSize: 15,
    fontWeight: "700",
    color: GLASS.text,
    textAlign: "center",
  },
  inspectorDimsExpanded: {
    fontSize: 12,
    color: GLASS.textMuted,
    textAlign: "center",
  },
  inspectorAdd: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADII.md,
  },
  inspectorAddPressed: {
    backgroundColor: COLORS.primaryPressed,
  },
  inspectorAddExpanded: {
    alignSelf: "stretch",
    justifyContent: "center",
    paddingVertical: 10,
  },
  inspectorAddText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },
  detailCard: {
    width: "31%",
    minWidth: 200,
    flexGrow: 1,
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
  detailCardSelected: {
    borderColor: COLORS.primary,
    borderWidth: 2,
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
  detailBottom: {
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
    opacity: 0.85,
  },
  emptyText: {
    textAlign: "center",
    color: GLASS.textMuted,
    fontSize: 13,
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
});
