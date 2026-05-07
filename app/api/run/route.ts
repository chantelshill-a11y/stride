/**
 * SSE endpoint that starts a run and streams agent events to the client.
 *
 * The same response that confirms the run also carries the event stream — one
 * round-trip from the user's "Run" click to the live trace appearing.
 */

import { createRun, emit, newRunId, subscribe } from '../../../agents/shared/trace';
import type { AgentEvent } from '../../../agents/shared/types';
import { runMorningBrief, runStatusOnlyDemo } from '../../../agents/orchestrator';
import { runMeetingMode } from '../../../agents/meeting-mode';
import { runCalendarExport } from '../../../agents/calendar-export';
import type { ProposedEvent } from '../../../agents/calendar-export';
import { replayMorningBrief } from '../../../agents/replay/morning-brief-replay';
import { replayMeetingMode } from '../../../agents/replay/meeting-mode-replay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RunRequest {
  mode: 'status-only' | 'morning-brief' | 'meeting-mode' | 'export-calendar';
  meetingTranscript?: string;
  /** Pre-built proposed events for calendar export, supplied by the UI. */
  proposedEvents?: ProposedEvent[];
  /** Source label used in the gate description, e.g. "Morning brief" or "Northridge mid-sprint check". */
  sourceLabel?: string;
  /**
   * When true, force replay mode (deterministic playback, no Anthropic call).
   * When false/unset, replay still kicks in automatically if ANTHROPIC_API_KEY
   * is missing.
   */
  demo?: boolean;
}

export async function POST(req: Request) {
  let body: RunRequest;
  try {
    body = (await req.json()) as RunRequest;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const run = createRun(newRunId());
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closed = true;
        }
      };

      const send = (event: AgentEvent) => {
        safeEnqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      // Initial comment frame to flush headers + a hello event with the runId.
      safeEnqueue(encoder.encode(`: stride-stream\n\n`));
      safeEnqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'run:hello', runId: run.runId, ts: Date.now() })}\n\n`,
        ),
      );

      // Replay any events already queued (shouldn't be any, but defensive).
      for (const e of run.events) send(e);
      const unsubscribe = subscribe(run, send);

      const startEvent: AgentEvent = {
        type: 'run:start',
        runId: run.runId,
        mode: body.mode === 'meeting-mode' ? 'meeting-mode' : 'morning-brief',
        ts: Date.now(),
      };
      emit(run, startEvent);

      // Heartbeat so intermediaries keep the connection alive.
      const heartbeat = setInterval(() => {
        safeEnqueue(encoder.encode(`: hb\n\n`));
      }, 15_000);

      const finish = () => {
        clearInterval(heartbeat);
        unsubscribe();
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            /* ignore */
          }
        }
      };

      // Replay mode kicks in when the client explicitly asks OR when there's
      // no Anthropic key on this deploy (so the demo is always exercisable).
      const replay = body.demo === true || !process.env.ANTHROPIC_API_KEY;

      // Kick off the agent workflow in the background.
      const work = (async () => {
        try {
          if (body.mode === 'morning-brief') {
            await (replay ? replayMorningBrief(run) : runMorningBrief(run));
          } else if (body.mode === 'status-only') {
            await (replay ? replayMorningBrief(run) : runStatusOnlyDemo(run));
          } else if (body.mode === 'meeting-mode') {
            await (replay
              ? replayMeetingMode(run, { transcript: body.meetingTranscript })
              : runMeetingMode(run, { transcript: body.meetingTranscript }));
          } else if (body.mode === 'export-calendar') {
            if (!body.proposedEvents || body.proposedEvents.length === 0) {
              emit(run, {
                type: 'run:error',
                runId: run.runId,
                message: 'export-calendar requires at least one proposedEvent',
                ts: Date.now(),
              });
            } else {
              await runCalendarExport(run, {
                events: body.proposedEvents,
                sourceLabel: body.sourceLabel,
              });
            }
          } else {
            emit(run, {
              type: 'run:error',
              runId: run.runId,
              message: `Unknown mode: ${body.mode}`,
              ts: Date.now(),
            });
          }
        } catch (err) {
          emit(run, {
            type: 'run:error',
            runId: run.runId,
            message: (err as Error).message,
            ts: Date.now(),
          });
        }
      })();

      work.finally(() => {
        // Give consumers a moment to receive the final event, then close.
        setTimeout(finish, 250);
      });

      // Close on client disconnect.
      req.signal.addEventListener('abort', finish);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
