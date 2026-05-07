/**
 * Notes API — single note.
 * GET /api/notes/{id} — read
 * PUT /api/notes/{id} — update (partial)
 * DELETE /api/notes/{id} — remove
 */

import { deleteNote, getNote, updateNote } from '../../../../agents/shared/notes';
import type { MeetingNote } from '../../../../agents/shared/types';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const note = await getNote(id);
  if (!note) return Response.json({ error: 'Note not found' }, { status: 404 });
  return Response.json(note);
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: Partial<MeetingNote>;
  try {
    body = (await req.json()) as Partial<MeetingNote>;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const updated = await updateNote(id, body);
  if (!updated) return Response.json({ error: 'Note not found' }, { status: 404 });
  return Response.json(updated);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ok = await deleteNote(id);
  if (!ok) return Response.json({ error: 'Note not found' }, { status: 404 });
  return Response.json({ ok: true });
}
