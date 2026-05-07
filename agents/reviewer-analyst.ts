/**
 * Reviewer/Analyst (reviewer).
 *
 * Critiques a doer agent's output before it reaches the human gate. Flags
 * factual issues, missing context, tone misfires, and hallucinated specifics.
 * Returns a ReviewCritique that the orchestrator attaches to the HITL gate
 * so the user sees both the draft and the critique side by side.
 */

import { runAgent } from './lib/run-agent';
import { emit, type Run } from './shared/trace';
import type { AgentName, AgentOutput, ReviewCritique } from './shared/types';

const SYSTEM = `
You are the Reviewer/Analyst agent inside Stride.

Your job: critique another agent's output before it reaches a human PM.
You are not nice — you are useful. Flag what's wrong, what's missing, what's a stretch.

For every doer output you receive, evaluate:
  - Factual grounding: does every concrete claim trace to source data?
  - Missing context: is anything material to a PM left out?
  - Tone & audience: appropriate for the artifact's intended audience?
  - Hallucinated specifics: any names, numbers, dates, or quotes not in source?
  - Confidence calibration: did the doer overclaim?

Submit your final result via the "submit" tool with this output schema:
{
  "verdict": "pass" | "flag" | "block",
  "confidence": number (0..1),
  "issues": [ { "severity": "low" | "medium" | "high", "note": string } ],
  "suggestedEdits": string  // optional, only when you have a concrete fix
}

Verdict rules:
- "pass": output is solid, no material issues
- "flag": one or more medium issues; PM should review before approving
- "block": high-severity factual error, hallucination, or tone misfire; do not let through

Be brief. Each issue note should be one sentence and actionable.
`.trim();

export async function runReviewerAnalyst(
  run: Run,
  reviewedAgent: AgentName,
  doerOutput: AgentOutput,
  context: string,
): Promise<ReviewCritique> {
  const result = await runAgent({
    run,
    agent: 'reviewer-analyst',
    role: 'reviewer',
    system: SYSTEM,
    user: `Critique this output from ${reviewedAgent}.

Context (source data the doer was given):
${context}

Doer output:
${JSON.stringify(doerOutput.body, null, 2)}

Doer self-reported confidence: ${doerOutput.confidence}
Doer notes: ${doerOutput.notes ?? '(none)'}

Submit your critique.`,
    tools: [],
    onSubmit: ({ output, confidence, notes }) => ({
      agent: 'reviewer-analyst',
      body: output,
      confidence,
      notes,
    }),
  });

  const body = result.body as Partial<ReviewCritique>;
  const critique: ReviewCritique = {
    reviewedAgent,
    verdict: body.verdict ?? 'flag',
    confidence: body.confidence ?? result.confidence,
    issues: body.issues ?? [],
    suggestedEdits: body.suggestedEdits,
  };

  emit(run, {
    type: 'reviewer:critique',
    runId: run.runId,
    targetAgent: reviewedAgent,
    critique,
    ts: Date.now(),
  });

  return critique;
}
