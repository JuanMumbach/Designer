import { COLORS, RADII } from "@/constants/theme";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, ScaledSize, StyleSheet, Text, View } from "react-native";
import { MaterialCategory, MaterialMeta, ObjectCategory, ObjectMaterialType } from "../../services/api";
import { DesignMaterialSlot } from "../../services/designMaterialDefaults";
import Button from "../Button";
import { DesignObject, GlobalMaterials, MaterialOverrides, ObjectTemplate } from "./3dView/DesignObjects";
import { Room3dProps } from "./3dView/Room3d";
import AddFurnitureInstanceMenu from "./3dViewOverlay/AddFurnitureInstanceMenu";
import CategoryBrowser from "./3dViewOverlay/CategoryBrowser";
import EditFurnitureInstanceMenu from "./3dViewOverlay/EditFurnitureInstanceMenu";
import FurnitureInstancesManager from "./3dViewOverlay/FurnitureInstancesManager";
import GlobalMaterialSettings from "./3dViewOverlay/GlobalMaterialSettings";
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
    <Pressable
      style={({ pressed }) => [styles.toolbarButton, pressed && styles.toolbarButtonPressed]}
      onPress={onPress}
    >
      <Text style={styles.toolbarButtonText}>{label}</Text>
    </Pressable>
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
        <Text style={styles.dropdownChevron}>{chevronOpen ? '▾' : '▸'}</Text>
      )}
    </Pressable>
  );
}

export default function View3dOverlay({ objectTemplates, categories, designObjects, room3dProps, setRoom3d , onObjectAdded, onObjectEdited, onObjectDeleted, movingObject, setMovingObject, magnetEnabled, forceEditObject, clearForceEdit, materials, materialCategories, globalMaterials, setGlobalMaterials, designSlots, slotTypesByModel, typeToDesignSlot, onSaveProject, onLoadProject, onSaveProjectCloud, onExport3d, isExporting} : View3dOverlayProps) {

  const router = useRouter();
  const { width } = useWindowDimensions();
  const [isObjectsManagerVisible, setIsObjectsManagerVisible] = useState(false);
  const [isListInstantiableObjectsVisible, setIsListInstantiableObjectsVisible] = useState(false);
  const [isRoomSettingsVisible, setIsRoomSettingsVisible] = useState(false);
  const [isAddObjectMenuVisible, setIsAddObjectMenuVisible] = useState(false);
  const [isGlobalMaterialsVisible, setIsGlobalMaterialsVisible] = useState(false);
  const [isOptionsMenuVisible, setIsOptionsMenuVisible] = useState(false);
  const [isExportMenuVisible, setIsExportMenuVisible] = useState(false);

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
    }
  };

  const toggleGlobalMaterials = () => {
    const newState = !isGlobalMaterialsVisible;
    setIsGlobalMaterialsVisible(newState);

    if (newState) {
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

  const closeOptionsMenu = () => {
    setIsOptionsMenuVisible(false);
    setIsExportMenuVisible(false);
  };

  return (
    <View style={styles.overlay}>
      {/*---------------------------------Menu lateral (Solo desktop)-------------------------------------*/}
      {(width > 768) &&
        (
          <View style={[styles.column, { backgroundColor: debugColors ? 'rgba(255, 0, 0, 0.25)' : 'transparent' }]}>
            {isRoomSettingsVisible && (
              <RoomManager room3dProps={room3dProps} setRoom3d={setRoom3d} onClose={() => setIsRoomSettingsVisible(false)}></RoomManager>
            )}
            {isGlobalMaterialsVisible && (
              <GlobalMaterialSettings
                globalMaterials={globalMaterials}
                onGlobalMaterialsChange={setGlobalMaterials}
                materials={materials}
                materialCategories={materialCategories}
                designSlots={designSlots}
                onClose={() => setIsGlobalMaterialsVisible(false)}
              />
            )}
            <Button label="Edit Room" onPress={() => toggleRoomSettings()} />
            <Button label="Default Materials" onPress={() => toggleGlobalMaterials()} />
          </View>
        )}

      {isOptionsMenuVisible && (
        <Pressable style={styles.menuBackdrop} onPress={closeOptionsMenu} />
      )}
      <View style={[styles.optionsContainer, width > 768 ? styles.optionsContainerLeft : styles.optionsContainerRight]}>
        <ToolbarButton label="Options" onPress={toggleOptionsMenu} />
        {isOptionsMenuVisible && (
          <View style={styles.dropdownPanel}>
            <DropdownItem label="Save project" onPress={() => { closeOptionsMenu(); onSaveProjectCloud(); }} />
            <DropdownItem label="Load project" onPress={() => { closeOptionsMenu(); router.push('/projectManager'); }} />
            <View style={styles.dropdownDivider} />
            <DropdownItem label="Import from file" onPress={() => { closeOptionsMenu(); onLoadProject(); }} />
            <View style={styles.dropdownExportItem}>
              <DropdownItem label="Export" chevronOpen={isExportMenuVisible} onPress={toggleExportMenu} />
              {isExportMenuVisible && width > 768 && (
                <View style={styles.dropdownSideSubmenu}>
                  <DropdownItem label="Project file" onPress={() => { closeOptionsMenu(); onSaveProject(); }} />
                  <DropdownItem label="3d model (.glb)" busy={isExporting} onPress={() => { closeOptionsMenu(); onExport3d(); }} />
                </View>
              )}
            </View>
            {isExportMenuVisible && width <= 768 && (
              <View style={styles.dropdownSubmenu}>
                <DropdownItem submenu label="Project file" onPress={() => { closeOptionsMenu(); onSaveProject(); }} />
                <DropdownItem submenu label="3d model (.glb)" busy={isExporting} onPress={() => { closeOptionsMenu(); onExport3d(); }} />
              </View>
            )}
          </View>
        )}
      </View>

      {/*-------------------------------------Columna central------------------------------------------*/}
      <View style={[styles.middleColumn, { backgroundColor: debugColors ? 'rgba(4, 0, 255, 0.25)' : 'transparent' }]}>

        {/*Area de contenido para modales o espacio libre */}
        <View style={[styles.modalArea, { backgroundColor: debugColors ? 'rgba(255, 165, 0, 0.25)' : 'transparent' }]}>
          {/*Renderizar menus laterales en el centro si es mobile*/}
          {(width <= 768) &&
            (
              (
                isObjectsManagerVisible && (
                  <FurnitureInstancesManager furnitureInstances={designObjects} onFurnitureSelect={handleEditObject} onClose={() => setIsObjectsManagerVisible(false)}/>
                )
              ) ||
              (
                isRoomSettingsVisible && (
                  <RoomManager room3dProps={room3dProps} setRoom3d={setRoom3d} onClose={() => setIsRoomSettingsVisible(false)}></RoomManager>
                )
              ) ||
              (
                isGlobalMaterialsVisible && (
                  <GlobalMaterialSettings
                    globalMaterials={globalMaterials}
                    onGlobalMaterialsChange={setGlobalMaterials}
                    materials={materials}
                    materialCategories={materialCategories}
                    designSlots={designSlots}
                    onClose={() => setIsGlobalMaterialsVisible(false)}
                  />
                )
              ) ||
              (
                isListInstantiableObjectsVisible && (
                  <CategoryBrowser objectTemplates={objectTemplates} categories={categories} addObjectAction={showAddObjectMenu} />
                )
              ) ||
              (
                isAddObjectMenuVisible && newObjectTypeState && (<AddFurnitureInstanceMenu newObjectType={newObjectTypeState} onObjectAdded={onObjectAdded} closeMenu={() => setIsAddObjectMenuVisible(false)}/>)
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
                      />
                  )
              )
            )
          }

          {/*------------------------Renderiza menus centrales version Desktop-----------------------------*/}
          {((width > 768) &&
          (
            (isListInstantiableObjectsVisible && (<CategoryBrowser objectTemplates={objectTemplates} categories={categories} addObjectAction={showAddObjectMenu} />))
            ||
            (isAddObjectMenuVisible && newObjectTypeState && (<AddFurnitureInstanceMenu newObjectType={newObjectTypeState} onObjectAdded={onObjectAdded} closeMenu={() => setIsAddObjectMenuVisible(false)}/>))
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
                  />
              )
            )
          )}
        </View>

        {/*----------------------------------Botonera principal-----------------------------------------*/}
        <View style={[styles.mainControls, { backgroundColor: debugColors ? 'rgba(51, 255, 0, 0.25)' : 'transparent' }]}>
          {(width <= 768) &&
            (<Button label="Edit Room" onPress={() => toggleRoomSettings()} />)
          }
          {(width <= 768) &&
            (<Button label="Materials" onPress={() => toggleGlobalMaterials()} />)
          }
          <Button label="New object" onPress={() => toggleAddObjectList()} />
          {(width <= 768) &&
            (<Button label="Edit Objects" onPress={() => toggleObjectsManager()} />)
          }
        </View>

      </View>

      {/*---------------------------------Menu lateral (Solo desktop)-------------------------------------*/}
      {(width > 768) &&
        (
          <View style={[styles.column, { backgroundColor: debugColors ? 'rgba(255, 0, 0, 0.25)' : 'transparent' }]}>
            {isObjectsManagerVisible && (
              <FurnitureInstancesManager furnitureInstances={designObjects} onFurnitureSelect={handleEditObject} onClose={() => setIsObjectsManagerVisible(false)}/>
            )}
            <Button label="Edit Objects" onPress={() => toggleObjectsManager()} />
          </View>
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
    padding: 10,
    height: '100%',
    flex: .5,
    pointerEvents: "box-none"
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
  mainControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: RADII.pill,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 100,
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
    top: 50,
    zIndex: 100,
    flexDirection: 'column',
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  optionsContainerLeft: {
    left: 20,
    alignItems: 'flex-start',
  },
  optionsContainerRight: {
    right: 20,
    alignItems: 'flex-end',
  },
  dropdownPanel: {
    marginTop: 8,
    minWidth: 220,
    backgroundColor: COLORS.bg,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
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
    backgroundColor: COLORS.surfaceAlt,
  },
  dropdownSubmenuItem: {
    paddingLeft: 28,
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textHeading,
    letterSpacing: 0.3,
  },
  dropdownChevron: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginLeft: 8,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  dropdownSubmenu: {
    backgroundColor: COLORS.bgAlt,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
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
    backgroundColor: COLORS.bg,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  toolbarButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: RADII.md,
    backgroundColor: COLORS.bgAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toolbarButtonPressed: {
    backgroundColor: COLORS.surfaceAlt,
  },
  toolbarButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textHeading,
    letterSpacing: 0.3,
  },
});
