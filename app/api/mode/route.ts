/**
 * GET /api/mode — tells the client whether the server has Anthropic
 * credentials configured (i.e. whether to run the live client-side
 * orchestrator) or whether it should fall back to the server-side replay
 * orchestrator on /api/run.
 *
 * Doesn't leak the key — only a boolean.
 */

export const runtime = 'nodejs';

export async function GET() {
  const live = Boolean(process.env.ANTHROPIC_API_KEY);
  return Response.json({ live, replay: !live });
}
