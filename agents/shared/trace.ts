/**
 * In-memory run registry.
 *
 * Holds the event stream and HITL gates for each active run so the SSE endpoint
 * can subscribe and the /api/approve endpoint can resolve gates. For a single
 * Next.js dev server (and a single Netlify function instance) this is enough.
 *
 * For multi-instance production: lift to Upstash Redis pub/sub + checkpoints.
 * The wire format and Run interface below already match what that swap will need.
 */

import type { AgentEvent, GateDecision, HITLGate } from './types';

type Subscriber = (e: AgentEvent) => void;

interface PendingGate {
  gate: HITLGate;
  resolve: (d: GateDecision) => void;
  reject: (err: Error) => void;
}

export interface Run {
  runId: string;
  startedAt: number;
  events: AgentEvent[];
  subscribers: Set<Subscriber>;
  gates: Map<string, PendingGate>;
  finished: boolean;
}

// Pin to globalThis so Next.js HMR doesn't drop in-flight runs.
const GLOBAL_KEY = '__cadence_runs__';
const globalAny = globalThis as unknown as { [GLOBAL_KEY]?: Map<string, Run> };
const runs: Map<string, Run> =
  globalAny[GLOBAL_KEY] ?? (globalAny[GLOBAL_KEY] = new Map<string, Run>());

export function createRun(runId: string): Run {
  const run: Run = {
    runId,
    startedAt: Date.now(),
    events: [],
    subscribers: new Set(),
    gates: new Map(),
    finished: false,
  };
  runs.set(runId, run);
  return run;
}

export function getRun(runId: string): Run | undefined {
  return runs.get(runId);
}

export function emit(run: Run, event: AgentEvent): void {
  run.events.push(event);
  for (const sub of run.subscribers) {
    try {
      sub(event);
    } catch {
      /* swallow subscriber errors so one bad subscriber can't break the run */
    }
  }
  if (event.type === 'run:done' || event.type === 'run:error') {
    run.finished = true;
    setTimeout(() => runs.delete(run.runId), 60_000); // grace period for late SSE consumers
  }
}

export function subscribe(run: Run, sub: Subscriber): () => void {
  run.subscribers.add(sub);
  return () => run.subscribers.delete(sub);
}

export function registerGate(run: Run, gate: HITLGate): Promise<GateDecision> {
  return new Promise<GateDecision>((resolve, reject) => {
    run.gates.set(gate.id, { gate, resolve, reject });
    emit(run, { type: 'gate:open', runId: run.runId, gate, ts: Date.now() });
  });
}

export function resolveGate(runId: string, gateId: string, decision: GateDecision): boolean {
  const run = runs.get(runId);
  if (!run) return false;
  const pending = run.gates.get(gateId);
  if (!pending) return false;
  run.gates.delete(gateId);
  emit(run, { type: 'gate:resolved', runId, gateId, decision, ts: Date.now() });
  pending.resolve(decision);
  return true;
}

export function newRunId(): string {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function newGateId(): string {
  return `gate_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
