import ProjectPicker from "@/components/DesignScreen/3dViewOverlay/ProjectPicker";
import Design3dView from "@/components/DesignScreen/Design3dViewer";
import View3dOverlay from "@/components/DesignScreen/View3dOverlay";
import { COLORS } from "@/constants/theme";
import { fetchAllMaterialTypes, fetchMaterialVersion, fetchModelMaterialTypes, fetchObjectVersion, fetchProject, fetchProjectVersion, MaterialType, ObjectMaterialType } from "@/services/api";
import { useAuth } from "@/services/AuthContext";
import { deserializeProjectState, loadProject, loadProjectFromCloud, ProjectStateDTO, saveProject, serializeProjectState } from "@/services/projectStorage";
import { exportSceneAsGLB } from "@/services/sceneExport";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View } from "react-native";
import { useCurrentProject } from "../services/currentProject";
import { collectDefaultGlobalMaterials, designMaterialsConfig, normalizeTypeName, resolveMaterialValue } from "../services/designMaterialDefaults";
import { MaterialSlotInfo } from "../services/materialSlots";
import {
  createThumbnailCaptureApi,
  ThumbnailCaptureApi,
} from "../services/thumbnailCapture";
import { useObjectTemplates } from "../services/useFurnitureModels";
import { useMaterials } from "../services/useMaterials";
import { AppliedMaterial, createDesignObject, DesignObject, getInitialPosition, GlobalMaterials, MaterialOverrides, resolveGlobalMaterials } from "./DesignScreen/3dView/DesignObjects";
import { Room3dProps } from "./DesignScreen/3dView/Room3d";
import { emptyBudgetSettings, ModelBudgetEntry } from '../services/budget';
import { MaterialPart } from '../services/materialParts';


const initialRoom3d: Room3dProps = {
  width: 4,
  height: 2.7,
  depth: 3,
  leftWall: true,
  rightWall: true
};

export default function DesignScreen({ projectId }: { projectId?: string }) {
  const { backendUserId, selectedWorkspaceId } = useAuth();
  const { setProject, setDesignSnapshot, budgetSettings, setBudgetSettings, registerBudgetEditor, registerPartsEditor } = useCurrentProject();
  const { objectTemplates, categories: objectCategories, isLoading: modelsLoading, error: modelsError } = useObjectTemplates(selectedWorkspaceId ?? undefined);
  const { materials, categories: materialCategories, isLoading: materialsLoading } = useMaterials(selectedWorkspaceId ?? undefined);
  const [room3d, setRoom3d] = useState<Room3dProps>(initialRoom3d);
  const [designObjects, setDesignObjects] = useState<DesignObject[]>([]);
  const [movingObject, setMovingObject] = useState<DesignObject | undefined>(undefined);
  const [globalMaterials, setGlobalMaterials] = useState<GlobalMaterials>({});
  useEffect(() => {
    setDesignSnapshot({ room: room3d, objects: designObjects, globalMaterials });
  }, [room3d, designObjects, globalMaterials, setDesignSnapshot]);
  const [materialDataById, setMaterialDataById] = useState<Record<string, AppliedMaterial>>({});
  const [magnetEnabled, _setMagnetEnabled] = useState<boolean>(true);
  const [isDraggingObject, setIsDraggingObject] = useState(false);
  const [forceEditObject, setForceEditObject] = useState<DesignObject | undefined>(undefined);
  const [isExporting, setIsExporting] = useState(false);
  const [isProjectPickerVisible, setIsProjectPickerVisible] = useState(false);
  const [isProjectLoading, setIsProjectLoading] = useState(false);
  const [slotTypesByModel, setSlotTypesByModel] = useState<Record<string, ObjectMaterialType[]>>({});
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const projectLoadedRef = useRef(false);
  const loadedProjectIdRef = useRef<string | null>(null);
  const defaultSceneInitializedRef = useRef(false);
  const projectLoadGenerationRef = useRef(0);
  useEffect(() => {
    registerBudgetEditor(isProjectLoading ? null : (id: string, entries: ModelBudgetEntry[] | undefined) => {
      setDesignObjects((objects) => objects.map((object) => object.id === id ? { ...object, budgetEntries: entries } : object));
    });
    registerPartsEditor(isProjectLoading ? null : (id: string, parts: MaterialPart[] | undefined) => {
      setDesignObjects((objects) => objects.map((object) => object.id === id ? { ...object, materialParts: parts } : object));
    });
    return () => { registerBudgetEditor(null); registerPartsEditor(null); };
  }, [registerBudgetEditor, registerPartsEditor, isProjectLoading]);
  useEffect(() => {
    if (projectId) return;
    setBudgetSettings(emptyBudgetSettings());
    setGlobalMaterials({});
    setDesignObjects([]);
    setProject(null);
    loadedProjectIdRef.current = null;
    projectLoadGenerationRef.current += 1;
    setIsProjectLoading(false);
    projectLoadedRef.current = false;
    defaultSceneInitializedRef.current = false;
  }, [projectId, setBudgetSettings, setProject]);

  const captureApi = useMemo<ThumbnailCaptureApi>(
    () => createThumbnailCaptureApi(),
    []
  );

  const handleExport3d = async () => {
    setIsExporting(true);
    try {
      await exportSceneAsGLB(room3d, designObjects, materialDataById, globalMaterials, slotTypesByModel, typeToDesignSlot);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveProject = async () => {
    const serializedState = serializeProjectState(room3d, designObjects, globalMaterials, budgetSettings);
    await saveProject(serializedState, 'my_designer_project.json');
  };

  const applyProjectData = useCallback(async (projectData: ProjectStateDTO, generation = ++projectLoadGenerationRef.current) => {
    const getModelUrl = async (modelId: string, version: number) => {
      const template = objectTemplates.find(t => t.id === modelId && t.version === version);
      if (template) return template.modelUrl;
      const storedVersion = await fetchObjectVersion(modelId, version);
      return storedVersion.fileURL;
    };

    const { room, objects, globalMaterials: loadedGlobalMaterials, budgetSettings: loadedBudget } = await deserializeProjectState(projectData, getModelUrl);
    if (generation !== projectLoadGenerationRef.current) return;
    setIsProjectLoading(false);
    projectLoadedRef.current = true;
    setRoom3d(room);
    setDesignObjects(objects);
    setGlobalMaterials(loadedGlobalMaterials ?? {});
    setBudgetSettings(loadedBudget);
    setMovingObject(undefined);
  }, [objectTemplates, setBudgetSettings]);

  const confirmReplaceScene = (action: () => void) => {
    if (designObjects.length === 0) {
      action();
      return;
    }
    const message = 'Loading will replace the current scene. Continue?';
    if (Platform.OS === 'web') {
      if (window.confirm(message)) action();
    } else {
      Alert.alert('Load Project', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Load', onPress: action },
      ]);
    }
  };

  const handleLoadProject = async () => {
    const projectData = await loadProject();
    if (projectData) {
      confirmReplaceScene(() => {
        applyProjectData(projectData).catch(() => Alert.alert('Error', 'No se pudo cargar el proyecto o su presupuesto.'));
      });
    }
  };

  const referencedMaterialIds = useMemo(() => {
    const ids = new Set<string>();
    for (const obj of designObjects) {
      for (const materialId of Object.values(obj.materialOverrides ?? {})) {
        const resolvedId = resolveMaterialValue(materialId, globalMaterials);
        if (resolvedId) ids.add(resolvedId);
      }
    }
    for (const materialId of Object.values(resolveGlobalMaterials(globalMaterials))) {
      if (materialId) ids.add(materialId);
    }
    return [...ids];
  }, [designObjects, globalMaterials]);

  useEffect(() => {
    let cancelled = false;
    if (referencedMaterialIds.length === 0) {
      setMaterialDataById({});
      return;
    }

    (async () => {
      const resolved: Record<string, AppliedMaterial> = {};
      for (const materialId of referencedMaterialIds) {
        if (cancelled) return;
        const meta = materials.find(m => m.id === materialId);
        if (!meta) continue;
        try {
          const data = await fetchMaterialVersion(materialId, meta.lastVersion);
          resolved[materialId] = {
            fileURL: data.fileURL,
            scaleU: data.scaleU,
            scaleV: data.scaleV,
          };
        } catch (err) {
          console.warn(`Could not resolve material ${materialId}:`, err);
        }
      }
      if (!cancelled) setMaterialDataById(resolved);
    })();

    return () => {
      cancelled = true;
    };
  }, [referencedMaterialIds, materials]);

  const resolvedGlobalMaterials = useMemo(() => {
    const resolved: Record<string, AppliedMaterial> = {};
    const finalMaterials = resolveGlobalMaterials(globalMaterials);
    for (const slotName of Object.keys(finalMaterials)) {
      const materialId = finalMaterials[slotName];
      const data = materialDataById[materialId];
      if (data) resolved[slotName] = data;
    }
    return resolved;
  }, [globalMaterials, materialDataById]);

  const typeToDesignSlot = useMemo(() => {
    const map: Record<string, string> = {};
    for (const slot of designMaterialsConfig.designMaterialSlots) {
      if (!slot.type) continue;
      const key = normalizeTypeName(slot.type);
      if (!map[key]) map[key] = slot.key;
    }
    return map;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const types = await fetchAllMaterialTypes();
        if (!cancelled) setMaterialTypes(types);
      } catch (err) {
        console.warn('Could not fetch material types:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const modelKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const obj of designObjects) {
      if (obj.modelId) keys.add(`${obj.modelId}:${obj.version}`);
    }
    return [...keys];
  }, [designObjects]);

  useEffect(() => {
    if (modelKeys.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const key of modelKeys) {
        if (cancelled) return;
        const colonIndex = key.indexOf(':');
        const modelId = key.substring(0, colonIndex);
        const version = Number(key.substring(colonIndex + 1));
        try {
          const rows = await fetchModelMaterialTypes(modelId, version);
          if (cancelled) return;
          setSlotTypesByModel(prev => {
            if (prev[key] && prev[key].length === rows.length) return prev;
            return { ...prev, [key]: rows };
          });
        } catch (err) {
          console.warn(`Could not fetch material types for ${key}:`, err);
          if (!cancelled) {
            setSlotTypesByModel(prev => (prev[key] ? prev : { ...prev, [key]: [] }));
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modelKeys]);

  useEffect(() => {
    if (projectLoadedRef.current) return;
    if (Object.keys(globalMaterials).length > 0) return;
    if (materials.length === 0 || designObjects.length === 0) return;
    const defaults = collectDefaultGlobalMaterials(designMaterialsConfig.designMaterialSlots, materials, materialTypes);
    if (Object.keys(defaults).length > 0) setGlobalMaterials(defaults);
  }, [materials, designObjects, globalMaterials, materialTypes]);

  useEffect(() => {
    if (projectId) return;
    if (objectTemplates.length === 0) return;
    if (defaultSceneInitializedRef.current || projectLoadedRef.current) return;
    defaultSceneInitializedRef.current = true;

    const defaults: DesignObject[] = [];

    const counterModels = objectTemplates.filter(m => m.objectProperties?.movingBehaviour === 'counter');
    const cupboardModels = objectTemplates.filter(m => m.objectProperties?.movingBehaviour === 'cupboard');

    if (counterModels.length > 0) {
      const counter = counterModels[1];
      defaults.push(createDesignObject(counter, [0, 0, 0]));
      defaults.push(createDesignObject(counter, [1.2, 0, 0]));
      defaults.push(createDesignObject(counter, [1.8, 0, 0]));
      defaults.push(createDesignObject(counter, [2.4, 0, 0]));
      defaults.push(createDesignObject(counterModels[0], [3, 0, 0]));
    }

    if (cupboardModels.length > 0) {
      const cupboard = cupboardModels[0];
      const cupboard2 = cupboardModels.length > 1 ? cupboardModels[1] : cupboardModels[0];
      const cupboardY = getInitialPosition(cupboard)[1];
      defaults.push(createDesignObject(cupboard, [0, cupboardY, 0]));
      defaults.push(createDesignObject(cupboard2, [1.2, cupboardY, 0]));
      defaults.push(createDesignObject(cupboard, [1.8, cupboardY, 0]));
      defaults.push(createDesignObject(cupboard2, [2.4, cupboardY, 0]));
    }

    setDesignObjects(defaults);
  }, [objectTemplates, projectId]);

  const loadProjectById = useCallback(async (id: string) => {
    const generation = ++projectLoadGenerationRef.current;
    setIsProjectLoading(true);
    setDesignObjects([]);
    setBudgetSettings(emptyBudgetSettings());
    setGlobalMaterials({});
    setProject(null);
    try {
      const project = await fetchProject(id);
      if (generation !== projectLoadGenerationRef.current) return;
      if (!project.lastVersion) {
        loadedProjectIdRef.current = id;
        setProject(project);
        Alert.alert('Info', 'This project has no saved versions.');
        return;
      }
      const version = await fetchProjectVersion(project.id, project.lastVersion);
      const projectState = await loadProjectFromCloud(version.fileURL);
      if (generation !== projectLoadGenerationRef.current) return;
      if (projectState) {
        await applyProjectData(projectState, generation);
        if (generation !== projectLoadGenerationRef.current) return;
        loadedProjectIdRef.current = id;
        setProject(project);
      }
    } catch (err) {
      console.error('Cloud load failed:', err);
      Alert.alert('Error', 'Failed to load project from cloud.');
    } finally {
      if (generation === projectLoadGenerationRef.current) setIsProjectLoading(false);
    }
  }, [applyProjectData, setProject, setBudgetSettings]);

  useEffect(() => {
    if (!projectId) return;
    if (objectTemplates.length === 0) return;
    if (loadedProjectIdRef.current === projectId) return;
    loadProjectById(projectId);
  }, [projectId, objectTemplates, loadProjectById]);

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
    setMovingObject(newObject);
  };

  const handleObjectEdited = (id: string, updates: { name: string, position: [number, number, number], rotation?: number, materialOverrides?: MaterialOverrides, hidden?: boolean, dimensions?: [number, number, number] }) => {
    setDesignObjects(prev => prev.map(obj =>
      obj.id === id ? {
        ...obj,
        name: updates.name,
        position: updates.position,
        ...(updates.rotation !== undefined && { rotation: updates.rotation }),
        ...(updates.materialOverrides !== undefined && { materialOverrides: updates.materialOverrides }),
        ...(updates.hidden !== undefined && { hidden: updates.hidden }),
        ...(updates.dimensions !== undefined && { dimensions: updates.dimensions }),
      } : obj
    ));
  };

  const handleObjectDeleted = (id: string) => {
    setDesignObjects(prev => prev.filter(obj => obj.id !== id));
    if (movingObject?.id === id) setMovingObject(undefined);
  };

  const handleSlotsDiscovered = (id: string, slots: MaterialSlotInfo[]) => {
    const deduped = slots.filter((s, i, arr) => arr.findIndex(a => a.slot === s.slot) === i);
    setDesignObjects(prev => prev.map(obj => {
      if (obj.id !== id) return obj;
      if (
        obj.slots &&
        deduped.length === obj.slots.length &&
        deduped.every((s, i) => s.slot === obj.slots![i].slot && s.displayName === obj.slots![i].displayName)
      ) {
        return obj;
      }
      return { ...obj, slots: deduped };
    }));
  };

  if (modelsLoading || materialsLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
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
        onSlotsDiscovered={handleSlotsDiscovered}
        globalMaterials={resolvedGlobalMaterials}
        globalMaterialsRaw={globalMaterials}
        materialDataById={materialDataById}
        slotTypesByModel={slotTypesByModel}
        typeToDesignSlot={typeToDesignSlot}
        captureApi={captureApi}
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
        globalMaterials={globalMaterials}
        setGlobalMaterials={setGlobalMaterials}
        materialDataById={materialDataById}
        designSlots={designMaterialsConfig.designMaterialSlots}
        slotTypesByModel={slotTypesByModel}
        typeToDesignSlot={typeToDesignSlot}
        onSaveProject={handleSaveProject}
        onLoadProject={handleLoadProject}
        onExport3d={handleExport3d}
        onSaveProjectCloud={() => setIsProjectPickerVisible(true)}
        isExporting={isExporting}
      >
      </View3dOverlay>

      {isProjectPickerVisible && (
        <View style={styles.pickerOverlay}>
          <ProjectPicker
            projectState={serializeProjectState(room3d, designObjects, globalMaterials, budgetSettings)}
            creatorId={backendUserId}
            onSaved={(project) => setProject(project)}
            onClose={() => setIsProjectPickerVisible(false)}
            captureApi={captureApi}
          />
        </View>
      )}

      {isProjectLoading && (
        <View style={styles.pickerOverlay}>
          <ActivityIndicator size="large" color={COLORS.white} />
          <Text style={styles.loadingProjectText}>Loading project...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.overlay,
    zIndex: 200,
  },
  loadingProjectText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
  },
});
