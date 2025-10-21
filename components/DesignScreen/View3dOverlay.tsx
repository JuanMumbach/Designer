import { useEffect, useState } from "react";
import { Dimensions, ScaledSize, StyleSheet, View } from "react-native";
import Button from "../Button";
import { DesignObjectInstanceProps, DesignObjectProps, objectTypes } from "./3dView/DesignObjects";
import { Room3dProps } from "./3dView/Room3d";
import AddObjectMenu from "./3dViewOverlay/AddObjectMenu";
import ListInstantiableObjects from "./3dViewOverlay/ListInstantiableObjects";
import ObjectsManager from "./3dViewOverlay/ObjectsManager";
import RoomManager from "./3dViewOverlay/RoomManager";

const debugColors = false;

interface View3dOverlayProps {
  designObjects: DesignObjectInstanceProps[];
  // Añadir room3dProps (valores actuales) y setRoom3d (función de actualización)
  room3dProps: Room3dProps;
  setRoom3d: React.Dispatch<React.SetStateAction<Room3dProps>>;
  onObjectAdded: (newObject: DesignObjectInstanceProps) => void;
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



export default function View3dOverlay({ designObjects, room3dProps, setRoom3d , onObjectAdded } : View3dOverlayProps) {

  const { width } = useWindowDimensions();
  const [isObjectsManagerVisible, setIsObjectsManagerVisible] = useState(false);
  const [isListInstantiableObjectsVisible, setIsListInstantiableObjectsVisible] = useState(false);
  const [isRoomSettingsVisible, setIsRoomSettingsVisible] = useState(false);

  const [newObjectTypeState, setNewObjectTypeState] = useState(objectTypes[0]);
  const showAddObjectMenu = (objectType: DesignObjectProps) => {
    // 2. Set the selected object type
    setNewObjectTypeState(objectType); 
    
    // 3. Manage menu visibility: Hide list and show add menu
    setIsObjectsManagerVisible(false);
    setIsListInstantiableObjectsVisible(false); // Hide the list
    setIsAddObjectMenuVisible(true); // Show the add menu
  }

  const [isAddObjectMenuVisible, setIsAddObjectMenuVisible] = useState(false);

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
                <ObjectsManager designObjects={designObjects} />
              )
            ) ||
            (
              isRoomSettingsVisible && (
                <RoomManager room3dProps={room3dProps} setRoom3d={setRoom3d}></RoomManager>
              )
            ) ||
            (
              isListInstantiableObjectsVisible && (
                <ListInstantiableObjects designObjectTypes={objectTypes} addObjectAction={showAddObjectMenu} />
              )
            ) ||
            (
              isAddObjectMenuVisible && (<AddObjectMenu newObjectType={newObjectTypeState} onObjectAdded={onObjectAdded} closeMenu={() => setIsAddObjectMenuVisible(false)}/>)
            )
          )
        }

        {/*------------------------Renderiza menus centrales version Desktop-----------------------------*/}
        {((width > 768) &&
        (
          (isListInstantiableObjectsVisible && (<ListInstantiableObjects designObjectTypes={objectTypes} addObjectAction={showAddObjectMenu} />))
          ||
          (isAddObjectMenuVisible && (<AddObjectMenu newObjectType={newObjectTypeState} onObjectAdded={onObjectAdded} closeMenu={() => setIsAddObjectMenuVisible(false)}/>))
        )
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
              <ObjectsManager designObjects={designObjects} />
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