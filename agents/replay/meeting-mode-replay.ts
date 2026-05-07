/**
 * Replay Meeting Mode — deterministic, no-Anthropic-key playback.
 */

import { gate, GateRejected } from '../shared/hitl';
import { emit, type Run } from '../shared/trace';
import { loadTracker, saveTracker } from '../shared/tracker';
import { getAdapter } from '../shared/integrations/registry';
import type {
  AgentName,
  AgentOutput,
  MeetingArtifact,
  ReviewCritique,
  Risk,
} from '../shared/types';
import type { ActionTrackerOutput } from '../action-tracker';
import type { RiskDetectiveOutput } from '../risk-detective';
import type { MeetingSummarizerOutput } from '../meeting-summarizer';
import { runTrackerCurator, type CuratorOutput } from '../tracker-curator';
import { syntheticTranscript } from '../../fixtures/synthetic-project/index';
import { createNote, meetingArtifactToMarkdown } from '../shared/notes';

const TICK = 80;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function replayDoer<T>(
  run: Run,
  agent: AgentName,
  toolCalls: Array<{ tool: string; input?: unknown }>,
  output: T,
  confidence: number,
): Promise<AgentOutput> {
  emit(run, { type: 'agent:start', runId: run.runId, agent, ts: Date.now() });
  await sleep(TICK * 2);

  for (const t of toolCalls) {
    emit(run, {
      type: 'agent:tool',
      runId: run.runId,
      agent,
      tool: t.tool,
      input: t.input ?? {},
      ts: Date.now(),
    });
    await sleep(TICK * 3);
    emit(run, {
      type: 'agent:tool-result',
      runId: run.runId,
      agent,
      tool: t.tool,
      output: '(replay) source data fetched',
      ts: Date.now(),
    });
    await sleep(TICK * 2);
  }

  const previewText = JSON.stringify(output).slice(0, 200);
  for (let i = 0; i < previewText.length; i += 24) {
    emit(run, {
      type: 'agent:token',
      runId: run.runId,
      agent,
      delta: previewText.slice(i, i + 24),
      ts: Date.now(),
    });
    await sleep(TICK / 2);
  }

  const submission: AgentOutput = { agent, body: output as unknown, confidence };
  emit(run, { type: 'agent:done', runId: run.runId, agent, output: submission, ts: Date.now() });
  return submission;
}

async function replayReview(
  run: Run,
  reviewedAgent: AgentName,
  critique: ReviewCritique,
): Promise<ReviewCritique> {
  emit(run, { type: 'agent:start', runId: run.runId, agent: 'reviewer-analyst', ts: Date.now() });
  await sleep(TICK * 3);
  emit(run, {
    type: 'agent:done',
    runId: run.runId,
    agent: 'reviewer-analyst',
    output: { agent: 'reviewer-analyst', body: critique, confidence: critique.confidence },
    ts: Date.now(),
  });
  emit(run, {
    type: 'reviewer:critique',
    runId: run.runId,
    targetAgent: reviewedAgent,
    critique,
    ts: Date.now(),
  });
  return critique;
}

const today = new Date().toISOString().slice(0, 10);

const ACTIONS: ActionTrackerOutput = {
  newItems: [
    {
      title: 'Send Sarah false-positive review packet by 10:30',
      owner: 'Rohan Mehta',
      dueDate: today,
      sourceRef: 'transcript:northridge-mid-sprint',
      evidence:
        'Chantel: "Rohan, send Sarah the FP review packet by 10:30 so she can scan it before our 11."',
    },
    {
      title: 'Send revised dry-run timeline before 2pm',
      owner: 'Megan O\'Brien',
      dueDate: today,
      sourceRef: 'transcript:northridge-mid-sprint',
      evidence:
        'Chantel: "Megan, send me the revised playbook timeline before two pm so I can put it in the exec readout."',
    },
    {
      title: 'Lock DocuSign sandbox install for Friday',
      owner: 'David Lambert',
      dueDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
      sourceRef: 'transcript:northridge-mid-sprint',
      evidence: 'David: "Sandbox creds Friday, production Tuesday after that."',
    },
    {
      title: 'Set Phase 2 ship confidence at 60% in exec readout',
      owner: 'Chantel Hill',
      dueDate: today,
      sourceRef: 'transcript:northridge-mid-sprint',
      evidence:
        'Chantel: "Me, set Phase 2 ship confidence at 60 percent in the readout, was 80 last week."',
    },
  ],
  statusUpdates: [],
};

const ACTIONS_CRITIQUE: ReviewCritique = {
  reviewedAgent: 'action-tracker',
  verdict: 'pass',
  confidence: 0.93,
  issues: [],
};

const RISKS: RiskDetectiveOutput = {
  newRisks: [],
  updates: [
    {
      id: 'r-1',
      severity: 'medium',
      notes:
        'Sarah confirmed earliest sign-off Monday in the mid-sprint check. Mitigation: ship FP review packet ahead of 11am threshold review.',
    },
    {
      id: 'r-3',
      severity: 'high',
      notes:
        'LoL F1 plateau confirmed in transcript by Rohan. Likely needs additional carve-out training data from Northridge legal.',
    },
  ],
  agedOut: [],
};

const RISKS_CRITIQUE: ReviewCritique = {
  reviewedAgent: 'risk-detective',
  verdict: 'pass',
  confidence: 0.9,
  issues: [],
};

const SUMMARIES: MeetingSummarizerOutput = {
  team:
    'Mid-sprint check covered the indemnification and LoL accuracy gating. Indemnification at 92.4% precision — needs Sarah\'s false-positive review (Monday) before another tuning pass. LoL plateaued at 0.91 F1; suspect carve-out language gap. Playbook slipping ~2 days; pulling Phase 3 scoping forward to compensate. May 22 Phase 2 close confidence revised down to 60%.',
  exec:
    'Phase 2 ship-date confidence revised from 80% to 60% based on the gating constraint surfaced today: Sarah\'s sign-off timing is earliest Monday, which compresses our revision cycle on indemnification before May 22. Two open dependencies in the risk register (attorney sign-off — mitigating; LoL training-set gap — open). DocuSign Insight feature confirmed for sandbox EOW, prod next Tuesday — feasible if validation closes on time. Ask: nothing required from leadership today; will re-baseline at Friday\'s readout.',
  client:
    'Helpful working session this morning. Our team aligned on the next two clauses through accuracy review and confirmed the workshop on May 13. We\'ve flagged a small dependency that may affect timing for the May 22 close — we\'ll have a clearer picture by Friday and update you in the next readout.',
};

const SUMMARIES_CRITIQUE: ReviewCritique = {
  reviewedAgent: 'comms-tailor',
  verdict: 'pass',
  confidence: 0.91,
  issues: [],
};

export async function replayMeetingMode(
  run: Run,
  input: { transcript?: string; meetingTitle?: string },
): Promise<void> {
  const transcript = input.transcript?.trim() || syntheticTranscript;
  const meetingTitle = input.meetingTitle ?? 'Northridge Phase 2 — Sprint 4 mid-sprint check';

  emit(run, {
    type: 'run:plan',
    runId: run.runId,
    plan: ['action-tracker', 'risk-detective', 'comms-tailor (summaries)', 'tracker-curator', 'final publish'],
    ts: Date.now(),
  });
  for (const a of ['action-tracker', 'risk-detective', 'comms-tailor', 'tracker-curator'] as const) {
    emit(run, { type: 'agent:queued', runId: run.runId, agent: a, ts: Date.now() });
    await sleep(TICK / 2);
  }

  const tracker0 = await loadTracker();
  const sprintBoard = await getAdapter('synthetic').fetch('sprint-board', {});

  // 1) Action Tracker
  await replayDoer(run, 'action-tracker', [], ACTIONS, 0.93);
  await replayReview(run, 'action-tracker', ACTIONS_CRITIQUE);

  let approvedActions: ActionTrackerOutput;
  try {
    approvedActions = await gate<ActionTrackerOutput>(run, {
      kind: 'between-agents',
      title: 'Review action items',
      description: 'Action items extracted from the transcript. Edit owners or due dates as needed.',
      agent: 'action-tracker',
      payload: ACTIONS,
      reviewerCritique: ACTIONS_CRITIQUE,
    });
  } catch (err) {
    if (err instanceof GateRejected) return endReplayRejected(run);
    throw err;
  }

  // 2) Risk Detective
  await replayDoer(run, 'risk-detective', [], RISKS, 0.9);
  await replayReview(run, 'risk-detective', RISKS_CRITIQUE);

  let approvedRisks: RiskDetectiveOutput;
  try {
    approvedRisks = await gate<RiskDetectiveOutput>(run, {
      kind: 'between-agents',
      title: 'Review risk delta',
      description: 'Risks evidenced in the transcript. Edit severity or notes if needed.',
      agent: 'risk-detective',
      payload: RISKS,
      reviewerCritique: RISKS_CRITIQUE,
    });
  } catch (err) {
    if (err instanceof GateRejected) return endReplayRejected(run);
    throw err;
  }

  // 3) Curator pre-pass.
  const curator = await runTrackerCurator(run, {
    prior: tracker0,
    riskDetective: approvedRisks,
    actionTracker: approvedActions,
    sprintBoard,
  });
  const curated = curator.body as CuratorOutput;
  const visibleRisks: Risk[] = curated.next.risks.filter(
    (r) => r.status === 'open' || r.status === 'mitigating',
  );

  // 4) Meeting Summarizer
  await replayDoer(run, 'comms-tailor', [], SUMMARIES, 0.91);
  await replayReview(run, 'comms-tailor', SUMMARIES_CRITIQUE);

  let approvedSummaries: MeetingSummarizerOutput;
  try {
    approvedSummaries = await gate<MeetingSummarizerOutput>(run, {
      kind: 'between-agents',
      title: 'Review tailored summaries',
      description: 'Team / exec / client versions. Edit any version before publishing.',
      agent: 'comms-tailor',
      payload: SUMMARIES,
      reviewerCritique: SUMMARIES_CRITIQUE,
    });
  } catch (err) {
    if (err instanceof GateRejected) return endReplayRejected(run);
    throw err;
  }

  // 5) Deterministic follow-ups + ticket drafts.
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
    summaries: approvedSummaries,
    riskEntries: visibleRisks.filter(
      (r) => r.source.kind === 'agent' && r.source.ref === 'risk-detective' && r.firstSeen === today,
    ),
    followUpInvites,
    ticketDrafts,
  };

  // 6) Final-publish gate.
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
    if (err instanceof GateRejected) return endReplayRejected(run);
    throw err;
  }

  // 7) Curator second pass + history + save.
  const finalCurator = await runTrackerCurator(run, {
    prior: curated.next,
    sprintBoard,
    artifact: { kind: 'meeting-artifact', meeting: publishedArtifact },
  });
  const finalCurated = finalCurator.body as CuratorOutput;
  await saveTracker(finalCurated.next);

  // 8) Auto-save a clean markdown note.
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

function endReplayRejected(run: Run): void {
  emit(run, { type: 'run:done', runId: run.runId, ts: Date.now() });
}
