/**
 * Integration registry.
 *
 * Agents query this registry instead of importing specific adapters. Adding a
 * new source (Jira, Linear, Slack, Notion) is a self-contained change:
 *
 *   1. Drop in `agents/shared/integrations/<id>.ts` exporting an IntegrationAdapter.
 *   2. `register(adapter)` it once, on module load.
 *   3. The settings UI auto-displays it via `listAdapters()`.
 *
 * No agent or orchestrator code changes required.
 */

import type { IntegrationAdapter } from '../types';
import { syntheticAdapter } from './synthetic';
import { googleAdapter, isGoogleConfigured } from './google';
import { microsoftAdapter, isMicrosoftConfigured } from './microsoft';

const adapters = new Map<IntegrationAdapter['id'], IntegrationAdapter>();

export function register(adapter: IntegrationAdapter): void {
  adapters.set(adapter.id, adapter);
}

export function getAdapter(id: IntegrationAdapter['id']): IntegrationAdapter {
  const adapter = adapters.get(id);
  if (!adapter) {
    throw new Error(`Integration adapter "${id}" is not registered.`);
  }
  return adapter;
}

export function listAdapters(): IntegrationAdapter[] {
  return Array.from(adapters.values());
}

export function hasAdapter(id: IntegrationAdapter['id']): boolean {
  return adapters.has(id);
}

// Default registrations. Synthetic always available; real adapters register
// only when their env vars are present.
register(syntheticAdapter);
if (isGoogleConfigured()) register(googleAdapter);
if (isMicrosoftConfigured()) register(microsoftAdapter);
