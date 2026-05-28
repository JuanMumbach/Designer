import Design3dView from "@/components/DesignScreen/Design3dViewer";
import View3dOverlay from "@/components/DesignScreen/View3dOverlay";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useObjectTemplates } from "../services/useFurnitureModels";
import { useMaterials } from "../services/useMaterials";
import { serializeProjectState, saveProject, loadProject, deserializeProjectState } from "@/services/projectStorage";
import { exportSceneAsGLB } from "@/services/sceneExport";
import { DesignObject, TextureOverride, createDesignObject } from "./DesignScreen/3dView/DesignObjects";
import { Room3dProps } from "./DesignScreen/3dView/Room3d";


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
  const [isExporting, setIsExporting] = useState(false);

  const handleExport3d = async () => {
    setIsExporting(true);
    try {
      await exportSceneAsGLB(room3d, designObjects);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveProject = async () => {
    const serializedState = serializeProjectState(room3d, designObjects);
    await saveProject(serializedState, 'my_designer_project.json');
  };

  const handleLoadProject = async () => {
    const projectData = await loadProject();
    if (projectData) {
      const getModelUrl = async (modelId: string, version: number) => {
        const template = objectTemplates.find(t => t.id === modelId && t.version === version);
        if (template) return template.modelUrl;
        return undefined;
      };

      const { room, objects } = await deserializeProjectState(projectData, getModelUrl);
      setRoom3d(room);
      setDesignObjects(objects);
      setMovingObject(undefined);
    }
  };

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
      defaults.push(createDesignObject(cupboard, [0, 1.5, 0]));
      defaults.push(createDesignObject(cupboard2, [1.2, 1.5, 0]));
      defaults.push(createDesignObject(cupboard, [1.8, 1.5, 0]));
      defaults.push(createDesignObject(cupboard2, [2.4, 1.5, 0]));
      defaults.push(createDesignObject(cupboard2, [3, 1.5, 0]));
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
        onSaveProject={handleSaveProject}
        onLoadProject={handleLoadProject}
        onExport3d={handleExport3d}
        isExporting={isExporting}
      >
      </View3dOverlay>
    </View>
  );
}
