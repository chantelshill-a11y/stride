'use client';

/**
 * Renders an HITL gate's payload as a human-readable view, switching on the
 * agent that produced it. The PM should never need to look at JSON unless
 * they choose to (a "show raw" details panel handles that).
 */

import { useState } from 'react';
import type { AgentName, BriefArtifact, MeetingArtifact } from '../agents/shared/types';
import type { ProposedEvent } from '../agents/calendar-export';
import { BriefView } from './BriefView';
import { MeetingArtifactView } from './MeetingArtifactView';

interface Props {
  agent: AgentName | undefined;
  payload: unknown;
  /** Called when the user edits the payload inline (e.g. calendar events). */
  onChange?: (next: unknown) => void;
}

export function GatePayloadView({ agent, payload, onChange }: Props) {
  // Final-publish / external-action gates have no `agent`; detect by shape.
  if (!agent) {
    if (isCalendarExport(payload))
      return <CalendarExportView payload={payload} onChange={onChange} />;
    if (isMeetingArtifact(payload)) return <MeetingArtifactView artifact={payload} />;
    if (isBriefArtifact(payload)) return <BriefView brief={payload} />;
    return <RawFallback payload={payload} />;
  }

  switch (agent) {
    case 'status-synthesizer':
      return <StatusView payload={payload as StatusBody} />;
    case 'risk-detective':
      return <RiskDetectiveDeltaView payload={payload as RiskDeltaBody} />;
    case 'meeting-prep':
      return <MeetingPrepView payload={payload as MeetingPrepBody} />;
    case 'action-tracker':
      return <ActionTrackerDeltaView payload={payload as ActionDeltaBody} />;
    case 'comms-tailor':
      return <CommsView payload={payload as CommsBody} />;
    default:
      return <RawFallback payload={payload} />;
  }
}

// ───── shape guards (loose; UI tolerates partial shapes during revision) ─────

function isBriefArtifact(p: unknown): p is BriefArtifact {
  return Boolean(p && typeof p === 'object' && 'standupDraft' in p && 'execUpdateDraft' in p);
}
function isMeetingArtifact(p: unknown): p is MeetingArtifact {
  return Boolean(p && typeof p === 'object' && 'summaries' in p && 'meetingTitle' in p);
}
interface CalendarPayload {
  target: 'Calendar';
  adapter: string;
  events: ProposedEvent[];
}
function isCalendarExport(p: unknown): p is CalendarPayload {
  return Boolean(
    p &&
      typeof p === 'object' &&
      'target' in p &&
      (p as { target: unknown }).target === 'Calendar' &&
      Array.isArray((p as { events?: unknown }).events),
  );
}

// ───── per-agent shapes (kept inline to avoid coupling renderer to agent types) ─────

interface StatusBody {
  yesterdayProgress?: string;
  velocity?: { completed: number; inProgress: number; blocked: number };
  slipping?: Array<{ id?: string; title?: string; reason?: string }>;
  onTrack?: Array<{ id?: string; title?: string }>;
  observations?: string[];
}
interface RiskDeltaBody {
  newRisks?: Array<{
    title?: string;
    severity?: 'low' | 'medium' | 'high';
    status?: 'open' | 'mitigating';
    owner?: string;
    workstreamId?: string;
    notes?: string;
    evidence?: string;
  }>;
  updates?: Array<{ id?: string; status?: string; severity?: string; notes?: string }>;
  agedOut?: string[];
}
interface MeetingPrepBody {
  meetings?: Array<{
    id?: string;
    title?: string;
    time?: string;
    attendees?: string[];
    agenda?: string;
    priorContext?: string;
    talkingPoints?: string[];
  }>;
}
interface ActionDeltaBody {
  newItems?: Array<{
    title?: string;
    owner?: string;
    dueDate?: string;
    sourceRef?: string;
    evidence?: string;
  }>;
  statusUpdates?: Array<{ id?: string; status?: string; note?: string }>;
}
interface CommsBody {
  // Morning-brief shape:
  standup?: string;
  exec?: string;
  client?: string;
  skipLevel?: string;
  // Meeting-mode shape uses `team` instead of `standup` and skips skipLevel:
  team?: string;
}

// ───── renderers ─────

function StatusView({ payload }: { payload: StatusBody }) {
  return (
    <div className="grid gap-5">
      {payload.yesterdayProgress && (
        <Section title="Yesterday">
          <p className="text-[color:var(--charcoal-soft)]">{payload.yesterdayProgress}</p>
        </Section>
      )}
      {payload.velocity && (
        <Section title="Velocity">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Stat label="Completed" value={payload.velocity.completed} />
            <Stat label="In progress" value={payload.velocity.inProgress} />
            <Stat label="Blocked" value={payload.velocity.blocked} />
          </div>
        </Section>
      )}
      {payload.slipping && payload.slipping.length > 0 && (
        <Section title="Slipping">
          <ul className="grid gap-2 text-sm">
            {payload.slipping.map((s, i) => (
              <li key={i} className="border-l-2 border-[color:var(--rag-amber)] pl-3">
                <div>
                  {s.id && <span className="mono text-xs text-[color:var(--charcoal-mute)] mr-2">{s.id}</span>}
                  <span className="font-medium">{s.title}</span>
                </div>
                {s.reason && <div className="text-[color:var(--charcoal-soft)] mt-0.5">{s.reason}</div>}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {payload.onTrack && payload.onTrack.length > 0 && (
        <Section title="On track">
          <ul className="grid gap-1 text-sm">
            {payload.onTrack.map((s, i) => (
              <li key={i} className="flex items-baseline gap-2">
                {s.id && <span className="mono text-xs text-[color:var(--charcoal-mute)]">{s.id}</span>}
                <span>{s.title}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {payload.observations && payload.observations.length > 0 && (
        <Section title="Observations">
          <ul className="grid gap-1 text-sm list-disc list-inside text-[color:var(--charcoal-soft)]">
            {payload.observations.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function RiskDetectiveDeltaView({ payload }: { payload: RiskDeltaBody }) {
  return (
    <div className="grid gap-5">
      {payload.newRisks && payload.newRisks.length > 0 && (
        <Section title={`New risks · ${payload.newRisks.length}`}>
          <ul className="grid gap-3 text-sm">
            {payload.newRisks.map((r, i) => (
              <li key={i} className="border border-[color:var(--rule)] p-3">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <div className="flex items-baseline gap-2">
                    {r.severity && <SevPill severity={r.severity} />}
                    <span className="font-medium">{r.title}</span>
                  </div>
                  {r.status && (
                    <span className="text-xs uppercase tracking-widest text-[color:var(--charcoal-mute)]">
                      {r.status}
                    </span>
                  )}
                </div>
                {r.notes && <p className="text-[color:var(--charcoal-soft)] mt-1">{r.notes}</p>}
                {r.evidence && (
                  <p className="text-xs text-[color:var(--charcoal-mute)] mt-1 italic">"{r.evidence}"</p>
                )}
                <div className="text-xs text-[color:var(--charcoal-mute)] mt-1 flex flex-wrap gap-x-3">
                  {r.owner && <span>owner: {r.owner}</span>}
                  {r.workstreamId && <span>workstream: {r.workstreamId}</span>}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {payload.updates && payload.updates.length > 0 && (
        <Section title={`Updates to existing risks · ${payload.updates.length}`}>
          <ul className="grid gap-1 text-sm">
            {payload.updates.map((u, i) => (
              <li key={i} className="text-[color:var(--charcoal-soft)]">
                <span className="mono text-xs text-[color:var(--charcoal-mute)] mr-2">{u.id}</span>
                {u.severity && <span className="mr-2">severity → {u.severity}</span>}
                {u.status && <span className="mr-2">status → {u.status}</span>}
                {u.notes && <span>· {u.notes}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {payload.agedOut && payload.agedOut.length > 0 && (
        <Section title={`Aged out · ${payload.agedOut.length}`}>
          <ul className="text-sm text-[color:var(--charcoal-soft)] grid gap-1">
            {payload.agedOut.map((id, i) => (
              <li key={i} className="mono text-xs">{id}</li>
            ))}
          </ul>
        </Section>
      )}
      {(!payload.newRisks || payload.newRisks.length === 0) &&
        (!payload.updates || payload.updates.length === 0) &&
        (!payload.agedOut || payload.agedOut.length === 0) && (
          <p className="text-sm text-[color:var(--charcoal-mute)]">No risk changes this run.</p>
        )}
    </div>
  );
}

function MeetingPrepView({ payload }: { payload: MeetingPrepBody }) {
  if (!payload.meetings || payload.meetings.length === 0) {
    return <p className="text-sm text-[color:var(--charcoal-mute)]">No meetings prepared.</p>;
  }
  return (
    <ul className="grid gap-4">
      {payload.meetings.map((m, i) => (
        <li key={i} className="border-l-2 border-[color:var(--forest)] pl-4">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <span className="font-medium">{m.title}</span>
            {m.time && (
              <span className="text-xs mono text-[color:var(--charcoal-mute)]">{m.time}</span>
            )}
          </div>
          {m.attendees && m.attendees.length > 0 && (
            <div className="text-xs text-[color:var(--charcoal-mute)] mt-0.5">
              {m.attendees.join(', ')}
            </div>
          )}
          {m.agenda && (
            <p className="text-sm text-[color:var(--charcoal-soft)] mt-1">{m.agenda}</p>
          )}
          {m.priorContext && (
            <p className="text-sm text-[color:var(--charcoal-soft)] mt-1 italic">{m.priorContext}</p>
          )}
          {m.talkingPoints && m.talkingPoints.length > 0 && (
            <ul className="mt-2 text-sm grid gap-0.5 list-disc list-inside text-[color:var(--charcoal-soft)]">
              {m.talkingPoints.map((t, j) => (
                <li key={j}>{t}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

function ActionTrackerDeltaView({ payload }: { payload: ActionDeltaBody }) {
  return (
    <div className="grid gap-5">
      {payload.newItems && payload.newItems.length > 0 && (
        <Section title={`New action items · ${payload.newItems.length}`}>
          <ul className="grid gap-2 text-sm">
            {payload.newItems.map((a, i) => (
              <li key={i} className="border border-[color:var(--rule)] p-3">
                <div className="font-medium">{a.title}</div>
                <div className="text-xs text-[color:var(--charcoal-mute)] mt-1 flex flex-wrap gap-x-3">
                  {a.owner && <span>owner: {a.owner}</span>}
                  {a.dueDate && <span>due {a.dueDate}</span>}
                  {a.sourceRef && <span className="mono">source: {a.sourceRef}</span>}
                </div>
                {a.evidence && (
                  <p className="text-xs text-[color:var(--charcoal-mute)] mt-1 italic">"{a.evidence}"</p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {payload.statusUpdates && payload.statusUpdates.length > 0 && (
        <Section title={`Status updates · ${payload.statusUpdates.length}`}>
          <ul className="grid gap-1 text-sm">
            {payload.statusUpdates.map((u, i) => (
              <li key={i} className="text-[color:var(--charcoal-soft)]">
                <span className="mono text-xs text-[color:var(--charcoal-mute)] mr-2">{u.id}</span>
                <span className="uppercase tracking-widest text-xs">{u.status}</span>
                {u.note && <span className="ml-2">· {u.note}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {(!payload.newItems || payload.newItems.length === 0) &&
        (!payload.statusUpdates || payload.statusUpdates.length === 0) && (
          <p className="text-sm text-[color:var(--charcoal-mute)]">No action item changes.</p>
        )}
    </div>
  );
}

function CommsView({ payload }: { payload: CommsBody }) {
  const versions: Array<{ key: keyof CommsBody; label: string }> = [
    { key: 'standup', label: 'Standup' },
    { key: 'team', label: 'Team' },
    { key: 'exec', label: 'Exec' },
    { key: 'client', label: 'Client' },
    { key: 'skipLevel', label: 'Skip-level' },
  ];
  return (
    <div className="grid gap-3">
      {versions
        .filter((v) => typeof payload[v.key] === 'string' && payload[v.key]!.length > 0)
        .map((v) => (
          <div key={v.key} className="border border-[color:var(--rule)] px-5 py-4 grid gap-2">
            <p className="eyebrow">{v.label}</p>
            <p className="text-base leading-relaxed whitespace-pre-wrap text-[color:var(--charcoal)]">
              {payload[v.key]}
            </p>
          </div>
        ))}
    </div>
  );
}

// ───── primitives ─────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2">
      <h4 className="serif text-lg text-[color:var(--forest)]">{title}</h4>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-[color:var(--rule)] p-2 text-center">
      <div className="text-2xl serif text-[color:var(--forest)]">{value}</div>
      <div className="eyebrow">{label}</div>
    </div>
  );
}

function SevPill({ severity }: { severity: 'low' | 'medium' | 'high' }) {
  const cls = severity === 'high' ? 'rag-red' : severity === 'medium' ? 'rag-amber' : 'rag-green';
  return (
    <span className={`text-xs uppercase tracking-widest border px-2 py-0.5 ${cls}`}>{severity}</span>
  );
}

function CalendarExportView({
  payload,
  onChange,
}: {
  payload: CalendarPayload;
  onChange?: (next: unknown) => void;
}) {
  // Track per-event "skip" toggles in a separate map so the user can opt
  // events out without losing their data. Skipped events are filtered before
  // the payload is sent to the gate decision.
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  if (payload.events.length === 0) {
    return <p className="text-sm text-[color:var(--charcoal-mute)]">No events to schedule.</p>;
  }

  const editable = !!onChange;
  const includedCount = payload.events.length - skipped.size;

  function updateEvent(id: string, patch: Partial<ProposedEvent>) {
    if (!onChange) return;
    onChange({
      ...payload,
      events: payload.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  }

  function applySkipsToPayload(skipSet: Set<string>) {
    if (!onChange) return;
    onChange({
      ...payload,
      events: payload.events.filter((e) => !skipSet.has(e.id)),
    });
  }

  function toggleSkip(id: string) {
    const next = new Set(skipped);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSkipped(next);
    // Note: we don't filter the payload here — the user might toggle back. The
    // skip applies on Approve, via the helper below the list.
  }

  function commitSkipsAndApprove() {
    applySkipsToPayload(skipped);
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <p className="text-xs text-[color:var(--charcoal-mute)]">
          Will be created on:{' '}
          <span className="font-medium text-[color:var(--charcoal)]">{payload.adapter}</span>
        </p>
        <p className="text-xs text-[color:var(--charcoal-mute)]">
          {includedCount} of {payload.events.length} included
        </p>
      </div>
      <ul className="grid gap-3">
        {payload.events.map((e) => {
          const isSkipped = skipped.has(e.id);
          return (
            <li
              key={e.id}
              className={`border p-4 grid gap-3 ${
                isSkipped ? 'border-[color:var(--rule)] opacity-50' : 'border-[color:var(--rule)]'
              }`}
            >
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-[color:var(--charcoal-mute)]">
                  <input
                    type="checkbox"
                    checked={!isSkipped}
                    onChange={() => toggleSkip(e.id)}
                    className="accent-[color:var(--forest)]"
                  />
                  Include
                </label>
                <KindToggle
                  kind={e.kind}
                  editable={editable}
                  onChange={(kind) => updateEvent(e.id, { kind })}
                />
              </div>

              {editable ? (
                <input
                  className="text-base font-medium bg-transparent border-b border-[color:var(--rule)] focus:border-[color:var(--forest)] outline-none py-1"
                  value={e.title}
                  onChange={(ev) => updateEvent(e.id, { title: ev.target.value })}
                />
              ) : (
                <p className="font-medium">{e.title}</p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Date">
                  {editable ? (
                    <input
                      type="date"
                      className="w-full text-sm bg-white border border-[color:var(--rule)] focus:border-[color:var(--forest)] outline-none px-2 py-1"
                      value={e.date}
                      onChange={(ev) => updateEvent(e.id, { date: ev.target.value })}
                    />
                  ) : (
                    <span className="text-sm">{e.date}</span>
                  )}
                </Field>
                <Field label="Start">
                  {editable ? (
                    <input
                      type="time"
                      className="w-full text-sm bg-white border border-[color:var(--rule)] focus:border-[color:var(--forest)] outline-none px-2 py-1"
                      value={e.startTime}
                      onChange={(ev) => updateEvent(e.id, { startTime: ev.target.value })}
                    />
                  ) : (
                    <span className="text-sm">{e.startTime}</span>
                  )}
                </Field>
                <Field label="Duration">
                  {editable ? (
                    <select
                      className="w-full text-sm bg-white border border-[color:var(--rule)] focus:border-[color:var(--forest)] outline-none px-2 py-1"
                      value={e.durationMinutes}
                      onChange={(ev) =>
                        updateEvent(e.id, { durationMinutes: parseInt(ev.target.value, 10) })
                      }
                    >
                      {[15, 30, 45, 60, 90, 120].map((m) => (
                        <option key={m} value={m}>
                          {m} min
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm">{e.durationMinutes} min</span>
                  )}
                </Field>
              </div>

              <Field label={e.kind === 'meeting' ? 'Attendees' : 'Attendees (optional)'}>
                {editable ? (
                  <input
                    className="w-full text-sm bg-white border border-[color:var(--rule)] focus:border-[color:var(--forest)] outline-none px-2 py-1"
                    placeholder="comma-separated emails"
                    value={e.attendees.join(', ')}
                    onChange={(ev) =>
                      updateEvent(e.id, {
                        attendees: ev.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                ) : e.attendees.length > 0 ? (
                  <span className="text-sm">{e.attendees.join(', ')}</span>
                ) : (
                  <span className="text-sm text-[color:var(--charcoal-mute)] italic">none</span>
                )}
              </Field>

              {e.agenda && (
                <Field label="Agenda">
                  {editable ? (
                    <input
                      className="w-full text-sm bg-white border border-[color:var(--rule)] focus:border-[color:var(--forest)] outline-none px-2 py-1"
                      value={e.agenda}
                      onChange={(ev) => updateEvent(e.id, { agenda: ev.target.value })}
                    />
                  ) : (
                    <span className="text-sm italic">{e.agenda}</span>
                  )}
                </Field>
              )}
            </li>
          );
        })}
      </ul>

      {skipped.size > 0 && editable && (
        <div className="text-xs">
          <button
            className="text-[color:var(--charcoal-soft)] underline"
            onClick={commitSkipsAndApprove}
          >
            Drop {skipped.size} skipped event{skipped.size === 1 ? '' : 's'} from the payload now
          </button>
          <span className="text-[color:var(--charcoal-mute)] ml-2">
            (otherwise they're dropped automatically when you approve)
          </span>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <span className="eyebrow">{label}</span>
      {children}
    </div>
  );
}

function KindToggle({
  kind,
  editable,
  onChange,
}: {
  kind: ProposedEvent['kind'];
  editable: boolean;
  onChange: (next: ProposedEvent['kind']) => void;
}) {
  if (!editable) {
    return (
      <span className="text-xs uppercase tracking-widest text-[color:var(--charcoal-mute)]">
        {kind === 'time-block' ? 'time block' : 'meeting'}
      </span>
    );
  }
  return (
    <div className="inline-flex border border-[color:var(--rule)]">
      {(['time-block', 'meeting'] as const).map((k) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={`px-2 py-1 text-xs uppercase tracking-widest ${
            kind === k
              ? 'bg-[color:var(--forest)] text-[color:var(--cream)]'
              : 'text-[color:var(--charcoal-mute)] hover:text-[color:var(--charcoal)]'
          }`}
        >
          {k === 'time-block' ? 'block' : 'meeting'}
        </button>
      ))}
    </div>
  );
}

function RawFallback({ payload }: { payload: unknown }) {
  return (
    <pre className="card-tight bg-[color:var(--cream-warm)] mono text-xs whitespace-pre-wrap overflow-auto max-h-72">
      {JSON.stringify(payload, null, 2)}
    </pre>
  );
}
