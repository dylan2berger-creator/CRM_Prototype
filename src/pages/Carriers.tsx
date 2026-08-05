// Screen 7 - /carriers, the carrier and DRP view.
// Built for the National Account Manager and for a CPM preparing for a carrier
// meeting: how a carrier scores a store, whether its assignment volume tracks
// forecast, how it rolls up across the book and within a region, which
// scorecard drivers it weights most, and what sales asks are open against it.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useData } from '@/data/DataContext';
import { EmptyState, Field, OpenQuestion, Panel, Select, Stat } from '@/components/ui';
import { SourceTag } from '@/components/Provenance';
import { SalesAskBadge, TierBadge } from '@/components/status';
import { Variance } from '@/components/Variance';
import { clientById, regionName, storeById, TIER_ORDER } from '@/data/selectors';
import { rollupsForMonth } from '@/data/rollups';
import { DrpTier, SalesAsk } from '@/types';
import { dateLabel, int, money, monthLabel, monthShort, pct } from '@/utils/format';

const ACTUAL = '#7B68EE';
const FORECAST = '#94a3b8';
const WORSE = '#F0616D';
const BETTER = '#24B47E';

// A tier is "worse" the further down TIER_ORDER it sits (Preferred -> At risk).
const tierRank = (t: DrpTier) => TIER_ORDER.indexOf(t);

export function Carriers() {
  const { data, landmarks } = useData();
  const cur = data.currentMonth;

  const carriers = useMemo(() => data.clients.filter((c) => c.isDrp), [data]);

  const [carrierId, setCarrierId] = useState<string>(carriers[0]?.id ?? '');
  const [storeId, setStoreId] = useState<string>('all'); // 'all' or a store id
  const [regionId, setRegionId] = useState<string>('all'); // 'all' or a region id

  // Stores this carrier trades with (has assignment volume for), sorted by name.
  const carrierStores = useMemo(() => {
    const ids = new Set<string>();
    for (const v of data.carrierVolumes) if (v.clientId === carrierId) ids.add(v.storeId);
    return [...ids]
      .map((id) => storeById(data, id))
      .filter((s): s is NonNullable<typeof s> => !!s)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, carrierId]);

  const carrier = clientById(data, carrierId);

  // If the carrier changes and the chosen store no longer trades with it, fall
  // back to the aggregate view rather than showing an empty scope.
  const effectiveStoreId =
    storeId !== 'all' && carrierStores.some((s) => s.id === storeId) ? storeId : 'all';

  // --- Assignment volume vs forecast, monthly, for the current scope ---------
  const volumeSeries = useMemo(() => {
    return data.months.map((month) => {
      let actual = 0;
      let forecast = 0;
      for (const v of data.carrierVolumes) {
        if (v.clientId !== carrierId || v.month !== month) continue;
        if (effectiveStoreId !== 'all' && v.storeId !== effectiveStoreId) continue;
        actual += v.assignmentActual;
        forecast += v.assignmentForecast;
      }
      return { month, actual, forecast };
    });
  }, [data, carrierId, effectiveStoreId]);

  const volNow = volumeSeries[volumeSeries.length - 1];
  const volGapUnits = volNow ? volNow.actual - volNow.forecast : 0;
  const volGapPct = volNow && volNow.forecast > 0 ? (volNow.actual / volNow.forecast - 1) * 100 : null;

  // Anomalies flagged on this carrier within the current scope, newest first.
  const anomalies = useMemo(() => {
    return data.carrierVolumes
      .filter(
        (v) =>
          v.clientId === carrierId &&
          v.isAnomaly &&
          (effectiveStoreId === 'all' || v.storeId === effectiveStoreId),
      )
      .sort((a, b) => (a.month < b.month ? 1 : -1));
  }, [data, carrierId, effectiveStoreId]);

  // --- DRP scorecard trend for one store + carrier ---------------------------
  // The scorecard is per store, so this chart needs a concrete store. When the
  // scope is "all stores" we show a representative store and say which one.
  const scorecardStoreId = effectiveStoreId !== 'all' ? effectiveStoreId : carrierStores[0]?.id ?? '';
  const scorecardStore = scorecardStoreId ? storeById(data, scorecardStoreId) : undefined;

  const scorecardSeries = useMemo(() => {
    return data.months
      .map((month) => {
        const sc = data.scorecards.find(
          (s) => s.storeId === scorecardStoreId && s.clientId === carrierId && s.month === month,
        );
        return sc ? { month, score: sc.score, tier: sc.tier } : null;
      })
      .filter((p): p is { month: string; score: number; tier: DrpTier } => !!p);
  }, [data, scorecardStoreId, carrierId]);

  // Points where the tier changed from the prior month.
  const tierChanges = useMemo(() => {
    const out: { month: string; score: number; from: DrpTier; to: DrpTier; worse: boolean }[] = [];
    for (let i = 1; i < scorecardSeries.length; i++) {
      const prev = scorecardSeries[i - 1];
      const p = scorecardSeries[i];
      if (prev.tier !== p.tier) {
        out.push({ month: p.month, score: p.score, from: prev.tier, to: p.tier, worse: tierRank(p.tier) > tierRank(prev.tier) });
      }
    }
    return out;
  }, [scorecardSeries]);

  const scoreDomain = useMemo(() => {
    if (!scorecardSeries.length) return [0, 100] as [number, number];
    const vals = scorecardSeries.map((p) => p.score);
    return [Math.max(0, Math.floor(Math.min(...vals) - 5)), Math.min(100, Math.ceil(Math.max(...vals) + 5))] as [number, number];
  }, [scorecardSeries]);

  // --- Carrier-level roll-up (this month) ------------------------------------
  const carrierRollup = useMemo(
    () => rollupsForMonth(data, 'carrier', cur).find((r) => r.keys.clientId === carrierId),
    [data, carrierId, cur],
  );

  const regionRows = useMemo(() => {
    return rollupsForMonth(data, 'carrier-in-region', cur)
      .filter((r) => r.keys.clientId === carrierId)
      .map((r) => ({
        regionId: r.keys.regionId ?? '',
        name: regionName(data, r.keys.regionId ?? ''),
        revenueActual: r.revenueActual,
        revenueForecast: r.revenueForecast,
        assignmentActual: r.assignmentActual,
        assignmentForecast: r.assignmentForecast,
        challenged: r.challengedStoreCount,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, carrierId, cur]);

  const selectedRegionRow = regionId !== 'all' ? regionRows.find((r) => r.regionId === regionId) : undefined;

  const revVarPct = carrierRollup && carrierRollup.revenueForecast > 0
    ? (carrierRollup.revenueActual / carrierRollup.revenueForecast - 1) * 100 : null;
  const asnVarPct = carrierRollup && carrierRollup.assignmentForecast > 0
    ? (carrierRollup.assignmentActual / carrierRollup.assignmentForecast - 1) * 100 : null;

  // --- Sales asks raised against this carrier --------------------------------
  const carrierAsks = useMemo(() => {
    const rows: { ask: SalesAsk; storeId: string }[] = [];
    for (const plan of data.actionPlans) {
      for (const ask of plan.salesAsks) {
        if (ask.clientId === carrierId) rows.push({ ask, storeId: plan.storeId });
      }
    }
    return rows.sort((a, b) => (a.ask.raisedOn < b.ask.raisedOn ? 1 : -1));
  }, [data, carrierId]);

  // --- Driver comparison: same store, two carriers ---------------------------
  // The demo point - two carriers on one store disagree about what matters.
  const [cmpStoreId, setCmpStoreId] = useState<string>(landmarks.twoCarrierDisagreeStoreId);

  const cmpStoreCarriers = useMemo(() => {
    const ids = new Set<string>();
    for (const s of data.scorecards) if (s.storeId === cmpStoreId && s.month === cur) ids.add(s.clientId);
    return [...ids]
      .map((id) => clientById(data, id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, cmpStoreId, cur]);

  const [cmpAId, setCmpAId] = useState<string>('');
  const [cmpBId, setCmpBId] = useState<string>('');
  // Effective A/B fall back to the first two carriers on the compared store.
  const cmpA = cmpStoreCarriers.some((c) => c.id === cmpAId) ? cmpAId : cmpStoreCarriers[0]?.id ?? '';
  const cmpB = cmpStoreCarriers.some((c) => c.id === cmpBId) ? cmpBId : (cmpStoreCarriers.find((c) => c.id !== cmpA)?.id ?? '');

  const cmpScA = data.scorecards.find((s) => s.storeId === cmpStoreId && s.clientId === cmpA && s.month === cur);
  const cmpScB = data.scorecards.find((s) => s.storeId === cmpStoreId && s.clientId === cmpB && s.month === cur);

  const maxWeight = (sc?: typeof cmpScA) =>
    sc ? sc.drivers.reduce((m, d) => Math.max(m, d.weightPct), 0) : -1;
  const topDriver = (sc?: typeof cmpScA) =>
    sc ? [...sc.drivers].sort((a, b) => b.weightPct - a.weightPct)[0] : undefined;
  const aMaxW = maxWeight(cmpScA);
  const bMaxW = maxWeight(cmpScB);
  const aTop = topDriver(cmpScA);
  const bTop = topDriver(cmpScB);

  const carrierOptions = carriers.map((c) => ({ value: c.id, label: c.name }));
  const storeOptions = [
    { value: 'all', label: 'All stores' },
    ...carrierStores.map((s) => ({ value: s.id, label: `${s.name} · ${s.id}` })),
  ];
  const regionOptions = [
    { value: 'all', label: 'All regions' },
    ...data.regions.map((r) => ({ value: r.id, label: r.name })),
  ];
  const cmpStoreOptions = [...data.stores]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => ({ value: s.id, label: `${s.name} · ${s.id}` }));

  if (!carrier) {
    return <EmptyState title="No DRP carriers in the dataset" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">Carrier and DRP view</h1>
        <p className="mt-0.5 text-sm text-muted">
          How one carrier scores its stores, where its assignment volume drifts from forecast, how it rolls up across
          the book and within a region, and what the account team owes it. Built for a carrier meeting.
        </p>
      </div>

      {(carrier.drpProgram || carrier.scorecardName) && (
        <div className="card flex flex-wrap items-center gap-x-4 gap-y-1.5 p-3 text-xs">
          {carrier.drpProgram && <span className="chip bg-accent-soft text-accent">{carrier.drpProgram}</span>}
          {carrier.scorecardName && (
            <span className="text-muted">
              Scorecard <span className="font-medium text-ink">{carrier.scorecardName}</span>
            </span>
          )}
          {carrier.scorePlatform && (
            <span className="text-muted">
              Scored in <span className="font-medium text-ink">{carrier.scorePlatform}</span>
            </span>
          )}
        </div>
      )}

      <OpenQuestion>
        Program and scorecard names shown here are real (Select Service, STARS, ARX, GHRN, and so on). The scores, CBSA
        ranks, and competitor counts are illustrative: the carrier scorecard feed at that granularity is
        carrier-proprietary and is not present in BDAP today. Driver weights are per carrier, not a Boyd-wide standard -
        CSI usually carries the most weight, with cycle time close behind.
      </OpenQuestion>

      <Panel title="Scope" subtitle="Pick the carrier, then narrow to one store or region as needed.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Carrier">
            <Select aria-label="Carrier" value={carrierId} onChange={setCarrierId} options={carrierOptions} />
          </Field>
          <Field label="Store">
            <Select aria-label="Store" value={effectiveStoreId} onChange={setStoreId} options={storeOptions} />
          </Field>
          <Field label="Region (roll-up)">
            <Select aria-label="Region" value={regionId} onChange={setRegionId} options={regionOptions} />
          </Field>
        </div>
      </Panel>

      {/* Carrier-level roll-up ------------------------------------------------ */}
      <Panel
        title={`${carrier.name} - roll-up this month`}
        subtitle={`Revenue and assignment volume vs forecast across all stores, ${monthLabel(cur)}.`}
        right={<SourceTag dataset="BDAP - DRP Assignments" />}
      >
        {carrierRollup ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Revenue actual"
                value={money(carrierRollup.revenueActual)}
                sub={`Plan ${money(carrierRollup.revenueForecast)}`}
              />
              <Stat
                label="Revenue vs plan"
                value={<Variance pct={revVarPct} />}
                sub={`Gap ${money(carrierRollup.revenueActual - carrierRollup.revenueForecast)}`}
                tone={revVarPct != null && revVarPct < 0 ? 'bad' : 'good'}
              />
              <Stat
                label="Assignments actual"
                value={int(carrierRollup.assignmentActual)}
                sub={`Forecast ${int(carrierRollup.assignmentForecast)}`}
              />
              <Stat
                label="Assignments vs forecast"
                value={<Variance pct={asnVarPct} />}
                sub={`Gap ${int(carrierRollup.assignmentActual - carrierRollup.assignmentForecast)} units`}
                tone={asnVarPct != null && asnVarPct < 0 ? 'bad' : 'good'}
              />
            </div>

            <h3 className="mt-4 mb-1.5 text-2xs font-semibold uppercase tracking-wide text-muted">
              By region
              {selectedRegionRow && <span className="ml-1 normal-case text-muted">· {selectedRegionRow.name} selected</span>}
            </h3>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Region</th>
                    <th className="text-right">Revenue actual</th>
                    <th className="text-right">Plan</th>
                    <th className="text-right">Rev vs plan</th>
                    <th className="text-right">Assign. actual</th>
                    <th className="text-right">Forecast</th>
                    <th className="text-right">Assign. vs fcst</th>
                    <th className="text-right">Challenged stores</th>
                  </tr>
                </thead>
                <tbody>
                  {regionRows.map((r) => {
                    const rv = r.revenueForecast > 0 ? (r.revenueActual / r.revenueForecast - 1) * 100 : null;
                    const av = r.assignmentForecast > 0 ? (r.assignmentActual / r.assignmentForecast - 1) * 100 : null;
                    const sel = r.regionId === regionId;
                    return (
                      <tr key={r.regionId} className={sel ? 'bg-accent-soft' : undefined}>
                        <td className="font-medium text-ink">{r.name}</td>
                        <td className="num">{money(r.revenueActual)}</td>
                        <td className="num text-muted">{money(r.revenueForecast)}</td>
                        <td className="num"><Variance pct={rv} /></td>
                        <td className="num">{int(r.assignmentActual)}</td>
                        <td className="num text-muted">{int(r.assignmentForecast)}</td>
                        <td className="num"><Variance pct={av} /></td>
                        <td className="num">{r.challenged}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState title="No roll-up for this carrier this month" />
        )}
      </Panel>

      {/* Scorecard trend ----------------------------------------------------- */}
      <Panel
        title={carrier.scorecardName ? `${carrier.scorecardName} trend` : 'DRP scorecard trend'}
        subtitle={
          scorecardStore
            ? `${carrier.name} at ${scorecardStore.name} over ${scorecardSeries.length} months, with tier changes marked.${effectiveStoreId === 'all' ? ' Showing a representative store - select a store above to change it.' : ''}`
            : 'No scorecard for this scope.'
        }
        right={<SourceTag dataset="DOMO - DRP Scorecards" />}
      >
        {scorecardSeries.length ? (
          <>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={scorecardSeries} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid stroke="#eef2f7" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickFormatter={monthShort}
                    tick={{ fontSize: 10, fill: '#7C828D' }}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                    minTickGap={16}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={scoreDomain}
                    tick={{ fontSize: 10, fill: '#7C828D' }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}
                    labelFormatter={(m) => monthLabel(m as string)}
                    formatter={(v: number) => [v.toFixed(1), 'Score']}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    name="DRP score"
                    stroke={ACTUAL}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  {tierChanges.map((t) => (
                    <ReferenceDot
                      key={t.month}
                      x={t.month}
                      y={t.score}
                      r={4}
                      fill={t.worse ? WORSE : BETTER}
                      stroke="#ffffff"
                      strokeWidth={1}
                      ifOverflow="extendDomain"
                      label={{ value: t.to, position: 'top', fontSize: 9, fill: t.worse ? WORSE : BETTER }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            {tierChanges.length ? (
              <ul className="mt-2 flex flex-col gap-1 text-xs text-ink">
                {tierChanges.map((t) => (
                  <li key={t.month} className="flex items-center gap-2">
                    <span className="tnum text-muted">{monthLabel(t.month)}</span>
                    <span aria-hidden style={{ color: t.worse ? WORSE : BETTER }}>{t.worse ? '▼' : '▲'}</span>
                    <span>
                      moved from {t.from} to {t.to}
                      {t.worse ? ' - a step down that puts assignments at risk' : ' - an improvement'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted">Tier held steady across the window.</p>
            )}
          </>
        ) : (
          <EmptyState title="No scorecard history for this carrier and store" />
        )}
      </Panel>

      {/* Assignment volume vs forecast --------------------------------------- */}
      <Panel
        title="Assignment volume vs forecast"
        subtitle={`${carrier.name} - ${effectiveStoreId === 'all' ? 'all stores aggregated' : storeById(data, effectiveStoreId)?.name ?? effectiveStoreId}.`}
        right={<SourceTag dataset="BDAP - DRP Assignments" />}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">This month:</span>
          <span className="tnum font-medium text-ink">{volNow ? int(volNow.actual) : '-'} actual</span>
          <span className="text-muted">vs</span>
          <span className="tnum text-muted">{volNow ? int(volNow.forecast) : '-'} forecast</span>
          <span className="text-muted">·</span>
          <span className="tnum font-medium" style={{ color: volGapUnits < 0 ? WORSE : BETTER }}>
            gap {volGapUnits >= 0 ? '+' : ''}{int(volGapUnits)} units
          </span>
          {volGapPct != null && <Variance pct={volGapPct} />}
        </div>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={volumeSeries} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid stroke="#eef2f7" vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={monthShort}
                tick={{ fontSize: 10, fill: '#7C828D' }}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
                minTickGap={16}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(v) => int(v)}
                tick={{ fontSize: 10, fill: '#7C828D' }}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}
                labelFormatter={(m) => monthLabel(m as string)}
                formatter={(v: number, name) => [int(v), name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="actual" name="Assignments" stroke={ACTUAL} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="forecast" name="Forecast" stroke={FORECAST} strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <h3 className="mt-4 mb-1.5 text-2xs font-semibold uppercase tracking-wide text-muted">
          Anomalies flagged ({anomalies.length})
        </h3>
        {anomalies.length ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Store</th>
                  <th className="text-right">Actual</th>
                  <th className="text-right">Forecast</th>
                  <th>What happened</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map((v) => (
                  <tr key={`${v.storeId}-${v.month}`}>
                    <td className="tnum whitespace-nowrap">{monthLabel(v.month)}</td>
                    <td className="whitespace-nowrap">
                      <Link className="text-accent hover:underline" to={`/store/${v.storeId}`}>
                        {storeById(data, v.storeId)?.name ?? v.storeId}
                      </Link>
                    </td>
                    <td className="num">{int(v.assignmentActual)}</td>
                    <td className="num text-muted">{int(v.assignmentForecast)}</td>
                    <td className="text-ink">{v.anomalyNote}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted">No assignment anomalies flagged for this carrier in the current scope.</p>
        )}
      </Panel>

      {/* Driver comparison --------------------------------------------------- */}
      <Panel
        title="Scorecard driver breakdown - two carriers, one store"
        subtitle="Carriers weight the same store differently. Compare what each one rewards so a plan targets the carrier that matters most for this store's volume."
        right={<SourceTag dataset="DOMO - DRP Scorecards" />}
      >
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Store">
            <Select
              aria-label="Comparison store"
              value={cmpStoreId}
              onChange={(v) => {
                setCmpStoreId(v);
                setCmpAId('');
                setCmpBId('');
              }}
              options={cmpStoreOptions}
            />
          </Field>
          <Field label="Carrier A">
            <Select
              aria-label="Carrier A"
              value={cmpA}
              onChange={setCmpAId}
              options={cmpStoreCarriers.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>
          <Field label="Carrier B">
            <Select
              aria-label="Carrier B"
              value={cmpB}
              onChange={setCmpBId}
              options={cmpStoreCarriers.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>
        </div>

        {cmpScA && cmpScB ? (
          <>
            {aTop && bTop && (
              <p className="mb-3 text-sm text-ink">
                <span className="font-medium">{clientById(data, cmpA)?.name}</span> weights{' '}
                <span className="font-medium">{aTop.name}</span> most ({pct(aTop.weightPct, 0)}), while{' '}
                <span className="font-medium">{clientById(data, cmpB)?.name}</span> weights{' '}
                <span className="font-medium">{bTop.name}</span> most ({pct(bTop.weightPct, 0)}). The store's value on
                each is the same number; only what each carrier rewards differs.
              </p>
            )}
            <div className="mb-2 flex flex-wrap items-center gap-4 text-2xs text-muted">
              <span>
                {clientById(data, cmpA)?.name}: <TierBadge tier={cmpScA.tier} /> · score {cmpScA.score.toFixed(1)}
              </span>
              <span>
                {clientById(data, cmpB)?.name}: <TierBadge tier={cmpScB.tier} /> · score {cmpScB.score.toFixed(1)}
              </span>
              <Link className="text-accent hover:underline" to={`/store/${cmpStoreId}`}>
                Open {storeById(data, cmpStoreId)?.name}
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th rowSpan={2} className="align-bottom">Driver</th>
                    <th colSpan={3} className="text-center">{clientById(data, cmpA)?.name}</th>
                    <th colSpan={3} className="text-center">{clientById(data, cmpB)?.name}</th>
                  </tr>
                  <tr>
                    <th className="text-right">Weight</th>
                    <th className="text-right">Store</th>
                    <th className="text-right">Target</th>
                    <th className="text-right">Weight</th>
                    <th className="text-right">Store</th>
                    <th className="text-right">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {cmpScA.drivers.map((da, i) => {
                    const db = cmpScB.drivers.find((d) => d.name === da.name) ?? cmpScB.drivers[i];
                    const aIsTop = da.weightPct === aMaxW;
                    const bIsTop = db.weightPct === bMaxW;
                    return (
                      <tr key={da.name}>
                        <td className="font-medium text-ink">{da.name}</td>
                        <td className={`num ${aIsTop ? 'font-semibold text-accent' : ''}`}>{pct(da.weightPct, 0)}</td>
                        <td className={`num ${da.storeValue < da.carrierTarget ? 'text-bad-text' : 'text-ink'}`}>{da.storeValue.toFixed(1)}</td>
                        <td className="num text-muted">{da.carrierTarget.toFixed(1)}</td>
                        <td className={`num ${bIsTop ? 'font-semibold text-accent' : ''}`}>{pct(db.weightPct, 0)}</td>
                        <td className={`num ${db.storeValue < db.carrierTarget ? 'text-bad-text' : 'text-ink'}`}>{db.storeValue.toFixed(1)}</td>
                        <td className="num text-muted">{db.carrierTarget.toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-1.5 text-2xs text-muted">
              Highest-weighted driver per carrier shown in teal. A store value below the carrier's target is shown in
              red - that is where the store loses points with that carrier.
            </p>
          </>
        ) : (
          <EmptyState title="Pick two carriers that both score this store" />
        )}
      </Panel>

      {/* Sales asks ---------------------------------------------------------- */}
      <Panel
        title={`Sales asks against ${carrier.name}`}
        subtitle="Requests raised to this carrier from store action plans, with current status."
      >
        {carrierAsks.length ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Store</th>
                  <th>Raised</th>
                  <th>By</th>
                  <th>Status</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {carrierAsks.map(({ ask, storeId: sid }) => (
                  <tr key={ask.id}>
                    <td className="max-w-md text-ink">{ask.request}</td>
                    <td className="whitespace-nowrap">
                      <Link className="text-accent hover:underline" to={`/store/${sid}`}>
                        {storeById(data, sid)?.name ?? sid}
                      </Link>
                    </td>
                    <td className="tnum whitespace-nowrap text-muted">{dateLabel(ask.raisedOn)}</td>
                    <td className="whitespace-nowrap text-muted">{ask.raisedBy}</td>
                    <td><SalesAskBadge status={ask.status} /></td>
                    <td className="text-muted">{ask.outcome ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted">No sales asks recorded against this carrier.</p>
        )}
      </Panel>
    </div>
  );
}
