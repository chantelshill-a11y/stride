/**
 * GET /api/source/sprint-board — current sprint board from the active adapter.
 *
 * Used by the client-side orchestrator so it can pass sprint-board into the
 * curator (for RAG recomputation that factors in blocked-item counts).
 */

import { getAdapter } from '../../../../agents/shared/integrations/registry';

export const runtime = 'nodejs';

export async function GET() {
  const adapter = getAdapter('synthetic');
  const board = await adapter.fetch('sprint-board', {});
  return Response.json(board);
}
