/**
 * Orchestrator — plans which doer agents run, in what order, and assembles
 * their outputs (after reviewer critique + HITL gates) into the final brief.
 *
 * Phase 2 → runStatusOnlyDemo (Status Synthesizer only) — used while bringing
 * the SSE + gate plumbing online.
 *
 * Phase 4 → runMorningBrief (full doer roster + Tracker Curator + final brief).
 *
 * Phase 6 → runMeetingMode (transcript-driven artifacts).
 */

import { gate, GateRejected } from './shared/hitl';
import { emit, type Run } from './shared/trace';
import { loadTracker, saveTracker } from './shared/tracker';
import { getAdapter } from './shared/integrations/registry';
import type { ActionItem, BriefArtifact, Risk } from './shared/types';
import { runStatusSynthesizer, type StatusSynthesizerOutput } from './status-synthesizer';
import { runRiskDetective, type RiskDetectiveOutput } from './risk-detective';
import { runMeetingPrep, type MeetingPrepOutput } from './meeting-prep';
import { runActionTracker, type ActionTrackerOutput } from './action-tracker';
import { runCommsTailor, type CommsTailorOutput } from './comms-tailor';
import { runTrackerCurator, type CuratorOutput } from './tracker-curator';
import { runReviewerAnalyst } from './reviewer-analyst';

/** Phase 2 workflow — kept for early plumbing tests; retained for the eval harness. */
export async function runStatusOnlyDemo(run: Run): Promise<void> {
  emit(run, {
    type: 'run:plan',
    runId: run.runId,
    plan: ['status-synthesizer', 'reviewer-analyst', 'hitl: review status'],
    ts: Date.now(),
  });
  emit(run, { type: 'agent:queued', runId: run.runId, agent: 'status-synthesizer', ts: Date.now() });
  emit(run, { type: 'agent:queued', runId: run.runId, agent: 'reviewer-analyst', ts: Date.now() });

  const status = await runStatusSynthesizer(run);
  const critique = await runReviewerAnalyst(
    run,
    'status-synthesizer',
    status,
    'Source data was the synthetic Northridge engagement sprint board, recent threads, and recent mail.',
  );
  try {
    await gate<StatusSynthesizerOutput>(run, {
      kind: critique.verdict === 'block' ? 'low-confidence-escalation' : 'between-agents',
      title: 'Review status read',
      description: 'Approve to continue, edit to adjust before the next agent uses it, or reject to stop.',
      agent: 'status-synthesizer',
      payload: status.body,
      reviewerCritique: critique,
    });
    emit(run, { type: 'run:done', runId: run.runId, ts: Date.now() });
  } catch (err) {
    if (err instanceof GateRejected) {
      emit(run, { type: 'run:done', runId: run.runId, ts: Date.now() });
      return;
    }
    throw err;
  }
}

/**
 * Phase 4 workflow — full Morning Brief.
 *
 * Sequential doer order chosen so the user can process one HITL gate at a time:
 *   status → risks → meetings → action items → comms → final publish.
 */
export async function runMorningBrief(run: Run): Promise<void> {
  emit(run, {
    type: 'run:plan',
    runId: run.runId,
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
    emit(run, { type: 'agent:queued', runId: run.runId, agent: a, ts: Date.now() });
  }

  const tracker0 = await loadTracker();
  const sprintBoard = await getAdapter('synthetic').fetch('sprint-board', {});

  // 1) Status Synthesizer + Reviewer + gate.
  const status = await runStatusSynthesizer(run);
  const statusCritique = await runReviewerAnalyst(
    run,
    'status-synthesizer',
    status,
    'Source: Northridge sprint board + threads + mail.',
  );
  let approvedStatus: StatusSynthesizerOutput;
  try {
    approvedStatus = await gate<StatusSynthesizerOutput>(run, {
      kind: statusCritique.verdict === 'block' ? 'low-confidence-escalation' : 'between-agents',
      title: 'Review status read',
      description: 'This feeds Comms Tailor next. Edit factual issues now or accept.',
      agent: 'status-synthesizer',
      payload: status.body,
      reviewerCritique: statusCritique,
    });
  } catch (err) {
    if (err instanceof GateRejected) return endRunRejected(run);
    throw err;
  }

  // 2) Risk Detective + Reviewer + gate.
  const risk = await runRiskDetective(run, { tracker: tracker0 });
  const riskCritique = await runReviewerAnalyst(
    run,
    'risk-detective',
    risk,
    'Source: sprint board + threads + mail. Existing tracker risks were provided.',
  );
  let approvedRisk: RiskDetectiveOutput;
  try {
    approvedRisk = await gate<RiskDetectiveOutput>(run, {
      kind: riskCritique.verdict === 'block' ? 'low-confidence-escalation' : 'between-agents',
      title: 'Review risk delta',
      description: 'New risks, updates to existing risks, and risks the agent thinks have aged out.',
      agent: 'risk-detective',
      payload: risk.body,
      reviewerCritique: riskCritique,
    });
  } catch (err) {
    if (err instanceof GateRejected) return endRunRejected(run);
    throw err;
  }

  // 3) Meeting Prep + Reviewer + gate.
  const prep = await runMeetingPrep(run);
  const prepCritique = await runReviewerAnalyst(
    run,
    'meeting-prep',
    prep,
    'Source: today\'s calendar + per-meeting context from threads, mail, and docs.',
  );
  let approvedPrep: MeetingPrepOutput;
  try {
    approvedPrep = await gate<MeetingPrepOutput>(run, {
      kind: prepCritique.verdict === 'block' ? 'low-confidence-escalation' : 'between-agents',
      title: 'Review meeting prep',
      description: 'Per-meeting prep blocks for today. Edit talking points or attendees.',
      agent: 'meeting-prep',
      payload: prep.body,
      reviewerCritique: prepCritique,
    });
  } catch (err) {
    if (err instanceof GateRejected) return endRunRejected(run);
    throw err;
  }

  // 4) Action Tracker (standing mode) + Reviewer + gate.
  const actions = await runActionTracker(run, { tracker: tracker0 });
  const actionsCritique = await runReviewerAnalyst(
    run,
    'action-tracker',
    actions,
    'Source: threads + mail since 24h ago. Existing tracker action items were provided.',
  );
  let approvedActions: ActionTrackerOutput;
  try {
    approvedActions = await gate<ActionTrackerOutput>(run, {
      kind: actionsCritique.verdict === 'block' ? 'low-confidence-escalation' : 'between-agents',
      title: 'Review action items',
      description: 'New action items extracted from recent comms; status updates to existing items.',
      agent: 'action-tracker',
      payload: actions.body,
      reviewerCritique: actionsCritique,
    });
  } catch (err) {
    if (err instanceof GateRejected) return endRunRejected(run);
    throw err;
  }

  // 5) Curator runs first so Comms Tailor sees the post-approval risk view.
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

  // 6) Comms Tailor + Reviewer + gate.
  const comms = await runCommsTailor(run, {
    status: approvedStatus,
    risks: visibleRisks,
  });
  const commsCritique = await runReviewerAnalyst(
    run,
    'comms-tailor',
    comms,
    `Inputs were the approved status read and ${visibleRisks.length} open risks.`,
  );
  let approvedComms: CommsTailorOutput;
  try {
    approvedComms = await gate<CommsTailorOutput>(run, {
      kind: commsCritique.verdict === 'block' ? 'low-confidence-escalation' : 'between-agents',
      title: 'Review tailored drafts',
      description: 'Standup, exec, client, and skip-level drafts. Edit any version.',
      agent: 'comms-tailor',
      payload: comms.body,
      reviewerCritique: commsCritique,
    });
  } catch (err) {
    if (err instanceof GateRejected) return endRunRejected(run);
    throw err;
  }

  // 7) Assemble the final brief artifact.
  const todayMeetings = approvedPrep.meetings.map((m) => ({
    title: m.title,
    time: m.time,
    prepNotes: `${m.priorContext}\n\nTalking points:\n${m.talkingPoints.map((t) => `- ${t}`).join('\n')}`,
  }));
  const openActionItems: ActionItem[] = curated.next.actionItems.filter(
    (a) => a.status !== 'done',
  );

  const brief: BriefArtifact = {
    generatedAt: new Date().toISOString(),
    yesterdayProgress: approvedStatus.yesterdayProgress,
    todayMeetings,
    risks: visibleRisks,
    standupDraft: approvedComms.standup,
    execUpdateDraft: approvedComms.exec,
    openActionItems,
  };

  // 8) Final-publish HITL gate.
  let publishedBrief: BriefArtifact;
  try {
    publishedBrief = await gate<BriefArtifact>(run, {
      kind: 'final-publish',
      title: 'Publish morning brief',
      description:
        'Final review of the assembled brief. Approving will commit changes to the Status Tracker and archive this brief to history. (External sends, when configured, would be triggered here.)',
      payload: brief,
    });
  } catch (err) {
    if (err instanceof GateRejected) return endRunRejected(run);
    throw err;
  }

  // 9) Curator second pass to attach this brief to history, then save.
  const finalCurator = await runTrackerCurator(run, {
    prior: curated.next,
    sprintBoard,
    artifact: { kind: 'morning-brief', brief: publishedBrief },
  });
  const finalCurated = finalCurator.body as CuratorOutput;
  await saveTracker(finalCurated.next);

  emit(run, { type: 'run:done', runId: run.runId, brief: publishedBrief, ts: Date.now() });
}

function endRunRejected(run: Run): void {
  emit(run, { type: 'run:done', runId: run.runId, ts: Date.now() });
}
