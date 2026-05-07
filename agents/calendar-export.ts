/**
 * Calendar export workflow.
 *
 * Takes a list of proposed events (built by the UI from a brief or meeting
 * artifact's action items + follow-up invites) and:
 *   1. Opens an external-action HITL gate so the PM can review / edit / revise
 *      via natural language before anything is sent.
 *   2. On approval, calls `create-event` on the configured calendar adapter
 *      (Microsoft for Outlook, Google for Google Calendar). Synthetic adapter
 *      handles the demo case as a no-op so the gate can be exercised without
 *      OAuth.
 *   3. Reports a summary of which events created OK and which failed.
 */

import { gate, GateRejected } from './shared/hitl';
import { emit, type Run } from './shared/trace';
import { getAdapter, hasAdapter } from './shared/integrations/registry';

/** A single calendar event proposed by the UI. */
export interface ProposedEvent {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM (24-hour). */
  startTime: string;
  durationMinutes: number;
  attendees: string[];
  agenda?: string;
  /** "time-block" = solo work block on the PM's own calendar; "meeting" = invite with attendees. */
  kind: 'time-block' | 'meeting';
  /** Where this event came from, surfaced in the UI. */
  source: { kind: 'action-item' | 'follow-up' | 'manual'; ref?: string };
}

export interface CalendarExportInput {
  events: ProposedEvent[];
  sourceLabel?: string;
}

export interface CalendarExportPayload {
  target: 'Calendar';
  adapter: string;
  events: ProposedEvent[];
}

export async function runCalendarExport(run: Run, input: CalendarExportInput): Promise<void> {
  emit(run, {
    type: 'run:plan',
    runId: run.runId,
    plan: ['build proposed events', 'hitl: approve calendar export', 'create events via adapter'],
    ts: Date.now(),
  });

  // Pick the configured calendar adapter, falling back to synthetic so the
  // demo flow is end-to-end testable without OAuth.
  const adapterId = hasAdapter('microsoft')
    ? 'microsoft'
    : hasAdapter('google')
      ? 'google'
      : 'synthetic';
  const adapter = getAdapter(adapterId);

  const payload: CalendarExportPayload = {
    target: 'Calendar',
    adapter: adapter.displayName,
    events: input.events,
  };

  const description =
    adapterId === 'synthetic'
      ? `No real calendar adapter is configured, so this will be a no-op (synthetic mode). Approve to test the flow end-to-end without sending anything externally. ${input.events.length} event${input.events.length === 1 ? '' : 's'} would be created.`
      : `Stride will create ${input.events.length} event${input.events.length === 1 ? '' : 's'} on your ${adapter.displayName} calendar. Edit times or attendees with natural language before approving.`;

  let approved: CalendarExportPayload;
  try {
    approved = await gate<CalendarExportPayload>(run, {
      kind: 'external-action',
      title: input.sourceLabel
        ? `Schedule from "${input.sourceLabel}" — ${input.events.length} event${input.events.length === 1 ? '' : 's'}`
        : `Schedule ${input.events.length} event${input.events.length === 1 ? '' : 's'}`,
      description,
      payload,
      externalAction: {
        target: 'calendar',
        summary: `Create ${input.events.length} calendar event${input.events.length === 1 ? '' : 's'}`,
      },
    });
  } catch (err) {
    if (err instanceof GateRejected) {
      emit(run, { type: 'run:done', runId: run.runId, ts: Date.now() });
      return;
    }
    throw err;
  }

  // Execute one create-event per approved event.
  const created: Array<{ title: string; ok: boolean; ref?: string; message?: string }> = [];
  for (const e of approved.events) {
    const startIso = composeIso(e.date, e.startTime);
    const endIso = addMinutes(startIso, e.durationMinutes);
    const result = await adapter.execute('create-event', {
      title: e.title,
      attendees: e.attendees,
      start: startIso,
      end: endIso,
      agenda: e.agenda,
    });
    created.push({ title: e.title, ok: result.ok, ref: result.ref, message: result.message });
  }

  const okCount = created.filter((c) => c.ok).length;
  const summary = `Calendar export: ${okCount}/${created.length} event${created.length === 1 ? '' : 's'} created via ${adapter.displayName}.`;
  emit(run, { type: 'tracker:updated', runId: run.runId, summary, ts: Date.now() });

  emit(run, { type: 'run:done', runId: run.runId, ts: Date.now() });
}

function composeIso(date: string, time: string): string {
  // date = YYYY-MM-DD, time = HH:MM
  const [h, m] = time.split(':').map((n) => parseInt(n, 10));
  return `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

function addMinutes(iso: string, minutes: number): string {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + minutes);
  // Trim to YYYY-MM-DDTHH:MM:SS (drop ms + Z to keep "local" semantics for the
  // adapter to interpret with its own time zone).
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:00`;
}
