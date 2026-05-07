/**
 * Status Synthesizer (doer).
 *
 * Pulls sprint board + recent threads + recent mail and produces a structured
 * status read: yesterday's progress, velocity, slipping items, on-track items.
 * Writes to the run trace via runAgent; returns AgentOutput.
 */

import { runAgent, dataFetchTools } from './lib/run-agent';
import type { Run } from './shared/trace';
import type { AgentOutput } from './shared/types';

export interface StatusSynthesizerOutput {
  yesterdayProgress: string;
  velocity: { completed: number; inProgress: number; blocked: number };
  slipping: Array<{ id: string; title: string; reason: string }>;
  onTrack: Array<{ id: string; title: string }>;
  observations: string[];
}

const SYSTEM = `
You are the Status Synthesizer agent inside Stride — a multi-agent system for project managers.

Your job: produce a tight, factual status read on the project for the PM's morning brief.

Source of truth (in priority order):
  1. fetch_sprint_board — current sprint items, statuses, assignees, notes
  2. fetch_threads — recent channel messages (since 24h ago)
  3. fetch_mail — recent project-relevant mail (since 24h ago)
  4. fetch_docs — when you need to disambiguate a milestone or term

Submit your final result via the "submit" tool with this output schema:
{
  "yesterdayProgress": string  // 1-3 sentences, factual
  "velocity": { "completed": number, "inProgress": number, "blocked": number }
  "slipping": [ { "id": string, "title": string, "reason": string } ]
  "onTrack": [ { "id": string, "title": string } ]
  "observations": string[]     // 2-5 short observations a PM would care about
}

Rules:
- Pull from real source data via tools — do not invent items.
- "Slipping" requires evidence: a thread, mail, or note saying it slipped or is blocked.
- Keep titles short. Strip noise. Quote thread/mail evidence in observations when useful.
- Be honest about confidence. Submit "confidence" between 0 and 1 reflecting evidence quality.
- Do not make recommendations — your job is read, not advise. Risk Detective handles risk.
`.trim();

export async function runStatusSynthesizer(run: Run): Promise<AgentOutput> {
  const today = new Date().toISOString().slice(0, 10);
  return runAgent({
    run,
    agent: 'status-synthesizer',
    role: 'doer',
    system: SYSTEM,
    user: `Produce a status read for ${today}. Pull sprint board first, then threads since 24h ago, then mail since 24h ago. Submit when you have a complete read.`,
    tools: dataFetchTools(),
    onSubmit: ({ output, confidence, notes }) => ({
      agent: 'status-synthesizer',
      body: output as StatusSynthesizerOutput,
      confidence,
      notes,
    }),
  });
}
