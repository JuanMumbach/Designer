import { useEffect, useState } from "react";
import { Dimensions, ScaledSize, StyleSheet, View } from "react-native";
import Button from "../Button";
import { FurnitureInstanceProps, FurnitureProps, furnitureModels } from "./3dView/DesignObjects";
import { Room3dProps } from "./3dView/Room3d";
import AddFurnitureInstanceMenu from "./3dViewOverlay/AddFurnitureInstanceMenu";
import EditFurnitureInstanceMenu from "./3dViewOverlay/EditFurnitureInstanceMenu";
import FurnitureInstancesManager from "./3dViewOverlay/FurnitureInstancesManager";
import ListFurnitureModels from "./3dViewOverlay/ListFurnitureModels";
import MoveFurnitureInstanceMenu from "./3dViewOverlay/MoveFurnitureInstanceMenu";
import RoomManager from "./3dViewOverlay/RoomManager";

const debugColors = false;

interface View3dOverlayProps {
  designObjects: FurnitureInstanceProps[];
  // Añadir room3dProps (valores actuales) y setRoom3d (función de actualización)
  room3dProps: Room3dProps;
  setRoom3d: React.Dispatch<React.SetStateAction<Room3dProps>>;
  onObjectAdded: (newObject: FurnitureInstanceProps) => void;
  onObjectEdited: (id: string, updates: { name: string, position: [number, number, number] }) => void;
  movingObject?: FurnitureInstanceProps;
  setMovingObject: (object?: FurnitureInstanceProps) => void;
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



export default function View3dOverlay({ designObjects, room3dProps, setRoom3d , onObjectAdded, onObjectEdited, movingObject, setMovingObject} : View3dOverlayProps) {

  const { width } = useWindowDimensions();
  const [isObjectsManagerVisible, setIsObjectsManagerVisible] = useState(false);
  const [isListInstantiableObjectsVisible, setIsListInstantiableObjectsVisible] = useState(false);
  const [isRoomSettingsVisible, setIsRoomSettingsVisible] = useState(false);
  const [isAddObjectMenuVisible, setIsAddObjectMenuVisible] = useState(false);
  
  const [newObjectTypeState, setNewObjectTypeState] = useState(furnitureModels[0]);
  
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

  const handleObjectMoveAndClose = (newPosition: [number, number, number]) => {
    if (movingObject) {
      onObjectEdited(movingObject.id, { name: movingObject.name, position: newPosition });
    }
  };

  return (
    <View style={styles.overlay}>
      {/*---------------------------------Menu lateral (Solo desktop)-------------------------------------*/}
      {(width > 768) &&
        (
          <View style={[styles.column, { backgroundColor: debugColors ? 'rgba(255, 0, 0, 0.25)' : 'transparent' }]}>
            {isRoomSettingsVisible && (
              <RoomManager room3dProps={room3dProps} setRoom3d={setRoom3d}></RoomManager>
            )}
            <Button label="Edit Room" onPress={() => setIsRoomSettingsVisible(!isRoomSettingsVisible)} />
          </View>
        )}
      
      {/*-------------------------------------Columna central------------------------------------------*/}
      <View style={[styles.middleColumn, { backgroundColor: debugColors ? 'rgba(4, 0, 255, 0.25)' : 'transparent' }]}>
        
        {/*Renderizar menus laterales en el centro si es mobile*/}
        {(width <= 768) &&
          (
            (
              isObjectsManagerVisible && (
                <FurnitureInstancesManager furnitureInstances={designObjects} onFurnitureSelect={handleEditObject} />
              )
            ) ||
            (
              isRoomSettingsVisible && (
                <RoomManager room3dProps={room3dProps} setRoom3d={setRoom3d}></RoomManager>
              )
            ) ||
            (
              isListInstantiableObjectsVisible && (
                <ListFurnitureModels designObjectTypes={furnitureModels} addObjectAction={showAddObjectMenu} />
              )
            ) ||
            (
              isAddObjectMenuVisible && (<AddFurnitureInstanceMenu newObjectType={newObjectTypeState} onObjectAdded={onObjectAdded} closeMenu={() => setIsAddObjectMenuVisible(false)}/>)
            ) ||
            (
                isEditObjectMenuVisible && selectedObjectState && (
                    <EditFurnitureInstanceMenu 
                        object={selectedObjectState} 
                        onEditComplete={handleObjectEditAndClose} // Usa el wrapper que cierra el menú
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
          (isAddObjectMenuVisible && (<AddFurnitureInstanceMenu newObjectType={newObjectTypeState} onObjectAdded={onObjectAdded} closeMenu={() => setIsAddObjectMenuVisible(false)}/>))
        ) ||
        (
            isEditObjectMenuVisible && selectedObjectState && (
                <EditFurnitureInstanceMenu 
                    object={selectedObjectState} 
                    onEditComplete={handleObjectEditAndClose}
                />
            )
          )
        )}

        {movingObject && (
          <MoveFurnitureInstanceMenu
            selectedObject={movingObject}
            onMove={handleObjectMoveAndClose}
            onClose={() => setMovingObject(undefined)}
          />
        )}

        {/*----------------------------------Botonera principal-----------------------------------------*/}
        <View style={[styles.mainControls, { backgroundColor: debugColors ? 'rgba(51, 255, 0, 0.25)' : 'transparent' }]}>
          {(width <= 768) &&
            (<Button label="Edit Room" onPress={() => setIsRoomSettingsVisible(!isRoomSettingsVisible)} />)
          }
          <Button label="Add Object" onPress={() => setIsListInstantiableObjectsVisible(!isListInstantiableObjectsVisible)} />
          {(width <= 768) &&
            (<Button label="Edit Objects" onPress={() => setIsObjectsManagerVisible(!isObjectsManagerVisible)} />)
          }
        </View>
      </View>
      
      {/*---------------------------------Menu lateral (Solo desktop)-------------------------------------*/}
      {(width > 768) &&
        (
          <View style={[styles.column, { backgroundColor: debugColors ? 'rgba(255, 0, 0, 0.25)' : 'transparent' }]}>
            {isObjectsManagerVisible && (
              <FurnitureInstancesManager furnitureInstances={designObjects} onFurnitureSelect={handleEditObject}/>
            )}
            <Button label="Edit Objects" onPress={() => setIsObjectsManagerVisible(!isObjectsManagerVisible)} />
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
    width: "auto",
    justifyContent: 'flex-end',
    padding: 10,
    height: '100%',
    flex: 1,
    pointerEvents: "box-none"
  },
  mainControls: {
    height: "auto",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 30,
    pointerEvents: "box-none"
  }, 
});