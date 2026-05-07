/**
 * Synthetic project fixture: "Northridge Financial — Contracts AI Phase 2".
 *
 * A believable mid-engagement CLM AI delivery program in financial services
 * (the kind Chantel runs at Cimplifi). Three workstreams (Clause Model
 * Expansion, Validation & Accuracy Gating, Client Governance & Rollout),
 * Phase 2 of 3, sprint 4 of 4, day 6. Includes a deliberately ambiguous risk
 * (attorney sign-off bottleneck) so the Reviewer/Analyst flagging path can be
 * verified end to end.
 *
 * Northridge Financial is fictional. Tools referenced (Relativity Contracts
 * Pro, DocuSign Insight, Claude Code, Cowork) are the ones used in real
 * engagements.
 */

import type {
  CalendarEvent,
  ChannelMessage,
  DocSnippet,
  MailMessage,
  SprintBoard,
  TrackerState,
} from '../../agents/shared/types';

const TODAY = '2026-05-06';
const Y = '2026-05-05';
const SPRINT_START = '2026-05-01';
const SPRINT_END = '2026-05-14';

export const syntheticSprintBoard: SprintBoard = {
  sprintName: 'Northridge Phase 2 — Sprint 4',
  startDate: SPRINT_START,
  endDate: SPRINT_END,
  items: [
    {
      id: 'NRF-201',
      title: 'Indemnification model — tune to 95%+ precision',
      status: 'in-progress',
      assignee: 'Rohan Mehta',
      storyPoints: 5,
      workstreamId: 'clause-model-expansion',
      lastUpdated: Y,
      notes:
        'Plateaued at 92.4% precision on the latest training run. Needs additional false-positive review from client legal before next iteration.',
    },
    {
      id: 'NRF-202',
      title: 'Limitation of Liability — F1 threshold sweep',
      status: 'in-progress',
      assignee: 'Rohan Mehta',
      storyPoints: 5,
      workstreamId: 'validation-accuracy',
      lastUpdated: Y,
      notes:
        'F1 sitting at 0.91 across thresholds 0.55–0.70. Suspect under-representation of "carve-out" language in training set.',
    },
    {
      id: 'NRF-203',
      title: 'Term & Termination — ship to production',
      status: 'done',
      assignee: 'Rohan Mehta',
      storyPoints: 3,
      workstreamId: 'clause-model-expansion',
      lastUpdated: Y,
      notes: 'Deployed to Relativity Contracts Pro Mon. 96.8% precision, 94.1% recall on hold-out set.',
    },
    {
      id: 'NRF-204',
      title: 'Governance workshop #2 — schedule + agenda',
      status: 'review',
      assignee: 'Megan O\'Brien',
      storyPoints: 3,
      workstreamId: 'client-governance',
      lastUpdated: Y,
      notes: 'Calendar holds confirmed for May 13. Agenda draft awaiting Chantel review.',
    },
    {
      id: 'NRF-205',
      title: 'Attorney training playbook — Phase 2 handoff',
      status: 'in-progress',
      assignee: 'Megan O\'Brien',
      storyPoints: 8,
      workstreamId: 'client-governance',
      lastUpdated: Y,
      notes:
        'Slipping ~2 days. Northridge legal ops asked for additional walkthrough on false-positive review SOP.',
    },
    {
      id: 'NRF-206',
      title: 'Phase 1 baseline regression tests (12 clauses)',
      status: 'done',
      assignee: 'Rohan Mehta',
      storyPoints: 3,
      workstreamId: 'validation-accuracy',
      lastUpdated: '2026-05-04',
      notes: 'All 12 baseline clauses still ≥95% precision after Phase 2 retraining. No regressions.',
    },
    {
      id: 'NRF-207',
      title: 'Sign-off SOP for new clause models',
      status: 'todo',
      assignee: 'Chantel Hill',
      storyPoints: 5,
      workstreamId: 'client-governance',
      lastUpdated: '2026-05-02',
      notes: 'Drafting against Cimplifi playbook template; needs Northridge VP Legal Ops review.',
    },
    {
      id: 'NRF-208',
      title: 'Error-analysis dashboard for exec readout',
      status: 'in-progress',
      assignee: 'Chantel Hill',
      storyPoints: 3,
      workstreamId: 'validation-accuracy',
      lastUpdated: Y,
    },
    {
      id: 'NRF-209',
      title: 'DocuSign Insight feature dependency — escalate',
      status: 'blocked',
      assignee: 'David Lambert',
      storyPoints: 3,
      workstreamId: 'clause-model-expansion',
      lastUpdated: '2026-05-04',
      notes:
        'Blocked on DocuSign platform team. Custom field mapping needed for Phase 3 production cutover; ETA still pending after escalation Friday.',
    },
    {
      id: 'NRF-210',
      title: 'Phase 3 scoping doc — production cutover plan',
      status: 'todo',
      assignee: 'David Lambert',
      storyPoints: 5,
      workstreamId: 'client-governance',
      lastUpdated: '2026-05-02',
      notes: 'Stretch goal this sprint; may slip into Sprint 5.',
    },
  ],
};

export const syntheticCalendar: CalendarEvent[] = [
  {
    id: 'cal-1',
    title: 'Northridge delivery standup',
    start: `${TODAY}T09:30:00`,
    end: `${TODAY}T09:45:00`,
    attendees: ['Chantel Hill', 'David Lambert', 'Rohan Mehta', 'Megan O\'Brien'],
    agenda: 'Daily standup. Mid-sprint check pulled forward this week.',
  },
  {
    id: 'cal-2',
    title: 'Threshold review — Northridge clause models',
    start: `${TODAY}T11:00:00`,
    end: `${TODAY}T11:45:00`,
    attendees: ['Chantel Hill', 'Rohan Mehta', 'Sarah Chen (Northridge)'],
    agenda:
      'Walk Sarah through indemnification + LoL precision/recall sweeps; align on production thresholds and false-positive review.',
  },
  {
    id: 'cal-3',
    title: '1:1 with engagement sponsor (James Carrera)',
    start: `${TODAY}T14:00:00`,
    end: `${TODAY}T14:30:00`,
    attendees: ['Chantel Hill', 'James Carrera (Cimplifi)'],
    notes:
      'Last 1:1 James asked for weekly visibility on Phase 2 ship-date confidence. Follow up with revised number.',
  },
  {
    id: 'cal-4',
    title: 'Northridge exec readout — Phase 2 mid-engagement',
    start: `${TODAY}T16:00:00`,
    end: `${TODAY}T16:30:00`,
    attendees: ['Linda Park (Northridge VP Legal Ops)', 'James Carrera (Cimplifi)', 'Chantel Hill'],
    agenda: 'Phase 2 progress, accuracy results to date, risks, target Phase 3 cutover date confidence.',
  },
];

export const syntheticMail: MailMessage[] = [
  {
    id: 'mail-1',
    from: 'sarah.chen@northridgefinancial.example',
    to: ['chantel.hill@cimplifi.example'],
    subject: 'Re: indemnification + LoL sign-off availability',
    ts: `${Y}T17:42:00`,
    snippet:
      "I can do the threshold review tomorrow at 11. For sign-off itself I'm tight this week — earliest I can review the false-positive set is Monday. Will that hold up your ship plan?",
  },
  {
    id: 'mail-2',
    from: 'james.carrera@cimplifi.example',
    to: ['chantel.hill@cimplifi.example'],
    subject: 'Northridge exec readout — what to expect',
    ts: `${Y}T19:05:00`,
    snippet:
      'Heads up Linda will want a confidence number on the May 22 Phase 2 close. Bring the error-analysis view and the dependency list. Keep it tight — 30 min, lots of questions.',
  },
  {
    id: 'mail-3',
    from: 'platform-cs@docusign.example',
    to: ['david.lambert@cimplifi.example', 'chantel.hill@cimplifi.example'],
    subject: 'DocuSign Insight custom field mapping — ETA update',
    ts: `${TODAY}T07:12:00`,
    snippet:
      'We can have the custom field mapping in your sandbox by EOW. Production rollout the following Tuesday assuming nothing else lands. Sandbox creds attached.',
  },
];

export const syntheticThreads: ChannelMessage[] = [
  {
    id: 't-1',
    channel: '#northridge-delivery',
    author: 'Rohan Mehta',
    ts: `${Y}T15:20:00`,
    text:
      'Indemnification at 92.4% precision after the latest run. I can squeeze another point or two with hard-negative mining but we need Sarah\'s false-positive review to confirm we\'re not over-fitting on the new training shard.',
  },
  {
    id: 't-2',
    channel: '#northridge-delivery',
    author: 'Megan O\'Brien',
    ts: `${Y}T16:45:00`,
    text:
      'Heads up the attorney training playbook is going to slip ~2 days. Northridge legal ops want an additional walkthrough on the FP review SOP before they sign off. Pulling Phase 3 scoping doc forward to keep moving.',
  },
  {
    id: 't-3',
    channel: '#northridge-delivery',
    author: 'David Lambert',
    ts: `${TODAY}T08:50:00`,
    text:
      'DocuSign got back — sandbox by Friday, prod next Tuesday. Tight against May 22 but feasible if validation closes on time.',
  },
  {
    id: 't-4',
    channel: '#cimplifi-delivery-leads',
    author: 'James Carrera',
    ts: `${Y}T18:10:00`,
    text:
      'Chantel — can you put a confidence number on the May 22 Phase 2 close for tomorrow\'s readout? Linda will ask first thing.',
  },
];

export const syntheticDocs: DocSnippet[] = [
  {
    id: 'doc-1',
    title: 'Northridge Phase 2 — engagement plan',
    url: 'https://docs.example/northridge-phase2-plan',
    excerpt:
      'Phase 2 target close May 22. Milestones: M1 Term & Termination shipped (5/5), M2 indemnification + LoL accuracy gating (5/13), M3 governance workshop #2 + sign-off SOP (5/15), M4 Phase 2 close + Phase 3 scoping (5/22).',
  },
  {
    id: 'doc-2',
    title: 'Northridge — running exec readout notes',
    url: 'https://docs.example/northridge-exec-readout',
    excerpt:
      "Last readout: Linda asked for weekly visibility on accuracy results vs production gates and any client-side dependencies. Action item from last week: surface DocuSign feature dependency on the running risk register.",
  },
  {
    id: 'doc-3',
    title: 'Cimplifi delivery playbook — clause model sign-off SOP',
    url: 'https://docs.example/cimplifi-signoff-sop',
    excerpt:
      'Standard sign-off requires (1) 95%+ precision and recall on hold-out set, (2) attorney false-positive review on a 50-doc sample, (3) VP Legal Ops written approval before production deployment.',
  },
];

export const syntheticTranscript = `
Northridge Phase 2 — Sprint 4 mid-sprint check
${TODAY} 09:30–10:00

CHANTEL: Thanks all. Quick mid-sprint check before threshold review with Sarah at 11. Rohan, where are we on indemnification and LoL?
ROHAN: Indemnification at 92.4 percent precision. I can probably squeeze another point with hard-negative mining but we are at the limit without Sarah's false-positive review on the new shard. LoL is plateaued at 0.91 F1, I think we are missing carve-out language in the training set.
CHANTEL: Sarah emailed last night. She can do threshold review today at eleven but earliest sign-off is Monday. Does that work for the ship plan?
ROHAN: Tight. We need indemnification at 95 percent before sign-off, so I want her FP review before I do another tuning pass. Monday review means earliest re-train Tuesday, sign-off late next week. May 22 close is at risk.
CHANTEL: OK, that goes on the readout. Megan, governance workshop and the playbook?
MEGAN: Workshop number two is locked for May 13. Playbook is slipping about two days because Northridge legal ops want an additional walkthrough on the false-positive review SOP. I am pulling the Phase 3 scoping doc forward to not lose ground.
CHANTEL: That makes the May 22 close even tighter. David, DocuSign?
DAVID: They wrote back this morning. Sandbox creds Friday, production Tuesday after that. Feasible against May 22 but assumes validation closes on time, which Rohan just said is tight.
CHANTEL: Action items I caught. Rohan, send Sarah the FP review packet by 10:30 so she can scan it before our 11. Megan, send me the revised playbook timeline before two pm so I can put it in the exec readout. David, lock DocuSign sandbox install for Friday and confirm with platform team this morning. Me, set Phase 2 ship confidence at 60 percent in the readout, was 80 last week, and surface the DocuSign + sign-off dependencies. Anything else?
DAVID: Just a flag — if Phase 2 slips past May 22 we should preempt the Phase 3 conversation with Linda before she asks.
CHANTEL: Yes. I will tee that up in the readout. Thanks all.
`.trim();

export const initialTracker: TrackerState = {
  projectName: 'Northridge Financial — Contracts AI Phase 2',
  updatedAt: `${Y}T18:30:00`,
  workstreams: [
    {
      id: 'clause-model-expansion',
      name: 'Clause Model Expansion',
      rag: 'amber',
      rationale:
        'Term & Termination shipped. Indemnification + LoL accuracy gating in flight; both depend on attorney FP review timing.',
      owner: 'Rohan Mehta',
      lastUpdated: Y,
    },
    {
      id: 'validation-accuracy',
      name: 'Validation & Accuracy Gating',
      rag: 'amber',
      rationale:
        'Threshold sweeps in flight. F1 plateau on LoL clause; suspect training-set gap on carve-outs.',
      owner: 'Rohan Mehta',
      lastUpdated: Y,
    },
    {
      id: 'client-governance',
      name: 'Client Governance & Rollout',
      rag: 'amber',
      rationale:
        'Workshop #2 locked. Attorney training playbook slipping ~2 days on additional FP review SOP walkthrough.',
      owner: 'Megan O\'Brien',
      lastUpdated: Y,
    },
  ],
  milestones: [
    { id: 'm1', title: 'M1: Term & Termination shipped', status: 'shipped', date: '2026-05-05', workstreamId: 'clause-model-expansion' },
    { id: 'm2', title: 'M2: Indemnification + LoL accuracy gating', status: 'in-flight', date: '2026-05-13', workstreamId: 'validation-accuracy' },
    { id: 'm3', title: 'M3: Governance workshop #2 + sign-off SOP', status: 'in-flight', date: '2026-05-15', workstreamId: 'client-governance' },
    { id: 'm4', title: 'M4: Phase 2 close + Phase 3 scoping', status: 'planned', date: '2026-05-22' },
  ],
  risks: [
    {
      id: 'r-1',
      title: 'Attorney sign-off bottleneck (Sarah Chen) — earliest Monday',
      severity: 'medium',
      status: 'open',
      owner: 'Chantel Hill',
      workstreamId: 'validation-accuracy',
      source: { kind: 'agent', ref: 'risk-detective:initial' },
      firstSeen: '2026-05-04',
      lastSeen: Y,
      notes:
        'Tight against May 22 close. Mitigation: ship FP review packet ahead of today\'s 11am threshold review to compress turnaround.',
    },
    {
      id: 'r-2',
      title: 'DocuSign Insight custom field mapping dependency',
      severity: 'medium',
      status: 'mitigating',
      owner: 'David Lambert',
      workstreamId: 'clause-model-expansion',
      source: { kind: 'agent', ref: 'risk-detective:initial' },
      firstSeen: '2026-05-02',
      lastSeen: Y,
      notes: 'DocuSign confirmed sandbox EOW, prod next Tuesday. Feasible against May 22 if validation closes on time.',
    },
    {
      id: 'r-3',
      title: 'LoL clause F1 plateau at 0.91 — training-set gap on carve-outs',
      severity: 'high',
      status: 'open',
      owner: 'Rohan Mehta',
      workstreamId: 'validation-accuracy',
      source: { kind: 'agent', ref: 'risk-detective:initial' },
      firstSeen: '2026-05-05',
      lastSeen: Y,
      notes:
        'Threatens Phase 2 close if not resolved this sprint. Likely needs additional training data from Northridge legal team.',
    },
  ],
  actionItems: [
    {
      id: 'ai-1',
      title: 'Send Sarah false-positive review packet by 10:30',
      owner: 'Rohan Mehta',
      dueDate: TODAY,
      status: 'in-progress',
      source: { kind: 'meeting', ref: 'mid-sprint-check' },
      createdAt: Y,
    },
    {
      id: 'ai-2',
      title: 'Send revised attorney-training playbook timeline before 2pm',
      owner: 'Megan O\'Brien',
      dueDate: TODAY,
      status: 'open',
      source: { kind: 'meeting', ref: 'mid-sprint-check' },
      createdAt: Y,
    },
  ],
  history: [],
  notes: [],
};
