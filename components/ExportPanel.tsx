'use client';

/**
 * ExportPanel — universal export bar for any workflow output.
 *
 * Shows two actions:
 *   1. Export to Word    — POST /api/export/word, triggers a .docx download.
 *   2. Schedule events   — POST /api/run mode=export-calendar with proposed events;
 *                          renders the inline trace + HITL gate so the PM approves
 *                          before anything is created on their calendar.
 *
 * The calendar action only renders when `proposedEvents` has at least one entry.
 */

import { useCallback, useRef, useState } from 'react';
import type { AgentEvent, BriefArtifact, HITLGate, MeetingArtifact } from '../agents/shared/types';
import type { ProposedEvent } from '../agents/calendar-export';
import { AgentTracePanel } from './AgentTracePanel';
import { HITLGateCard } from './HITLGateCard';

type Source =
  | { kind: 'brief'; payload: BriefArtifact }
  | { kind: 'meeting'; payload: MeetingArtifact }
  | { kind: 'note'; noteId: string }
  | { kind: 'tracker' };

interface Props {
  source: Source;
  /** Required for the calendar action; omit/empty to hide the button. */
  proposedEvents?: ProposedEvent[];
  /** Used in the gate title, e.g. "Morning brief" or "Northridge mid-sprint check". */
  sourceLabel?: string;
  /**
   * When the panel sits at the bottom of an artifact (brief, meeting, note),
   * a top divider visually separates it from the artifact content. When the
   * panel stands alone in its own card (Status Tracker), set this to false.
   */
  withTopDivider?: boolean;
}

type Status = 'idle' | 'running' | 'awaiting' | 'done' | 'error';

export function ExportPanel({
  source,
  proposedEvents,
  sourceLabel,
  withTopDivider = true,
}: Props) {
  const [downloading, setDownloading] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [gates, setGates] = useState<HITLGate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleEvent = useCallback((e: AgentEvent | { type: 'run:hello'; runId: string }) => {
    if (e.type === 'run:hello') {
      setRunId(e.runId);
      return;
    }
    setEvents((prev) => [...prev, e as AgentEvent]);
    if (e.type === 'gate:open') {
      setGates((prev) => [...prev, e.gate]);
      setStatus('awaiting');
    } else if (e.type === 'gate:resolved') {
      setGates((prev) => prev.filter((g) => g.id !== e.gateId));
      setStatus('running');
    } else if (e.type === 'run:done') {
      setStatus('done');
    } else if (e.type === 'run:error') {
      setError(e.message);
      setStatus('error');
    }
  }, []);

  async function downloadWord() {
    setDownloading(true);
    setError(null);
    try {
      const reqBody =
        source.kind === 'note'
          ? { kind: 'note', noteId: source.noteId }
          : source.kind === 'tracker'
            ? { kind: 'tracker' }
            : { kind: source.kind, payload: source.payload };
      const res = await fetch('/api/export/word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Word export failed (${res.status})`);
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') ?? '';
      const match = cd.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? 'stride.docx';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  async function startCalendarExport() {
    if (!proposedEvents || proposedEvents.length === 0) return;
    setStatus('running');
    setEvents([]);
    setGates([]);
    setRunId(null);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'export-calendar',
          proposedEvents,
          sourceLabel,
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`Calendar export failed: ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) !== -1) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          for (const line of frame.split('\n')) {
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            try {
              handleEvent(JSON.parse(payload));
            } catch {
              /* ignore */
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message);
      setStatus('error');
    }
  }

  const canSchedule = (proposedEvents?.length ?? 0) > 0;

  return (
    <div
      className={`grid gap-4 ${withTopDivider ? 'pt-4 border-t border-[color:var(--rule)]' : ''}`}
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="eyebrow">Extract</p>
        <div className="flex gap-2">
          <button className="btn btn-quiet" onClick={downloadWord} disabled={downloading}>
            {downloading ? 'Building…' : 'Export to Word'}
          </button>
          {canSchedule && (
            <button
              className="btn btn-primary"
              onClick={startCalendarExport}
              disabled={status === 'running' || status === 'awaiting'}
              title="Schedule the action items as time blocks (and follow-ups as meetings) on your calendar."
            >
              Schedule action items
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="card card-tight rag-red border border-current text-xs">{error}</div>
      )}

      {status !== 'idle' && (
        <div className="grid gap-3">
          <div className="flex items-baseline justify-between">
            <p className="eyebrow">Calendar export · {status}</p>
            {runId && (
              <span className="text-xs mono text-[color:var(--charcoal-mute)]">
                run id: {runId}
              </span>
            )}
          </div>
          {gates.map((gate) => (
            <HITLGateCard key={gate.id} runId={runId ?? ''} gate={gate} onResolved={() => undefined} />
          ))}
          {events.length > 0 && gates.length === 0 && <AgentTracePanel events={events} />}
        </div>
      )}
    </div>
  );
}
