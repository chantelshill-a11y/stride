/**
 * POST /api/revise — apply a natural-language revision to a gate payload.
 *
 * Input: { agent, payload, instruction }
 * Output: { revised }
 *
 * The HITL gate UI calls this when the PM types an instruction in the gate's
 * "Want to revise?" box. It does NOT mutate the gate state on the server —
 * the client uses the revised payload locally and submits it as a `kind: 'edit'`
 * decision when the PM clicks Approve.
 */

import { revisePayload } from '../../../agents/lib/revise';
import type { AgentName } from '../../../agents/shared/types';

export const runtime = 'nodejs';

interface ReviseRequest {
  agent?: AgentName | 'final-brief' | 'final-meeting';
  payload: unknown;
  instruction: string;
}

export async function POST(req: Request) {
  let body: ReviseRequest;
  try {
    body = (await req.json()) as ReviseRequest;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.payload || typeof body.instruction !== 'string' || body.instruction.trim().length === 0) {
    return Response.json({ error: 'Missing payload or instruction' }, { status: 400 });
  }

  try {
    const revised = await revisePayload(body.agent, body.payload, body.instruction);
    return Response.json({ revised });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
