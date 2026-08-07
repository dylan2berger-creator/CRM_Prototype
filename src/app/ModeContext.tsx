// App-mode toggle: the full multi-screen app vs. a lean "MVP" cut that keeps
// only what the core user stories need (identify/monitor/prioritize challenged
// shops, root-cause + action plans, anomaly alerts, owner tagging, continuity).
// The toggle lets stakeholders compare the MVP against the current app.

import { createContext, ReactNode, useContext, useState } from 'react';

export type AppMode = 'full' | 'mvp';

interface ModeContextValue {
  mode: AppMode;
  mvp: boolean;
  setMode: (m: AppMode) => void;
}

const ModeContext = createContext<ModeContextValue | null>(null);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AppMode>('full');
  return <ModeContext.Provider value={{ mode, mvp: mode === 'mvp', setMode }}>{children}</ModeContext.Provider>;
}

export function useMode(): ModeContextValue {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useMode must be used within ModeProvider');
  return ctx;
}
