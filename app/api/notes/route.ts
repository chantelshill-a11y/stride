/**
 * Notes API.
 * GET /api/notes — list all notes
 * POST /api/notes — create a new note
 */

import { createNote, listNotes } from '../../../agents/shared/notes';
import type { MeetingNote } from '../../../agents/shared/types';

export const runtime = 'nodejs';

export async function GET() {
  const notes = await listNotes();
  return Response.json(notes);
}

export async function POST(req: Request) {
  let body: Partial<MeetingNote> & { title: string };
  try {
    body = (await req.json()) as Partial<MeetingNote> & { title: string };
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.title || body.title.trim().length === 0) {
    return Response.json({ error: 'title is required' }, { status: 400 });
  }
  const note = await createNote(body);
  return Response.json(note, { status: 201 });
}
