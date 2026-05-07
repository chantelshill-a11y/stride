/**
 * Client-side Tracker Curator.
 *
 * The original curator (agents/tracker-curator.ts) was deterministic logic
 * wrapped in event emission. The client orchestrator runs the deterministic
 * part directly — no API call needed — and emits the same trace events via
 * the orchestrator's onEvent callback for UI consistency.
 *
 * Logic mirrors agents/tracker-curator.ts exactly; keeping this file in
 * sync with that one is cheap and intentional (one source of truth for
 * the math, two host environments).
 */

import type {
  ActionItem,
  AgentEvent,
  BriefArtifact,
  HistoryEntry,
  MeetingArtifact,
  Risk,
  SprintBoard,
  TrackerState,
  Workstream,
} from '../../agents/shared/types';
import type { ActionTrackerOutput } from '../../agents/action-tracker';
import type { RiskDetectiveOutput } from '../../agents/risk-detective';

export interface CuratorInput {
  prior: TrackerState;
  riskDetective?: RiskDetectiveOutput;
  actionTracker?: ActionTrackerOutput;
  sprintBoard?: SprintBoard;
  artifact?:
    | { kind: 'morning-brief'; brief: BriefArtifact }
    | { kind: 'meeting-artifact'; meeting: MeetingArtifact };
}

export interface CuratorOutput {
  next: TrackerState;
  summary: string;
  diff: {
    addedRisks: number;
    updatedRisks: number;
    agedOutRisks: number;
    addedActionItems: number;
    updatedActionItems: number;
    workstreamsChanged: number;
  };
}

export function curate(input: CuratorInput): CuratorOutput {
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  const next: TrackerState = JSON.parse(JSON.stringify(input.prior));
  let addedRisks = 0;
  let updatedRisks = 0;
  let agedOutRisks = 0;
  let addedActionItems = 0;
  let updatedActionItems = 0;

  if (input.riskDetective) {
    for (const newR of input.riskDetective.newRisks) {
      const id = `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const r: Risk = {
        id,
        title: newR.title,
        severity: newR.severity,
        status: newR.status,
        owner: newR.owner,
        workstreamId: newR.workstreamId,
        source: { kind: 'agent', ref: 'risk-detective' },
        firstSeen: today,
        lastSeen: today,
        notes: newR.notes,
      };
      next.risks.push(r);
      addedRisks++;
    }
    for (const upd of input.riskDetective.updates) {
      const r = next.risks.find((x) => x.id === upd.id);
      if (!r) continue;
      if (upd.status) r.status = upd.status;
      if (upd.severity) r.severity = upd.severity;
      if (upd.notes) r.notes = upd.notes;
      r.lastSeen = today;
      updatedRisks++;
    }
    for (const id of input.riskDetective.agedOut) {
      const r = next.risks.find((x) => x.id === id);
      if (!r) continue;
      if (r.status !== 'aged-out' && r.status !== 'resolved') {
        r.status = 'aged-out';
        agedOutRisks++;
      }
    }
  }

  if (input.actionTracker) {
    for (const newA of input.actionTracker.newItems) {
      const id = `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const a: ActionItem = {
        id,
        title: newA.title,
        owner: newA.owner,
        dueDate: newA.dueDate,
        status: 'open',
        source: { kind: 'agent', ref: newA.sourceRef },
        createdAt: nowIso,
      };
      next.actionItems.push(a);
      addedActionItems++;
    }
    for (const upd of input.actionTracker.statusUpdates) {
      const a = next.actionItems.find((x) => x.id === upd.id);
      if (!a) continue;
      a.status = upd.status;
      updatedActionItems++;
    }
  }

  let workstreamsChanged = 0;
  for (const ws of next.workstreams) {
    const newRag = recomputeRag(ws, next.risks, input.sprintBoard);
    if (newRag.rag !== ws.rag || newRag.rationale !== ws.rationale) {
      ws.rag = newRag.rag;
      ws.rationale = newRag.rationale;
      ws.lastUpdated = today;
      workstreamsChanged++;
    }
  }

  if (input.artifact) {
    const id = `h-${Date.now().toString(36)}`;
    const entry: HistoryEntry =
      input.artifact.kind === 'morning-brief'
        ? {
            id,
            kind: 'morning-brief',
            ts: nowIso,
            summary: input.artifact.brief.yesterdayProgress.slice(0, 140),
            artifact: input.artifact.brief,
          }
        : {
            id,
            kind: 'meeting-artifact',
            ts: nowIso,
            summary: `Meeting: ${input.artifact.meeting.meetingTitle}`,
            artifact: input.artifact.meeting,
          };
    next.history.unshift(entry);
    next.history = next.history.slice(0, 50);
  }

  next.updatedAt = nowIso;

  const summary = `Tracker updated: +${addedRisks} risks, ${updatedRisks} updated, ${agedOutRisks} aged out; +${addedActionItems} action items, ${updatedActionItems} updated; ${workstreamsChanged} workstream RAGs changed.`;

  return {
    next,
    summary,
    diff: {
      addedRisks,
      updatedRisks,
      agedOutRisks,
      addedActionItems,
      updatedActionItems,
      workstreamsChanged,
    },
  };
}

function recomputeRag(
  ws: Workstream,
  risks: Risk[],
  sprintBoard: SprintBoard | undefined,
): { rag: Workstream['rag']; rationale: string } {
  const wsRisks = risks.filter(
    (r) => r.workstreamId === ws.id && r.status !== 'resolved' && r.status !== 'aged-out',
  );
  const hasHigh = wsRisks.some((r) => r.severity === 'high');
  const hasMedium = wsRisks.some((r) => r.severity === 'medium');

  let blockedCount = 0;
  let inFlight = 0;
  if (sprintBoard) {
    for (const item of sprintBoard.items) {
      if (item.workstreamId !== ws.id) continue;
      if (item.status === 'blocked') blockedCount++;
      if (item.status === 'in-progress' || item.status === 'review') inFlight++;
    }
  }

  if (hasHigh || blockedCount >= 2) {
    return {
      rag: 'red',
      rationale: hasHigh
        ? `High-severity open risk on this workstream${blockedCount ? ` plus ${blockedCount} blocked items` : ''}.`
        : `${blockedCount} items blocked on this workstream.`,
    };
  }
  if (hasMedium || blockedCount === 1) {
    return {
      rag: 'amber',
      rationale: hasMedium
        ? `Medium-severity open risk on this workstream${blockedCount ? ` plus ${blockedCount} blocked item(s)` : ''}.`
        : `${blockedCount} item(s) blocked.`,
    };
  }
  return {
    rag: 'green',
    rationale: `${inFlight} item(s) in flight, no open material risks.`,
  };
}

/** Emits the same trace events the server-side curator would, given the diff. */
export function emitCuratorEvents(
  runId: string,
  output: CuratorOutput,
  onEvent: (e: AgentEvent) => void,
): void {
  const ts = Date.now();
  onEvent({ type: 'agent:queued', runId, agent: 'tracker-curator', ts });
  onEvent({ type: 'agent:start', runId, agent: 'tracker-curator', ts });
  onEvent({ type: 'tracker:updated', runId, summary: output.summary, ts });
  onEvent({
    type: 'agent:done',
    runId,
    agent: 'tracker-curator',
    output: { agent: 'tracker-curator', body: output, confidence: 1 },
    ts,
  });
}
