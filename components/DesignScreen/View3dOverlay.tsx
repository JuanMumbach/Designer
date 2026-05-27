import { useEffect, useState } from "react";
import { Dimensions, ScaledSize, StyleSheet, View } from "react-native";
import Button from "../Button";
import { DesignObject, ObjectTemplate, TextureOverride } from "./3dView/DesignObjects";
import { Room3dProps } from "./3dView/Room3d";
import AddFurnitureInstanceMenu from "./3dViewOverlay/AddFurnitureInstanceMenu";
import CategoryBrowser from "./3dViewOverlay/CategoryBrowser";
import EditFurnitureInstanceMenu from "./3dViewOverlay/EditFurnitureInstanceMenu";
import FurnitureInstancesManager from "./3dViewOverlay/FurnitureInstancesManager";
import RoomManager from "./3dViewOverlay/RoomManager";
import { MaterialCategory, MaterialMeta, ObjectCategory } from "../../services/api";

const debugColors = false;

interface View3dOverlayProps {
  objectTemplates: ObjectTemplate[];
  categories: ObjectCategory[];
  designObjects: DesignObject[];
  room3dProps: Room3dProps;
  setRoom3d: React.Dispatch<React.SetStateAction<Room3dProps>>;
  onObjectAdded: (newObject: DesignObject) => void;
  onObjectEdited: (id: string, updates: { name: string, position: [number, number, number], rotation?: number, textureOverrides?: TextureOverride[] }) => void;
  onObjectDeleted: (id: string) => void;
  movingObject?: DesignObject;
  setMovingObject: (object?: DesignObject) => void;
  magnetEnabled: boolean;
  forceEditObject?: DesignObject;
  clearForceEdit: () => void;
  materials: MaterialMeta[];
  materialCategories: MaterialCategory[];
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



export default function View3dOverlay({ objectTemplates, categories, designObjects, room3dProps, setRoom3d , onObjectAdded, onObjectEdited, onObjectDeleted, movingObject, setMovingObject, magnetEnabled, forceEditObject, clearForceEdit, materials, materialCategories} : View3dOverlayProps) {

  const { width } = useWindowDimensions();
  const [isObjectsManagerVisible, setIsObjectsManagerVisible] = useState(false);
  const [isListInstantiableObjectsVisible, setIsListInstantiableObjectsVisible] = useState(false);
  const [isRoomSettingsVisible, setIsRoomSettingsVisible] = useState(false);
  const [isAddObjectMenuVisible, setIsAddObjectMenuVisible] = useState(false);

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
    setNewObjectTypeState(objectType);
    setIsAddObjectMenuVisible(true);
  }

  const handleEditObject = (object: DesignObject) => {
    setIsAddObjectMenuVisible(false);
    setIsListInstantiableObjectsVisible(false);
    setIsRoomSettingsVisible(false);
    setIsObjectsManagerVisible(false);

    setSelectedObjectState(object);
    setIsEditObjectMenuVisible(true);
  };

  const closeEditMenu = () => {
      setIsEditObjectMenuVisible(false);
      setSelectedObjectState(undefined);
  };

  const handleObjectEditAndClose = (id: string, updates: { name: string, position: [number, number, number], textureOverrides?: TextureOverride[] }) => {
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
    }
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
            <Button label="Edit Room" onPress={() => toggleRoomSettings()} />
          </View>
        )}

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
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 40,
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
    zIndex: 100,
  },
});
