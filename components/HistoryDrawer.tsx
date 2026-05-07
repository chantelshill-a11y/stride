'use client';

import type { HistoryEntry } from '../agents/shared/types';

export function HistoryDrawer({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-[color:var(--charcoal-mute)]">
        Past briefs and meeting artifacts will appear here.
      </p>
    );
  }
  return (
    <ul className="grid gap-2">
      {history.map((h) => (
        <li key={h.id} className="border border-[color:var(--rule)] p-3">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <span className="eyebrow mr-2">
                {h.kind === 'morning-brief' ? 'Morning brief' : 'Meeting'}
              </span>
              <span className="text-sm">{h.summary}</span>
            </div>
            <span className="text-xs text-[color:var(--charcoal-mute)] mono">
              {new Date(h.ts).toLocaleString()}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
