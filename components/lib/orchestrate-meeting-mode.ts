/**
 * Client-side Meeting Mode orchestrator.
 *
 * Mirrors the server-side `runMeetingMode` for live mode. Replay mode still
 * uses the server-side orchestrator on /api/run.
 *
 * Per-agent calls go to /api/agent so each one stays well under Netlify's
 * 30s function streaming cap. HITL gates are plain JS Promises — no
 * /api/approve round-trip needed since the gate state lives in the
 * browser. Curator is a deterministic pure function ported from the server
 * (components/lib/curator.ts).
 *
 * Flow: Action Tracker + Risk Detective in parallel from the transcript →
 * reviewers in parallel → 2 sequential gates → curator pre-pass →
 * Meeting Summarizer → reviewer → gate → assemble MeetingArtifact →
 * final-publish gate → curator second pass with artifact → save tracker
 * (replace-all) → save markdown note via /api/notes.
 */

import type {
  ActionItem,
  AgentEvent,
  GateDecision,
  HITLGate,
  MeetingArtifact,
  Risk,
  SprintBoard,
  TrackerState,
} from '../../agents/shared/types';
import type { ActionTrackerOutput } from '../../agents/action-tracker';
import type { MeetingSummarizerOutput } from '../../agents/meeting-summarizer';
import type { RiskDetectiveOutput } from '../../agents/risk-detective';
import type { ReviewCritique } from '../../agents/shared/types';

import { runDoer, runMeetingSummarizer, runReviewer } from './agent-client';
import { curate, emitCuratorEvents } from './curator';

export interface MeetingOrchestratorContext {
  transcript: string;
  meetingTitle: string;
  onEvent: (e: AgentEvent) => void;
  /** Resolves with the user's decision when they click Approve / Edit / Reject. */
  openGate: (gate: HITLGate) => Promise<GateDecision>;
  signal?: AbortSignal;
}

export async function orchestrateMeetingMode(
  ctx: MeetingOrchestratorContext,
): Promise<MeetingArtifact | null> {
  const { transcript, meetingTitle, onEvent, openGate, signal } = ctx;
  const runId = `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  // run:start + plan + queue events to seed the trace panel.
  onEvent({ type: 'run:start', runId, mode: 'meeting-mode', ts: Date.now() });
  onEvent({
    type: 'run:plan',
    runId,
    plan: [
      'action-tracker',
      'risk-detective',
      'comms-tailor (summaries)',
      'tracker-curator',
      'final publish',
    ],
    ts: Date.now(),
  });
  for (const a of [
    'action-tracker',
    'risk-detective',
    'comms-tailor',
    'tracker-curator',
  ] as const) {
    onEvent({ type: 'agent:queued', runId, agent: a, ts: Date.now() });
  }

  // Load tracker state + sprint board once for the run.
  const [tracker, sprintBoard] = await Promise.all([
    fetch('/api/tracker', { signal, cache: 'no-store' }).then((r) => r.json() as Promise<TrackerState>),
    fetch('/api/source/sprint-board', { signal, cache: 'no-store' }).then(
      (r) => r.json() as Promise<SprintBoard>,
    ),
  ]);

  // Phase 1: Action Tracker + Risk Detective fan out in parallel — both read
  // the same transcript independently.
  const [actionsOut, riskOut] = await Promise.all([
    runDoer('action-tracker', { tracker, transcript }, onEvent, signal),
    runDoer('risk-detective', { tracker, transcript }, onEvent, signal),
  ]);

  // Phase 2: their reviewers also fan out in parallel.
  const [actionsCritique, riskCritique] = await Promise.all([
    runReviewer(
      'action-tracker',
      actionsOut,
      `Source: meeting transcript "${meetingTitle}". Existing tracker action items were provided.`,
      onEvent,
      signal,
    ),
    runReviewer(
      'risk-detective',
      riskOut,
      `Source: meeting transcript "${meetingTitle}". Existing tracker risks were provided.`,
      onEvent,
      signal,
    ),
  ]);

  // Phase 3: sequential HITL gates so the PM processes one decision at a time.
  const approvedActions = (await openLocalGate(
    runId,
    {
      kind: gateKindFor(actionsCritique),
      title: 'Review action items',
      description: 'Action items extracted from the transcript. Edit owners or due dates as needed.',
      agent: 'action-tracker',
      payload: actionsOut.body,
      reviewerCritique: actionsCritique,
    },
    onEvent,
    openGate,
  )) as ActionTrackerOutput | null;
  if (approvedActions === null) return endRunRejected(runId, onEvent);

  const approvedRisk = (await openLocalGate(
    runId,
    {
      kind: gateKindFor(riskCritique),
      title: 'Review risk delta',
      description: 'Risks evidenced in the transcript. Edit severity or notes if needed.',
      agent: 'risk-detective',
      payload: riskOut.body,
      reviewerCritique: riskCritique,
    },
    onEvent,
    openGate,
  )) as RiskDetectiveOutput | null;
  if (approvedRisk === null) return endRunRejected(runId, onEvent);

  // Phase 4: curator pre-pass so the summarizer sees the post-approval risk view.
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

  // Phase 5: Meeting Summarizer + Reviewer + gate.
  // Server routes meeting-summarizer under the same /api/agent endpoint;
  // its agent:done event is emitted under the 'comms-tailor' name.
  const summaryOut = await runMeetingSummarizer(
    { transcript, actions: approvedActions, risks: visibleRisks, meetingTitle },
    onEvent,
    signal,
  );
  const summaryCritique = await runReviewer(
    'comms-tailor',
    summaryOut,
    `Inputs were the transcript, ${approvedActions.newItems.length} action items, and ${visibleRisks.length} risks.`,
    onEvent,
    signal,
  );
  const approvedSummary = (await openLocalGate(
    runId,
    {
      kind: gateKindFor(summaryCritique),
      title: 'Review tailored summaries',
      description: 'Team / exec / client versions. Edit any version before publishing.',
      agent: 'comms-tailor',
      payload: summaryOut.body,
      reviewerCritique: summaryCritique,
    },
    onEvent,
    openGate,
  )) as MeetingSummarizerOutput | null;
  if (approvedSummary === null) return endRunRejected(runId, onEvent);

  // Phase 6: deterministic follow-ups + ticket drafts from approved action items.
  const followUpInvites = approvedActions.newItems
    .filter((a) => !a.dueDate || a.dueDate.length === 0)
    .slice(0, 5)
    .map((a) => ({
      title: `Follow-up: ${a.title}`,
      attendees: a.owner ? [a.owner] : [],
      rationale: `Action item from "${meetingTitle}" needs a working session — no due date set.`,
    }));

  const ticketDrafts = approvedActions.newItems
    .filter((a) => /implement|fix|build|ship|test|migrate|deploy|refactor/i.test(a.title))
    .slice(0, 5)
    .map((a) => ({
      title: a.title,
      body: `Source: ${meetingTitle}\nOwner: ${a.owner ?? 'unassigned'}\nDue: ${a.dueDate ?? 'unspecified'}\n\nEvidence: ${a.evidence}`,
    }));

  // Phase 7: assemble the artifact for the final-publish gate.
  const today = new Date().toISOString().slice(0, 10);
  const newActionsCount = approvedActions.newItems.length;
  const recentlyAddedActions: ActionItem[] =
    newActionsCount === 0
      ? []
      : curated.next.actionItems
          .filter((a) => a.source.kind === 'agent' && a.status !== 'done')
          .slice(-newActionsCount);

  const meetingArtifact: MeetingArtifact = {
    generatedAt: new Date().toISOString(),
    meetingTitle,
    actionItems: recentlyAddedActions,
    summaries: approvedSummary,
    riskEntries: visibleRisks.filter(
      (r) =>
        r.source.kind === 'agent' &&
        r.source.ref === 'risk-detective' &&
        r.firstSeen === today,
    ),
    followUpInvites,
    ticketDrafts,
  };

  const publishedArtifact = (await openLocalGate(
    runId,
    {
      kind: 'final-publish',
      title: 'Publish meeting artifacts',
      description:
        'Final review of the assembled meeting artifacts. Approving will commit changes to the Status Tracker and archive this artifact to history.',
      payload: meetingArtifact,
    },
    onEvent,
    openGate,
  )) as MeetingArtifact | null;
  if (publishedArtifact === null) return endRunRejected(runId, onEvent);

  // Phase 8: curator second pass to attach this artifact to history; save tracker.
  const finalCurated = curate({
    prior: curated.next,
    sprintBoard,
    artifact: { kind: 'meeting-artifact', meeting: publishedArtifact },
  });
  emitCuratorEvents(runId, finalCurated, onEvent);

  await fetch('/api/tracker', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'replace-all', payload: finalCurated.next }),
    signal,
  });

  // Phase 9: auto-save a clean markdown note from the artifact so it shows up
  // under /notes for review, edit, and Word/calendar export.
  const linkedHistory = finalCurated.next.history[0];
  await fetch('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: meetingTitle,
      date: today,
      body: meetingArtifactToMarkdown(publishedArtifact),
      source: 'meeting-mode',
      linkedArtifactId: linkedHistory?.id,
    }),
    signal,
  });

  onEvent({
    type: 'tracker:updated',
    runId,
    summary: `Note saved to /notes: "${meetingTitle}".`,
    ts: Date.now(),
  });
  onEvent({ type: 'run:done', runId, meeting: publishedArtifact, ts: Date.now() });
  return publishedArtifact;
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

/**
 * Render a MeetingArtifact as a clean markdown note body.
 *
 * Ported (verbatim) from agents/shared/notes.ts so it can run in the browser
 * without pulling tracker.ts (which has server-only imports). Keep in sync.
 */
function meetingArtifactToMarkdown(a: MeetingArtifact): string {
  const lines: string[] = [];
  lines.push(`# ${a.meetingTitle}`);
  lines.push('');
  lines.push(`*${new Date(a.generatedAt).toLocaleString()}*`);
  lines.push('');
  if (a.actionItems.length > 0) {
    lines.push('## Action items');
    lines.push('');
    for (const ai of a.actionItems) {
      const owner = ai.owner ? ` — ${ai.owner}` : '';
      const due = ai.dueDate ? ` (due ${ai.dueDate})` : '';
      lines.push(`- [ ] ${ai.title}${owner}${due}`);
    }
    lines.push('');
  }
  if (a.summaries) {
    lines.push('## Summaries');
    lines.push('');
    if (a.summaries.team) {
      lines.push('### Team');
      lines.push('');
      lines.push(a.summaries.team);
      lines.push('');
    }
    if (a.summaries.exec) {
      lines.push('### Exec');
      lines.push('');
      lines.push(a.summaries.exec);
      lines.push('');
    }
    if (a.summaries.client) {
      lines.push('### Client');
      lines.push('');
      lines.push(a.summaries.client);
      lines.push('');
    }
  }
  if (a.riskEntries.length > 0) {
    lines.push('## New risks');
    lines.push('');
    for (const r of a.riskEntries) {
      lines.push(`- **[${r.severity}]** ${r.title}${r.notes ? ` — ${r.notes}` : ''}`);
    }
    lines.push('');
  }
  if (a.followUpInvites.length > 0) {
    lines.push('## Follow-up invites');
    lines.push('');
    for (const f of a.followUpInvites) {
      lines.push(`- ${f.title}${f.attendees.length ? ` (${f.attendees.join(', ')})` : ''}`);
    }
    lines.push('');
  }
  if (a.ticketDrafts.length > 0) {
    lines.push('## Ticket drafts');
    lines.push('');
    for (const t of a.ticketDrafts) {
      lines.push(`- ${t.title}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}
