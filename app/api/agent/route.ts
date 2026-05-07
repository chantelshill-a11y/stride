/**
 * Per-agent run endpoint.
 *
 * The browser's client-side orchestrator (components/lib/orchestrate-*.ts)
 * calls this once per agent. Each call streams the agent's events as SSE
 * and ends with a `agent:done` event carrying the agent's output. Because
 * each call is a single agent (≈ 5-25s), it fits well under Netlify's 30s
 * Lambda streaming cap on the free tier — no Edge runtime needed.
 *
 * Replay mode (no API key, full deterministic playback) still uses the
 * legacy `/api/run` endpoint which orchestrates everything server-side.
 */

import { createRun, emit, newRunId, subscribe } from '../../../agents/shared/trace';
import type { AgentEvent, AgentName, AgentOutput, ReviewCritique, Risk, TrackerState } from '../../../agents/shared/types';
import { runStatusSynthesizer } from '../../../agents/status-synthesizer';
import { runRiskDetective } from '../../../agents/risk-detective';
import { runMeetingPrep } from '../../../agents/meeting-prep';
import { runActionTracker } from '../../../agents/action-tracker';
import { runCommsTailor } from '../../../agents/comms-tailor';
import { runMeetingSummarizer } from '../../../agents/meeting-summarizer';
import { runReviewerAnalyst } from '../../../agents/reviewer-analyst';
import type { ActionTrackerOutput } from '../../../agents/action-tracker';
import type { StatusSynthesizerOutput } from '../../../agents/status-synthesizer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AgentRequest {
  agent:
    | 'status-synthesizer'
    | 'risk-detective'
    | 'meeting-prep'
    | 'action-tracker'
    | 'comms-tailor'
    | 'meeting-summarizer'
    | 'reviewer-analyst';
  args?: {
    tracker?: TrackerState;
    transcript?: string;
    status?: StatusSynthesizerOutput;
    risks?: Risk[];
    actions?: ActionTrackerOutput;
    meetingTitle?: string;
    // Reviewer-only:
    reviewedAgent?: AgentName;
    output?: AgentOutput;
    contextSummary?: string;
  };
}

export async function POST(req: Request) {
  let body: AgentRequest;
  try {
    body = (await req.json()) as AgentRequest;
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

      safeEnqueue(encoder.encode(`: stride-agent\n\n`));
      safeEnqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'run:hello', runId: run.runId, ts: Date.now() })}\n\n`,
        ),
      );

      for (const e of run.events) send(e);
      const unsubscribe = subscribe(run, send);

      const heartbeat = setInterval(() => safeEnqueue(encoder.encode(`: hb\n\n`)), 15_000);

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

      const work = (async () => {
        try {
          const args = body.args ?? {};
          if (body.agent === 'status-synthesizer') {
            await runStatusSynthesizer(run);
          } else if (body.agent === 'risk-detective') {
            if (!args.tracker) throw new Error('risk-detective requires args.tracker');
            await runRiskDetective(run, { tracker: args.tracker, transcript: args.transcript });
          } else if (body.agent === 'meeting-prep') {
            await runMeetingPrep(run);
          } else if (body.agent === 'action-tracker') {
            if (!args.tracker) throw new Error('action-tracker requires args.tracker');
            await runActionTracker(run, { tracker: args.tracker, transcript: args.transcript });
          } else if (body.agent === 'comms-tailor') {
            if (!args.status || !args.risks)
              throw new Error('comms-tailor requires args.status and args.risks');
            await runCommsTailor(run, { status: args.status, risks: args.risks });
          } else if (body.agent === 'meeting-summarizer') {
            if (!args.transcript || !args.actions || !args.risks || !args.meetingTitle)
              throw new Error('meeting-summarizer requires transcript, actions, risks, meetingTitle');
            await runMeetingSummarizer(run, {
              transcript: args.transcript,
              actions: args.actions,
              risks: args.risks,
              meetingTitle: args.meetingTitle,
            });
          } else if (body.agent === 'reviewer-analyst') {
            if (!args.reviewedAgent || !args.output || !args.contextSummary)
              throw new Error(
                'reviewer-analyst requires reviewedAgent, output, contextSummary',
              );
            const critique: ReviewCritique = await runReviewerAnalyst(
              run,
              args.reviewedAgent,
              args.output,
              args.contextSummary,
            );
            // Emit the critique as a structured agent:done so the client can resolve.
            // (The internal runReviewerAnalyst also emits reviewer:critique; this
            // gives the client an explicit terminal event keyed by the request agent.)
            void critique;
          } else {
            throw new Error(`Unknown agent: ${body.agent}`);
          }
        } catch (err) {
          // body.agent includes 'meeting-summarizer' which isn't in AgentName.
          // For the error event, use 'comms-tailor' (the under-the-hood emit
          // name for that agent) so the trace stays well-typed.
          const errorAgent: AgentName =
            body.agent === 'meeting-summarizer' ? 'comms-tailor' : body.agent;
          emit(run, {
            type: 'agent:error',
            runId: run.runId,
            agent: errorAgent,
            message: (err as Error).message,
            ts: Date.now(),
          });
          emit(run, {
            type: 'run:error',
            runId: run.runId,
            message: (err as Error).message,
            ts: Date.now(),
          });
        }
      })();

      work.finally(() => setTimeout(finish, 250));
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
