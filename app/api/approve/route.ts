/**
 * HITL gate resolution endpoint.
 *
 * The trace panel POSTs here when the user approves, edits, or rejects a gate.
 * The run picks up the decision via `resolveGate`, the awaiting agent
 * unblocks, and downstream events flow back through SSE.
 */

import { resolveGate } from '../../../agents/shared/trace';
import type { GateDecision } from '../../../agents/shared/types';

export const runtime = 'nodejs';

interface ApproveRequest {
  runId: string;
  gateId: string;
  decision: GateDecision;
}

export async function POST(req: Request) {
  let body: ApproveRequest;
  try {
    body = (await req.json()) as ApproveRequest;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.runId || !body.gateId || !body.decision) {
    return Response.json(
      { error: 'Missing required fields: runId, gateId, decision' },
      { status: 400 },
    );
  }

  const ok = resolveGate(body.runId, body.gateId, body.decision);
  if (!ok) {
    return Response.json(
      { error: 'Run or gate not found (may have expired or already been resolved)' },
      { status: 404 },
    );
  }

  return Response.json({ ok: true });
}
