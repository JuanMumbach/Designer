import { GLASS, RADII } from "@/constants/theme";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, ScaledSize, StyleSheet, Text, View, ViewProps } from "react-native";
import { MaterialCategory, MaterialMeta, ObjectCategory, ObjectMaterialType } from "../../services/api";
import { DesignMaterialSlot } from "../../services/designMaterialDefaults";
import Button from "../Button";
import { AppliedMaterial, DesignObject, GlobalMaterials, MaterialOverrides, ObjectTemplate } from "./3dView/DesignObjects";
import { Room3dProps } from "./3dView/Room3d";
import AddFurnitureInstanceMenu from "./3dViewOverlay/AddFurnitureInstanceMenu";
import BottomSheet from "./3dViewOverlay/BottomSheet";
import CategoryBrowser from "./3dViewOverlay/CategoryBrowser";
import EditFurnitureInstanceMenu from "./3dViewOverlay/EditFurnitureInstanceMenu";
import FurnitureInstancesManager from "./3dViewOverlay/FurnitureInstancesManager";
import GlassSurface from "./3dViewOverlay/GlassSurface";
import GlobalMaterialSettings from "./3dViewOverlay/GlobalMaterialSettings";
import MaterialsWidget from "./3dViewOverlay/MaterialsWidget";
import RoomManager from "./3dViewOverlay/RoomManager";

const debugColors = false;

interface View3dOverlayProps {
  objectTemplates: ObjectTemplate[];
  categories: ObjectCategory[];
  designObjects: DesignObject[];
  room3dProps: Room3dProps;
  setRoom3d: React.Dispatch<React.SetStateAction<Room3dProps>>;
  onObjectAdded: (newObject: DesignObject) => void;
  onObjectEdited: (id: string, updates: { name: string, position: [number, number, number], rotation?: number, materialOverrides?: MaterialOverrides }) => void;
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
  const [windowDimensions, setWindowDimensions] = useState(Dimensions.get('window'));

  useEffect(() => {
    const onChange = ({ window }: { window: ScaledSize }) => {
      setWindowDimensions(window);
    };

    const subscription = Dimensions.addEventListener('change', onChange);

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
        <ActivityIndicator size="small" color="#93c5fd" />
      ) : (
        <Text style={styles.dropdownItemText}>{label}</Text>
      )}
      {chevronOpen !== undefined && (
        <Text style={styles.dropdownChevron}>{chevronOpen ? '▾' : '▸'}</Text>
      )}
    </Pressable>
  );
}

export default function View3dOverlay({ objectTemplates, categories, designObjects, room3dProps, setRoom3d , onObjectAdded, onObjectEdited, onObjectDeleted, movingObject, setMovingObject, magnetEnabled, forceEditObject, clearForceEdit, materials, materialCategories, globalMaterials, setGlobalMaterials, materialDataById, designSlots, slotTypesByModel, typeToDesignSlot, onSaveProject, onLoadProject, onSaveProjectCloud, onExport3d, isExporting} : View3dOverlayProps) {

  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isDesktop = width > 768;
  const [isObjectsManagerVisible, setIsObjectsManagerVisible] = useState(false);
  const [isListInstantiableObjectsVisible, setIsListInstantiableObjectsVisible] = useState(false);
  const [isRoomSettingsVisible, setIsRoomSettingsVisible] = useState(false);
  const [isAddObjectMenuVisible, setIsAddObjectMenuVisible] = useState(false);
  const [isGlobalMaterialsVisible, setIsGlobalMaterialsVisible] = useState(false);
  const [isOptionsMenuVisible, setIsOptionsMenuVisible] = useState(false);
  const [isExportMenuVisible, setIsExportMenuVisible] = useState(false);
  const [materialsInitialSlot, setMaterialsInitialSlot] = useState<string | null>(null);
  const [materialsPanelNonce, setMaterialsPanelNonce] = useState(0);

  const [newObjectTypeState, setNewObjectTypeState] = useState<ObjectTemplate | undefined>(undefined);

  useEffect(() => {
    if (objectTemplates.length > 0 && !newObjectTypeState) {
      setNewObjectTypeState(objectTemplates[0]);
    }
  }, [objectTemplates, newObjectTypeState]);

  const [isEditObjectMenuVisible, setIsEditObjectMenuVisible] = useState(false);
  const [selectedObjectState, setSelectedObjectState] = useState<DesignObject | undefined>(undefined);

  useEffect(() => {
    if (forceEditObject) {
      handleEditObject(forceEditObject);
      clearForceEdit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceEditObject]);

  useEffect(() => {
    if (selectedObjectState) {
      const updated = designObjects.find(o => o.id === selectedObjectState.id);
      if (updated && updated !== selectedObjectState) {
        setSelectedObjectState(updated);
      }
    }
  }, [designObjects, selectedObjectState]);

  const showAddObjectMenu = (objectType: ObjectTemplate) => {
    setIsEditObjectMenuVisible(false);
    setIsObjectsManagerVisible(false);
    setIsListInstantiableObjectsVisible(false);
    setIsGlobalMaterialsVisible(false);
    setNewObjectTypeState(objectType);
    setIsAddObjectMenuVisible(true);
  }

  const handleEditObject = (object: DesignObject) => {
    setIsAddObjectMenuVisible(false);
    setIsListInstantiableObjectsVisible(false);
    setIsRoomSettingsVisible(false);
    setIsObjectsManagerVisible(false);
    setIsGlobalMaterialsVisible(false);

    setSelectedObjectState(object);
    setIsEditObjectMenuVisible(true);
  };

  const closeEditMenu = () => {
      setIsEditObjectMenuVisible(false);
      setSelectedObjectState(undefined);
  };

  const handleObjectEditAndClose = (id: string, updates: { name: string, position: [number, number, number], rotation?: number, materialOverrides?: MaterialOverrides }) => {
      onObjectEdited(id, updates);
      closeEditMenu();
  };

  const handleObjectDeleteAndClose = (id: string) => {
      onObjectDeleted(id);
      closeEditMenu();
  };

  const handleObjectMoveAndClose = (newPosition: [number, number, number]) => {
    if (movingObject) {
      onObjectEdited(movingObject.id, { name: movingObject.name, position: newPosition });
    }
  };

  const toggleRoomSettings = () => {
    const newState = !isRoomSettingsVisible;
    setIsRoomSettingsVisible(newState);

    if (newState) {
      setIsListInstantiableObjectsVisible(false);
      setIsObjectsManagerVisible(false);
      setIsAddObjectMenuVisible(false);
      setIsEditObjectMenuVisible(false);
      setIsGlobalMaterialsVisible(false);
      setMaterialsInitialSlot(null);
    }
  };

  const handleMaterialsToggle = (slotKey?: string) => {
    const shouldOpen = slotKey !== undefined ? true : !isGlobalMaterialsVisible;
    setIsGlobalMaterialsVisible(shouldOpen);
    setMaterialsInitialSlot(shouldOpen ? (slotKey ?? null) : null);
    setMaterialsPanelNonce(prev => prev + 1);

    if (shouldOpen) {
      setIsRoomSettingsVisible(false);
      setIsListInstantiableObjectsVisible(false);
      setIsObjectsManagerVisible(false);
      setIsAddObjectMenuVisible(false);
      setIsEditObjectMenuVisible(false);
    }
  };

  const toggleAddObjectList = () => {
    const newState = !isListInstantiableObjectsVisible;
    setIsListInstantiableObjectsVisible(newState);

    if (newState) {
      setIsRoomSettingsVisible(false);
      setIsObjectsManagerVisible(false);
      setIsAddObjectMenuVisible(false);
      setIsEditObjectMenuVisible(false);
      setIsGlobalMaterialsVisible(false);
      setMaterialsInitialSlot(null);
    }
  };

  const toggleObjectsManager = () => {
    const newState = !isObjectsManagerVisible;
    setIsObjectsManagerVisible(newState);

    if (newState) {
      setIsRoomSettingsVisible(false);
      setIsListInstantiableObjectsVisible(false);
      setIsAddObjectMenuVisible(false);
      setIsEditObjectMenuVisible(false);
      setIsGlobalMaterialsVisible(false);
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
    setMaterialsInitialSlot(null);
    setIsListInstantiableObjectsVisible(false);
    setIsAddObjectMenuVisible(false);
    closeEditMenu();
  };

  const sheetMaxHeight = Math.round(height * 0.75);
  const desktopPanelMaxHeight = Math.max(300, Math.round(height * 0.45));
  const widePanelStyle = [styles.widePanel, { maxHeight: desktopPanelMaxHeight }];
  const sheetPanelStyle = [styles.sheetPanel, { maxHeight: sheetMaxHeight - 56 }];

  const materialsPanel = (
    <GlobalMaterialSettings
      key={`${materialsInitialSlot ?? 'materials-list'}-${materialsPanelNonce}`}
      globalMaterials={globalMaterials}
      onGlobalMaterialsChange={setGlobalMaterials}
      materials={materials}
      materialCategories={materialCategories}
      designSlots={designSlots}
      onClose={() => { setIsGlobalMaterialsVisible(false); setMaterialsInitialSlot(null); }}
      containerStyle={styles.widgetPanel}
      initialEditingSlot={materialsInitialSlot}
    />
  );

  const mobilePanel = (
    (
      isObjectsManagerVisible && (
        <FurnitureInstancesManager furnitureInstances={designObjects} onFurnitureSelect={handleEditObject} onClose={() => setIsObjectsManagerVisible(false)} containerStyle={sheetPanelStyle}/>
      )
    ) ||
    (
      isRoomSettingsVisible && (
        <RoomManager room3dProps={room3dProps} setRoom3d={setRoom3d} onClose={() => setIsRoomSettingsVisible(false)} containerStyle={sheetPanelStyle}></RoomManager>
      )
    ) ||
    (
      isGlobalMaterialsVisible && (
        <GlobalMaterialSettings
          key={`${materialsInitialSlot ?? 'materials-list'}-${materialsPanelNonce}`}
          globalMaterials={globalMaterials}
          onGlobalMaterialsChange={setGlobalMaterials}
          materials={materials}
          materialCategories={materialCategories}
          designSlots={designSlots}
          onClose={() => { setIsGlobalMaterialsVisible(false); setMaterialsInitialSlot(null); }}
          containerStyle={sheetPanelStyle}
          initialEditingSlot={materialsInitialSlot}
        />
      )
    ) ||
    (
      isListInstantiableObjectsVisible && (
        <CategoryBrowser objectTemplates={objectTemplates} categories={categories} addObjectAction={showAddObjectMenu} containerStyle={sheetPanelStyle} />
      )
    ) ||
    (
      isAddObjectMenuVisible && newObjectTypeState && (<AddFurnitureInstanceMenu newObjectType={newObjectTypeState} onObjectAdded={onObjectAdded} closeMenu={() => setIsAddObjectMenuVisible(false)} containerStyle={sheetPanelStyle}/>)
    ) ||
    (
        isEditObjectMenuVisible && selectedObjectState && (
            <EditFurnitureInstanceMenu
                object={selectedObjectState}
                onEditComplete={handleObjectEditAndClose}
                onDelete={handleObjectDeleteAndClose}
                materials={materials}
                materialCategories={materialCategories}
                globalMaterials={globalMaterials}
                designSlots={designSlots}
                slotTypesByModel={slotTypesByModel}
                typeToDesignSlot={typeToDesignSlot}
                containerStyle={sheetPanelStyle}
            />
        )
    )
  );

  return (
    <View style={styles.overlay}>
      {/*---------------------------------Menu lateral (Solo desktop)-------------------------------------*/}
      {isDesktop &&
        (
          <View style={[styles.column, styles.columnLeft, { backgroundColor: debugColors ? 'rgba(255, 0, 0, 0.25)' : 'transparent' }]}>
            {isRoomSettingsVisible && (
              <RoomManager room3dProps={room3dProps} setRoom3d={setRoom3d} onClose={() => setIsRoomSettingsVisible(false)}></RoomManager>
            )}
            <Button label="Edit Room" variant="glass" onPress={() => toggleRoomSettings()} />
          </View>
        )}

      {isOptionsMenuVisible && (
        <Pressable style={styles.menuBackdrop} onPress={closeOptionsMenu} />
      )}
      <View style={[styles.optionsContainer, styles.optionsContainerLeft]}>
        <ToolbarButton label="Options" onPress={toggleOptionsMenu} />
        {isOptionsMenuVisible && (
          <GlassSurface style={styles.dropdownPanel}>
            <DropdownItem label="Save project" onPress={() => { closeOptionsMenu(); onSaveProjectCloud(); }} />
            <DropdownItem label="Load project" onPress={() => { closeOptionsMenu(); router.push('/projectManager'); }} />
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
                  <DropdownItem label="3d model (.glb)" busy={isExporting} onPress={() => { closeOptionsMenu(); onExport3d(); }} />
                </View>
              )}
            </View>
            {isExportMenuVisible && !isDesktop && (
              <View style={styles.dropdownSubmenu}>
                <DropdownItem submenu label="Project file" onPress={() => { closeOptionsMenu(); onSaveProject(); }} />
                <DropdownItem submenu label="3d model (.glb)" busy={isExporting} onPress={() => { closeOptionsMenu(); onExport3d(); }} />
              </View>
            )}
          </GlassSurface>
        )}
      </View>

      {/*-------------------------------------Columna central------------------------------------------*/}
      <View style={[styles.middleColumn, { backgroundColor: debugColors ? 'rgba(4, 0, 255, 0.25)' : 'transparent' }]}>

        {/*Area de contenido para modales o espacio libre */}
        <View style={[styles.modalArea, { backgroundColor: debugColors ? 'rgba(255, 165, 0, 0.25)' : 'transparent' }]}>
          {/*------------------------Menus centrales version Desktop (panel ancho y corto)-----------------------------*/}
          {isDesktop &&
          (
            (isListInstantiableObjectsVisible && (<CategoryBrowser wide objectTemplates={objectTemplates} categories={categories} addObjectAction={showAddObjectMenu} containerStyle={widePanelStyle} />))
            ||
            (isAddObjectMenuVisible && newObjectTypeState && (<AddFurnitureInstanceMenu newObjectType={newObjectTypeState} onObjectAdded={onObjectAdded} closeMenu={() => setIsAddObjectMenuVisible(false)} containerStyle={widePanelStyle}/>))
            ||
            (isEditObjectMenuVisible && selectedObjectState && (
                <EditFurnitureInstanceMenu
                    object={selectedObjectState}
                    onEditComplete={handleObjectEditAndClose}
                    onDelete={handleObjectDeleteAndClose}
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

        {/*----------------------------------Botonera principal-----------------------------------------*/}
        {isDesktop ? (
          <View style={styles.mainControlsPlain}>
            <Button label="New object" variant="glass" onPress={() => toggleAddObjectList()} />
          </View>
        ) : (
          <GlassSurface style={styles.mainControlsGlass}>
            <Button label="Edit Room" variant="glass" onPress={() => toggleRoomSettings()} />
            <Button label="New object" variant="glass" onPress={() => toggleAddObjectList()} />
            <Button label="Edit Objects" variant="glass" onPress={() => toggleObjectsManager()} />
          </GlassSurface>
        )}

      </View>

      {/*---------------------------------Menu lateral (Solo desktop)-------------------------------------*/}
      {isDesktop &&
        (
          <View style={[styles.column, styles.columnRight, { backgroundColor: debugColors ? 'rgba(255, 0, 0, 0.25)' : 'transparent' }]}>
            {isObjectsManagerVisible && (
              <FurnitureInstancesManager furnitureInstances={designObjects} onFurnitureSelect={handleEditObject} onClose={() => setIsObjectsManagerVisible(false)}/>
            )}
            <Button label="Edit Objects" variant="glass" onPress={() => toggleObjectsManager()} />
          </View>
        )}

      {/*---------------------------------Materials widget (esquina superior derecha)-------------------------------------*/}
      <View style={styles.widgetAnchor} pointerEvents="box-none">
        <MaterialsWidget
          designSlots={designSlots}
          globalMaterials={globalMaterials}
          materialDataById={materialDataById}
          expanded={isGlobalMaterialsVisible}
          onToggle={handleMaterialsToggle}
          compact={!isDesktop}
        />
        {isDesktop && isGlobalMaterialsVisible && materialsPanel}
      </View>

      {/*---------------------------------Bottom sheet (Solo mobile)-------------------------------------*/}
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
    alignItems: 'center',
    pointerEvents: "box-none",
    paddingBottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  column: {
    width: "auto",
    justifyContent: 'flex-end',
    padding: 24,
    height: '100%',
    flex: .5,
    pointerEvents: "box-none"
  },
  columnLeft: {
    alignItems: 'flex-start',
  },
  columnRight: {
    alignItems: 'flex-end',
  },
  middleColumn: {
    width: "100%",
    height: '100%',
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    pointerEvents: "box-none"
  },
  modalArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingTop: 60,
    paddingBottom: 20,
    pointerEvents: "box-none",
  },
  widePanel: {
    width: '85%',
    maxWidth: 760,
  },
  sheetPanel: {
    width: '100%',
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  mainControlsPlain: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    pointerEvents: 'box-none',
    zIndex: 100,
  },
  mainControlsGlass: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADII.full,
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 100,
  },
  widgetAnchor: {
    position: 'absolute',
    top: 24,
    right: 24,
    alignItems: 'flex-end',
    zIndex: 130,
  },
  widgetPanel: {
    marginTop: 12,
  },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 90,
  },
  optionsContainer: {
    position: 'absolute',
    top: 24,
    zIndex: 100,
    flexDirection: 'column',
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  optionsContainerLeft: {
    left: 24,
    alignItems: 'flex-start',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontWeight: '600',
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
    position: 'relative',
  },
  dropdownSideSubmenu: {
    position: 'absolute',
    left: '100%',
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
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  toolbarButtonPressed: {
    backgroundColor: GLASS.bgPressed,
  },
  toolbarButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: GLASS.text,
    letterSpacing: 0.3,
  },
});
