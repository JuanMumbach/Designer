import { COLORS, GLASS, RADII } from "@/constants/theme";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, ScaledSize, StyleSheet, Text, View, ViewProps } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { MaterialCategory, MaterialMeta, ObjectCategory, ObjectMaterialType } from "../../services/api";
import { DesignMaterialSlot } from "../../services/designMaterialDefaults";
import { AppliedMaterial, createDesignObject, DesignObject, getInitialPosition, GlobalMaterials, MaterialOverrides, ObjectTemplate } from "./3dView/DesignObjects";
import { Room3dProps } from "./3dView/Room3d";
import BottomSheet from "./3dViewOverlay/BottomSheet";
import CategoryBrowser from "./3dViewOverlay/CategoryBrowser";
import EditFurnitureInstanceMenu from "./3dViewOverlay/EditFurnitureInstanceMenu";
import FurnitureInstancesManager from "./3dViewOverlay/FurnitureInstancesManager";
import GlassSurface from "./3dViewOverlay/GlassSurface";
import MaterialPicker from "./3dViewOverlay/MaterialPicker";
import MaterialsWidget from "./3dViewOverlay/MaterialsWidget";
import RoomManager from "./3dViewOverlay/RoomManager";

interface View3dOverlayProps {
  objectTemplates: ObjectTemplate[];
  categories: ObjectCategory[];
  designObjects: DesignObject[];
  room3dProps: Room3dProps;
  setRoom3d: React.Dispatch<React.SetStateAction<Room3dProps>>;
  onObjectAdded: (newObject: DesignObject) => void;
  onObjectEdited: (id: string, updates: { name: string; position: [number, number, number]; rotation?: number; materialOverrides?: MaterialOverrides }) => void;
  onObjectDeleted: (id: string) => void;
  movingObject?: DesignObject;
  setMovingObject: (object?: DesignObject) => void;
  magnetEnabled: boolean;
  forceEditObject?: DesignObject;
  clearForceEdit: () => void;
  materials: MaterialMeta[];
  materialCategories: MaterialCategory[];
  globalMaterials: GlobalMaterials;
  setGlobalMaterials: React.Dispatch<React.SetStateAction<GlobalMaterials>>;
  materialDataById: Record<string, AppliedMaterial>;
  designSlots: DesignMaterialSlot[];
  slotTypesByModel: Record<string, ObjectMaterialType[]>;
  typeToDesignSlot: Record<string, string>;
  onSaveProject: () => void;
  onLoadProject: () => void;
  onSaveProjectCloud: () => void;
  onExport3d: () => void;
  isExporting: boolean;
}

function useWindowDimensions() {
  const [windowDimensions, setWindowDimensions] = useState(Dimensions.get("window"));

  useEffect(() => {
    const onChange = ({ window }: { window: ScaledSize }) => {
      setWindowDimensions(window);
    };

    const subscription = Dimensions.addEventListener("change", onChange);

    return () => {
      subscription.remove();
    };
  }, []);

  return windowDimensions;
}

function ToolbarButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <GlassSurface style={styles.toolbarButton}>
      <Pressable
        style={({ pressed }) => [styles.toolbarButtonInner, pressed && styles.toolbarButtonPressed]}
        onPress={onPress}
      >
        <Ionicons name="menu-outline" size={15} color={GLASS.text} style={styles.toolbarIcon} />
        <Text style={styles.toolbarButtonText}>{label}</Text>
      </Pressable>
    </GlassSurface>
  );
}

function DropdownItem({
  label,
  onPress,
  busy,
  chevronOpen,
  submenu,
}: {
  label: string;
  onPress?: () => void;
  busy?: boolean;
  chevronOpen?: boolean;
  submenu?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.dropdownItem,
        submenu && styles.dropdownSubmenuItem,
        pressed && !busy && styles.dropdownItemPressed,
      ]}
      onPress={onPress}
      disabled={busy}
    >
      {busy ? (
        <ActivityIndicator size="small" color={COLORS.primary} />
      ) : (
        <Text style={styles.dropdownItemText}>{label}</Text>
      )}
      {chevronOpen !== undefined && (
        <Text style={styles.dropdownChevron}>{chevronOpen ? "▾" : "▸"}</Text>
      )}
    </Pressable>
  );
}

export default function View3dOverlay({
  objectTemplates,
  categories,
  designObjects,
  room3dProps,
  setRoom3d,
  onObjectAdded,
  onObjectEdited,
  onObjectDeleted,
  movingObject,
  forceEditObject,
  clearForceEdit,
  materials,
  materialCategories,
  globalMaterials,
  setGlobalMaterials,
  materialDataById,
  designSlots,
  slotTypesByModel,
  typeToDesignSlot,
  onSaveProject,
  onLoadProject,
  onSaveProjectCloud,
  onExport3d,
  isExporting,
}: View3dOverlayProps) {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isDesktop = width > 768;
  const [isObjectsManagerVisible, setIsObjectsManagerVisible] = useState(false);
  const [isListInstantiableObjectsVisible, setIsListInstantiableObjectsVisible] = useState(false);
  const [isRoomSettingsVisible, setIsRoomSettingsVisible] = useState(false);
  const [isGlobalMaterialsVisible, setIsGlobalMaterialsVisible] = useState(false);
  const [isMaterialsPreviewsVisible, setIsMaterialsPreviewsVisible] = useState(false);
  const [isOptionsMenuVisible, setIsOptionsMenuVisible] = useState(false);
  const [isExportMenuVisible, setIsExportMenuVisible] = useState(false);
  const [materialsInitialSlot, setMaterialsInitialSlot] = useState<string | null>(null);
  const [activeMaterialCardId, setActiveMaterialCardId] = useState<string | null>(null);

  const [isEditObjectMenuVisible, setIsEditObjectMenuVisible] = useState(false);
  const [selectedObjectState, setSelectedObjectState] = useState<DesignObject | undefined>(undefined);

  useEffect(() => {
    if (forceEditObject) {
      handleEditObject(forceEditObject);
      clearForceEdit();
    }
  }, [forceEditObject]);

  useEffect(() => {
    if (selectedObjectState) {
      const updated = designObjects.find(o => o.id === selectedObjectState.id);
      if (updated && updated !== selectedObjectState) {
        setSelectedObjectState(updated);
      }
    }
  }, [designObjects, selectedObjectState]);

  const handleAddObject = (objectType: ObjectTemplate) => {
    setIsEditObjectMenuVisible(false);
    setIsObjectsManagerVisible(false);
    setIsListInstantiableObjectsVisible(false);
    setIsGlobalMaterialsVisible(false);
    setIsMaterialsPreviewsVisible(false);
    onObjectAdded(createDesignObject(objectType, getInitialPosition(objectType)));
  };

  const handleEditObject = (object: DesignObject) => {
    setIsListInstantiableObjectsVisible(false);
    setIsRoomSettingsVisible(false);
    setIsObjectsManagerVisible(false);
    setIsGlobalMaterialsVisible(false);
    setIsMaterialsPreviewsVisible(false);

    setSelectedObjectState(object);
    setIsEditObjectMenuVisible(true);
  };

  const closeEditMenu = () => {
    setIsEditObjectMenuVisible(false);
    setSelectedObjectState(undefined);
  };

  const handleObjectEditAndClose = (
    id: string,
    updates: { name: string; position: [number, number, number]; rotation?: number; materialOverrides?: MaterialOverrides }
  ) => {
    onObjectEdited(id, updates);
    closeEditMenu();
  };

  const handleObjectDeleteAndClose = (id: string) => {
    onObjectDeleted(id);
    closeEditMenu();
  };

  const toggleRoomSettings = () => {
    const newState = !isRoomSettingsVisible;
    setIsRoomSettingsVisible(newState);

    if (newState) {
      setIsListInstantiableObjectsVisible(false);
      setIsObjectsManagerVisible(false);
      setIsEditObjectMenuVisible(false);
      setIsGlobalMaterialsVisible(false);
      setIsMaterialsPreviewsVisible(false);
      setMaterialsInitialSlot(null);
    }
  };

  const closePanelsForMaterials = () => {
    setIsRoomSettingsVisible(false);
    setIsListInstantiableObjectsVisible(false);
    setIsObjectsManagerVisible(false);
    setIsEditObjectMenuVisible(false);
  };

  const toggleMaterialsPreviews = () => {
    const shouldOpen = !isMaterialsPreviewsVisible;
    setIsMaterialsPreviewsVisible(shouldOpen);

    if (shouldOpen) {
      setIsGlobalMaterialsVisible(false);
      setMaterialsInitialSlot(null);
      closePanelsForMaterials();
    }
  };

  const openMaterialsPanel = (slotKey?: string) => {
    setIsMaterialsPreviewsVisible(false);
    setIsGlobalMaterialsVisible(true);
    setMaterialsInitialSlot(slotKey ?? null);
    setActiveMaterialCardId(null);
    closePanelsForMaterials();
  };

  const closeMaterialsPanel = () => {
    setIsGlobalMaterialsVisible(false);
    setMaterialsInitialSlot(null);
  };

  const handleMaterialSelect = async (materialMeta: MaterialMeta) => {
    const slot = materialsInitialSlot;
    if (!slot) return;
    setGlobalMaterials(prev => ({ ...prev, [slot]: materialMeta.id }));
    closeMaterialsPanel();
  };

  const handleMaterialReset = (slotKey: string) => {
    setGlobalMaterials(prev => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
    setActiveMaterialCardId(null);
  };

  const toggleAddObjectList = () => {
    const newState = !isListInstantiableObjectsVisible;
    setIsListInstantiableObjectsVisible(newState);

    if (newState) {
      setIsRoomSettingsVisible(false);
      setIsObjectsManagerVisible(false);
      setIsEditObjectMenuVisible(false);
      setIsGlobalMaterialsVisible(false);
      setIsMaterialsPreviewsVisible(false);
      setMaterialsInitialSlot(null);
    }
  };

  const toggleObjectsManager = () => {
    const newState = !isObjectsManagerVisible;
    setIsObjectsManagerVisible(newState);

    if (newState) {
      setIsRoomSettingsVisible(false);
      setIsListInstantiableObjectsVisible(false);
      setIsEditObjectMenuVisible(false);
      setIsGlobalMaterialsVisible(false);
      setIsMaterialsPreviewsVisible(false);
      setMaterialsInitialSlot(null);
    }
  };

  const toggleOptionsMenu = () => {
    const newState = !isOptionsMenuVisible;
    setIsOptionsMenuVisible(newState);
    if (!newState) setIsExportMenuVisible(false);
  };

  const toggleExportMenu = () => {
    setIsExportMenuVisible(prev => !prev);
  };

  const exportHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (exportHoverTimer.current) clearTimeout(exportHoverTimer.current);
    };
  }, []);

  const handleExportHoverIn = () => {
    if (exportHoverTimer.current) {
      clearTimeout(exportHoverTimer.current);
      exportHoverTimer.current = null;
    }
    setIsExportMenuVisible(true);
  };

  const handleExportHoverOut = () => {
    if (exportHoverTimer.current) clearTimeout(exportHoverTimer.current);
    exportHoverTimer.current = setTimeout(() => {
      exportHoverTimer.current = null;
      setIsExportMenuVisible(false);
    }, 200);
  };

  const closeOptionsMenu = () => {
    setIsOptionsMenuVisible(false);
    setIsExportMenuVisible(false);
  };

  const closeMobileSheet = () => {
    setIsObjectsManagerVisible(false);
    setIsRoomSettingsVisible(false);
    setIsGlobalMaterialsVisible(false);
    setIsMaterialsPreviewsVisible(false);
    setMaterialsInitialSlot(null);
    setIsListInstantiableObjectsVisible(false);
    closeEditMenu();
  };

  const sheetMaxHeight = Math.round(height * 0.75);
  const desktopPanelMaxHeight = Math.max(300, Math.round(height * 0.55));
  const widePanelStyle = [styles.widePanel, { maxHeight: desktopPanelMaxHeight }];
  const sheetPanelStyle = [styles.sheetPanel, { maxHeight: sheetMaxHeight - 56 }];

  const materialsPanel = (
    <MaterialPicker
      key={materialsInitialSlot ?? "material-picker"}
      materials={materials}
      categories={materialCategories}
      onSelect={handleMaterialSelect}
      onClose={closeMaterialsPanel}
      containerStyle={styles.widgetPanel}
    />
  );

  const mobilePanel =
    (isObjectsManagerVisible && (
      <FurnitureInstancesManager
        furnitureInstances={designObjects}
        onFurnitureSelect={handleEditObject}
        onClose={() => setIsObjectsManagerVisible(false)}
        containerStyle={sheetPanelStyle}
      />
    )) ||
    (isRoomSettingsVisible && (
      <RoomManager
        room3dProps={room3dProps}
        setRoom3d={setRoom3d}
        onClose={() => setIsRoomSettingsVisible(false)}
        containerStyle={sheetPanelStyle}
      />
    )) ||
    (isGlobalMaterialsVisible && (
      <MaterialPicker
        key={materialsInitialSlot ?? "material-picker"}
        materials={materials}
        categories={materialCategories}
        onSelect={handleMaterialSelect}
        onClose={closeMaterialsPanel}
        containerStyle={sheetPanelStyle}
      />
    )) ||
    (isListInstantiableObjectsVisible && (
      <CategoryBrowser
        objectTemplates={objectTemplates}
        categories={categories}
        addObjectAction={handleAddObject}
        onClose={() => setIsListInstantiableObjectsVisible(false)}
        containerStyle={sheetPanelStyle}
      />
    )) ||
    (isEditObjectMenuVisible && selectedObjectState && (
      <EditFurnitureInstanceMenu
        object={selectedObjectState}
        onEditComplete={handleObjectEditAndClose}
        onDelete={handleObjectDeleteAndClose}
        onClose={closeEditMenu}
        materials={materials}
        materialCategories={materialCategories}
        globalMaterials={globalMaterials}
        designSlots={designSlots}
        slotTypesByModel={slotTypesByModel}
        typeToDesignSlot={typeToDesignSlot}
        containerStyle={sheetPanelStyle}
      />
    ));

  return (
    <View style={styles.overlay}>
      {isOptionsMenuVisible && (
        <Pressable style={styles.menuBackdrop} onPress={closeOptionsMenu} />
      )}
      <View style={[styles.optionsContainer, styles.optionsContainerLeft]}>
        <ToolbarButton label="Options" onPress={toggleOptionsMenu} />
        {isOptionsMenuVisible && (
          <GlassSurface style={styles.dropdownPanel}>
            <DropdownItem label="Save project" onPress={() => { closeOptionsMenu(); onSaveProjectCloud(); }} />
            <DropdownItem label="Load project" onPress={() => { closeOptionsMenu(); router.push("/projectManager"); }} />
            <View style={styles.dropdownDivider} />
            <DropdownItem label="Import from file" onPress={() => { closeOptionsMenu(); onLoadProject(); }} />
            <View
              style={styles.dropdownExportItem}
              {...({ onMouseEnter: handleExportHoverIn, onMouseLeave: handleExportHoverOut } as unknown as ViewProps)}
            >
              <DropdownItem label="Export" chevronOpen={isExportMenuVisible} onPress={toggleExportMenu} />
              {isExportMenuVisible && isDesktop && (
                <View style={styles.dropdownSideSubmenu}>
                  <DropdownItem label="Project file" onPress={() => { closeOptionsMenu(); onSaveProject(); }} />
                  <DropdownItem label="3D model (.glb)" busy={isExporting} onPress={() => { closeOptionsMenu(); onExport3d(); }} />
                </View>
              )}
            </View>
            {isExportMenuVisible && !isDesktop && (
              <View style={styles.dropdownSubmenu}>
                <DropdownItem submenu label="Project file" onPress={() => { closeOptionsMenu(); onSaveProject(); }} />
                <DropdownItem submenu label="3D model (.glb)" busy={isExporting} onPress={() => { closeOptionsMenu(); onExport3d(); }} />
              </View>
            )}
          </GlassSurface>
        )}
      </View>

      <View style={styles.centerContainer}>
        <View style={styles.modalArea}>
          {isDesktop && (
            (isListInstantiableObjectsVisible && (
              <CategoryBrowser
                wide
                objectTemplates={objectTemplates}
                categories={categories}
                addObjectAction={handleAddObject}
                onClose={() => setIsListInstantiableObjectsVisible(false)}
                containerStyle={widePanelStyle}
              />
            )) ||
            (isRoomSettingsVisible && (
              <RoomManager
                room3dProps={room3dProps}
                setRoom3d={setRoom3d}
                onClose={() => setIsRoomSettingsVisible(false)}
              />
            )) ||
            (isObjectsManagerVisible && (
              <FurnitureInstancesManager
                furnitureInstances={designObjects}
                onFurnitureSelect={handleEditObject}
                onClose={() => setIsObjectsManagerVisible(false)}
              />
            )) ||
            (isEditObjectMenuVisible && selectedObjectState && (
              <EditFurnitureInstanceMenu
                object={selectedObjectState}
                onEditComplete={handleObjectEditAndClose}
                onDelete={handleObjectDeleteAndClose}
                onClose={closeEditMenu}
                materials={materials}
                materialCategories={materialCategories}
                globalMaterials={globalMaterials}
                designSlots={designSlots}
                slotTypesByModel={slotTypesByModel}
                typeToDesignSlot={typeToDesignSlot}
                containerStyle={widePanelStyle}
              />
            ))
          )}
        </View>

        <View style={styles.dockWrap} pointerEvents="box-none">
          <GlassSurface style={styles.dockSurface}>
            <Pressable
              style={({ pressed }) => [
                styles.dockPrimaryAction,
                isListInstantiableObjectsVisible && styles.dockPrimaryActionActive,
                pressed && styles.dockButtonPressed,
              ]}
              onPress={toggleAddObjectList}
            >
              <Ionicons name="add" size={18} color={COLORS.white} />
              <Text style={styles.dockPrimaryText}>Add Module</Text>
            </Pressable>

            <View style={styles.dockDivider} />

            <Pressable
              style={({ pressed }) => [
                styles.dockAction,
                isRoomSettingsVisible && styles.dockActionActive,
                pressed && styles.dockButtonPressed,
              ]}
              onPress={toggleRoomSettings}
            >
              <Ionicons
                name="expand-outline"
                size={16}
                color={isRoomSettingsVisible ? COLORS.primary : GLASS.text}
              />
              <Text style={[styles.dockActionText, isRoomSettingsVisible && styles.dockActionTextActive]}>
                Room
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.dockAction,
                isObjectsManagerVisible && styles.dockActionActive,
                pressed && styles.dockButtonPressed,
              ]}
              onPress={toggleObjectsManager}
            >
              <Ionicons
                name="layers-outline"
                size={16}
                color={isObjectsManagerVisible ? COLORS.primary : GLASS.text}
              />
              <Text style={[styles.dockActionText, isObjectsManagerVisible && styles.dockActionTextActive]}>
                Objects
              </Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{designObjects.length}</Text>
              </View>
            </Pressable>
          </GlassSurface>
        </View>
      </View>

      {activeMaterialCardId && !isGlobalMaterialsVisible && (
        <Pressable style={styles.materialCardBackdrop} onPress={() => setActiveMaterialCardId(null)} />
      )}
      <View style={styles.widgetAnchor} pointerEvents="box-none">
        <MaterialsWidget
          designSlots={designSlots}
          globalMaterials={globalMaterials}
          materialDataById={materialDataById}
          materials={materials}
          expanded={isMaterialsPreviewsVisible}
          onToggleExpanded={toggleMaterialsPreviews}
          activeCardId={activeMaterialCardId}
          onCardActivate={setActiveMaterialCardId}
          onCardDismiss={() => setActiveMaterialCardId(null)}
          onRequestPicker={openMaterialsPanel}
          onResetSlot={handleMaterialReset}
          compact={!isDesktop}
        />
        {isDesktop && isGlobalMaterialsVisible && materialsPanel}
      </View>

      {!isDesktop && mobilePanel && (
        <BottomSheet onClose={closeMobileSheet} maxHeight={sheetMaxHeight}>
          {mobilePanel}
        </BottomSheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "box-none",
  },
  centerContainer: {
    width: "100%",
    height: "100%",
    flexDirection: "column",
    alignItems: "center",
    pointerEvents: "box-none",
  },
  modalArea: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingTop: 64,
    paddingBottom: 20,
    pointerEvents: "box-none",
  },
  widePanel: {
    width: "88%",
    maxWidth: 780,
  },
  sheetPanel: {
    width: "100%",
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    shadowOpacity: 0,
    elevation: 0,
  },
  dockWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    zIndex: 100,
  },
  dockSurface: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: RADII.full,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  dockPrimaryAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: RADII.full,
  },
  dockPrimaryActionActive: {
    backgroundColor: COLORS.primaryPressed,
  },
  dockPrimaryText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  dockDivider: {
    width: 1,
    height: 22,
    backgroundColor: GLASS.border,
    marginHorizontal: 4,
  },
  dockAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: RADII.full,
  },
  dockActionActive: {
    backgroundColor: GLASS.bgPressed,
  },
  dockButtonPressed: {
    opacity: 0.85,
  },
  dockActionText: {
    fontSize: 13,
    fontWeight: "600",
    color: GLASS.text,
  },
  dockActionTextActive: {
    color: COLORS.primary,
    fontWeight: "700",
  },
  countBadge: {
    backgroundColor: GLASS.bgInput,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADII.sm,
    borderWidth: 1,
    borderColor: GLASS.border,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: GLASS.textMuted,
  },
  widgetAnchor: {
    position: "absolute",
    top: 24,
    right: 24,
    alignItems: "flex-end",
    zIndex: 130,
  },
  materialCardBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 120,
  },
  widgetPanel: {
    marginTop: 12,
  },
  menuBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 90,
  },
  optionsContainer: {
    position: "absolute",
    top: 24,
    zIndex: 100,
    flexDirection: "column",
    alignItems: "center",
    pointerEvents: "box-none",
  },
  optionsContainerLeft: {
    left: 24,
    alignItems: "flex-start",
  },
  dropdownPanel: {
    marginTop: 8,
    minWidth: 220,
    borderRadius: RADII.lg,
    overflow: "visible",
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  dropdownItemPressed: {
    backgroundColor: GLASS.bgPressed,
  },
  dropdownSubmenuItem: {
    paddingLeft: 28,
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: "600",
    color: GLASS.text,
    letterSpacing: 0.3,
  },
  dropdownChevron: {
    fontSize: 12,
    color: GLASS.textMuted,
    marginLeft: 8,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: GLASS.border,
    marginVertical: 4,
  },
  dropdownSubmenu: {
    backgroundColor: GLASS.bgInput,
    borderTopWidth: 1,
    borderTopColor: GLASS.border,
    marginHorizontal: 8,
    marginBottom: 6,
    borderRadius: RADII.md,
    paddingVertical: 4,
  },
  dropdownExportItem: {
    position: "relative",
  },
  dropdownSideSubmenu: {
    position: "absolute",
    left: "100%",
    top: 0,
    marginLeft: 8,
    minWidth: 200,
    backgroundColor: GLASS.bg,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: GLASS.border,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  toolbarButton: {
    borderRadius: RADII.full,
  },
  toolbarButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  toolbarIcon: {
    marginRight: 2,
  },
  toolbarButtonPressed: {
    backgroundColor: GLASS.bgPressed,
  },
  toolbarButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: GLASS.text,
    letterSpacing: 0.3,
  },
});
