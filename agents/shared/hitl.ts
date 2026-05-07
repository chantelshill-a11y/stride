/**
 * Human-in-the-loop gate primitives.
 *
 * Every external action and every agent handoff routes through `gate()`. The
 * agent execution awaits the user's decision before continuing. If the user
 * edits the payload, the edited version is what flows downstream; if they
 * reject, the agent throws `GateRejected` so the orchestrator can branch.
 */

import { newGateId, registerGate, type Run } from './trace';
import type { AgentName, GateDecision, HITLGate, ReviewCritique } from './types';

export class GateRejected extends Error {
  constructor(public reason?: string) {
    super(reason ?? 'Gate rejected by user');
    this.name = 'GateRejected';
  }
}

export interface GateOptions {
  kind: HITLGate['kind'];
  title: string;
  description: string;
  agent?: AgentName;
  payload: unknown;
  externalAction?: HITLGate['externalAction'];
  reviewerCritique?: ReviewCritique;
}

/**
 * Open a gate, await user decision, return the resolved payload.
 *
 * - approve  → returns the original payload
 * - edit     → returns the user-edited payload
 * - reject   → throws GateRejected
 */
export async function gate<T>(run: Run, opts: GateOptions): Promise<T> {
  const id = newGateId();
  const hitl: HITLGate = {
    id,
    kind: opts.kind,
    title: opts.title,
    description: opts.description,
    agent: opts.agent,
    payload: opts.payload,
    externalAction: opts.externalAction,
    reviewerCritique: opts.reviewerCritique,
  };
  const decision: GateDecision = await registerGate(run, hitl);
  if (decision.kind === 'reject') {
    throw new GateRejected(decision.reason);
  }
  if (decision.kind === 'edit') {
    return decision.edited as T;
  }
  return opts.payload as T;
}

/**
 * Convenience for low-confidence escalation. The reviewer flags an output;
 * we wrap the standard between-agents gate but mark it as escalated so the
 * UI can highlight it differently.
 */
export function shouldEscalate(critique: ReviewCritique): boolean {
  if (critique.verdict === 'block') return true;
  if (critique.verdict === 'flag' && critique.confidence < 0.6) return true;
  if (critique.issues.some((i) => i.severity === 'high')) return true;
  return false;
}
