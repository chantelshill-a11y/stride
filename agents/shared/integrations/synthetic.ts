/**
 * Synthetic integration adapter.
 *
 * Serves the baked-in fake-project fixture so visitors can run a real-looking
 * brief without authenticating anything. The shape exactly matches what real
 * adapters return — agents can't tell the difference.
 */

import type {
  IntegrationAction,
  IntegrationActionArgs,
  IntegrationAdapter,
  IntegrationCapability,
  IntegrationFetchArgs,
  IntegrationFetchResult,
} from '../types';
import {
  syntheticSprintBoard,
  syntheticCalendar,
  syntheticMail,
  syntheticThreads,
  syntheticDocs,
} from '../../../fixtures/synthetic-project/index';

export const syntheticAdapter: IntegrationAdapter = {
  id: 'synthetic',
  displayName: 'Synthetic project (demo)',
  capabilities: ['sprint-board', 'calendar', 'mail', 'threads', 'docs'],

  async fetch<T extends IntegrationCapability>(
    capability: T,
    _args: IntegrationFetchArgs[T],
  ): Promise<IntegrationFetchResult[T]> {
    switch (capability) {
      case 'sprint-board':
        return syntheticSprintBoard as IntegrationFetchResult[T];
      case 'calendar':
        return syntheticCalendar as IntegrationFetchResult[T];
      case 'mail':
        return syntheticMail as IntegrationFetchResult[T];
      case 'threads':
        return syntheticThreads as IntegrationFetchResult[T];
      case 'docs':
        return syntheticDocs as IntegrationFetchResult[T];
      default:
        throw new Error(`synthetic adapter does not support capability "${capability}"`);
    }
  },

  async execute<T extends IntegrationAction>(
    action: T,
    args: IntegrationActionArgs[T],
  ): Promise<{ ok: boolean; ref?: string; message?: string }> {
    // Synthetic mode never sends anything for real. We acknowledge the action
    // so the demo can show "sent" without side effects.
    if (action === 'create-event') {
      const a = args as IntegrationActionArgs['create-event'];
      return {
        ok: true,
        ref: `synthetic-event-${Date.now().toString(36)}`,
        message: `Synthetic mode: would have created event "${a.title}" ${a.start} → ${a.end}${a.attendees.length ? ` with ${a.attendees.length} attendee(s)` : ''}.`,
      };
    }
    return {
      ok: true,
      ref: `synthetic-${action}-${Date.now().toString(36)}`,
      message: `Synthetic mode: ${action} acknowledged.`,
    };
  },
};
