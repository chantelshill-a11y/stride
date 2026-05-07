/**
 * Tracker Curator (doer/curator).
 *
 * Reconciles approved doer outputs into the persistent Status Tracker.
 *
 * Unlike other doers, this one is largely deterministic — its job is mechanical:
 *   - apply newRisks / risk updates / agedOut decisions from Risk Detective
 *   - apply newItems / status updates from Action Tracker
 *   - recompute workstream RAG from updated risks + sprint-board state
 *   - touch updatedAt
 *   - append a HistoryEntry for the run
 *
 * Wrapping it in the "agent" interface keeps the trace panel and HITL story
 * uniform — and leaves the door open to swap in a model-driven version later
 * (e.g., for nuanced RAG calibration or risk re-titling).
 */

import { emit, type Run } from './shared/trace';
import type {
  ActionItem,
  AgentOutput,
  BriefArtifact,
  HistoryEntry,
  MeetingArtifact,
  Risk,
  TrackerState,
  Workstream,
} from './shared/types';
import type { RiskDetectiveOutput } from './risk-detective';
import type { ActionTrackerOutput } from './action-tracker';
import type { SprintBoard } from './shared/types';

export interface CuratorInput {
  prior: TrackerState;
  riskDetective?: RiskDetectiveOutput;
  actionTracker?: ActionTrackerOutput;
  sprintBoard?: SprintBoard;
  artifact?: { kind: 'morning-brief'; brief: BriefArtifact } | { kind: 'meeting-artifact'; meeting: MeetingArtifact };
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

export async function runTrackerCurator(run: Run, input: CuratorInput): Promise<AgentOutput> {
  emit(run, { type: 'agent:queued', runId: run.runId, agent: 'tracker-curator', ts: Date.now() });
  emit(run, { type: 'agent:start', runId: run.runId, agent: 'tracker-curator', ts: Date.now() });

  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  const next: TrackerState = JSON.parse(JSON.stringify(input.prior));
  let addedRisks = 0;
  let updatedRisks = 0;
  let agedOutRisks = 0;
  let addedActionItems = 0;
  let updatedActionItems = 0;

  // Apply risk detective output.
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

  // Apply action tracker output.
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

  // Recompute workstream RAG.
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

  // Append history entry.
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
    next.history = next.history.slice(0, 50); // cap
  }

  next.updatedAt = nowIso;

  const summary = `Tracker updated: +${addedRisks} risks, ${updatedRisks} updated, ${agedOutRisks} aged out; +${addedActionItems} action items, ${updatedActionItems} updated; ${workstreamsChanged} workstream RAGs changed.`;

  emit(run, { type: 'tracker:updated', runId: run.runId, summary, ts: Date.now() });

  const output: AgentOutput = {
    agent: 'tracker-curator',
    body: {
      next,
      summary,
      diff: { addedRisks, updatedRisks, agedOutRisks, addedActionItems, updatedActionItems, workstreamsChanged },
    } satisfies CuratorOutput,
    confidence: 1,
  };

  emit(run, { type: 'agent:done', runId: run.runId, agent: 'tracker-curator', output, ts: Date.now() });
  return output;
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
