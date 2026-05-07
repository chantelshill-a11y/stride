/**
 * Replay Morning Brief — deterministic, no-Anthropic-key playback.
 *
 * Visitors without an ANTHROPIC_API_KEY (and anyone hitting `/brief?demo=replay`)
 * see this instead of a live agent run. Same event types, same gates, same UI —
 * the only difference is that outputs are hand-authored against the synthetic
 * Northridge fixture and inter-event delays are scripted to feel realistic.
 *
 * The replay still pauses for HITL gates. The user actually approves, edits,
 * or rejects — the gate experience is real, only the LLM call is replaced.
 */

import { gate, GateRejected } from '../shared/hitl';
import { emit, type Run } from '../shared/trace';
import { loadTracker, saveTracker } from '../shared/tracker';
import { getAdapter } from '../shared/integrations/registry';
import type {
  ActionItem,
  AgentName,
  AgentOutput,
  BriefArtifact,
  ReviewCritique,
  Risk,
} from '../shared/types';
import type { StatusSynthesizerOutput } from '../status-synthesizer';
import type { RiskDetectiveOutput } from '../risk-detective';
import type { MeetingPrepOutput } from '../meeting-prep';
import type { ActionTrackerOutput } from '../action-tracker';
import type { CommsTailorOutput } from '../comms-tailor';
import { runTrackerCurator, type CuratorOutput } from '../tracker-curator';

// ───── timing ─────

const TICK = 80; // base ms between micro events
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ───── replay primitives ─────

async function replayDoer<T>(
  run: Run,
  agent: AgentName,
  toolCalls: Array<{ tool: string; input?: unknown }>,
  output: T,
  confidence: number,
  notes?: string,
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

  // Token-stream pacing so the trace feels alive even in replay.
  const previewText = JSON.stringify(output).slice(0, 240);
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

  const submission: AgentOutput = { agent, body: output as unknown, confidence, notes };
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

// ───── canonical Northridge outputs ─────

const STATUS: StatusSynthesizerOutput = {
  yesterdayProgress:
    'Term & Termination clause shipped to production at 96.8% precision. Indemnification + LoL accuracy gating in flight; bulk-action review awaiting copy.',
  velocity: { completed: 2, inProgress: 4, blocked: 1 },
  slipping: [
    {
      id: 'NRF-205',
      title: 'Attorney training playbook — Phase 2 handoff',
      reason: 'Northridge legal ops requested an additional FP review SOP walkthrough; ~2 days slip.',
    },
  ],
  onTrack: [
    { id: 'NRF-203', title: 'Term & Termination — ship to production' },
    { id: 'NRF-409', title: 'CSV import path validation' },
  ],
  observations: [
    'Phase 2 ship-date confidence dropped from 80% to 60% per Rohan based on FP review timing.',
    'DocuSign confirmed sandbox EOW, prod next Tuesday — feasible against May 22 if validation closes on time.',
    'LoL clause F1 plateau at 0.91 suggests training-set gap on carve-out language.',
  ],
};

const STATUS_CRITIQUE: ReviewCritique = {
  reviewedAgent: 'status-synthesizer',
  verdict: 'pass',
  confidence: 0.86,
  issues: [
    {
      severity: 'low',
      note: '"~2 days slip" is a paraphrase of Megan\'s thread; consider stating the source explicitly in the readout.',
    },
  ],
};

const RISKS_OUT: RiskDetectiveOutput = {
  newRisks: [],
  updates: [
    {
      id: 'r-1',
      severity: 'medium',
      notes:
        'Sarah confirmed earliest sign-off Monday. Mitigation: ship FP review packet ahead of 11am threshold review to compress turnaround.',
    },
  ],
  agedOut: [],
};

const RISKS_CRITIQUE: ReviewCritique = {
  reviewedAgent: 'risk-detective',
  verdict: 'pass',
  confidence: 0.91,
  issues: [],
};

const MEETING_PREP: MeetingPrepOutput = {
  meetings: [
    {
      id: 'cal-1',
      title: 'Northridge delivery standup',
      time: '09:30–09:45',
      attendees: ['Chantel Hill', 'David Lambert', 'Rohan Mehta', 'Megan O\'Brien'],
      agenda: 'Daily standup. Mid-sprint check pulled forward this week.',
      priorContext:
        'Yesterday the team flagged FP review timing as the gating constraint on Phase 2 close. Rohan working hard-negative mining; Megan pulling Phase 3 scoping forward.',
      talkingPoints: [
        'Confirm FP review packet ships to Sarah by 10:30',
        'Lock May 22 ship-date confidence at 60% for the exec readout',
        'Decide: pull NRF-210 (Phase 3 scoping) into this sprint or hold for Sprint 5',
      ],
    },
    {
      id: 'cal-2',
      title: 'Threshold review — Northridge clause models',
      time: '11:00–11:45',
      attendees: ['Chantel Hill', 'Rohan Mehta', 'Sarah Chen (Northridge)'],
      agenda:
        'Walk Sarah through indemnification + LoL precision/recall sweeps; align on production thresholds and false-positive review.',
      priorContext:
        'Sarah\'s FP review is the gating constraint on Phase 2. Earliest sign-off Monday per her email last night.',
      talkingPoints: [
        'Confirm Sarah will do FP review on the 50-doc indemnification sample Monday morning',
        'Align on 0.92 → 0.95 precision target for indemnification',
        'Open: training-set gap on carve-out language; ask if Northridge legal can supply 100 examples',
      ],
    },
    {
      id: 'cal-3',
      title: '1:1 with engagement sponsor (James Carrera)',
      time: '14:00–14:30',
      attendees: ['Chantel Hill', 'James Carrera (Cimplifi)'],
      agenda: 'Weekly visibility on Phase 2 ship-date confidence and dependency status.',
      priorContext: 'James asked last 1:1 for weekly visibility on the May 22 close. Bringing revised number.',
      talkingPoints: [
        'Phase 2 confidence revised: 80% → 60%',
        'Two open dependencies: Sarah\'s FP review timing (mitigating) + LoL training data (open)',
        'Phase 3 scoping in flight; preempt Linda\'s ask in the readout',
      ],
    },
    {
      id: 'cal-4',
      title: 'Northridge exec readout — Phase 2 mid-engagement',
      time: '16:00–16:30',
      attendees: ['Linda Park (Northridge VP Legal Ops)', 'James Carrera (Cimplifi)', 'Chantel Hill'],
      agenda: 'Phase 2 progress, accuracy results to date, risks, target Phase 3 cutover date confidence.',
      priorContext:
        'Linda will ask for a confidence number on the May 22 close first thing. Last readout she asked for weekly accuracy results vs production gates.',
      talkingPoints: [
        'Lead with Term & Termination shipped at 96.8% precision (4 percentage points over the gate)',
        'Phase 2 close confidence: 60% (was 80% last week) — explain the FP review timing constraint',
        'Surface DocuSign + LoL training data as the two open dependencies',
        'Tee up Phase 3 scoping conversation before Linda asks',
      ],
    },
  ],
};

const MEETING_PREP_CRITIQUE: ReviewCritique = {
  reviewedAgent: 'meeting-prep',
  verdict: 'pass',
  confidence: 0.88,
  issues: [],
};

const ACTIONS: ActionTrackerOutput = {
  newItems: [
    {
      title: 'Send Sarah false-positive review packet by 10:30',
      owner: 'Rohan Mehta',
      dueDate: new Date().toISOString().slice(0, 10),
      sourceRef: 'thread:t-1',
      evidence: 'Rohan: "Indemnification at 92.4% precision after the latest run."',
    },
    {
      title: 'Send revised attorney-training playbook timeline before 2pm',
      owner: 'Megan O\'Brien',
      dueDate: new Date().toISOString().slice(0, 10),
      sourceRef: 'thread:t-2',
      evidence: 'Megan: "playbook is going to slip ~2 days. Pulling Phase 3 scoping doc forward."',
    },
    {
      title: 'Confirm DocuSign sandbox install for Friday',
      owner: 'David Lambert',
      dueDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
      sourceRef: 'thread:t-3',
      evidence: 'David: "Sandbox by Friday, prod next Tuesday."',
    },
  ],
  statusUpdates: [],
};

const ACTIONS_CRITIQUE: ReviewCritique = {
  reviewedAgent: 'action-tracker',
  verdict: 'pass',
  confidence: 0.89,
  issues: [],
};

const COMMS: CommsTailorOutput = {
  standup:
    'Yesterday: Term & Termination shipped to prod at 96.8% precision. Today: indemnification FP review packet to Sarah by 10:30, threshold review at 11, exec readout at 4. Blockers: LoL F1 plateau at 0.91 (training-set gap on carve-outs) and Sarah\'s sign-off timing (earliest Monday).',
  exec:
    'Phase 2 mid-engagement: Term & Termination shipped at 96.8% precision (4 points over the 95% production gate). Indemnification + LoL accuracy gating are in flight; Sarah\'s false-positive review on Monday is the gating constraint and we\'ve revised May 22 close confidence from 80% to 60% as a result. DocuSign Insight custom field mapping confirmed for sandbox EOW, production next Tuesday — feasible against May 22 if validation closes on time. Two open dependencies surface in the risk register: attorney sign-off timing (mitigating) and LoL training data on carve-out language (open). Phase 3 scoping pulled forward into this sprint.',
  client:
    'We shipped the first production clause model this week with accuracy four points above target. Two more clauses are in their final accuracy review and on track for sign-off the week of May 13. We\'ve identified a small dependency that could affect the May 22 close date — we\'ll keep you posted next readout. The governance workshop is locked for May 13.',
  skipLevel:
    'Phase 2 close confidence at 60% on May 22 (was 80% last week). Single biggest constraint: attorney sign-off timing on the Northridge side. Mitigation: compress turnaround by shipping FP review packet ahead of today\'s threshold review. DocuSign dependency on track. Phase 3 scoping pulled forward.',
};

const COMMS_CRITIQUE: ReviewCritique = {
  reviewedAgent: 'comms-tailor',
  verdict: 'pass',
  confidence: 0.92,
  issues: [],
};

// ───── orchestration ─────

export async function replayMorningBrief(run: Run): Promise<void> {
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
    await sleep(TICK / 2);
  }

  const tracker0 = await loadTracker();
  const sprintBoard = await getAdapter('synthetic').fetch('sprint-board', {});

  // 1) Status Synthesizer
  await replayDoer(
    run,
    'status-synthesizer',
    [
      { tool: 'fetch_sprint_board' },
      { tool: 'fetch_threads', input: { since: '2026-05-05' } },
      { tool: 'fetch_mail', input: { since: '2026-05-05' } },
    ],
    STATUS,
    0.86,
  );
  await replayReview(run, 'status-synthesizer', STATUS_CRITIQUE);

  let approvedStatus: StatusSynthesizerOutput;
  try {
    approvedStatus = await gate<StatusSynthesizerOutput>(run, {
      kind: 'between-agents',
      title: 'Review status read',
      description: 'This feeds Comms Tailor next. Edit factual issues now or accept.',
      agent: 'status-synthesizer',
      payload: STATUS,
      reviewerCritique: STATUS_CRITIQUE,
    });
  } catch (err) {
    if (err instanceof GateRejected) return endReplayRejected(run);
    throw err;
  }

  // 2) Risk Detective
  await replayDoer(
    run,
    'risk-detective',
    [{ tool: 'fetch_sprint_board' }, { tool: 'fetch_threads', input: { since: '2026-05-05' } }],
    RISKS_OUT,
    0.91,
  );
  await replayReview(run, 'risk-detective', RISKS_CRITIQUE);

  let approvedRisk: RiskDetectiveOutput;
  try {
    approvedRisk = await gate<RiskDetectiveOutput>(run, {
      kind: 'between-agents',
      title: 'Review risk delta',
      description: 'New risks, updates to existing risks, and risks the agent thinks have aged out.',
      agent: 'risk-detective',
      payload: RISKS_OUT,
      reviewerCritique: RISKS_CRITIQUE,
    });
  } catch (err) {
    if (err instanceof GateRejected) return endReplayRejected(run);
    throw err;
  }

  // 3) Meeting Prep
  await replayDoer(
    run,
    'meeting-prep',
    [
      { tool: 'fetch_calendar', input: { rangeStart: '2026-05-06', rangeEnd: '2026-05-07' } },
      { tool: 'fetch_threads', input: { since: '2026-05-05' } },
    ],
    MEETING_PREP,
    0.88,
  );
  await replayReview(run, 'meeting-prep', MEETING_PREP_CRITIQUE);

  let approvedPrep: MeetingPrepOutput;
  try {
    approvedPrep = await gate<MeetingPrepOutput>(run, {
      kind: 'between-agents',
      title: 'Review meeting prep',
      description: 'Per-meeting prep blocks for today. Edit talking points or attendees.',
      agent: 'meeting-prep',
      payload: MEETING_PREP,
      reviewerCritique: MEETING_PREP_CRITIQUE,
    });
  } catch (err) {
    if (err instanceof GateRejected) return endReplayRejected(run);
    throw err;
  }

  // 4) Action Tracker
  await replayDoer(
    run,
    'action-tracker',
    [{ tool: 'fetch_threads', input: { since: '2026-05-05' } }, { tool: 'fetch_mail', input: { since: '2026-05-05' } }],
    ACTIONS,
    0.89,
  );
  await replayReview(run, 'action-tracker', ACTIONS_CRITIQUE);

  let approvedActions: ActionTrackerOutput;
  try {
    approvedActions = await gate<ActionTrackerOutput>(run, {
      kind: 'between-agents',
      title: 'Review action items',
      description: 'New action items extracted from recent comms; status updates to existing items.',
      agent: 'action-tracker',
      payload: ACTIONS,
      reviewerCritique: ACTIONS_CRITIQUE,
    });
  } catch (err) {
    if (err instanceof GateRejected) return endReplayRejected(run);
    throw err;
  }

  // 5) Curator pre-pass so the comms tailor sees the post-approval risk view.
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

  // 6) Comms Tailor
  await replayDoer(run, 'comms-tailor', [], COMMS, 0.92);
  await replayReview(run, 'comms-tailor', COMMS_CRITIQUE);

  let approvedComms: CommsTailorOutput;
  try {
    approvedComms = await gate<CommsTailorOutput>(run, {
      kind: 'between-agents',
      title: 'Review tailored drafts',
      description: 'Standup, exec, client, and skip-level drafts. Edit any version.',
      agent: 'comms-tailor',
      payload: COMMS,
      reviewerCritique: COMMS_CRITIQUE,
    });
  } catch (err) {
    if (err instanceof GateRejected) return endReplayRejected(run);
    throw err;
  }

  // 7) Assemble brief.
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

  // 8) Final publish gate.
  let publishedBrief: BriefArtifact;
  try {
    publishedBrief = await gate<BriefArtifact>(run, {
      kind: 'final-publish',
      title: 'Publish morning brief',
      description:
        'Final review of the assembled brief. Approving will commit changes to the Status Tracker and archive this brief to history.',
      payload: brief,
    });
  } catch (err) {
    if (err instanceof GateRejected) return endReplayRejected(run);
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

function endReplayRejected(run: Run): void {
  emit(run, { type: 'run:done', runId: run.runId, ts: Date.now() });
}
