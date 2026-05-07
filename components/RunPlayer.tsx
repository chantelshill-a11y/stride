'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AgentTracePanel } from './AgentTracePanel';
import { HITLGateCard } from './HITLGateCard';
import { BriefView } from './BriefView';
import { MeetingArtifactView } from './MeetingArtifactView';
import { orchestrateMorningBrief } from './lib/orchestrate-morning-brief';
import { orchestrateMeetingMode } from './lib/orchestrate-meeting-mode';
import type {
  AgentEvent,
  BriefArtifact,
  GateDecision,
  HITLGate,
  MeetingArtifact,
} from '../agents/shared/types';

type RunStatus = 'idle' | 'running' | 'awaiting' | 'done' | 'error';

interface RunPlayerProps {
  mode: 'morning-brief' | 'meeting-mode' | 'status-only';
  ctaLabel?: string;
  description?: string;
  meetingTranscript?: string;
  meetingTitle?: string;
}

export function RunPlayer({
  mode,
  ctaLabel = 'Run',
  description,
  meetingTranscript,
  meetingTitle,
}: RunPlayerProps) {
  const [status, setStatus] = useState<RunStatus>('idle');
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [openGates, setOpenGates] = useState<HITLGate[]>([]);
  const [brief, setBrief] = useState<BriefArtifact | null>(null);
  const [meeting, setMeeting] = useState<MeetingArtifact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [traceMode, setTraceMode] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * Pending gate Promise resolvers, keyed by gateId. Populated when the
   * client orchestrator opens a gate; emptied when the user clicks
   * Approve/Edit/Reject and we resolve the corresponding Promise.
   */
  const gateResolversRef = useRef<Map<string, (decision: GateDecision) => void>>(new Map());

  const handleEvent = useCallback((e: AgentEvent | { type: 'run:hello'; runId: string }) => {
    if (e.type === 'run:hello') {
      setRunId(e.runId);
      return;
    }
    setEvents((prev) => [...prev, e as AgentEvent]);

    if (e.type === 'run:start') {
      setRunId(e.runId);
    } else if (e.type === 'gate:open') {
      setOpenGates((prev) => [...prev, e.gate]);
      setStatus('awaiting');
    } else if (e.type === 'gate:resolved') {
      setOpenGates((prev) => prev.filter((g) => g.id !== e.gateId));
      setStatus('running');
    } else if (e.type === 'run:done') {
      if (e.brief) setBrief(e.brief);
      if (e.meeting) setMeeting(e.meeting);
      setStatus('done');
    } else if (e.type === 'run:error') {
      setError(e.message);
      setStatus('error');
    }
  }, []);

  /**
   * Returns a Promise that resolves with the user's gate decision. The
   * resolver is stashed in gateResolversRef and fired by HITLGateCard's
   * onDecide callback when the user clicks Approve/Edit/Reject.
   */
  const openGate = useCallback((gate: HITLGate): Promise<GateDecision> => {
    return new Promise<GateDecision>((resolve) => {
      gateResolversRef.current.set(gate.id, resolve);
    });
  }, []);

  const onGateDecide = useCallback((gateId: string, decision: GateDecision) => {
    const resolver = gateResolversRef.current.get(gateId);
    if (resolver) {
      gateResolversRef.current.delete(gateId);
      resolver(decision);
    }
    // Optimistically remove the card; the orchestrator will also emit
    // gate:resolved which will redundantly remove it from openGates.
    setOpenGates((prev) => prev.filter((g) => g.id !== gateId));
    setStatus('running');
  }, []);

  const start = useCallback(async () => {
    setStatus('running');
    setEvents([]);
    setOpenGates([]);
    setBrief(null);
    setMeeting(null);
    setError(null);
    setRunId(null);
    gateResolversRef.current.clear();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Decide whether to use the client-side orchestrator (live mode, with
      // ANTHROPIC_API_KEY on the server) or the server-side replay endpoint.
      const modeRes = await fetch('/api/mode', { cache: 'no-store', signal: controller.signal });
      const { live } = (await modeRes.json()) as { live: boolean; replay: boolean };

      if (live && (mode === 'morning-brief' || mode === 'meeting-mode')) {
        await runClientSide(controller.signal);
      } else {
        await runServerSide(controller.signal);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message);
      setStatus('error');
    }
  }, [mode, handleEvent, openGate, meetingTranscript, meetingTitle]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Live mode: run the orchestrator in the browser, calling /api/agent per agent. */
  const runClientSide = useCallback(
    async (signal: AbortSignal) => {
      if (mode === 'morning-brief') {
        await orchestrateMorningBrief({
          onEvent: (e) => handleEvent(e),
          openGate,
          signal,
        });
      } else if (mode === 'meeting-mode') {
        const transcript = meetingTranscript ?? '';
        const title = meetingTitle ?? 'Meeting';
        await orchestrateMeetingMode({
          transcript,
          meetingTitle: title,
          onEvent: (e) => handleEvent(e),
          openGate,
          signal,
        });
      }
    },
    [mode, meetingTranscript, meetingTitle, handleEvent, openGate],
  );

  /** Replay / status-only mode: server-side orchestrator on /api/run. */
  const runServerSide = useCallback(
    async (signal: AbortSignal) => {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          meetingTranscript: mode === 'meeting-mode' ? meetingTranscript : undefined,
        }),
        signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`Run failed to start: ${res.status} ${res.statusText}`);
      }

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
              const evt = JSON.parse(payload);
              handleEvent(evt);
            } catch {
              /* skip malformed frames */
            }
          }
        }
      }
    },
    [mode, meetingTranscript, handleEvent],
  );

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const handleGateResolved = useCallback(() => {
    // Optimistic UI update; the gate:resolved event from the orchestrator
    // will also remove it, but this keeps the UI snappy if the event lags.
  }, []);

  return (
    <div className="grid gap-8">
      <header className="grid gap-3">
        <div className="flex items-baseline justify-between">
          <p className="eyebrow">{mode.replace('-', ' ')}</p>
          <RunStatusPill status={status} />
        </div>
        {description && <p className="text-[color:var(--charcoal-soft)] max-w-2xl">{description}</p>}
        <div className="flex flex-wrap gap-3 items-center">
          <button
            className="btn btn-primary"
            onClick={start}
            disabled={status === 'running' || status === 'awaiting'}
          >
            {status === 'idle' || status === 'done' || status === 'error' ? ctaLabel : 'Running…'}
          </button>
          <button
            className="btn btn-quiet"
            onClick={() => setTraceMode((t) => !t)}
            aria-pressed={traceMode}
            title="Toggle the live agent trace panel. Trace mode shows orchestration; polished mode shows only the final artifact."
          >
            {traceMode ? 'Hide trace' : 'Show trace'}
          </button>
          {runId && (
            <span className="text-xs mono text-[color:var(--charcoal-mute)] self-center">
              run id: {runId}
            </span>
          )}
        </div>
      </header>

      {error && (
        <div className="card card-tight rag-red border border-current">
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className={`grid gap-8 items-start ${traceMode ? 'lg:grid-cols-[1fr_1fr]' : ''}`}>
        {traceMode && (
          <section className="grid gap-3">
            <h2 className="serif text-2xl text-[color:var(--forest)]">Agent trace</h2>
            <AgentTracePanel events={events} />
          </section>
        )}

        <section className="grid gap-3">
          <h2 className="serif text-2xl text-[color:var(--forest)]">Review &amp; output</h2>

          {openGates.length === 0 && !brief && !meeting && status !== 'done' && (
            <div className="card card-pad text-sm text-[color:var(--charcoal-mute)]">
              When an agent finishes, its output will appear here for your review.
            </div>
          )}

          {openGates.map((gate) => {
            const hasClientResolver = gateResolversRef.current.has(gate.id);
            return (
              <HITLGateCard
                key={gate.id}
                runId={runId ?? ''}
                gate={gate}
                onResolved={handleGateResolved}
                onDecide={
                  hasClientResolver ? (decision) => onGateDecide(gate.id, decision) : undefined
                }
              />
            );
          })}

          {brief && <BriefView brief={brief} />}
          {meeting && <MeetingArtifactView artifact={meeting} />}

          {status === 'done' && !brief && !meeting && openGates.length === 0 && (
            <div className="card card-pad text-sm text-[color:var(--charcoal-mute)]">
              Run finished without producing an artifact (e.g. rejected at a gate). Reset and try again.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function RunStatusPill({ status }: { status: RunStatus }) {
  const label = {
    idle: 'Idle',
    running: 'Running',
    awaiting: 'Awaiting your review',
    done: 'Done',
    error: 'Error',
  }[status];
  const cls = {
    idle: 'agent-state-queued',
    running: 'agent-state-running pulse',
    awaiting: 'agent-state-awaiting',
    done: 'agent-state-done',
    error: 'agent-state-error',
  }[status];
  return <span className={`text-xs uppercase tracking-widest ${cls}`}>{label}</span>;
}

