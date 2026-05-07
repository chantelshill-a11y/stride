'use client';

import type { AgentEvent, AgentName, AgentState, ReviewCritique } from '../agents/shared/types';

interface AgentRow {
  name: AgentName;
  state: AgentState;
  toolCalls: Array<{ tool: string; ts: number }>;
  output?: unknown;
  critique?: ReviewCritique;
  errorMessage?: string;
}

const DESCRIPTORS: Record<AgentName, { displayName: string; role: string }> = {
  orchestrator: { displayName: 'Orchestrator', role: 'plans + assembles' },
  'status-synthesizer': { displayName: 'Status Synthesizer', role: 'doer' },
  'risk-detective': { displayName: 'Risk Detective', role: 'doer' },
  'meeting-prep': { displayName: 'Meeting Prep', role: 'doer' },
  'comms-tailor': { displayName: 'Comms Tailor', role: 'doer' },
  'action-tracker': { displayName: 'Action Tracker', role: 'doer' },
  'tracker-curator': { displayName: 'Tracker Curator', role: 'curator' },
  'reviewer-analyst': { displayName: 'Reviewer / Analyst', role: 'reviewer' },
};

export function deriveAgentRows(events: AgentEvent[]): AgentRow[] {
  const rows = new Map<AgentName, AgentRow>();
  const ensure = (name: AgentName): AgentRow => {
    let r = rows.get(name);
    if (!r) {
      r = { name, state: 'queued', toolCalls: [] };
      rows.set(name, r);
    }
    return r;
  };

  for (const e of events) {
    switch (e.type) {
      case 'agent:queued': ensure(e.agent).state = 'queued'; break;
      case 'agent:start': ensure(e.agent).state = 'running'; break;
      case 'agent:tool':
        ensure(e.agent).toolCalls.push({ tool: e.tool, ts: e.ts });
        break;
      case 'agent:done': {
        const r = ensure(e.agent);
        r.state = 'done';
        r.output = e.output.body;
        break;
      }
      case 'agent:error': {
        const r = ensure(e.agent);
        r.state = 'error';
        r.errorMessage = e.message;
        break;
      }
      case 'reviewer:critique': {
        const target = ensure(e.targetAgent);
        target.critique = e.critique;
        break;
      }
      case 'gate:open': {
        if (e.gate.agent) ensure(e.gate.agent).state = 'awaiting-review';
        break;
      }
      case 'gate:resolved': {
        // Find the agent whose gate this was — we approximate by the most recent awaiting agent
        for (const r of rows.values()) {
          if (r.state === 'awaiting-review') r.state = 'done';
        }
        break;
      }
    }
  }

  return Array.from(rows.values());
}

export function AgentTracePanel({ events }: { events: AgentEvent[] }) {
  const rows = deriveAgentRows(events);
  const trackerNotes = events
    .filter((e): e is Extract<AgentEvent, { type: 'tracker:updated' }> => e.type === 'tracker:updated')
    .map((e) => e.summary);

  if (rows.length === 0 && trackerNotes.length === 0) {
    return (
      <div className="card card-pad text-sm text-[color:var(--charcoal-mute)]">
        No agents yet. The trace will appear here as the run starts.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="card divide-y divide-[color:var(--rule)]">
        {rows.map((r) => (
          <AgentRowView key={r.name} row={r} />
        ))}
      </div>
      {trackerNotes.length > 0 && (
        <div className="card card-tight border-l-4 border-[color:var(--forest)]">
          <p className="eyebrow mb-1">Tracker updates</p>
          <ul className="text-sm text-[color:var(--charcoal-soft)] grid gap-0.5">
            {trackerNotes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AgentRowView({ row }: { row: AgentRow }) {
  const d = DESCRIPTORS[row.name];
  return (
    <div className="px-5 py-4 flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <span className="serif text-lg text-[color:var(--forest)]">{d.displayName}</span>
          <span className="eyebrow">{d.role}</span>
        </div>
        <StateBadge state={row.state} />
      </div>

      {row.toolCalls.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[color:var(--charcoal-mute)] mono">
          {row.toolCalls.map((t, i) => (
            <span key={i}>↳ {t.tool}</span>
          ))}
        </div>
      )}

      {row.critique && (
        <CritiquePill critique={row.critique} />
      )}

      {row.errorMessage && (
        <div className="text-xs rag-red border border-current p-2">{row.errorMessage}</div>
      )}
    </div>
  );
}

function StateBadge({ state }: { state: AgentState }) {
  const label = {
    queued: 'Queued',
    running: 'Running',
    'awaiting-review': 'Awaiting review',
    done: 'Done',
    error: 'Error',
  }[state];

  const cls = {
    queued: 'agent-state-queued',
    running: 'agent-state-running pulse',
    'awaiting-review': 'agent-state-awaiting',
    done: 'agent-state-done',
    error: 'agent-state-error',
  }[state];

  return <span className={`text-xs uppercase tracking-widest ${cls}`}>{label}</span>;
}

function CritiquePill({ critique }: { critique: ReviewCritique }) {
  const tone =
    critique.verdict === 'pass'
      ? 'border-[color:var(--forest)] text-[color:var(--forest)]'
      : critique.verdict === 'flag'
        ? 'rag-amber'
        : 'rag-red';

  return (
    <div className={`border ${tone} px-3 py-2 text-xs`}>
      <div className="flex items-baseline justify-between">
        <span className="uppercase tracking-widest font-medium">Reviewer: {critique.verdict}</span>
        <span className="mono">conf {(critique.confidence * 100).toFixed(0)}%</span>
      </div>
      {critique.issues.length > 0 && (
        <ul className="mt-1 list-disc list-inside space-y-0.5">
          {critique.issues.slice(0, 3).map((i, idx) => (
            <li key={idx}>
              <span className="uppercase tracking-wider mr-1">[{i.severity}]</span>
              {i.note}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
