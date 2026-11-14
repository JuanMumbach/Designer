import ProjectPicker from "@/components/DesignScreen/3dViewOverlay/ProjectPicker";
import Design3dView from "@/components/DesignScreen/Design3dViewer";
import View3dOverlay from "@/components/DesignScreen/View3dOverlay";
import { COLORS } from "@/constants/theme";
import { fetchAllMaterialTypes, fetchMaterialVersion, fetchModelMaterialTypes, fetchObjectVersion, fetchProject, fetchProjectVersion, MaterialType, ObjectMaterialType } from "@/services/api";
import { useAuth } from "@/services/AuthContext";
import { deserializeProjectState, loadProject, loadProjectFromCloud, ProjectStateDTO, saveProject, serializeProjectState } from "@/services/projectStorage";
import { exportSceneAsGLB } from "@/services/sceneExport";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View } from "react-native";
import { useCurrentProject } from "../services/currentProject";
import { collectDefaultGlobalMaterials, designMaterialsConfig, normalizeTypeName, resolveMaterialValue } from "../services/designMaterialDefaults";
import { MaterialSlotInfo } from "../services/materialSlots";
import {
  createThumbnailCaptureApi,
  ThumbnailCaptureApi,
} from "../services/thumbnailCapture";
import { parseObjectProperties, useObjectTemplates } from "../services/useFurnitureModels";
import { useMaterials } from "../services/useMaterials";
import { AppliedMaterial, createDesignObject, duplicateDesignObject, DesignObject, getInitialPosition, GlobalMaterials, MaterialOverrides, resolveGlobalMaterials } from "./DesignScreen/3dView/DesignObjects";
import { Room3dProps } from "./DesignScreen/3dView/Room3d";
import { ActiveMeasurementEdit, MeasurementSide } from "./DesignScreen/3dViewOverlay/EditMeasurementModal";
import { emptyBudgetSettings, ModelBudgetEntry } from '../services/budget';
import { MaterialPart } from '../services/materialParts';
import {
  getHandleGroupVariantMap,
  isHandleVariant,
  isHandleVariantGroup,
  parseVariantProperties,
  resolveHandleKeyForVariantGroup,
  resolveVariantSelectionForHandleKey,
} from '../services/variants';


const initialRoom3d: Room3dProps = {
  width: 4,
  height: 2.7,
  depth: 3,
  leftWall: true,
  rightWall: true
};

export default function DesignScreen({ projectId }: { projectId?: string }) {
  const { backendUserId, selectedWorkspaceId } = useAuth();
  const { project, projectName, setProject, setProjectName, setDesignSnapshot, defaultHandleType, setDefaultHandleType, savedViews, setSavedViews, budgetSettings, setBudgetSettings, registerBudgetEditor, registerPartsEditor } = useCurrentProject();
  const { objectTemplates, categories: objectCategories, isLoading: modelsLoading, error: modelsError, refresh: refreshObjectTemplates } = useObjectTemplates(selectedWorkspaceId ?? undefined);
  const { materials, categories: materialCategories, isLoading: materialsLoading } = useMaterials(selectedWorkspaceId ?? undefined);
  const [room3d, setRoom3d] = useState<Room3dProps>(initialRoom3d);
  const [designObjects, setDesignObjects] = useState<DesignObject[]>([]);
  const [movingObject, setMovingObject] = useState<DesignObject | undefined>(undefined);
  const [globalMaterials, setGlobalMaterials] = useState<GlobalMaterials>({});

  const hasFocusedOnceRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnceRef.current) {
        hasFocusedOnceRef.current = true;
        return;
      }
      void refreshObjectTemplates(true);
    }, [refreshObjectTemplates])
  );

  useEffect(() => {
    if (objectTemplates.length === 0) return;
    setDesignObjects((prev) => {
      let anyChanged = false;
      const next = prev.map((obj) => {
        const template =
          objectTemplates.find((t) => t.id === obj.modelId && t.version === obj.version) ??
          objectTemplates.find((t) => t.id === obj.modelId);
        if (!template) return obj;
        const nextVariants = template.variants ?? obj.variants;
        const nextDefaultVariants =
          template.objectProperties?.defaultVariants ?? obj.objectProperties?.defaultVariants;
        if (
          nextVariants === obj.variants &&
          nextDefaultVariants === obj.objectProperties?.defaultVariants
        ) {
          return obj;
        }
        anyChanged = true;
        return {
          ...obj,
          variants: nextVariants,
          objectProperties:
            nextDefaultVariants !== undefined
              ? { ...(obj.objectProperties ?? {}), defaultVariants: nextDefaultVariants }
              : obj.objectProperties,
        };
      });
      return anyChanged ? next : prev;
    });
  }, [objectTemplates]);
  useEffect(() => {
    setDesignSnapshot({ room: room3d, objects: designObjects, globalMaterials, defaultHandleType });
  }, [room3d, designObjects, globalMaterials, defaultHandleType, setDesignSnapshot]);
  const [materialDataById, setMaterialDataById] = useState<Record<string, AppliedMaterial>>({});
  const materialDataByIdRef = useRef(materialDataById);
  materialDataByIdRef.current = materialDataById;
  const [magnetEnabled, _setMagnetEnabled] = useState<boolean>(true);
  const [isDraggingObject, setIsDraggingObject] = useState(false);
  const [forceEditObject, setForceEditObject] = useState<DesignObject | undefined>(undefined);
  const [activeMeasurementEdit, setActiveMeasurementEdit] = useState<ActiveMeasurementEdit | undefined>(undefined);
  const [isFraming, setIsFraming] = useState(false);
  const [wallContextMenu, setWallContextMenu] = useState<{
    wallId: import('./DesignScreen/3dView/Room3d').WallIdentifier;
    x: number;
    y: number;
  } | null>(null);
  const [editingWall, setEditingWall] = useState<import('./DesignScreen/3dView/Room3d').WallIdentifier | null>(null);

  const handleWallContextMenu = useCallback((
    wallId: import('./DesignScreen/3dView/Room3d').WallIdentifier,
    event: any
  ) => {
    const native = event.nativeEvent ?? event;
    let x = native?.offsetX ?? event.offsetX;
    let y = native?.offsetY ?? event.offsetY;

    if (typeof x !== 'number' || typeof y !== 'number') {
      const clientX = event.clientX ?? native?.clientX ?? 120;
      const clientY = event.clientY ?? native?.clientY ?? 120;
      const target = native?.target ?? event.target;
      const rect = target?.getBoundingClientRect?.();
      if (rect) {
        x = clientX - rect.left;
        y = clientY - rect.top;
      } else {
        x = clientX;
        y = clientY;
      }
    }

    setWallContextMenu({ wallId, x, y });
  }, []);

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
    if (loadedProjectIdRef.current !== null) {
      setProjectName('');
      loadedProjectIdRef.current = null;
    }
    setBudgetSettings(emptyBudgetSettings());
    setSavedViews([]);
    setGlobalMaterials({});
    setDefaultHandleType(null);
    setDesignObjects([]);
    setProject(null);
    projectLoadGenerationRef.current += 1;
    setIsProjectLoading(false);
    projectLoadedRef.current = false;
    defaultSceneInitializedRef.current = false;
  }, [projectId, setBudgetSettings, setSavedViews, setProject, setProjectName, setDefaultHandleType]);

  const captureApi = useMemo<ThumbnailCaptureApi>(
    () => createThumbnailCaptureApi(),
    []
  );

  const handleExport3d = async () => {
    setIsExporting(true);
    try {
      await exportSceneAsGLB(room3d, designObjects, materialDataById, globalMaterials, slotTypesByModel, typeToDesignSlot, undefined, defaultHandleType);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveProject = async () => {
    const serializedState = serializeProjectState(room3d, designObjects, globalMaterials, budgetSettings, savedViews, defaultHandleType);
    const safeName = (projectName || project?.name || 'my_designer_project').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    await saveProject(serializedState, `${safeName || 'my_designer_project'}.json`);
  };

  const applyProjectData = useCallback(async (projectData: ProjectStateDTO, generation = ++projectLoadGenerationRef.current) => {
    const getModelUrl = async (modelId: string, version: number) => {
      const template = objectTemplates.find(t => t.id === modelId && t.version === version);
      if (template) return template.modelUrl;
      const storedVersion = await fetchObjectVersion(modelId, version);
      return storedVersion.fileURL;
    };

    const { room, objects, globalMaterials: loadedGlobalMaterials, defaultHandleType: loadedDefaultHandle, budgetSettings: loadedBudget, savedViews: loadedSavedViews } = await deserializeProjectState(projectData, getModelUrl);
    if (generation !== projectLoadGenerationRef.current) return;
    setIsProjectLoading(false);
    projectLoadedRef.current = true;
    setRoom3d(room);
    const enrichedObjects = await Promise.all(objects.map(async (obj) => {
      const stripSeededHandleDefaults = (
        target: DesignObject,
        variantsList: import('../services/variants').ObjectVariant[] | undefined,
        defaultVars: Record<string, string | null> | undefined
      ): DesignObject => {
        if (!target.selectedVariants || !defaultVars) return target;
        const handleGroups = new Set<string>();
        for (const g of Object.keys(target.selectedVariants)) {
          if (isHandleVariantGroup(g)) handleGroups.add(g);
        }
        for (const v of variantsList ?? []) {
          if (isHandleVariant(v)) {
            handleGroups.add(parseVariantProperties(v.variantProperties).group);
          }
        }
        if (handleGroups.size === 0) return target;
        const nextSelected = { ...target.selectedVariants };
        let changed = false;
        for (const g of handleGroups) {
          if (g in nextSelected && g in defaultVars && nextSelected[g] === defaultVars[g]) {
            delete nextSelected[g];
            changed = true;
          }
        }
        if (!changed) return target;
        return {
          ...target,
          selectedVariants: Object.keys(nextSelected).length > 0 ? nextSelected : undefined,
        };
      };

      const template =
        objectTemplates.find(t => t.id === obj.modelId && t.version === obj.version) ??
        objectTemplates.find(t => t.id === obj.modelId);
      if (template?.variants) {
        const mergedProps = template.objectProperties?.defaultVariants
          ? { ...(obj.objectProperties ?? {}), defaultVariants: template.objectProperties.defaultVariants }
          : obj.objectProperties;
        return stripSeededHandleDefaults(
          { ...obj, variants: template.variants, objectProperties: mergedProps },
          template.variants,
          mergedProps?.defaultVariants
        );
      }
      try {
        const v = await fetchObjectVersion(obj.modelId, obj.version);
        const parsedProps = parseObjectProperties(v?.objectProperties);
        const mergedProps = parsedProps?.defaultVariants
          ? { ...(obj.objectProperties ?? {}), defaultVariants: parsedProps.defaultVariants }
          : obj.objectProperties;
        if (v?.variants) {
          return stripSeededHandleDefaults(
            { ...obj, variants: v.variants, objectProperties: mergedProps },
            v.variants,
            mergedProps?.defaultVariants
          );
        }
      } catch {
        // preserve as-is
      }
      return obj;
    }));
    setDesignObjects(enrichedObjects);
    setGlobalMaterials(loadedGlobalMaterials ?? {});
    setDefaultHandleType(loadedDefaultHandle);
    setBudgetSettings(loadedBudget);
    setSavedViews(loadedSavedViews);
    setMovingObject(undefined);
  }, [objectTemplates, setBudgetSettings, setSavedViews, setDefaultHandleType]);

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
      if (obj.backsplash?.materialId) {
        const resolvedId = resolveMaterialValue(obj.backsplash.materialId, globalMaterials);
        if (resolvedId) ids.add(resolvedId);
      }
    }
    for (const materialId of Object.values(resolveGlobalMaterials(globalMaterials))) {
      if (materialId) ids.add(materialId);
    }
    if (room3d?.walls) {
      for (const wall of Object.values(room3d.walls)) {
        if (!wall) continue;
        if (wall.materialId) {
          const resolvedId = resolveMaterialValue(wall.materialId, globalMaterials);
          if (resolvedId) ids.add(resolvedId);
        }
        if (wall.defaultTileMaterialId) {
          const resolvedId = resolveMaterialValue(wall.defaultTileMaterialId, globalMaterials);
          if (resolvedId) ids.add(resolvedId);
        }
        if (wall.tiles) {
          for (const tile of wall.tiles) {
            if (tile.materialId) {
              const resolvedId = resolveMaterialValue(tile.materialId, globalMaterials);
              if (resolvedId) ids.add(resolvedId);
            }
          }
        }
      }
    }
    return [...ids];
  }, [designObjects, globalMaterials, room3d]);

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
        const cached = materialDataByIdRef.current[materialId];
        if (cached && cached.version === meta.lastVersion) {
          resolved[materialId] = cached;
          continue;
        }
        try {
          const data = await fetchMaterialVersion(materialId, meta.lastVersion);
          resolved[materialId] = {
            fileURL: data.fileURL,
            scaleU: data.scaleU,
            scaleV: data.scaleV,
            version: meta.lastVersion,
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

  const handleMaterialDataResolved = useCallback((id: string, applied: AppliedMaterial) => {
    setMaterialDataById((prev) => ({ ...prev, [id]: applied }));
  }, []);

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
    setSavedViews([]);
    setGlobalMaterials({});
    setDefaultHandleType(null);
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
  }, [applyProjectData, setProject, setBudgetSettings, setSavedViews, setDefaultHandleType]);

  useEffect(() => {
    if (!projectId) return;
    if (objectTemplates.length === 0) return;
    if (loadedProjectIdRef.current === projectId) return;
    loadProjectById(projectId);
  }, [projectId, objectTemplates, loadProjectById]);

  useEffect(() => {
    if (!movingObject) {
      setActiveMeasurementEdit(undefined);
    } else if (activeMeasurementEdit && activeMeasurementEdit.objectId !== movingObject.id) {
      setActiveMeasurementEdit(undefined);
    }
  }, [movingObject, activeMeasurementEdit]);

  const handleObjectInteraction = (object: DesignObject) => {
    setMovingObject(object);
  };

  const handleEditObjectFrom3D = (object: DesignObject) => {
    setMovingObject(object);
    setActiveMeasurementEdit(undefined);
    setForceEditObject(object);
  };

  const handleSelectMeasurement = (object: DesignObject, side: MeasurementSide, currentValue: number) => {
    setMovingObject(object);
    setActiveMeasurementEdit({
      objectId: object.id,
      side,
      currentValue,
    });
  };

  const handleObjectAdded = (newObject: DesignObject) => {
    setDesignObjects(prev => [...prev, newObject]);
    setMovingObject(newObject);
  };

  const handleObjectEdited = (id: string, updates: { name: string, position: [number, number, number], rotation?: number, materialOverrides?: MaterialOverrides, hidden?: boolean, dimensions?: [number, number, number], selectedVariants?: Record<string, string | null> }) => {
    setDesignObjects(prev => prev.map(obj =>
      obj.id === id ? {
        ...obj,
        name: updates.name,
        position: updates.position,
        ...(updates.rotation !== undefined && { rotation: updates.rotation }),
        ...(updates.materialOverrides !== undefined && { materialOverrides: updates.materialOverrides }),
        ...(updates.hidden !== undefined && { hidden: updates.hidden }),
        ...(updates.dimensions !== undefined && { dimensions: updates.dimensions }),
        ...(updates.selectedVariants !== undefined && { selectedVariants: updates.selectedVariants }),
      } : obj
    ));
  };

  const handleObjectDeleted = (id: string) => {
    setDesignObjects(prev => prev.filter(obj => obj.id !== id));
    if (movingObject?.id === id) setMovingObject(undefined);
  };

  const handleObjectDuplicate = (object: DesignObject) => {
    const duplicated = duplicateDesignObject(object, designObjects, room3d);
    setDesignObjects(prev => [...prev, duplicated]);
    setMovingObject(duplicated);
  };

  const clearHandleOverridesInObjects = useCallback(() => {
    const clearOnObj = (obj: DesignObject): DesignObject => {
      if (!obj.selectedVariants) return obj;
      const handleGroups = new Set<string>();
      for (const g of Object.keys(obj.selectedVariants)) {
        if (isHandleVariantGroup(g)) handleGroups.add(g);
      }
      for (const v of obj.variants ?? []) {
        if (isHandleVariant(v)) {
          handleGroups.add(parseVariantProperties(v.variantProperties).group);
        }
      }
      if (handleGroups.size === 0) return obj;
      const nextSelected = { ...obj.selectedVariants };
      let changed = false;
      for (const g of handleGroups) {
        if (g in nextSelected) {
          delete nextSelected[g];
          changed = true;
        }
      }
      if (!changed) return obj;
      return {
        ...obj,
        selectedVariants: Object.keys(nextSelected).length > 0 ? nextSelected : undefined,
      };
    };
    setDesignObjects(prev => prev.map(clearOnObj));
    setMovingObject(prev => prev ? clearOnObj(prev) : prev);
  }, []);

  const handleClearHandleOverrides = useCallback(() => {
    clearHandleOverridesInObjects();
  }, [clearHandleOverridesInObjects]);

  const handleReplaceHandleType = useCallback((sourceHandleKey: string, targetHandleKey: string) => {
    if (sourceHandleKey === targetHandleKey) return;

    const replaceOnObj = (obj: DesignObject): DesignObject => {
      const handleGroups = getHandleGroupVariantMap(obj.variants);
      if (handleGroups.size === 0) return obj;

      const nextSelected = { ...(obj.selectedVariants ?? {}) };
      let changed = false;

      for (const [grp, grpVariants] of handleGroups.entries()) {
        const currentResolved = resolveHandleKeyForVariantGroup(
          grp,
          grpVariants,
          obj.objectProperties?.defaultVariants,
          obj.selectedVariants,
          defaultHandleType
        );
        if (currentResolved.key !== sourceHandleKey) continue;

        const targetSelection = resolveVariantSelectionForHandleKey(grpVariants, targetHandleKey);
        if (!targetSelection.matched) continue;

        nextSelected[grp] = targetSelection.variantId;
        changed = true;
      }

      if (!changed) return obj;
      return {
        ...obj,
        selectedVariants: nextSelected,
      };
    };

    setDesignObjects(prev => prev.map(replaceOnObj));
    setMovingObject(prev => prev ? replaceOnObj(prev) : prev);
    setDefaultHandleType(prev => prev === sourceHandleKey ? targetHandleKey : prev);
  }, [defaultHandleType, setDefaultHandleType]);

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
        onWallContextMenu={handleWallContextMenu}
        designObjects={designObjects}
        onObjectInteraction={handleObjectInteraction}
        onObjectEdited={handleObjectEdited}
        onObjectDeleted={handleObjectDeleted}
        onEditObject={handleEditObjectFrom3D}
        onObjectDuplicate={handleObjectDuplicate}
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
        activeMeasurementSide={activeMeasurementEdit?.side}
        onSelectMeasurement={handleSelectMeasurement}
        isFraming={isFraming}
        defaultHandleType={defaultHandleType}
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
        onObjectDuplicate={handleObjectDuplicate}
        movingObject={movingObject}
        setMovingObject={setMovingObject}
        magnetEnabled={magnetEnabled}
        forceEditObject={forceEditObject}
        clearForceEdit={() => setForceEditObject(undefined)}
        activeMeasurementEdit={activeMeasurementEdit}
        onClearMeasurementEdit={() => setActiveMeasurementEdit(undefined)}
        materials={materials}
        materialCategories={materialCategories}
        materialTypes={materialTypes}
        globalMaterials={globalMaterials}
        setGlobalMaterials={setGlobalMaterials}
        defaultHandleType={defaultHandleType}
        setDefaultHandleType={setDefaultHandleType}
        onReplaceHandleType={handleReplaceHandleType}
        onClearHandleOverrides={handleClearHandleOverrides}
        materialDataById={materialDataById}
        designSlots={designMaterialsConfig.designMaterialSlots}
        slotTypesByModel={slotTypesByModel}
        typeToDesignSlot={typeToDesignSlot}
        onSaveProject={handleSaveProject}
        onLoadProject={handleLoadProject}
        onExport3d={handleExport3d}
        onSaveProjectCloud={() => setIsProjectPickerVisible(true)}
        isExporting={isExporting}
        wallContextMenu={wallContextMenu}
        onClearWallContextMenu={() => setWallContextMenu(null)}
        editingWall={editingWall}
        setEditingWall={setEditingWall}
        onMaterialDataResolved={handleMaterialDataResolved}
        savedViews={savedViews}
        setSavedViews={setSavedViews}
        captureApi={captureApi}
        projectName={projectName || project?.name || 'Project'}
        onFramingModeChange={setIsFraming}
      />

      {isProjectPickerVisible && (
        <View style={styles.pickerOverlay}>
          <ProjectPicker
            projectState={serializeProjectState(room3d, designObjects, globalMaterials, budgetSettings, savedViews, defaultHandleType)}
            creatorId={backendUserId}
            initialProjectName={projectName || project?.name || ''}
            initialProjectId={project?.id ?? null}
            initialWorkspaceId={project?.workspaceId ?? null}
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
