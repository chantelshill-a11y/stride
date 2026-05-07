/**
 * Meeting Prep (doer).
 *
 * For each meeting on today's calendar, produces a concise prep block:
 * agenda restated, attendees, prior context, and 3-5 talking points.
 */

import { runAgent, dataFetchTools } from './lib/run-agent';
import type { Run } from './shared/trace';
import type { AgentOutput } from './shared/types';

export interface MeetingPrepBlock {
  id: string;
  title: string;
  time: string;
  attendees: string[];
  agenda: string;
  priorContext: string;
  talkingPoints: string[];
}

export interface MeetingPrepOutput {
  meetings: MeetingPrepBlock[];
}

const SYSTEM = `
You are the Meeting Prep agent inside Stride.

Your job: for each meeting today, give the PM the briefest possible prep block.

Source of truth (in priority order):
  1. fetch_calendar — meetings on the requested day
  2. fetch_threads — recent context per meeting topic
  3. fetch_mail — recent stakeholder messages relevant to the meeting
  4. fetch_docs — milestone plans, prior readout notes

For each meeting, submit:
{
  "id": string,                  // calendar event id
  "title": string,
  "time": string,                // "HH:mm–HH:mm"
  "attendees": [string],
  "agenda": string,              // 1 sentence
  "priorContext": string,        // 1-2 sentences of why this meeting matters now
  "talkingPoints": [string]      // 3-5 short bullets — concrete, actionable
}

Submit a single object with key "meetings" containing an array of these blocks.

Rules:
- Only include meetings on the requested date.
- Prefer evidence-backed talking points (something that actually happened in source data).
- Never invent attendees, agenda items, or prior decisions.
`.trim();

export async function runMeetingPrep(run: Run): Promise<AgentOutput> {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  return runAgent({
    run,
    agent: 'meeting-prep',
    role: 'doer',
    system: SYSTEM,
    user: `Prepare for ${today}. Pull calendar (range ${today} to ${tomorrow}), then per-meeting context from threads and mail. Submit one consolidated MeetingPrepOutput.`,
    tools: dataFetchTools(),
    onSubmit: ({ output, confidence, notes }) => ({
      agent: 'meeting-prep',
      body: output as MeetingPrepOutput,
      confidence,
      notes,
    }),
  });
}
