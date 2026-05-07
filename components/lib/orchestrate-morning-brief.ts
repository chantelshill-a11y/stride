/**
 * Client-side Morning Brief orchestrator.
 *
 * Replaces the server-side `runMorningBrief` for live mode (replay still
 * uses the server-side orchestrator on /api/run).
 *
 * Per-agent calls go to /api/agent so each one stays well under Netlify's
 * 30s function streaming cap. HITL gates are plain JS Promises — no
 * /api/approve round-trip needed since the gate state lives in the
 * browser. Curator is a deterministic pure function ported from the
 * server (components/lib/curator.ts).
 *
 * Wall-clock end-to-end: ~30-50s to first gate (4 doers + 4 reviewers
 * fan out in parallel), down from the 110s+ of the all-sequential
 * server-side version, plus the connection no longer dies at 30s.
 */

import type {
  ActionItem,
  AgentEvent,
  BriefArtifact,
  GateDecision,
  HITLGate,
  ReviewCritique,
  Risk,
  SprintBoard,
  TrackerState,
} from '../../agents/shared/types';
import type { ActionTrackerOutput } from '../../agents/action-tracker';
import type { CommsTailorOutput } from '../../agents/comms-tailor';
import type { MeetingPrepOutput } from '../../agents/meeting-prep';
import type { RiskDetectiveOutput } from '../../agents/risk-detective';
import type { StatusSynthesizerOutput } from '../../agents/status-synthesizer';

import { runDoer, runReviewer } from './agent-client';
import { curate, emitCuratorEvents } from './curator';

export interface OrchestratorContext {
  onEvent: (e: AgentEvent) => void;
  /** Resolves with the user's decision when they click Approve / Edit / Reject. */
  openGate: (gate: HITLGate) => Promise<GateDecision>;
  signal?: AbortSignal;
}

export async function orchestrateMorningBrief(
  ctx: OrchestratorContext,
): Promise<BriefArtifact | null> {
  const { onEvent, openGate, signal } = ctx;
  const runId = `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  // run:start + plan + queue events to seed the trace panel.
  onEvent({ type: 'run:start', runId, mode: 'morning-brief', ts: Date.now() });
  onEvent({
    type: 'run:plan',
    runId,
    plan: [
      'status-synthesizer',
      'risk-detective',
      'meeting-prep',
      'action-tracker',
      'comms-tailor',
      'tracker-curator',
      'final publish',
    ],
    ts: Date.now(),
  });
  for (const a of [
    'status-synthesizer',
    'risk-detective',
    'meeting-prep',
    'action-tracker',
    'comms-tailor',
    'tracker-curator',
  ] as const) {
    onEvent({ type: 'agent:queued', runId, agent: a, ts: Date.now() });
  }

  // Load tracker state + sprint board once for the run.
  const [tracker, sprintBoard] = await Promise.all([
    fetch('/api/tracker', { signal, cache: 'no-store' }).then((r) => r.json() as Promise<TrackerState>),
    fetch('/api/source/sprint-board', { signal, cache: 'no-store' }).then((r) => r.json() as Promise<SprintBoard>),
  ]);

  // Phase 1: four input doers fan out in parallel.
  const [statusOut, riskOut, prepOut, actionsOut] = await Promise.all([
    runDoer('status-synthesizer', {}, onEvent, signal),
    runDoer('risk-detective', { tracker }, onEvent, signal),
    runDoer('meeting-prep', {}, onEvent, signal),
    runDoer('action-tracker', { tracker }, onEvent, signal),
  ]);

  // Phase 2: their reviewers also fan out in parallel.
  const [statusCritique, riskCritique, prepCritique, actionsCritique] = await Promise.all([
    runReviewer(
      'status-synthesizer',
      statusOut,
      'Source: Northridge sprint board + threads + mail.',
      onEvent,
      signal,
    ),
    runReviewer(
      'risk-detective',
      riskOut,
      'Source: sprint board + threads + mail. Existing tracker risks were provided.',
      onEvent,
      signal,
    ),
    runReviewer(
      'meeting-prep',
      prepOut,
      "Source: today's calendar + per-meeting context from threads, mail, and docs.",
      onEvent,
      signal,
    ),
    runReviewer(
      'action-tracker',
      actionsOut,
      'Source: threads + mail since 24h ago. Existing tracker action items were provided.',
      onEvent,
      signal,
    ),
  ]);

  // Phase 3: sequential HITL gates so the PM processes one decision at a time.
  const approvedStatus = (await openLocalGate(
    runId,
    {
      kind: gateKindFor(statusCritique),
      title: 'Review status read',
      description: 'This feeds Comms Tailor next. Edit factual issues now or accept.',
      agent: 'status-synthesizer',
      payload: statusOut.body,
      reviewerCritique: statusCritique,
    },
    onEvent,
    openGate,
  )) as StatusSynthesizerOutput | null;
  if (approvedStatus === null) return endRunRejected(runId, onEvent);

  const approvedRisk = (await openLocalGate(
    runId,
    {
      kind: gateKindFor(riskCritique),
      title: 'Review risk delta',
      description: 'New risks, updates to existing risks, and risks the agent thinks have aged out.',
      agent: 'risk-detective',
      payload: riskOut.body,
      reviewerCritique: riskCritique,
    },
    onEvent,
    openGate,
  )) as RiskDetectiveOutput | null;
  if (approvedRisk === null) return endRunRejected(runId, onEvent);

  const approvedPrep = (await openLocalGate(
    runId,
    {
      kind: gateKindFor(prepCritique),
      title: 'Review meeting prep',
      description: 'Per-meeting prep blocks for today. Edit talking points or attendees.',
      agent: 'meeting-prep',
      payload: prepOut.body,
      reviewerCritique: prepCritique,
    },
    onEvent,
    openGate,
  )) as MeetingPrepOutput | null;
  if (approvedPrep === null) return endRunRejected(runId, onEvent);

  const approvedActions = (await openLocalGate(
    runId,
    {
      kind: gateKindFor(actionsCritique),
      title: 'Review action items',
      description: 'New action items extracted from recent comms; status updates to existing items.',
      agent: 'action-tracker',
      payload: actionsOut.body,
      reviewerCritique: actionsCritique,
    },
    onEvent,
    openGate,
  )) as ActionTrackerOutput | null;
  if (approvedActions === null) return endRunRejected(runId, onEvent);

  // Phase 4: curator (deterministic; runs in the browser).
  const curated = curate({
    prior: tracker,
    riskDetective: approvedRisk,
    actionTracker: approvedActions,
    sprintBoard,
  });
  emitCuratorEvents(runId, curated, onEvent);

  const visibleRisks: Risk[] = curated.next.risks.filter(
    (r) => r.status === 'open' || r.status === 'mitigating',
  );

  // Phase 5: Comms Tailor + Reviewer + gate.
  const commsOut = await runDoer(
    'comms-tailor',
    { status: approvedStatus, risks: visibleRisks },
    onEvent,
    signal,
  );
  const commsCritique = await runReviewer(
    'comms-tailor',
    commsOut,
    `Inputs were the approved status read and ${visibleRisks.length} open risks.`,
    onEvent,
    signal,
  );
  const approvedComms = (await openLocalGate(
    runId,
    {
      kind: gateKindFor(commsCritique),
      title: 'Review tailored drafts',
      description: 'Standup, exec, client, and skip-level drafts. Edit any version.',
      agent: 'comms-tailor',
      payload: commsOut.body,
      reviewerCritique: commsCritique,
    },
    onEvent,
    openGate,
  )) as CommsTailorOutput | null;
  if (approvedComms === null) return endRunRejected(runId, onEvent);

  // Phase 6: assemble brief.
  const todayMeetings = approvedPrep.meetings.map((m) => ({
    title: m.title,
    time: m.time,
    prepNotes: `${m.priorContext}\n\nTalking points:\n${m.talkingPoints.map((t) => `- ${t}`).join('\n')}`,
  }));
  const openActionItems: ActionItem[] = curated.next.actionItems.filter((a) => a.status !== 'done');

  const brief: BriefArtifact = {
    generatedAt: new Date().toISOString(),
    yesterdayProgress: approvedStatus.yesterdayProgress,
    todayMeetings,
    risks: visibleRisks,
    standupDraft: approvedComms.standup,
    execUpdateDraft: approvedComms.exec,
    openActionItems,
  };

  // Phase 7: final-publish HITL gate.
  const publishedBrief = (await openLocalGate(
    runId,
    {
      kind: 'final-publish',
      title: 'Publish morning brief',
      description:
        'Final review of the assembled brief. Approving will commit changes to the Status Tracker and archive this brief to history.',
      payload: brief,
    },
    onEvent,
    openGate,
  )) as BriefArtifact | null;
  if (publishedBrief === null) return endRunRejected(runId, onEvent);

  // Phase 8: curator second pass to attach this brief to history; save tracker.
  const finalCurated = curate({
    prior: curated.next,
    sprintBoard,
    artifact: { kind: 'morning-brief', brief: publishedBrief },
  });
  emitCuratorEvents(runId, finalCurated, onEvent);

  await fetch('/api/tracker', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'replace-all', payload: finalCurated.next }),
    signal,
  });

  onEvent({ type: 'run:done', runId, brief: publishedBrief, ts: Date.now() });
  return publishedBrief;
}

function gateKindFor(critique: ReviewCritique): HITLGate['kind'] {
  return critique.verdict === 'block' ? 'low-confidence-escalation' : 'between-agents';
}

function newGateId(): string {
  return `gate_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Open a HITL gate locally and await the user's decision.
 * Returns the resolved payload (the original or the user's edit), or
 * null if the user rejected — orchestrator interprets null as "stop run".
 */
async function openLocalGate(
  runId: string,
  spec: Omit<HITLGate, 'id'>,
  onEvent: (e: AgentEvent) => void,
  open: (gate: HITLGate) => Promise<GateDecision>,
): Promise<unknown> {
  const id = newGateId();
  const gate: HITLGate = { id, ...spec };
  onEvent({ type: 'gate:open', runId, gate, ts: Date.now() });
  const decision = await open(gate);
  onEvent({ type: 'gate:resolved', runId, gateId: id, decision, ts: Date.now() });
  if (decision.kind === 'reject') return null;
  if (decision.kind === 'edit') return decision.edited;
  return spec.payload;
}

function endRunRejected(runId: string, onEvent: (e: AgentEvent) => void): null {
  onEvent({ type: 'run:done', runId, ts: Date.now() });
  return null;
}
