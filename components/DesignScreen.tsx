import Design3dView from "@/components/DesignScreen/Design3dViewer";
import View3dOverlay from "@/components/DesignScreen/View3dOverlay";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { DesignObject, TextureOverride, createDesignObject } from "./DesignScreen/3dView/DesignObjects";
import { Room3dProps } from "./DesignScreen/3dView/Room3d";
import { useObjectTemplates } from "../services/useFurnitureModels";
import { useMaterials } from "../services/useMaterials";


const initialRoom3d: Room3dProps = {
  width: 5,
  height: 3,
  depth: 4,
  leftWall: true,
  rightWall: true
};

export default function DesignScreen() {
  const { objectTemplates, categories: objectCategories, isLoading: modelsLoading, error: modelsError } = useObjectTemplates();
  const { materials, categories: materialCategories, isLoading: materialsLoading } = useMaterials();
  const [room3d, setRoom3d] = useState<Room3dProps>(initialRoom3d);
  const [designObjects, setDesignObjects] = useState<DesignObject[]>([]);
  const [movingObject, setMovingObject] = useState<DesignObject | undefined>(undefined);
  const [magnetEnabled, _setMagnetEnabled] = useState<boolean>(true);
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

  const handleObjectEdited = (id: string, updates: { name: string, position: [number, number, number], rotation?: number, textureOverrides?: TextureOverride[] }) => {
    setDesignObjects(prev => prev.map(obj =>
      obj.id === id ? {
        ...obj,
        name: updates.name,
        position: updates.position,
        ...(updates.rotation !== undefined && { rotation: updates.rotation }),
        ...(updates.textureOverrides !== undefined && { textureOverrides: updates.textureOverrides })
      } : obj
    ));
  };

  const handleObjectDeleted = (id: string) => {
    setDesignObjects(prev => prev.filter(obj => obj.id !== id));
    if (movingObject?.id === id) setMovingObject(undefined);
  };

  const handleMeshesDiscovered = (id: string, meshNames: string[]) => {
    const deduped = meshNames.filter((name, i, arr) => arr.indexOf(name) === i);
    setDesignObjects(prev => prev.map(obj => {
      if (obj.id !== id) return obj;
      if (obj.meshNames && deduped.length === obj.meshNames.length && deduped.every((n, i) => n === obj.meshNames[i])) {
        return obj;
      }
      return { ...obj, meshNames: deduped };
    }));
  };

  if (modelsLoading || materialsLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading...</Text>
      </View>
    );
  }

  if (modelsError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Error loading furniture models: {modelsError.message}</Text>
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
        onMeshesDiscovered={handleMeshesDiscovered}
      />
      <View3dOverlay
        objectTemplates={objectTemplates}
        categories={objectCategories}
        room3dProps={room3d}
        setRoom3d={setRoom3d}
        designObjects={designObjects}
        onObjectAdded={handleObjectAdded}
        onObjectEdited={handleObjectEdited}
        onObjectDeleted={handleObjectDeleted}
        movingObject={movingObject}
        setMovingObject={setMovingObject}
        magnetEnabled={magnetEnabled}
        forceEditObject={forceEditObject}
        clearForceEdit={() => setForceEditObject(undefined)}
        materials={materials}
        materialCategories={materialCategories}
      >
      </View3dOverlay>
    </View>
  );
}
