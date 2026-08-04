// Memoized per-dataset indexes so selectors don't linearly scan the ~55k-row
// fact table on every render. Keyed on the DataSet object with a WeakMap, so a
// fresh dataset (after a plan edit) rebuilds automatically.

import { CarrierVolume, DataSet, DrpScorecard, MetricPeriod } from '@/types';

export interface DataIndex {
  metricByStoreMonth: Map<string, MetricPeriod[]>; // `${storeId}|${month}`
  metricByStore: Map<string, MetricPeriod[]>;
  volByStoreMonth: Map<string, CarrierVolume[]>;
  volByStore: Map<string, CarrierVolume[]>;
  scoreByStoreMonth: Map<string, DrpScorecard[]>;
  scoreByStore: Map<string, DrpScorecard[]>;
}

const cache = new WeakMap<DataSet, DataIndex>();

function add<T>(map: Map<string, T[]>, key: string, val: T) {
  const arr = map.get(key);
  if (arr) arr.push(val);
  else map.set(key, [val]);
}

export function dataIndex(data: DataSet): DataIndex {
  let idx = cache.get(data);
  if (idx) return idx;
  idx = {
    metricByStoreMonth: new Map(),
    metricByStore: new Map(),
    volByStoreMonth: new Map(),
    volByStore: new Map(),
    scoreByStoreMonth: new Map(),
    scoreByStore: new Map(),
  };
  for (const m of data.metrics) {
    add(idx.metricByStoreMonth, `${m.storeId}|${m.month}`, m);
    add(idx.metricByStore, m.storeId, m);
  }
  for (const v of data.carrierVolumes) {
    add(idx.volByStoreMonth, `${v.storeId}|${v.month}`, v);
    add(idx.volByStore, v.storeId, v);
  }
  for (const s of data.scorecards) {
    add(idx.scoreByStoreMonth, `${s.storeId}|${s.month}`, s);
    add(idx.scoreByStore, s.storeId, s);
  }
  cache.set(data, idx);
  return idx;
}

export const mByStoreMonth = (data: DataSet, storeId: string, month: string): MetricPeriod[] =>
  dataIndex(data).metricByStoreMonth.get(`${storeId}|${month}`) ?? [];
export const vByStoreMonth = (data: DataSet, storeId: string, month: string): CarrierVolume[] =>
  dataIndex(data).volByStoreMonth.get(`${storeId}|${month}`) ?? [];
export const sByStoreMonth = (data: DataSet, storeId: string, month: string): DrpScorecard[] =>
  dataIndex(data).scoreByStoreMonth.get(`${storeId}|${month}`) ?? [];
