import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { BudgetSettings, emptyBudgetSettings, ModelBudgetEntry } from './budget';
import { Project } from './api';
import type { DesignObject } from '../components/DesignScreen/3dView/DesignObjects';
import type { Room3dProps } from '../components/DesignScreen/3dView/Room3d';
import type { MaterialPart } from './materialParts';

export interface SavedViewResolution {
  preset: string | 'custom';
  width: number;
  height: number;
}

export interface SavedView {
  id: string;
  name: string;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  fov: number;
  zoom?: number;
  resolution: SavedViewResolution;
  previewDataUrl?: string;
}

export interface DesignSnapshot {
  room: Room3dProps;
  objects: DesignObject[];
  globalMaterials?: Record<string, string>;
  defaultHandleType?: string | null;
}

export type CloudSaveStatus = 'not_saved' | 'saving' | 'saved' | 'unsaved_changes';

interface CurrentProjectContextValue {
  project: Project | null;
  setProject: (project: Project | null) => void;
  projectName: string;
  setProjectName: (name: string) => void;
  cloudSaveStatus: CloudSaveStatus;
  cloudSaveMessageTick: number;
  setCloudSaveStatus: (status: CloudSaveStatus, showMessage?: boolean) => void;
  designSnapshot: DesignSnapshot | null;
  setDesignSnapshot: (snapshot: DesignSnapshot) => void;
  defaultHandleType: string | null;
  setDefaultHandleType: React.Dispatch<React.SetStateAction<string | null>>;
  savedViews: SavedView[];
  setSavedViews: React.Dispatch<React.SetStateAction<SavedView[]>>;
  budgetSettings: BudgetSettings;
  setBudgetSettings: (settings: BudgetSettings) => void;
  registerBudgetEditor: (editor: ((id: string, entries: ModelBudgetEntry[] | undefined) => void) | null) => void;
  updateBudgetEntries: (id: string, entries: ModelBudgetEntry[] | undefined) => void;
  canEditBudgetObjects: boolean;
  registerPartsEditor: (editor: ((id: string, parts: MaterialPart[] | undefined) => void) | null) => void;
  updateMaterialParts: (id: string, parts: MaterialPart[] | undefined) => void;
}

const CurrentProjectContext = createContext<CurrentProjectContextValue>({
  project: null,
  setProject: () => {},
  projectName: '',
  setProjectName: () => {},
  cloudSaveStatus: 'not_saved',
  cloudSaveMessageTick: 0,
  setCloudSaveStatus: () => {},
  designSnapshot: null,
  setDesignSnapshot: () => {},
  defaultHandleType: null,
  setDefaultHandleType: () => {},
  savedViews: [],
  setSavedViews: () => {},
  budgetSettings: emptyBudgetSettings(),
  setBudgetSettings: () => {},
  registerBudgetEditor: () => {},
  updateBudgetEntries: () => {},
  canEditBudgetObjects: false,
  registerPartsEditor: () => {},
  updateMaterialParts: () => {},
});

export function CurrentProjectProvider({ children }: { children: React.ReactNode }) {
  const [project, setProjectState] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  const [cloudSaveStatus, setCloudSaveStatusState] = useState<CloudSaveStatus>('not_saved');
  const [cloudSaveMessageTick, setCloudSaveMessageTick] = useState<number>(0);
  const [designSnapshot, setDesignSnapshot] = useState<DesignSnapshot | null>(null);
  const [defaultHandleType, setDefaultHandleType] = useState<string | null>(null);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [budgetSettings, setBudgetSettings] = useState<BudgetSettings>(emptyBudgetSettings);
  const editorRef = useRef<((id: string, entries: ModelBudgetEntry[] | undefined) => void) | null>(null);
  const [canEditBudgetObjects, setCanEditBudgetObjects] = useState(false);

  const setProject = useCallback((nextProject: Project | null) => {
    setProjectState(nextProject);
    if (nextProject) {
      setProjectName(nextProject.name ?? '');
    }
  }, []);

  const setCloudSaveStatus = useCallback((status: CloudSaveStatus, showMessage?: boolean) => {
    setCloudSaveStatusState(status);
    if (showMessage) {
      setCloudSaveMessageTick((prev) => prev + 1);
    } else if (status === 'saved' || status === 'unsaved_changes') {
      setCloudSaveMessageTick(0);
    }
  }, []);

  const registerBudgetEditor = useCallback((editor: typeof editorRef.current) => {
    editorRef.current = editor;
    setCanEditBudgetObjects(editor !== null);
  }, []);
  const updateBudgetEntries = useCallback((id: string, entries: ModelBudgetEntry[] | undefined) => editorRef.current?.(id, entries), []);
  const partsEditorRef = useRef<((id: string, parts: MaterialPart[] | undefined) => void) | null>(null);
  const registerPartsEditor = useCallback((editor: typeof partsEditorRef.current) => { partsEditorRef.current = editor; }, []);
  const updateMaterialParts = useCallback((id: string, parts: MaterialPart[] | undefined) => partsEditorRef.current?.(id, parts), []);

  return (
    <CurrentProjectContext.Provider value={{ project, setProject, projectName, setProjectName, cloudSaveStatus, cloudSaveMessageTick, setCloudSaveStatus, designSnapshot, setDesignSnapshot, defaultHandleType, setDefaultHandleType, savedViews, setSavedViews, budgetSettings, setBudgetSettings, registerBudgetEditor, updateBudgetEntries, canEditBudgetObjects, registerPartsEditor, updateMaterialParts }}>
      {children}
    </CurrentProjectContext.Provider>
  );
}

export function useCurrentProject() {
  return useContext(CurrentProjectContext);
}
