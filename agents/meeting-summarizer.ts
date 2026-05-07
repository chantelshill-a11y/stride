/**
 * Meeting Summarizer (doer).
 *
 * In Meeting Mode, produces three audience-tailored summaries of a single
 * meeting: team / exec / client. Reuses the Comms Tailor brief but inputs
 * are a transcript + extracted action items + extracted risks.
 *
 * Kept separate from Comms Tailor because the prompts and output shape
 * differ enough that combining them muddies the contract.
 */

import { runAgent } from './lib/run-agent';
import type { Run } from './shared/trace';
import type { AgentOutput, Risk } from './shared/types';
import type { ActionTrackerOutput } from './action-tracker';

export interface MeetingSummarizerOutput {
  team: string;
  exec: string;
  client: string;
}

const SYSTEM = `
You are the Meeting Summarizer agent inside Stride.

Your job: take a meeting transcript plus the action items + risks already
extracted from it, and draft three audience-tailored summaries.

Audiences:

  TEAM (~80 words):
  - For people who weren't in the meeting but work on the project
  - Cover decisions made, action items spawned, blockers raised
  - Plain language; ticket IDs ok

  EXEC (~120 words):
  - For leadership not in the meeting
  - Lead with the headline (status / decision / risk)
  - Quantify slip if any
  - Surface any decision needed from leadership; otherwise omit

  CLIENT (~90 words):
  - For external stakeholders
  - Outcomes-focused; no internal language
  - Honest about timing without disclosing internals
  - Never name individual contributors

Submit your final result via the "submit" tool with this output schema:
{ "team": string, "exec": string, "client": string }

Rules:
- Use only facts from the transcript / action items / risks.
- Never invent attendees, decisions, or timelines.
- No emojis.
`.trim();

export async function runMeetingSummarizer(
  run: Run,
  context: { transcript: string; actions: ActionTrackerOutput; risks: Risk[]; meetingTitle: string },
): Promise<AgentOutput> {
  return runAgent({
    run,
    agent: 'comms-tailor',
    role: 'doer',
    system: SYSTEM,
    user: `Meeting: ${context.meetingTitle}

Transcript:
"""
${context.transcript}
"""

Action items extracted from this meeting:
${JSON.stringify(context.actions.newItems, null, 2)}

Risks extracted from this meeting:
${JSON.stringify(context.risks, null, 2)}

Draft team / exec / client summaries.`,
    tools: [],
    onSubmit: ({ output, confidence, notes }) => ({
      agent: 'comms-tailor',
      body: output as MeetingSummarizerOutput,
      confidence,
      notes,
    }),
  });
}
