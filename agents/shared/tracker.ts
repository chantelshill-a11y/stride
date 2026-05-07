/**
 * Persistent Status Tracker state.
 *
 * In production this is backed by Upstash Redis. For local dev and the
 * synthetic-mode demo it lives in memory and seeds from the synthetic fixture.
 * Both paths use the same TrackerState shape so the agent code never branches.
 */

import type { TrackerState } from './types';
import { initialTracker } from '../../fixtures/synthetic-project/index';

/**
 * Pin the in-memory store to globalThis so Next.js HMR doesn't reset it on
 * every code reload during local dev. Production deploys should swap this for
 * Upstash Redis (the shape stays identical).
 */
const GLOBAL_KEY = '__cadence_tracker_store__';
const globalAny = globalThis as unknown as { [GLOBAL_KEY]?: Map<string, TrackerState> };
const memoryStore: Map<string, TrackerState> =
  globalAny[GLOBAL_KEY] ?? (globalAny[GLOBAL_KEY] = new Map<string, TrackerState>());

const DEFAULT_PROJECT_ID = 'synthetic';

export async function loadTracker(projectId: string = DEFAULT_PROJECT_ID): Promise<TrackerState> {
  const existing = memoryStore.get(projectId);
  if (existing) return existing;
  // First load: seed from fixture so the demo has a believable starting state.
  const seeded: TrackerState = JSON.parse(JSON.stringify(initialTracker));
  memoryStore.set(projectId, seeded);
  return seeded;
}

export async function saveTracker(
  state: TrackerState,
  projectId: string = DEFAULT_PROJECT_ID,
): Promise<void> {
  memoryStore.set(projectId, state);
}

export async function resetTracker(projectId: string = DEFAULT_PROJECT_ID): Promise<TrackerState> {
  memoryStore.delete(projectId);
  return loadTracker(projectId);
}
