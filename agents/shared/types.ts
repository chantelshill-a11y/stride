/**
 * Core contracts every agent, gate, and adapter obeys.
 * Stable shapes here = stable system. Change with care.
 */

export type AgentRole = 'orchestrator' | 'doer' | 'reviewer' | 'curator';

export type AgentName =
  | 'orchestrator'
  | 'status-synthesizer'
  | 'risk-detective'
  | 'meeting-prep'
  | 'comms-tailor'
  | 'action-tracker'
  | 'tracker-curator'
  | 'reviewer-analyst';

export type AgentState = 'queued' | 'running' | 'awaiting-review' | 'done' | 'error';

export interface AgentDescriptor {
  name: AgentName;
  role: AgentRole;
  displayName: string;
  blurb: string;
}

/** Everything emitted on the event bus. The trace panel renders these directly. */
export type AgentEvent =
  | { type: 'run:start'; runId: string; mode: 'morning-brief' | 'meeting-mode'; ts: number }
  | { type: 'run:plan'; runId: string; plan: string[]; ts: number }
  | { type: 'agent:queued'; runId: string; agent: AgentName; ts: number }
  | { type: 'agent:start'; runId: string; agent: AgentName; ts: number }
  | { type: 'agent:tool'; runId: string; agent: AgentName; tool: string; input: unknown; ts: number }
  | { type: 'agent:tool-result'; runId: string; agent: AgentName; tool: string; output: unknown; ts: number }
  | { type: 'agent:token'; runId: string; agent: AgentName; delta: string; ts: number }
  | { type: 'agent:done'; runId: string; agent: AgentName; output: AgentOutput; ts: number }
  | { type: 'agent:error'; runId: string; agent: AgentName; message: string; ts: number }
  | { type: 'reviewer:critique'; runId: string; targetAgent: AgentName; critique: ReviewCritique; ts: number }
  | { type: 'gate:open'; runId: string; gate: HITLGate; ts: number }
  | { type: 'gate:resolved'; runId: string; gateId: string; decision: GateDecision; ts: number }
  | { type: 'tracker:updated'; runId: string; summary: string; ts: number }
  | { type: 'run:done'; runId: string; brief?: BriefArtifact; meeting?: MeetingArtifact; ts: number }
  | { type: 'run:error'; runId: string; message: string; ts: number };

export interface AgentOutput {
  agent: AgentName;
  body: unknown;
  confidence: number; // 0..1
  notes?: string;
}

export interface ReviewCritique {
  reviewedAgent: AgentName;
  verdict: 'pass' | 'flag' | 'block';
  confidence: number;
  issues: Array<{ severity: 'low' | 'medium' | 'high'; note: string }>;
  suggestedEdits?: string;
}

/** Human-in-the-loop gate. The run pauses until the user resolves it. */
export interface HITLGate {
  id: string;
  kind: 'between-agents' | 'external-action' | 'final-publish' | 'low-confidence-escalation';
  title: string;
  description: string;
  agent?: AgentName;
  payload: unknown; // the thing being approved (a draft, a status section, etc.)
  externalAction?: {
    target: 'email' | 'slack' | 'calendar' | 'jira' | 'linear';
    summary: string;
  };
  reviewerCritique?: ReviewCritique;
}

export type GateDecision =
  | { kind: 'approve' }
  | { kind: 'edit'; edited: unknown }
  | { kind: 'reject'; reason?: string };

/** Final brief artifact (Workflow A). */
export interface BriefArtifact {
  generatedAt: string;
  yesterdayProgress: string;
  todayMeetings: Array<{ title: string; time: string; prepNotes: string }>;
  risks: Risk[];
  standupDraft: string;
  execUpdateDraft: string;
  openActionItems: ActionItem[];
}

/** Final meeting-mode artifact (Workflow B). */
export interface MeetingArtifact {
  generatedAt: string;
  meetingTitle: string;
  actionItems: ActionItem[];
  summaries: { team: string; exec: string; client: string };
  riskEntries: Risk[];
  followUpInvites: Array<{ title: string; attendees: string[]; rationale: string }>;
  ticketDrafts: Array<{ title: string; body: string }>;
}

/** Persistent tracker state (Workflow C). */
export interface TrackerState {
  projectName: string;
  updatedAt: string;
  workstreams: Workstream[];
  milestones: Milestone[];
  risks: Risk[];
  actionItems: ActionItem[];
  history: HistoryEntry[];
  notes: MeetingNote[];
}

/** Meeting notes — manual or auto-generated from Meeting Mode artifacts. */
export interface MeetingNote {
  id: string;
  title: string;
  /** ISO date the meeting happened (or note was created). */
  date: string;
  /** Free-form markdown — what the PM types or what we render from a meeting artifact. */
  body: string;
  source: 'manual' | 'meeting-mode';
  /** When source is 'meeting-mode', this links back to the HistoryEntry that produced it. */
  linkedArtifactId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Workstream {
  id: string;
  name: string;
  rag: 'green' | 'amber' | 'red';
  rationale: string;
  owner?: string;
  lastUpdated: string;
}

export interface Milestone {
  id: string;
  title: string;
  status: 'shipped' | 'in-flight' | 'slipping' | 'planned';
  date: string;
  workstreamId?: string;
}

export interface Risk {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'mitigating' | 'resolved' | 'aged-out';
  owner?: string;
  workstreamId?: string;
  source: { kind: 'agent' | 'manual' | 'meeting'; ref: string };
  firstSeen: string;
  lastSeen: string;
  notes?: string;
}

export interface ActionItem {
  id: string;
  title: string;
  owner?: string;
  dueDate?: string;
  status: 'open' | 'in-progress' | 'done';
  source: { kind: 'agent' | 'manual' | 'meeting'; ref: string };
  createdAt: string;
}

export interface HistoryEntry {
  id: string;
  kind: 'morning-brief' | 'meeting-artifact';
  ts: string;
  summary: string;
  artifact: BriefArtifact | MeetingArtifact;
}

/** Integration adapter contract — agents query the registry, never specific adapters. */
export interface IntegrationAdapter {
  id: 'synthetic' | 'google' | 'microsoft' | 'jira' | 'linear' | 'slack' | 'notion';
  displayName: string;
  capabilities: IntegrationCapability[];
  /** Fetches contextual data the agent needs. The shape is per-capability and well-typed below. */
  fetch<T extends IntegrationCapability>(
    capability: T,
    args: IntegrationFetchArgs[T],
  ): Promise<IntegrationFetchResult[T]>;
  /** Performs an external action — only ever called downstream of an approved HITL gate. */
  execute<T extends IntegrationAction>(
    action: T,
    args: IntegrationActionArgs[T],
  ): Promise<{ ok: boolean; ref?: string; message?: string }>;
}

export type IntegrationCapability = 'sprint-board' | 'calendar' | 'mail' | 'threads' | 'docs';
export type IntegrationAction = 'send-email' | 'post-channel' | 'create-event' | 'create-ticket';

export interface IntegrationFetchArgs {
  'sprint-board': { sprintId?: string };
  calendar: { rangeStart: string; rangeEnd: string };
  mail: { since: string };
  threads: { channels?: string[]; since: string };
  docs: { query: string };
}

export interface IntegrationFetchResult {
  'sprint-board': SprintBoard;
  calendar: CalendarEvent[];
  mail: MailMessage[];
  threads: ChannelMessage[];
  docs: DocSnippet[];
}

export interface IntegrationActionArgs {
  'send-email': { to: string[]; subject: string; bodyMarkdown: string };
  'post-channel': { channel: string; bodyMarkdown: string };
  'create-event': { title: string; attendees: string[]; start: string; end: string; agenda?: string };
  'create-ticket': { project: string; title: string; bodyMarkdown: string; labels?: string[] };
}

/** Source-data shapes returned by adapters. Kept small and PM-shaped on purpose. */
export interface SprintBoard {
  sprintName: string;
  startDate: string;
  endDate: string;
  items: Array<{
    id: string;
    title: string;
    status: 'todo' | 'in-progress' | 'review' | 'done' | 'blocked';
    assignee?: string;
    storyPoints?: number;
    workstreamId?: string;
    lastUpdated: string;
    notes?: string;
  }>;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  attendees: string[];
  agenda?: string;
  notes?: string;
}

export interface MailMessage {
  id: string;
  from: string;
  to: string[];
  subject: string;
  ts: string;
  snippet: string;
}

export interface ChannelMessage {
  id: string;
  channel: string;
  author: string;
  ts: string;
  text: string;
}

export interface DocSnippet {
  id: string;
  title: string;
  url?: string;
  excerpt: string;
}
