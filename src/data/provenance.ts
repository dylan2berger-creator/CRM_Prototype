// Provenance: every number in the UI should be traceable to the source dataset
// it came from, and the app should be able to say how current that data is.
// This maps dataset names to their freshness record.

import { DataFreshness, DataSet } from '@/types';

export function freshnessFor(data: DataSet, dataset: string): DataFreshness | undefined {
  return data.freshness.find((f) => f.dataset === dataset);
}

// The mocked upstream systems, for the "what is real / what is mocked" note.
export const SOURCE_SYSTEMS = {
  DOMO: 'DOMO — metrics and exec dashboard (mocked)',
  BDAP: 'BDAP — upstream of DOMO, fed by CCCone (mocked)',
  CCCone: 'CCCone — estimating and repair-order system (mocked)',
} as const;
