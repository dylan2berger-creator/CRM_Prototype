// Holds the generated dataset in memory (no backend) and exposes the mutators
// the editable surfaces need. Every mutation produces a fresh DataSet object so
// the WeakMap-memoized selectors recompute and React re-renders.

import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  ActionPlan,
  ActionStep,
  Alert,
  DataSet,
  Risk,
  SalesAsk,
  SalesActivity,
} from '@/types';
import { generate, Landmarks } from '@/mock/generator';

interface DataContextValue {
  data: DataSet;
  landmarks: Landmarks;
  // action plans
  createPlan: (storeId: string, createdBy: string) => string;
  updatePlan: (planId: string, patch: Partial<Omit<ActionPlan, 'id' | 'storeId' | 'steps' | 'risks' | 'salesAsks'>>) => void;
  // steps
  addStep: (planId: string, step: ActionStep) => void;
  updateStep: (planId: string, stepId: string, patch: Partial<ActionStep>) => void;
  deleteStep: (planId: string, stepId: string) => void;
  reorderSteps: (planId: string, orderedIds: string[]) => void;
  // risks
  addRisk: (planId: string, risk: Risk) => void;
  updateRisk: (planId: string, riskId: string, patch: Partial<Risk>) => void;
  deleteRisk: (planId: string, riskId: string) => void;
  // sales asks
  addSalesAsk: (planId: string, ask: SalesAsk) => void;
  updateSalesAsk: (planId: string, askId: string, patch: Partial<SalesAsk>) => void;
  // sales activity (tagging appends to the read-only history)
  addSalesActivity: (activity: SalesActivity) => void;
  // alerts
  acknowledgeAlert: (alertId: string) => void;
  acknowledgeAll: (ids: string[]) => void;
  newId: (prefix: string) => string;
}

const Ctx = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => generate(), []);
  const { landmarks, ...dataset } = initial;
  const [data, setData] = useState<DataSet>(dataset);
  const counter = useRef(1);

  const newId = useCallback((prefix: string): string => `${prefix}-${Date.now().toString(36)}-${counter.current++}`, []);

  // Helper: replace a plan by id with a mapper.
  const mapPlan = useCallback((planId: string, fn: (p: ActionPlan) => ActionPlan) => {
    setData((prev) => ({
      ...prev,
      actionPlans: prev.actionPlans.map((p) => (p.id === planId ? fn(p) : p)),
    }));
  }, []);

  const createPlan = useCallback(
    (storeId: string, createdBy: string): string => {
      const id = `AP-${storeId}-${counter.current++}`;
      const plan: ActionPlan = {
        id,
        storeId,
        createdOn: new Date().toISOString().slice(0, 10),
        createdBy,
        status: 'Draft',
        summary: '',
        steps: [],
        risks: [],
        salesAsks: [],
      };
      setData((prev) => ({ ...prev, actionPlans: [...prev.actionPlans, plan] }));
      return id;
    },
    [],
  );

  const updatePlan: DataContextValue['updatePlan'] = useCallback((planId, patch) => {
    mapPlan(planId, (p) => ({ ...p, ...patch }));
  }, [mapPlan]);

  const addStep: DataContextValue['addStep'] = useCallback((planId, step) => {
    mapPlan(planId, (p) => ({ ...p, steps: [...p.steps, step] }));
  }, [mapPlan]);

  const updateStep: DataContextValue['updateStep'] = useCallback((planId, stepId, patch) => {
    mapPlan(planId, (p) => ({ ...p, steps: p.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)) }));
  }, [mapPlan]);

  const deleteStep: DataContextValue['deleteStep'] = useCallback((planId, stepId) => {
    mapPlan(planId, (p) => ({ ...p, steps: p.steps.filter((s) => s.id !== stepId) }));
  }, [mapPlan]);

  const reorderSteps: DataContextValue['reorderSteps'] = useCallback((planId, orderedIds) => {
    mapPlan(planId, (p) => {
      const byId = new Map(p.steps.map((s) => [s.id, s]));
      const reordered = orderedIds.map((id) => byId.get(id)).filter((s): s is ActionStep => !!s);
      // keep any steps not in orderedIds at the end
      const rest = p.steps.filter((s) => !orderedIds.includes(s.id));
      return { ...p, steps: [...reordered, ...rest] };
    });
  }, [mapPlan]);

  const addRisk: DataContextValue['addRisk'] = useCallback((planId, risk) => {
    mapPlan(planId, (p) => ({ ...p, risks: [...p.risks, risk] }));
  }, [mapPlan]);
  const updateRisk: DataContextValue['updateRisk'] = useCallback((planId, riskId, patch) => {
    mapPlan(planId, (p) => ({ ...p, risks: p.risks.map((r) => (r.id === riskId ? { ...r, ...patch } : r)) }));
  }, [mapPlan]);
  const deleteRisk: DataContextValue['deleteRisk'] = useCallback((planId, riskId) => {
    mapPlan(planId, (p) => ({ ...p, risks: p.risks.filter((r) => r.id !== riskId) }));
  }, [mapPlan]);

  const addSalesAsk: DataContextValue['addSalesAsk'] = useCallback((planId, ask) => {
    mapPlan(planId, (p) => ({ ...p, salesAsks: [...p.salesAsks, ask] }));
  }, [mapPlan]);
  const updateSalesAsk: DataContextValue['updateSalesAsk'] = useCallback((planId, askId, patch) => {
    mapPlan(planId, (p) => ({ ...p, salesAsks: p.salesAsks.map((a) => (a.id === askId ? { ...a, ...patch } : a)) }));
  }, [mapPlan]);

  const addSalesActivity: DataContextValue['addSalesActivity'] = useCallback((activity) => {
    setData((prev) => ({ ...prev, salesActivities: [activity, ...prev.salesActivities] }));
  }, []);

  const acknowledgeAlert: DataContextValue['acknowledgeAlert'] = useCallback((alertId) => {
    setData((prev) => ({ ...prev, alerts: prev.alerts.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a)) }));
  }, []);
  const acknowledgeAll: DataContextValue['acknowledgeAll'] = useCallback((ids) => {
    const set = new Set(ids);
    setData((prev) => ({ ...prev, alerts: prev.alerts.map((a: Alert) => (set.has(a.id) ? { ...a, acknowledged: true } : a)) }));
  }, []);

  const value: DataContextValue = {
    data,
    landmarks,
    createPlan,
    updatePlan,
    addStep,
    updateStep,
    deleteStep,
    reorderSteps,
    addRisk,
    updateRisk,
    deleteRisk,
    addSalesAsk,
    updateSalesAsk,
    addSalesActivity,
    acknowledgeAlert,
    acknowledgeAll,
    newId,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
