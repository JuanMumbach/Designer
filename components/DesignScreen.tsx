import Design3dView from "@/components/DesignScreen/Design3dViewer";
import View3dOverlay from "@/components/DesignScreen/View3dOverlay";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { FurnitureInstanceProps, FurnitureType, NewFurnitureInstance } from "./DesignScreen/3dView/DesignObjects";
import { Room3dProps } from "./DesignScreen/3dView/Room3d";
import { useFurnitureModels } from "../services/useFurnitureModels";


const initialRoom3d: Room3dProps = {
  width: 5,
  height: 3,
  depth: 4,
  leftWall: true,
  rightWall: true
};

export default function DesignScreen() {
  const { furnitureModels, categories, isLoading, error } = useFurnitureModels();
  const [room3d, setRoom3d] = useState<Room3dProps>(initialRoom3d);
  const [counterLineObjects, setCounterObjects] = useState<FurnitureInstanceProps[]>([]);
  const [cupboardLineObjects, setCupboardObjects] = useState<FurnitureInstanceProps[]>([]);
  const [movingObject, setMovingObject] = useState<FurnitureInstanceProps | undefined>(undefined);
  const [magnetEnabled, setMagnetEnabled] = useState<boolean>(false);
  const [isDraggingObject, setIsDraggingObject] = useState(false);

  useEffect(() => {
    if (furnitureModels.length === 0) return;

    const counterModels = furnitureModels.filter(m => m.type === FurnitureType.Counter);
    const cupboardModels = furnitureModels.filter(m => m.type === FurnitureType.Cupboard);

    const defaults: FurnitureInstanceProps[] = [];
    const cupboards: FurnitureInstanceProps[] = [];

    if (counterModels.length > 0) {
      const counter = counterModels[0];
      defaults.push(NewFurnitureInstance(counter, [0, 0, 0]));
      defaults.push(NewFurnitureInstance(counter, [1, 0, 0]));
      defaults.push(NewFurnitureInstance(counter, [1.6, 0, 0]));
      defaults.push(NewFurnitureInstance(counter, [2.2, 0, 0]));
    }

    if (cupboardModels.length > 0) {
      const cupboard = cupboardModels[0];
      const cupboard2 = cupboardModels.length > 1 ? cupboardModels[1] : cupboardModels[0];
      cupboards.push(NewFurnitureInstance(cupboard, [0, 1.6, 0]));
      cupboards.push(NewFurnitureInstance(cupboard2, [1.2, 1.6, 0]));
      cupboards.push(NewFurnitureInstance(cupboard, [1.8, 1.6, 0]));
      cupboards.push(NewFurnitureInstance(cupboard2, [2.4, 1.6, 0]));
      cupboards.push(NewFurnitureInstance(cupboard2, [3, 1.6, 0]));
    }

    setCounterObjects(defaults);
    setCupboardObjects(cupboards);
  }, [furnitureModels]);

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

  const handleObjectDeleted = (id: string) => {
    const isCounterObject = counterLineObjects.some(obj => obj.id === id);
    if (isCounterObject) {
      setCounterObjects(prev => prev.filter(obj => obj.id !== id));
    } else {
      setCupboardObjects(prev => prev.filter(obj => obj.id !== id));
    }
    if (movingObject?.id === id) {
      setMovingObject(undefined);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading furniture models...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Error loading furniture models: {error.message}</Text>
      </View>
    );
  }

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
        onObjectDeleted={handleObjectDeleted}
        movingObject={movingObject}
        setMovingObject={setMovingObject}
        magnetEnabled={magnetEnabled}
        onDragStateChange={setIsDraggingObject}
      />
      <View3dOverlay
        furnitureModels={furnitureModels}
        categories={categories}
        room3dProps={room3d}
        setRoom3d={setRoom3d}
        designObjects={ [...counterLineObjects, ...cupboardLineObjects] }
        onObjectAdded={handleObjectAdded}
        onObjectEdited={handleObjectEdited}
        onObjectDeleted={handleObjectDeleted}
        movingObject={movingObject}
        setMovingObject={setMovingObject}
        magnetEnabled={magnetEnabled}
        setMagnetEnabled={setMagnetEnabled}
      >
      </View3dOverlay>
    </View>
  );
}