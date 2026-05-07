/**
 * Action Tracker (doer).
 *
 * Extracts action items from a transcript, threads, or both. Reconciles against
 * the existing tracker action items so we don't duplicate ones the PM already
 * committed.
 */

import { runAgent, dataFetchTools } from './lib/run-agent';
import type { Run } from './shared/trace';
import type { ActionItem, AgentOutput, TrackerState } from './shared/types';

export interface ActionTrackerOutput {
  newItems: Array<{
    title: string;
    owner?: string;
    dueDate?: string;
    sourceRef: string; // freeform: meeting id, thread id, transcript line
    evidence: string;
  }>;
  statusUpdates: Array<{ id: string; status: ActionItem['status']; note?: string }>;
}

const SYSTEM = `
You are the Action Tracker agent inside Stride.

Your job: identify action items the PM is on the hook for or owns assigning.

Two source modes:
  MEETING — a transcript is provided in the user message; extract items spoken aloud
  STANDING — no transcript; pull from fetch_threads + fetch_mail since 24h ago

You will be given the existing tracker action items in your prompt. Use their
IDs in "statusUpdates" to mark items in-progress or done; never duplicate them
in "newItems".

Submit your final result via the "submit" tool with this output schema:
{
  "newItems": [
    {
      "title": string,        // imperative voice, ≤ 12 words
      "owner": string?,       // best-effort attribution
      "dueDate": string?,     // YYYY-MM-DD if explicit; omit if not
      "sourceRef": string,    // e.g. "transcript:atlas-mid-sprint" or "thread:t-2"
      "evidence": string      // brief quote from source
    }
  ],
  "statusUpdates": [
    { "id": string, "status": "open" | "in-progress" | "done", "note": string? }
  ]
}

Rules:
- An action item must have a verb and an owner-shape (named person, role, or "PM").
- Do not infer due dates that weren't said. Omit when unknown.
- Skip items that are clearly informational ("FYI") or pure status reads.
`.trim();

export async function runActionTracker(
  run: Run,
  context: { tracker: TrackerState; transcript?: string },
): Promise<AgentOutput> {
  const existing = context.tracker.actionItems
    .filter((a) => a.status !== 'done')
    .map((a) => `  - ${a.id} [${a.status}] ${a.title} (owner: ${a.owner ?? 'unassigned'}, due: ${a.dueDate ?? 'none'})`);

  const userMsg = context.transcript
    ? `MODE: MEETING

Existing tracker action items (do not duplicate; status updates only):
${existing.length > 0 ? existing.join('\n') : '  (none)'}

Transcript:
"""
${context.transcript}
"""

Extract action items from the transcript. Submit when done.`
    : `MODE: STANDING

Existing tracker action items (do not duplicate; status updates only):
${existing.length > 0 ? existing.join('\n') : '  (none)'}

Pull threads since 24h ago, then mail since 24h ago. Extract any action items the PM owns or assigns. Submit when done.`;

  return runAgent({
    run,
    agent: 'action-tracker',
    role: 'doer',
    system: SYSTEM,
    user: userMsg,
    tools: context.transcript ? [] : dataFetchTools(),
    onSubmit: ({ output, confidence, notes }) => ({
      agent: 'action-tracker',
      body: output as ActionTrackerOutput,
      confidence,
      notes,
    }),
  });
}
