/**
 * GET /api/mode — tells the client whether the server has Anthropic
 * credentials configured (i.e. whether to run the live client-side
 * orchestrator) or whether it should fall back to the server-side replay
 * orchestrator on /api/run.
 *
 * Also returns a build marker so we can verify which deploy is live
 * without inspecting the JS bundle. Doesn't leak the key — only a boolean.
 */

export const runtime = 'nodejs';

const BUILD_MARKER = 'client-orchestration-2026-05-07';

export async function GET() {
  const live = Boolean(process.env.ANTHROPIC_API_KEY);
  return Response.json({ live, replay: !live, build: BUILD_MARKER });
}
