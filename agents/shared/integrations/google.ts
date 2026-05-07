/**
 * Google Workspace adapter (Calendar + Gmail).
 *
 * Skeleton: implements the IntegrationAdapter contract and registers itself
 * when GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET are set in env. The OAuth flow
 * lives in `app/api/auth/google/[...]` (Phase 9 wiring) and stores access
 * tokens in an encrypted cookie. The adapter uses the current request's token.
 *
 * Returns the same internal shapes as the synthetic adapter, so agents can't
 * tell the difference. Today this is mock-shaped; replace the marked sections
 * with real Google API calls (calendar.events.list, gmail.users.messages.list)
 * once OAuth is wired.
 */

import type {
  CalendarEvent,
  IntegrationAdapter,
  IntegrationFetchArgs,
  IntegrationFetchResult,
  IntegrationCapability,
  IntegrationAction,
  IntegrationActionArgs,
  MailMessage,
} from '../types';

async function fetchCalendar(args: IntegrationFetchArgs['calendar']): Promise<CalendarEvent[]> {
  // TODO(real-mode): replace with:
  //   const token = await getGoogleAccessToken();
  //   const res = await fetch(
  //     `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
  //     `?timeMin=${encodeURIComponent(args.rangeStart)}&timeMax=${encodeURIComponent(args.rangeEnd)}` +
  //     `&singleEvents=true&orderBy=startTime`,
  //     { headers: { Authorization: `Bearer ${token}` } },
  //   );
  //   const json = await res.json();
  //   return json.items.map(toCalendarEvent);
  void args;
  return [];
}

async function fetchMail(args: IntegrationFetchArgs['mail']): Promise<MailMessage[]> {
  // TODO(real-mode): replace with Gmail messages.list + messages.get for each
  // message id, mapping to MailMessage. Filter `internalDate >= sinceMs`.
  void args;
  return [];
}

export const googleAdapter: IntegrationAdapter = {
  id: 'google',
  displayName: 'Google Workspace (Calendar + Gmail)',
  capabilities: ['calendar', 'mail'],

  async fetch<T extends IntegrationCapability>(
    capability: T,
    args: IntegrationFetchArgs[T],
  ): Promise<IntegrationFetchResult[T]> {
    if (capability === 'calendar') {
      return (await fetchCalendar(args as IntegrationFetchArgs['calendar'])) as IntegrationFetchResult[T];
    }
    if (capability === 'mail') {
      return (await fetchMail(args as IntegrationFetchArgs['mail'])) as IntegrationFetchResult[T];
    }
    throw new Error(`Google adapter does not support capability "${capability}"`);
  },

  async execute<T extends IntegrationAction>(
    action: T,
    args: IntegrationActionArgs[T],
  ): Promise<{ ok: boolean; ref?: string; message?: string }> {
    // Only invoked downstream of an approved external-action HITL gate.
    if (action === 'send-email') {
      // TODO(real-mode): build RFC822, base64url-encode, POST to gmail.users.messages.send.
      const a = args as IntegrationActionArgs['send-email'];
      return {
        ok: false,
        message: `Google adapter not yet wired. Would send to ${a.to.join(', ')} with subject "${a.subject}".`,
      };
    }
    if (action === 'create-event') {
      // TODO(real-mode):
      //   POST https://www.googleapis.com/calendar/v3/calendars/primary/events
      //   {
      //     summary: title,
      //     start: { dateTime: start, timeZone: 'UTC' },
      //     end:   { dateTime: end,   timeZone: 'UTC' },
      //     attendees: attendees.map((email) => ({ email })),
      //     description: agenda ?? '',
      //   }
      const a = args as IntegrationActionArgs['create-event'];
      return {
        ok: false,
        message: `Google adapter not yet wired. Would create event "${a.title}" ${a.start} → ${a.end}${a.attendees.length ? ` with ${a.attendees.length} attendee(s)` : ''}.`,
      };
    }
    return { ok: false, message: `Google adapter does not support action "${action}".` };
  },
};

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
