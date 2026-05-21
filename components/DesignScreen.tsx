import Design3dView from "@/components/DesignScreen/Design3dViewer";
import View3dOverlay from "@/components/DesignScreen/View3dOverlay";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { DesignObject, createDesignObject } from "./DesignScreen/3dView/DesignObjects";
import { Room3dProps } from "./DesignScreen/3dView/Room3d";
import { useObjectTemplates } from "../services/useFurnitureModels";


const initialRoom3d: Room3dProps = {
  width: 5,
  height: 3,
  depth: 4,
  leftWall: true,
  rightWall: true
};

export default function DesignScreen() {
  const { objectTemplates, categories, isLoading, error } = useObjectTemplates();
  const [room3d, setRoom3d] = useState<Room3dProps>(initialRoom3d);
  const [designObjects, setDesignObjects] = useState<DesignObject[]>([]);
  const [movingObject, setMovingObject] = useState<DesignObject | undefined>(undefined);
  const [magnetEnabled, setMagnetEnabled] = useState<boolean>(false);
  const [isDraggingObject, setIsDraggingObject] = useState(false);
  const [forceEditObject, setForceEditObject] = useState<DesignObject | undefined>(undefined);

  useEffect(() => {
    if (objectTemplates.length === 0) return;

    const defaults: DesignObject[] = [];

    const counterModels = objectTemplates.filter(m => m.objectProperties?.movingBehaviour === 'counter');
    const cupboardModels = objectTemplates.filter(m => m.objectProperties?.movingBehaviour === 'cupboard');

    if (counterModels.length > 0) {
      const counter = counterModels[0];
      defaults.push(createDesignObject(counter, [0, 0, 0]));
      defaults.push(createDesignObject(counter, [1, 0, 0]));
      defaults.push(createDesignObject(counter, [1.6, 0, 0]));
      defaults.push(createDesignObject(counter, [2.2, 0, 0]));
    }

    if (cupboardModels.length > 0) {
      const cupboard = cupboardModels[0];
      const cupboard2 = cupboardModels.length > 1 ? cupboardModels[1] : cupboardModels[0];
      const y1 = cupboard.objectProperties?.height ?? 0;
      const y2 = cupboard2.objectProperties?.height ?? 0;
      defaults.push(createDesignObject(cupboard, [0, y1, 0]));
      defaults.push(createDesignObject(cupboard2, [1.2, y2, 0]));
      defaults.push(createDesignObject(cupboard, [1.8, y1, 0]));
      defaults.push(createDesignObject(cupboard2, [2.4, y2, 0]));
      defaults.push(createDesignObject(cupboard2, [3, y2, 0]));
    }

    setDesignObjects(defaults);
  }, [objectTemplates]);

  const handleObjectInteraction = (object: DesignObject) => {
    console.log("Interacted with object:", object.id);
    setMovingObject(object);
  };

  const handleEditObjectFrom3D = (object: DesignObject) => {
    setMovingObject(object);
    setForceEditObject(object);
  };

  const handleObjectAdded = (newObject: DesignObject) => {
    setDesignObjects(prev => [...prev, newObject]);
  };

  const handleObjectEdited = (id: string, updates: { name: string, position: [number, number, number], rotation?: number }) => {
    setDesignObjects(prev => prev.map(obj =>
      obj.id === id ? { ...obj, name: updates.name, position: updates.position, ...(updates.rotation !== undefined && { rotation: updates.rotation }) } : obj
    ));
  };

  const handleObjectDeleted = (id: string) => {
    setDesignObjects(prev => prev.filter(obj => obj.id !== id));
    if (movingObject?.id === id) setMovingObject(undefined);
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
        designObjects={designObjects}
        onObjectInteraction={handleObjectInteraction}
        onObjectEdited={handleObjectEdited}
        onObjectDeleted={handleObjectDeleted}
        onEditObject={handleEditObjectFrom3D}
        movingObject={movingObject}
        setMovingObject={setMovingObject}
        magnetEnabled={magnetEnabled}
        onDragStateChange={setIsDraggingObject}
      />
      <View3dOverlay
        objectTemplates={objectTemplates}
        categories={categories}
        room3dProps={room3d}
        setRoom3d={setRoom3d}
        designObjects={designObjects}
        onObjectAdded={handleObjectAdded}
        onObjectEdited={handleObjectEdited}
        onObjectDeleted={handleObjectDeleted}
        movingObject={movingObject}
        setMovingObject={setMovingObject}
        magnetEnabled={magnetEnabled}
        setMagnetEnabled={setMagnetEnabled}
        forceEditObject={forceEditObject}
        clearForceEdit={() => setForceEditObject(undefined)}
      >
      </View3dOverlay>
    </View>
  );
}
