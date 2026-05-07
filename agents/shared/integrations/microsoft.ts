/**
 * Microsoft Graph adapter (Outlook calendar + mail).
 *
 * Skeleton: implements the IntegrationAdapter contract and registers itself
 * when MICROSOFT_CLIENT_ID + MICROSOFT_CLIENT_SECRET are set in env. OAuth
 * flow lives in `app/api/auth/microsoft/[...]` (Phase 9 wiring).
 *
 * Returns the same internal shapes as the synthetic adapter so agents see no
 * difference. Today this is mock-shaped; replace marked sections with real
 * Graph calls (/me/calendar/calendarView, /me/messages) once OAuth is wired.
 */

import type {
  CalendarEvent,
  DocSnippet,
  IntegrationAction,
  IntegrationActionArgs,
  IntegrationAdapter,
  IntegrationCapability,
  IntegrationFetchArgs,
  IntegrationFetchResult,
  MailMessage,
} from '../types';

async function fetchCalendar(args: IntegrationFetchArgs['calendar']): Promise<CalendarEvent[]> {
  // TODO(real-mode):
  //   const token = await getMicrosoftAccessToken();
  //   const res = await fetch(
  //     `https://graph.microsoft.com/v1.0/me/calendar/calendarView` +
  //     `?startDateTime=${encodeURIComponent(args.rangeStart)}&endDateTime=${encodeURIComponent(args.rangeEnd)}`,
  //     { headers: { Authorization: `Bearer ${token}` } },
  //   );
  //   ...
  void args;
  return [];
}

async function fetchMail(args: IntegrationFetchArgs['mail']): Promise<MailMessage[]> {
  // TODO(real-mode): /me/messages?$filter=receivedDateTime ge {sinceIso}
  void args;
  return [];
}

async function fetchDocs(args: IntegrationFetchArgs['docs']): Promise<DocSnippet[]> {
  // TODO(real-mode): SharePoint search or Graph search across docs.
  void args;
  return [];
}

export const microsoftAdapter: IntegrationAdapter = {
  id: 'microsoft',
  displayName: 'Microsoft 365 (Outlook + Calendar)',
  capabilities: ['calendar', 'mail', 'docs'],

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
    if (capability === 'docs') {
      return (await fetchDocs(args as IntegrationFetchArgs['docs'])) as IntegrationFetchResult[T];
    }
    throw new Error(`Microsoft adapter does not support capability "${capability}"`);
  },

  async execute<T extends IntegrationAction>(
    action: T,
    args: IntegrationActionArgs[T],
  ): Promise<{ ok: boolean; ref?: string; message?: string }> {
    if (action === 'send-email') {
      // TODO(real-mode): POST /me/sendMail with the message payload.
      const a = args as IntegrationActionArgs['send-email'];
      return {
        ok: false,
        message: `Microsoft adapter not yet wired. Would send to ${a.to.join(', ')} with subject "${a.subject}".`,
      };
    }
    if (action === 'create-event') {
      // TODO(real-mode):
      //   POST https://graph.microsoft.com/v1.0/me/events
      //   {
      //     subject: title,
      //     start: { dateTime: start, timeZone: 'UTC' },
      //     end:   { dateTime: end,   timeZone: 'UTC' },
      //     attendees: attendees.map((email) => ({ emailAddress: { address: email }, type: 'required' })),
      //     body: { contentType: 'text', content: agenda ?? '' },
      //   }
      const a = args as IntegrationActionArgs['create-event'];
      return {
        ok: false,
        message: `Microsoft adapter not yet wired. Would create event "${a.title}" ${a.start} → ${a.end}${a.attendees.length ? ` with ${a.attendees.length} attendee(s)` : ''}.`,
      };
    }
    return { ok: false, message: `Microsoft adapter does not support action "${action}".` };
  },
};

export function isMicrosoftConfigured(): boolean {
  return Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
}
