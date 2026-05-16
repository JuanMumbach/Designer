import { useEffect, useState } from "react";
import { Dimensions, ScaledSize, StyleSheet, View } from "react-native";
import Button from "../Button";
import { FurnitureInstanceProps, FurnitureProps } from "./3dView/DesignObjects";
import { Room3dProps } from "./3dView/Room3d";
import AddFurnitureInstanceMenu from "./3dViewOverlay/AddFurnitureInstanceMenu";
import EditFurnitureInstanceMenu from "./3dViewOverlay/EditFurnitureInstanceMenu";
import FurnitureInstancesManager from "./3dViewOverlay/FurnitureInstancesManager";
import ListFurnitureModels from "./3dViewOverlay/ListFurnitureModels";
import RoomManager from "./3dViewOverlay/RoomManager";

const debugColors = false;

interface View3dOverlayProps {
  furnitureModels: FurnitureProps[];
  designObjects: FurnitureInstanceProps[];
  // Añadir room3dProps (valores actuales) y setRoom3d (función de actualización)
  room3dProps: Room3dProps;
  setRoom3d: React.Dispatch<React.SetStateAction<Room3dProps>>;
  onObjectAdded: (newObject: FurnitureInstanceProps) => void;
  onObjectEdited: (id: string, updates: { name: string, position: [number, number, number], rotation?: number }) => void;
  onObjectDeleted: (id: string) => void;
  movingObject?: FurnitureInstanceProps;
  setMovingObject: (object?: FurnitureInstanceProps) => void;
  magnetEnabled: boolean;
  setMagnetEnabled: React.Dispatch<React.SetStateAction<boolean>>;
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



export default function View3dOverlay({ furnitureModels, designObjects, room3dProps, setRoom3d , onObjectAdded, onObjectEdited, onObjectDeleted, movingObject, setMovingObject, magnetEnabled, setMagnetEnabled} : View3dOverlayProps) {

  const { width } = useWindowDimensions();
  const [isObjectsManagerVisible, setIsObjectsManagerVisible] = useState(false);
  const [isListInstantiableObjectsVisible, setIsListInstantiableObjectsVisible] = useState(false);
  const [isRoomSettingsVisible, setIsRoomSettingsVisible] = useState(false);
  const [isAddObjectMenuVisible, setIsAddObjectMenuVisible] = useState(false);
  
  const [newObjectTypeState, setNewObjectTypeState] = useState<FurnitureProps | undefined>(undefined);

  useEffect(() => {
    if (furnitureModels.length > 0 && !newObjectTypeState) {
      setNewObjectTypeState(furnitureModels[0]);
    }
  }, [furnitureModels, newObjectTypeState]);
  
  const [isEditObjectMenuVisible, setIsEditObjectMenuVisible] = useState(false);
  const [selectedObjectState, setSelectedObjectState] = useState<FurnitureInstanceProps | undefined>(undefined);

  const showAddObjectMenu = (objectType: FurnitureProps) => {
    setIsEditObjectMenuVisible(false); 
    setIsObjectsManagerVisible(false);
    setIsListInstantiableObjectsVisible(false); 
    setNewObjectTypeState(objectType); 
    setIsAddObjectMenuVisible(true); 
  }
  
  const handleEditObject = (object: FurnitureInstanceProps) => {
    setIsAddObjectMenuVisible(false);
    setIsListInstantiableObjectsVisible(false);
    setIsRoomSettingsVisible(false);
    setIsObjectsManagerVisible(false); // Ocultar el ObjectsManager al abrir el editor
    
    setSelectedObjectState(object);
    setIsEditObjectMenuVisible(true);
  };

  const closeEditMenu = () => {
      setIsEditObjectMenuVisible(false);
      setSelectedObjectState(undefined); // Limpiar el objeto seleccionado
  };

  const handleObjectEditAndClose = (id: string, updates: { name: string, position: [number, number, number] }) => {
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

  //wrappers functions for opening/closing menus
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
            <View style={[styles.topBar, { backgroundColor: debugColors ? 'rgba(255, 255, 0, 0.25)' : 'white' }]}>
              <Button label={magnetEnabled ? "Magnet ON" : "Magnet OFF"} onPress={() => setMagnetEnabled(prev => !prev)} />
            </View>
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
                  <ListFurnitureModels designObjectTypes={furnitureModels} addObjectAction={showAddObjectMenu} />
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
                      />
                  )
              )
            )
          }

          {/*------------------------Renderiza menus centrales version Desktop-----------------------------*/}
          {((width > 768) &&
          (
            (isListInstantiableObjectsVisible && (<ListFurnitureModels designObjectTypes={furnitureModels} addObjectAction={showAddObjectMenu} />))
            ||
            (isAddObjectMenuVisible && newObjectTypeState && (<AddFurnitureInstanceMenu newObjectType={newObjectTypeState} onObjectAdded={onObjectAdded} closeMenu={() => setIsAddObjectMenuVisible(false)}/>))
          ) ||
          (
              isEditObjectMenuVisible && selectedObjectState && (
                  <EditFurnitureInstanceMenu 
                      object={selectedObjectState} 
                      onEditComplete={handleObjectEditAndClose}
                      onDelete={handleObjectDeleteAndClose}
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

        {/* Magnet toggle (mobile: top-left of middle column) */}
        {(width <= 768) &&
          <View style={[styles.topBar, { backgroundColor: debugColors ? 'rgba(255, 255, 0, 0.25)' : 'white' }]}>
            <Button label={magnetEnabled ? "Magnet ON" : "Magnet OFF"} onPress={() => setMagnetEnabled(prev => !prev)} />
          </View>
        }
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
  topBar: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
    zIndex: 100,
  },
});