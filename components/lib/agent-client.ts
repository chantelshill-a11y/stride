/**
 * Client-side helpers for calling /api/agent.
 *
 * The browser orchestrator calls these once per agent and per reviewer.
 * Each call streams the agent's events via SSE (so the trace panel updates
 * live) and resolves with the agent's output. Because each call spans
 * one agent only (~5-25s), it never approaches Netlify's 30s streaming cap.
 */

import type {
  AgentEvent,
  AgentName,
  AgentOutput,
  ReviewCritique,
  Risk,
  TrackerState,
} from '../../agents/shared/types';
import type { ActionTrackerOutput } from '../../agents/action-tracker';
import type { StatusSynthesizerOutput } from '../../agents/status-synthesizer';

interface DoerArgs {
  tracker?: TrackerState;
  transcript?: string;
  status?: StatusSynthesizerOutput;
  risks?: Risk[];
  actions?: ActionTrackerOutput;
  meetingTitle?: string;
}

/** Calls /api/agent for a doer, streams its events to onEvent, returns the AgentOutput. */
export async function runDoer(
  agent: Exclude<AgentName, 'reviewer-analyst' | 'orchestrator' | 'tracker-curator'>,
  args: DoerArgs,
  onEvent: (e: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<AgentOutput> {
  return invokeAgent(
    { agent, args: args as unknown as Record<string, unknown> },
    agent,
    onEvent,
    signal,
  );
}

/**
 * Calls /api/agent for the Meeting Summarizer.
 *
 * The server dispatches this under the request name 'meeting-summarizer' but
 * the agent emits its events as 'comms-tailor' (the under-the-hood role —
 * see runMeetingSummarizer). So we send 'meeting-summarizer' as the request
 * agent and expect 'comms-tailor' as the agent:done emitter.
 */
export async function runMeetingSummarizer(
  args: { transcript: string; actions: ActionTrackerOutput; risks: Risk[]; meetingTitle: string },
  onEvent: (e: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<AgentOutput> {
  return invokeAgent(
    { agent: 'meeting-summarizer', args: args as unknown as Record<string, unknown> },
    'comms-tailor',
    onEvent,
    signal,
  );
}

/** Calls /api/agent for the reviewer; returns the structured ReviewCritique. */
export async function runReviewer(
  reviewedAgent: AgentName,
  output: AgentOutput,
  contextSummary: string,
  onEvent: (e: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<ReviewCritique> {
  const result = await invokeAgent(
    {
      agent: 'reviewer-analyst',
      args: { reviewedAgent, output, contextSummary },
    },
    'reviewer-analyst',
    onEvent,
    signal,
  );
  // The reviewer's body is a partial critique; reconstruct the canonical shape
  // (matches the server's runReviewerAnalyst result).
  const body = result.body as Partial<ReviewCritique>;
  return {
    reviewedAgent,
    verdict: body.verdict ?? 'flag',
    confidence: body.confidence ?? result.confidence,
    issues: body.issues ?? [],
    suggestedEdits: body.suggestedEdits,
  };
}

interface InvokeBody {
  /**
   * The dispatch name as expected by /api/agent. This is wider than AgentName
   * because the server accepts 'meeting-summarizer' as a dispatch key even
   * though that agent emits events as 'comms-tailor' (see runMeetingSummarizer).
   */
  agent: AgentName | 'meeting-summarizer';
  args: Record<string, unknown>;
}

async function invokeAgent(
  body: InvokeBody,
  expectedAgent: AgentName,
  onEvent: (e: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<AgentOutput> {
  const res = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`Agent ${body.agent} failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let output: AgentOutput | null = null;
  let errorMessage: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        try {
          const evt = JSON.parse(payload) as AgentEvent | { type: 'run:hello'; runId: string };
          if (evt.type === 'run:hello') continue;
          // Dispatch to caller's trace handler.
          onEvent(evt as AgentEvent);
          if (evt.type === 'agent:done' && evt.agent === expectedAgent) {
            output = evt.output;
          }
          if (evt.type === 'agent:error') {
            errorMessage = evt.message;
          }
          if (evt.type === 'run:error') {
            errorMessage = errorMessage ?? evt.message;
          }
        } catch {
          /* skip malformed frames */
        }
      }
    }
  }

  if (errorMessage) throw new Error(errorMessage);
  if (!output) throw new Error(`Agent ${body.agent} did not submit a result`);
  return output;
}
