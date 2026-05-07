/**
 * Tracker state API.
 *
 * GET — current state (for the /tracker page)
 * POST — manual edit (add/update/remove a workstream, risk, or action item)
 *
 * Tracker writes from agent runs go through `saveTracker` directly inside the
 * orchestrator after a final-publish HITL gate; this endpoint is for the UI's
 * manual-edit affordance.
 */

import { loadTracker, saveTracker } from '../../../agents/shared/tracker';
import type { ActionItem, Risk, TrackerState, Workstream } from '../../../agents/shared/types';

export const runtime = 'nodejs';

export async function GET() {
  const tracker = await loadTracker();
  return Response.json(tracker);
}

interface ManualEdit {
  op:
    | 'upsert-risk'
    | 'upsert-action'
    | 'upsert-workstream'
    | 'delete-risk'
    | 'delete-action'
    | 'replace-all';
  payload: Risk | ActionItem | Workstream | { id: string } | TrackerState;
}

export async function POST(req: Request) {
  let body: ManualEdit;
  try {
    body = (await req.json()) as ManualEdit;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const state = await loadTracker();
  const next: TrackerState = JSON.parse(JSON.stringify(state));
  const today = new Date().toISOString().slice(0, 10);

  switch (body.op) {
    case 'upsert-risk': {
      const r = body.payload as Risk;
      const idx = next.risks.findIndex((x) => x.id === r.id);
      if (idx >= 0) next.risks[idx] = { ...r, lastSeen: today };
      else next.risks.push({ ...r, source: { kind: 'manual', ref: 'manual-edit' }, firstSeen: today, lastSeen: today });
      break;
    }
    case 'upsert-action': {
      const a = body.payload as ActionItem;
      const idx = next.actionItems.findIndex((x) => x.id === a.id);
      if (idx >= 0) next.actionItems[idx] = a;
      else next.actionItems.push({ ...a, source: { kind: 'manual', ref: 'manual-edit' }, createdAt: new Date().toISOString() });
      break;
    }
    case 'upsert-workstream': {
      const w = body.payload as Workstream;
      const idx = next.workstreams.findIndex((x) => x.id === w.id);
      if (idx >= 0) next.workstreams[idx] = { ...w, lastUpdated: today };
      else next.workstreams.push({ ...w, lastUpdated: today });
      break;
    }
    case 'delete-risk': {
      const id = (body.payload as { id: string }).id;
      next.risks = next.risks.filter((r) => r.id !== id);
      break;
    }
    case 'delete-action': {
      const id = (body.payload as { id: string }).id;
      next.actionItems = next.actionItems.filter((a) => a.id !== id);
      break;
    }
    case 'replace-all': {
      // Used by the client-side orchestrator to commit a full curated tracker
      // state at the end of a Morning Brief / Meeting Mode run.
      const t = body.payload as TrackerState;
      t.updatedAt = new Date().toISOString();
      await saveTracker(t);
      return Response.json(t);
    }
    default:
      return Response.json({ error: 'Unknown op' }, { status: 400 });
  }

  next.updatedAt = new Date().toISOString();
  await saveTracker(next);
  return Response.json(next);
}
