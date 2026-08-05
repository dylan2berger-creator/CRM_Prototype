// Provenance tag - every number derived from mock data can name its source
// dataset and say how current that data is. Because provenance is one of the
// arguments the prototype makes.

import { useData } from '@/data/DataContext';
import { freshnessFor } from '@/data/provenance';
import { dateTimeLabel } from '@/utils/format';

export function SourceTag({ dataset }: { dataset: string }) {
  const { data } = useData();
  const fresh = freshnessFor(data, dataset);
  return (
    <span
      className="inline-flex items-center gap-1 text-2xs text-muted"
      title={
        fresh
          ? `Source: ${dataset}\nLast refreshed ${dateTimeLabel(fresh.lastRefreshed)}${fresh.certified ? ' · certified' : ' · not certified'}`
          : `Source: ${dataset}`
      }
    >
      <span aria-hidden>◦</span>
      <span className="underline decoration-dotted underline-offset-2">{dataset}</span>
      {fresh && !fresh.certified && <span className="text-warn-text">(uncertified)</span>}
    </span>
  );
}
