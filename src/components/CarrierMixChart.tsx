// Carrier mix + score-movement chart for the Carriers screen. Two modes:
//  - "share" view: each shop is a proportional strip whose segments are its
//    carriers, width = that carrier's share of the shop's repair orders.
//  - "aligned grid": carriers become fixed columns; a shop/carrier below the
//    RO-share threshold shows as an inactive dashed cell.
// Segments/cells are shaded by the carrier's 3-month DRP score change
// (blue = up, red = down, grey = flat).

import { Fragment, useState } from 'react';

export interface MixCarrier {
  name: string;
  sharePct: number;
  scoreChange: number; // points, current vs 3 months ago
}
export interface ShopMix {
  id: string;
  name: string;
  carriers: MixCarrier[]; // DRP carriers with RO volume, sorted by share desc
}

// Score change -> background tint. Alpha scales with magnitude.
function tint(v: number): string {
  if (v <= -1) return `rgba(186,26,26,${Math.min(0.14 + Math.abs(v) * 0.05, 0.5)})`; // bad #ba1a1a
  if (v >= 1) return `rgba(0,82,155,${Math.min(0.12 + v * 0.05, 0.42)})`; // accent #00529b
  return 'rgba(140,140,135,0.16)'; // flat
}
const fmtC = (v: number) => (v > 0 ? `+${v}` : `${v}`);
const OTHER = '#949494';

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-[11px] w-6 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

export function CarrierMixChart({ shops, columns }: { shops: ShopMix[]; columns: string[] }) {
  const [aligned, setAligned] = useState(false);
  const [thr, setThr] = useState(5);

  if (!shops.length) return <p className="text-xs text-muted">No shops with carrier volume in this scope.</p>;

  return (
    <div>
      {/* controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button className="btn" onClick={() => setAligned((a) => !a)}>
          {aligned ? 'Switch to share view' : 'Switch to aligned grid'}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <label htmlFor="mixthr" className="text-xs text-muted">
            Min RO share
          </label>
          <input
            id="mixthr"
            type="range"
            min={0}
            max={25}
            step={1}
            value={thr}
            onChange={(e) => setThr(Number(e.target.value))}
            className="w-28 accent-accent"
            aria-label="Minimum RO share"
          />
          <span className="w-8 text-xs font-medium tnum text-ink">{thr}%</span>
        </div>
      </div>

      {/* legend */}
      <div className="mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-muted">
        <Swatch color="rgba(186,26,26,0.45)" label="Score down" />
        <Swatch color="rgba(140,140,135,0.16)" label="Flat" />
        <Swatch color="rgba(0,82,155,0.40)" label="Up" />
        <span style={{ color: OTHER }}>
          {aligned
            ? 'Dashed cell means this carrier is below the threshold at that shop.'
            : "Segment width is that carrier's share of the shop's repair orders."}
        </span>
      </div>

      {aligned ? (
        <div className="overflow-x-auto">
          <div
            className="grid items-center gap-[3px]"
            style={{ gridTemplateColumns: `150px repeat(${columns.length}, minmax(54px, 1fr))` }}
          >
            <div />
            {columns.map((c) => (
              <div key={c} className="pb-1 text-center text-[11px] leading-tight text-muted">
                {c}
              </div>
            ))}
            {shops.map((shop) => (
              <Fragment key={shop.id}>
                <div className="truncate pr-1.5 text-[13px] text-ink" title={shop.name}>
                  {shop.name}
                </div>
                {columns.map((cn) => {
                  const c = shop.carriers.find((x) => x.name === cn);
                  if (!c || c.sharePct < thr) {
                    return (
                      <div
                        key={cn}
                        className="flex items-center justify-center rounded"
                        style={{ height: 34, border: '0.5px dashed #c9c9c9' }}
                      >
                        <span className="text-[11px]" style={{ color: OTHER }}>
                          –
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={cn}
                      title={`${cn} · ${c.sharePct}% of ROs · ${fmtC(c.scoreChange)} pts`}
                      className="flex cursor-default flex-col items-center justify-center rounded"
                      style={{ height: 34, background: tint(c.scoreChange) }}
                    >
                      <span className="text-[13px] leading-tight text-ink">{fmtC(c.scoreChange)}</span>
                      <span className="text-[10px] leading-tight" style={{ color: OTHER }}>
                        {c.sharePct}%
                      </span>
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {shops.map((shop) => {
            const keep = shop.carriers.filter((c) => c.sharePct >= thr);
            const rest = Math.max(0, 100 - keep.reduce((a, c) => a + c.sharePct, 0));
            return (
              <div key={shop.id} className="grid items-center gap-2" style={{ gridTemplateColumns: '150px 1fr' }}>
                <div className="truncate text-[13px] text-ink" title={shop.name}>
                  {shop.name}
                </div>
                <div className="flex gap-0.5" style={{ height: 34 }}>
                  {keep.map((c) => (
                    <div
                      key={c.name}
                      title={`${c.name} · ${c.sharePct}% of ROs · ${fmtC(c.scoreChange)} pts`}
                      className="flex cursor-default flex-col items-center justify-center overflow-hidden rounded-[3px]"
                      style={{ flex: c.sharePct, background: tint(c.scoreChange) }}
                    >
                      {c.sharePct >= 15 && (
                        <span className="whitespace-nowrap text-[11px] leading-tight text-muted">{c.name}</span>
                      )}
                      <span className="text-[12px] leading-tight text-ink">{fmtC(c.scoreChange)}</span>
                    </div>
                  ))}
                  {rest > 1 && (
                    <div
                      title={`All other carriers · ${rest}% of ROs`}
                      className="flex items-center justify-center rounded-[3px]"
                      style={{ flex: rest, background: 'rgba(140,140,135,0.08)' }}
                    >
                      <span className="text-[11px]" style={{ color: OTHER }}>
                        {rest >= 18 ? 'other ' : ''}
                        {rest}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
