/**
 * POST /api/export/word — produces a .docx download.
 *
 * Body: one of
 *   { kind: 'brief',   payload: BriefArtifact }
 *   { kind: 'meeting', payload: MeetingArtifact }
 *   { kind: 'note',    noteId: string }   // looked up server-side so a stale
 *                                          // client can still get the latest
 *
 * Response: application/vnd.openxmlformats-officedocument.wordprocessingml.document
 *           with Content-Disposition: attachment; filename="..."
 */

import {
  briefToDocx,
  meetingArtifactToDocx,
  noteToDocx,
  safeFilename,
  trackerToDocx,
} from '../../../../agents/lib/docx-export';
import { getNote } from '../../../../agents/shared/notes';
import { loadTracker } from '../../../../agents/shared/tracker';
import type { BriefArtifact, MeetingArtifact } from '../../../../agents/shared/types';

export const runtime = 'nodejs';

interface BriefRequest {
  kind: 'brief';
  payload: BriefArtifact;
}
interface MeetingRequest {
  kind: 'meeting';
  payload: MeetingArtifact;
}
interface NoteRequest {
  kind: 'note';
  noteId: string;
}
interface TrackerRequest {
  kind: 'tracker';
}

type WordExportRequest = BriefRequest | MeetingRequest | NoteRequest | TrackerRequest;

export async function POST(req: Request) {
  let body: WordExportRequest;
  try {
    body = (await req.json()) as WordExportRequest;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    let buffer: Buffer;
    let filename: string;

    if (body.kind === 'brief') {
      buffer = await briefToDocx(body.payload);
      filename = safeFilename(`Morning brief ${body.payload.generatedAt.slice(0, 10)}`);
    } else if (body.kind === 'meeting') {
      buffer = await meetingArtifactToDocx(body.payload);
      filename = safeFilename(body.payload.meetingTitle);
    } else if (body.kind === 'note') {
      const note = await getNote(body.noteId);
      if (!note) return Response.json({ error: 'Note not found' }, { status: 404 });
      buffer = await noteToDocx(note);
      filename = safeFilename(note.title);
    } else if (body.kind === 'tracker') {
      const tracker = await loadTracker();
      buffer = await trackerToDocx(tracker);
      filename = safeFilename(`${tracker.projectName} — snapshot ${new Date().toISOString().slice(0, 10)}`);
    } else {
      return Response.json({ error: 'Unknown kind' }, { status: 400 });
    }

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
