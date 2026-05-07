/**
 * Meeting Mode workflow (Workflow B).
 *
 * Input: a meeting transcript (and optional title).
 * Output: MeetingArtifact — action items, three tailored summaries, risk
 * register entries, suggested follow-up invites, ticket drafts.
 *
 * Sequential gate cadence so the user processes one decision at a time.
 */

import { gate, GateRejected } from './shared/hitl';
import { emit, type Run } from './shared/trace';
import { loadTracker, saveTracker } from './shared/tracker';
import { getAdapter } from './shared/integrations/registry';
import type { MeetingArtifact, Risk } from './shared/types';
import { runActionTracker, type ActionTrackerOutput } from './action-tracker';
import { runRiskDetective, type RiskDetectiveOutput } from './risk-detective';
import { runMeetingSummarizer, type MeetingSummarizerOutput } from './meeting-summarizer';
import { runReviewerAnalyst } from './reviewer-analyst';
import { runTrackerCurator, type CuratorOutput } from './tracker-curator';
import { syntheticTranscript } from '../fixtures/synthetic-project/index';
import { createNote, meetingArtifactToMarkdown } from './shared/notes';

export interface MeetingModeInput {
  transcript?: string;
  meetingTitle?: string;
}

export async function runMeetingMode(run: Run, input: MeetingModeInput): Promise<void> {
  const transcript = input.transcript?.trim() || syntheticTranscript;
  const meetingTitle = input.meetingTitle ?? 'Northridge Phase 2 — Sprint 4 mid-sprint check';

  emit(run, {
    type: 'run:plan',
    runId: run.runId,
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
    emit(run, { type: 'agent:queued', runId: run.runId, agent: a, ts: Date.now() });
  }

  const tracker0 = await loadTracker();
  const sprintBoard = await getAdapter('synthetic').fetch('sprint-board', {});

  // 1) Action Tracker (transcript) + Reviewer + gate.
  const actions = await runActionTracker(run, { tracker: tracker0, transcript });
  const actionsCritique = await runReviewerAnalyst(
    run,
    'action-tracker',
    actions,
    `Source: meeting transcript "${meetingTitle}". Existing tracker action items were provided.`,
  );
  let approvedActions: ActionTrackerOutput;
  try {
    approvedActions = await gate<ActionTrackerOutput>(run, {
      kind: actionsCritique.verdict === 'block' ? 'low-confidence-escalation' : 'between-agents',
      title: 'Review action items',
      description: 'Action items extracted from the transcript. Edit owners or due dates as needed.',
      agent: 'action-tracker',
      payload: actions.body,
      reviewerCritique: actionsCritique,
    });
  } catch (err) {
    if (err instanceof GateRejected) return endRunRejected(run);
    throw err;
  }

  // 2) Risk Detective (transcript) + Reviewer + gate.
  const risk = await runRiskDetective(run, { tracker: tracker0, transcript });
  const riskCritique = await runReviewerAnalyst(
    run,
    'risk-detective',
    risk,
    `Source: meeting transcript "${meetingTitle}". Existing tracker risks were provided.`,
  );
  let approvedRisk: RiskDetectiveOutput;
  try {
    approvedRisk = await gate<RiskDetectiveOutput>(run, {
      kind: riskCritique.verdict === 'block' ? 'low-confidence-escalation' : 'between-agents',
      title: 'Review risk delta',
      description: 'Risks evidenced in the transcript. Edit severity or notes if needed.',
      agent: 'risk-detective',
      payload: risk.body,
      reviewerCritique: riskCritique,
    });
  } catch (err) {
    if (err instanceof GateRejected) return endRunRejected(run);
    throw err;
  }

  // 3) Curator pre-pass so the summarizer sees the post-approval risk view.
  const curator = await runTrackerCurator(run, {
    prior: tracker0,
    riskDetective: approvedRisk,
    actionTracker: approvedActions,
    sprintBoard,
  });
  const curated = curator.body as CuratorOutput;
  const visibleRisks: Risk[] = curated.next.risks.filter(
    (r) => r.status === 'open' || r.status === 'mitigating',
  );

  // 4) Summarizer + Reviewer + gate.
  const summary = await runMeetingSummarizer(run, {
    transcript,
    actions: approvedActions,
    risks: visibleRisks,
    meetingTitle,
  });
  const summaryCritique = await runReviewerAnalyst(
    run,
    'comms-tailor',
    summary,
    `Inputs were the transcript, ${approvedActions.newItems.length} action items, and ${visibleRisks.length} risks.`,
  );
  let approvedSummary: MeetingSummarizerOutput;
  try {
    approvedSummary = await gate<MeetingSummarizerOutput>(run, {
      kind: summaryCritique.verdict === 'block' ? 'low-confidence-escalation' : 'between-agents',
      title: 'Review tailored summaries',
      description: 'Team / exec / client versions. Edit any version before publishing.',
      agent: 'comms-tailor',
      payload: summary.body,
      reviewerCritique: summaryCritique,
    });
  } catch (err) {
    if (err instanceof GateRejected) return endRunRejected(run);
    throw err;
  }

  // 5) Deterministic follow-ups + ticket drafts from approved action items.
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

  // 6) Final-publish gate on the assembled artifact.
  const today = new Date().toISOString().slice(0, 10);
  const newActionsCount = approvedActions.newItems.length;
  const recentlyAddedActions =
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
      (r) => r.source.kind === 'agent' && r.source.ref === 'risk-detective' && r.firstSeen === today,
    ),
    followUpInvites,
    ticketDrafts,
  };

  let publishedArtifact: MeetingArtifact;
  try {
    publishedArtifact = await gate<MeetingArtifact>(run, {
      kind: 'final-publish',
      title: 'Publish meeting artifacts',
      description:
        'Final review of the assembled meeting artifacts. Approving will commit changes to the Status Tracker and archive this artifact to history.',
      payload: meetingArtifact,
    });
  } catch (err) {
    if (err instanceof GateRejected) return endRunRejected(run);
    throw err;
  }

  // 7) Curator second pass to attach this artifact to history, then save.
  const finalCurator = await runTrackerCurator(run, {
    prior: curated.next,
    sprintBoard,
    artifact: { kind: 'meeting-artifact', meeting: publishedArtifact },
  });
  const finalCurated = finalCurator.body as CuratorOutput;
  await saveTracker(finalCurated.next);

  // 8) Auto-save a clean markdown note from the artifact so it shows up under
  //    /notes for review, edit, and Word/calendar export.
  const linkedHistory = finalCurated.next.history[0];
  await createNote({
    title: meetingTitle,
    date: today,
    body: meetingArtifactToMarkdown(publishedArtifact),
    source: 'meeting-mode',
    linkedArtifactId: linkedHistory?.id,
  });

  emit(run, {
    type: 'tracker:updated',
    runId: run.runId,
    summary: `Note saved to /notes: "${meetingTitle}".`,
    ts: Date.now(),
  });
  emit(run, { type: 'run:done', runId: run.runId, meeting: publishedArtifact, ts: Date.now() });
}

function endRunRejected(run: Run): void {
  emit(run, { type: 'run:done', runId: run.runId, ts: Date.now() });
}
