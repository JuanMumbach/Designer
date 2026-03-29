import Design3dView, { defaultCounterObjects, defaultCupboardObjects } from "@/components/DesignScreen/Design3dViewer";
import View3dOverlay from "@/components/DesignScreen/View3dOverlay";
import { useState } from "react";
import { View } from "react-native";
import { FurnitureInstanceProps, FurnitureType, NewFurnitureInstance, furnitureModels } from "./DesignScreen/3dView/DesignObjects";
import { Room3dProps } from "./DesignScreen/3dView/Room3d";


const initialRoom3d: Room3dProps = {
  width: 5,
  height: 3,
  depth: 4,
  leftWall: true,
  rightWall: true
};


defaultCounterObjects.push(NewFurnitureInstance(furnitureModels[0], [0, 0, 0]));
defaultCounterObjects.push(NewFurnitureInstance(furnitureModels[0], [1, 0, 0]));
defaultCounterObjects.push(NewFurnitureInstance(furnitureModels[0], [1.6, 0, 0]));
defaultCounterObjects.push(NewFurnitureInstance(furnitureModels[0], [2.2, 0, 0]));
defaultCupboardObjects.push(NewFurnitureInstance(furnitureModels[3], [0, 1.6, 0]));
defaultCupboardObjects.push(NewFurnitureInstance(furnitureModels[2], [1.2, 1.6, 0]));
defaultCupboardObjects.push(NewFurnitureInstance(furnitureModels[3], [1.8, 1.6, 0]));
defaultCupboardObjects.push(NewFurnitureInstance(furnitureModels[2], [2.4, 1.6, 0]));
defaultCupboardObjects.push(NewFurnitureInstance(furnitureModels[2], [3, 1.6, 0]));

export default function DesignScreen() {
  const [room3d, setRoom3d] = useState<Room3dProps>(initialRoom3d);
  const [counterLineObjects, setCounterObjects] = useState<FurnitureInstanceProps[]>(defaultCounterObjects);
  const [cupboardLineObjects, setCupboardObjects] = useState<FurnitureInstanceProps[]>(defaultCupboardObjects);
  const [movingObject, setMovingObject] = useState<FurnitureInstanceProps | undefined>(undefined);
  const [magnetEnabled, setMagnetEnabled] = useState<boolean>(false);
  const [isDraggingObject, setIsDraggingObject] = useState(false);

  const handleObjectInteraction = (object: FurnitureInstanceProps) => {
    console.log("Interacted with object:", object.id);
    setMovingObject(object);
  };

  const handleObjectAdded = (newObject: FurnitureInstanceProps) => {
    if (newObject.type.type === FurnitureType.Counter) {
      setCounterObjects(prevObjects => [...prevObjects, newObject]);
    }

    if (newObject.type.type === FurnitureType.Cupboard) {
      setCupboardObjects(prevObjects => [...prevObjects, newObject]);
    }
  };


const handleObjectEdited = (id: string, updates: { name: string, position: [number, number, number], rotation?: number }) => {

    const updateObjects = (prevObjects: FurnitureInstanceProps[]) => {
      return prevObjects.map(obj => {
        if (obj.id === id) {
          return {
            ...obj,
            name: updates.name,
            position: updates.position,
            ...(updates.rotation !== undefined && { rotation: updates.rotation })
          };
        }
        return obj;
      });
    };

    const isCounterObject = counterLineObjects.some(obj => obj.id === id);

    if (isCounterObject) {
      setCounterObjects(updateObjects);
    } else {
      setCupboardObjects(updateObjects);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Design3dView
        {...{ room3d }}
        counterObjects={counterLineObjects}
        cupboardObjects={cupboardLineObjects}
        onObjectInteraction={handleObjectInteraction}
        onObjectEdited={handleObjectEdited}
        movingObject={movingObject}
        setMovingObject={setMovingObject}
        magnetEnabled={magnetEnabled}
        onDragStateChange={setIsDraggingObject}
      />
      <View3dOverlay
        room3dProps={room3d}
        setRoom3d={setRoom3d}
        designObjects={ [...counterLineObjects, ...cupboardLineObjects] }
        onObjectAdded={handleObjectAdded}
        onObjectEdited={handleObjectEdited}
        movingObject={movingObject}
        setMovingObject={setMovingObject}
        magnetEnabled={magnetEnabled}
        setMagnetEnabled={setMagnetEnabled}
      >
      </View3dOverlay>
    </View>
  );
}