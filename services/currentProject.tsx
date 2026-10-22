import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { BudgetSettings, emptyBudgetSettings, ModelBudgetEntry } from './budget';
import { Project } from './api';
import type { DesignObject } from '../components/DesignScreen/3dView/DesignObjects';
import type { Room3dProps } from '../components/DesignScreen/3dView/Room3d';
import type { MaterialPart } from './materialParts';

export interface DesignSnapshot {
  room: Room3dProps;
  objects: DesignObject[];
  globalMaterials?: Record<string, string>;
}

interface CurrentProjectContextValue {
  project: Project | null;
  setProject: (project: Project | null) => void;
  designSnapshot: DesignSnapshot | null;
  setDesignSnapshot: (snapshot: DesignSnapshot) => void;
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
  designSnapshot: null,
  setDesignSnapshot: () => {},
  budgetSettings: emptyBudgetSettings(),
  setBudgetSettings: () => {},
  registerBudgetEditor: () => {},
  updateBudgetEntries: () => {},
  canEditBudgetObjects: false,
  registerPartsEditor: () => {},
  updateMaterialParts: () => {},
});

export function CurrentProjectProvider({ children }: { children: React.ReactNode }) {
  const [project, setProject] = useState<Project | null>(null);
  const [designSnapshot, setDesignSnapshot] = useState<DesignSnapshot | null>(null);
  const [budgetSettings, setBudgetSettings] = useState<BudgetSettings>(emptyBudgetSettings);
  const editorRef = useRef<((id: string, entries: ModelBudgetEntry[] | undefined) => void) | null>(null);
  const [canEditBudgetObjects, setCanEditBudgetObjects] = useState(false);
  const registerBudgetEditor = useCallback((editor: typeof editorRef.current) => {
    editorRef.current = editor;
    setCanEditBudgetObjects(editor !== null);
  }, []);
  const updateBudgetEntries = useCallback((id: string, entries: ModelBudgetEntry[] | undefined) => editorRef.current?.(id, entries), []);
  const partsEditorRef = useRef<((id: string, parts: MaterialPart[] | undefined) => void) | null>(null);
  const registerPartsEditor = useCallback((editor: typeof partsEditorRef.current) => { partsEditorRef.current = editor; }, []);
  const updateMaterialParts = useCallback((id: string, parts: MaterialPart[] | undefined) => partsEditorRef.current?.(id, parts), []);

  return (
    <CurrentProjectContext.Provider value={{ project, setProject, designSnapshot, setDesignSnapshot, budgetSettings, setBudgetSettings, registerBudgetEditor, updateBudgetEntries, canEditBudgetObjects, registerPartsEditor, updateMaterialParts }}>
      {children}
    </CurrentProjectContext.Provider>
  );
}

export function useCurrentProject() {
  return useContext(CurrentProjectContext);
}
