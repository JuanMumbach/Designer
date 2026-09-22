import React, { createContext, useContext, useState } from 'react';
import { Project } from './api';

interface CurrentProjectContextValue {
  project: Project | null;
  setProject: (project: Project | null) => void;
}

const CurrentProjectContext = createContext<CurrentProjectContextValue>({
  project: null,
  setProject: () => {},
});

export function CurrentProjectProvider({ children }: { children: React.ReactNode }) {
  const [project, setProject] = useState<Project | null>(null);

  return (
    <CurrentProjectContext.Provider value={{ project, setProject }}>
      {children}
    </CurrentProjectContext.Provider>
  );
}

export function useCurrentProject() {
  return useContext(CurrentProjectContext);
}