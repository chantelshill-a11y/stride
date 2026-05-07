'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Milestone, TrackerState } from '../agents/shared/types';
import { RAGBadge } from './RAGBadge';
import { RiskRegister } from './RiskRegister';
import { ActionItemsBoard } from './ActionItemsBoard';
import { HistoryDrawer } from './HistoryDrawer';
import { ExportPanel } from './ExportPanel';
import { ProductivityMetrics } from './ProductivityMetrics';
import { buildTrackerEvents } from './lib/proposed-events';

export function StatusTracker() {
  const [tracker, setTracker] = useState<TrackerState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/tracker', { cache: 'no-store' });
        if (!res.ok) throw new Error(`Tracker fetch failed: ${res.status}`);
        const data: TrackerState = await res.json();
        if (!cancelled) setTracker(data);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  if (error) {
    return (
      <div className="card card-pad rag-red border border-current">
        <p className="text-sm">Couldn’t load tracker: {error}</p>
      </div>
    );
  }
  if (!tracker) {
    return (
      <div className="card card-pad text-sm text-[color:var(--charcoal-mute)]">Loading…</div>
    );
  }

  return <TrackerView tracker={tracker} onReload={() => setReloadTick((t) => t + 1)} />;
}

function TrackerView({ tracker, onReload }: { tracker: TrackerState; onReload: () => void }) {
  const proposedEvents = useMemo(() => buildTrackerEvents(tracker), [tracker]);

  return (
    <div className="grid gap-10">
      <header className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3">
        <div>
          <p className="eyebrow">Project</p>
          <h2 className="serif text-2xl sm:text-3xl text-[color:var(--forest)]">{tracker.projectName}</h2>
        </div>
        <div className="text-xs text-[color:var(--charcoal-mute)] flex flex-wrap items-center gap-3">
          <span className="mono">updated {new Date(tracker.updatedAt).toLocaleString()}</span>
          <button className="btn btn-quiet" onClick={onReload}>
            Reload
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-2 gap-4">
        <ProductivityMetrics history={tracker.history} />
        <div className="card card-pad">
          <ExportPanel
            source={{ kind: 'tracker' }}
            proposedEvents={proposedEvents}
            sourceLabel={`${tracker.projectName} — open action items`}
            withTopDivider={false}
          />
        </div>
      </div>

      <section className="grid gap-4">
        <h3 className="serif text-2xl text-[color:var(--forest)]">Workstreams</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {tracker.workstreams.map((w) => (
            <div key={w.id} className="card card-pad grid gap-2">
              <div className="flex items-baseline justify-between">
                <span className="font-medium">{w.name}</span>
                <RAGBadge rag={w.rag} />
              </div>
              <p className="text-sm text-[color:var(--charcoal-soft)]">{w.rationale}</p>
              <div className="text-xs text-[color:var(--charcoal-mute)]">
                {w.owner ? `Owner: ${w.owner}` : 'No owner'} · last update {w.lastUpdated}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4">
        <h3 className="serif text-2xl text-[color:var(--forest)]">Milestones</h3>
        <MilestoneTimeline milestones={tracker.milestones} />
      </section>

      <section className="grid gap-4">
        <h3 className="serif text-2xl text-[color:var(--forest)]">Risks</h3>
        <RiskRegister risks={tracker.risks} />
      </section>

      <section className="grid gap-4">
        <h3 className="serif text-2xl text-[color:var(--forest)]">Action items</h3>
        <ActionItemsBoard items={tracker.actionItems} />
      </section>

      <section className="grid gap-4">
        <h3 className="serif text-2xl text-[color:var(--forest)]">History</h3>
        <HistoryDrawer history={tracker.history} />
      </section>
    </div>
  );
}

function MilestoneTimeline({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) {
    return <p className="text-sm text-[color:var(--charcoal-mute)]">No milestones tracked.</p>;
  }
  const STATUS_CLS: Record<Milestone['status'], string> = {
    shipped: 'rag-green',
    'in-flight': 'rag-amber',
    slipping: 'rag-red',
    planned: '',
  };
  return (
    <ol className="grid gap-2">
      {milestones.map((m) => (
        <li key={m.id} className="border border-[color:var(--rule)] p-3 flex items-baseline justify-between gap-3">
          <div>
            <div className="font-medium">{m.title}</div>
            <div className="text-xs text-[color:var(--charcoal-mute)] mono">{m.date}</div>
          </div>
          <span
            className={`text-xs uppercase tracking-widest border px-2 py-0.5 ${STATUS_CLS[m.status]}`}
          >
            {m.status}
          </span>
        </li>
      ))}
    </ol>
  );
}
