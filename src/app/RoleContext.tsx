// Role switching. No auth - the role is chosen from a control in the header.
// Changing role changes the visible store scope and the default landing route.

import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { Role } from '@/types';
import { useData } from '@/data/DataContext';

export type Scope =
  | { type: 'all' }
  | { type: 'spm'; spmId: string }
  | { type: 'cpm'; cpmId: string }
  | { type: 'region'; regionId: string }
  | { type: 'store'; storeId: string };

export interface RoleConfig {
  role: Role;
  label: string;
  userName: string;
  scope: Scope;
  landing: string;
}

interface RoleContextValue {
  role: Role;
  config: RoleConfig;
  setRole: (r: Role) => void;
  roles: { role: Role; label: string }[];
}

const Ctx = createContext<RoleContextValue | null>(null);

export const ROLE_LABELS: Record<Role, string> = {
  spm: 'Shop Performance Manager',
  cpm: 'Client Performance Manager',
  rvp: 'Regional VP',
  gm: 'Shop GM',
  exec: 'VP Market Performance',
};

export function RoleProvider({ children }: { children: ReactNode }) {
  const { data, landmarks } = useData();
  const [role, setRole] = useState<Role>('spm');

  const config = useMemo<RoleConfig>(() => {
    const spm = data.spms.find((s) => s.id === landmarks.primarySpmId);
    const cpm = data.cpms.find((c) => c.id === landmarks.primaryCpmId);
    const gmStore = data.stores.find((s) => s.id === landmarks.gmStoreId);
    const region = data.regions.find((r) => r.id === landmarks.underperformingRegionId);
    switch (role) {
      case 'spm':
        return {
          role,
          label: ROLE_LABELS.spm,
          userName: spm?.name ?? 'SPM',
          scope: { type: 'spm', spmId: landmarks.primarySpmId },
          landing: '/',
        };
      case 'cpm': {
        const carrierName = data.clients.find((c) => c.id === cpm?.carrierId)?.name;
        const beat = cpm?.carrierId && cpm?.division ? `${carrierName} · ${cpm.division}` : '';
        return {
          role,
          label: beat ? `Client Performance Manager · ${beat}` : ROLE_LABELS.cpm,
          userName: cpm?.name ?? 'CPM',
          scope: { type: 'cpm', cpmId: landmarks.primaryCpmId },
          landing: '/',
        };
      }
      case 'rvp':
        return {
          role,
          label: ROLE_LABELS.rvp,
          userName: region?.rvpName ?? 'RVP',
          scope: { type: 'region', regionId: landmarks.underperformingRegionId },
          landing: '/roll-up',
        };
      case 'gm':
        return {
          role,
          label: ROLE_LABELS.gm,
          userName: gmStore?.gmName ?? 'GM',
          scope: { type: 'store', storeId: landmarks.gmStoreId },
          landing: `/store/${landmarks.gmStoreId}`,
        };
      case 'exec':
        return {
          role,
          label: ROLE_LABELS.exec,
          userName: 'VP Market Performance & Integration',
          scope: { type: 'all' },
          landing: '/roll-up',
        };
    }
  }, [role, data, landmarks]);

  const value: RoleContextValue = {
    role,
    config,
    setRole,
    roles: (Object.keys(ROLE_LABELS) as Role[]).map((r) => ({ role: r, label: ROLE_LABELS[r] })),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRole must be used within RoleProvider');
  return ctx;
}
