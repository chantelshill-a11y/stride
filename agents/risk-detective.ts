/**
 * Risk Detective (doer).
 *
 * Surfaces blockers, slipping work, dependency conflicts, and stale items.
 * Reads the sprint board + threads + mail + the existing tracker risks so it
 * can deduplicate (don't re-surface a risk we already have).
 */

import { runAgent, dataFetchTools } from './lib/run-agent';
import type { Run } from './shared/trace';
import type { AgentOutput, Risk, TrackerState } from './shared/types';

export interface RiskDetectiveOutput {
  newRisks: Array<Omit<Risk, 'id' | 'firstSeen' | 'lastSeen' | 'source'> & { evidence: string }>;
  updates: Array<{ id: string; status?: Risk['status']; severity?: Risk['severity']; notes?: string }>;
  agedOut: string[]; // ids of tracker risks that are no longer evidenced
}

const SYSTEM = `
You are the Risk Detective agent inside Stride.

Your job: surface project risk for the PM. Three kinds of work:
  1. NEW risks — ones not already on the tracker that have current evidence in source data
  2. UPDATES — to existing tracker risks: severity changed, status changed, mitigation note
  3. AGED-OUT — existing tracker risks that have no recent evidence; should be closed

Source of truth (in priority order):
  1. fetch_sprint_board — look for "blocked" status, slip notes, items in review > 2 days
  2. fetch_threads — escalations, "blocker", "behind", "at risk" language
  3. fetch_mail — stakeholder concerns, dependency confirmations, deadline shifts
  4. fetch_docs — milestone plans for context

You will be given the existing tracker risks in your prompt. Use their IDs in "updates" and "agedOut".

Submit your final result via the "submit" tool with this output schema:
{
  "newRisks": [
    {
      "title": string,             // 1 short sentence
      "severity": "low" | "medium" | "high",
      "status": "open" | "mitigating",
      "owner": string?,
      "workstreamId": string?,
      "notes": string,             // why this is a risk + any mitigation
      "evidence": string           // quote/reference from source data
    }
  ],
  "updates": [ { "id": string, "status": ?, "severity": ?, "notes": ? } ],
  "agedOut": [ string ]
}

Rules:
- A risk requires concrete evidence. Quote a thread/mail/note in "evidence".
- "agedOut" must be ids whose evidence is no longer present in source data — be conservative.
- Severity is calibrated against the project's stated milestones, not generic feel.
- Confidence: lower when evidence is indirect or implicit.
`.trim();

export async function runRiskDetective(
  run: Run,
  context: { tracker: TrackerState; transcript?: string },
): Promise<AgentOutput> {
  const existing = context.tracker.risks
    .filter((r) => r.status !== 'resolved' && r.status !== 'aged-out')
    .map((r) => `  - ${r.id} [${r.severity}] ${r.title} (status: ${r.status}, owner: ${r.owner ?? 'unassigned'})`);

  const userMsg = context.transcript
    ? `MODE: MEETING

Existing tracker risks (do not duplicate; updates only):
${existing.length > 0 ? existing.join('\n') : '  (none)'}

Transcript:
"""
${context.transcript}
"""

Surface risks evidenced in the transcript (slips, blockers, dependency confirmations, deadline shifts). Submit when done.`
    : `MODE: STANDING

Existing tracker risks (do not duplicate):
${existing.length > 0 ? existing.join('\n') : '  (none)'}

Pull sprint board, then threads since 24h ago, then mail since 24h ago. Submit when you have a complete read.`;

  return runAgent({
    run,
    agent: 'risk-detective',
    role: 'doer',
    system: SYSTEM,
    user: userMsg,
    tools: context.transcript ? [] : dataFetchTools(),
    onSubmit: ({ output, confidence, notes }) => ({
      agent: 'risk-detective',
      body: output as RiskDetectiveOutput,
      confidence,
      notes,
    }),
  });
}
