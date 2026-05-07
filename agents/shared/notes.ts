/**
 * Meeting notes helpers.
 *
 * Notes are stored inside TrackerState.notes so a single tracker save covers
 * project state + notes. Meeting-mode runs auto-create a note alongside the
 * MeetingArtifact; manual notes are created from the /notes page.
 */

import { loadTracker, saveTracker } from './tracker';
import type { MeetingArtifact, MeetingNote, TrackerState } from './types';

export async function listNotes(): Promise<MeetingNote[]> {
  const t = await loadTracker();
  return [...t.notes].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getNote(id: string): Promise<MeetingNote | null> {
  const t = await loadTracker();
  return t.notes.find((n) => n.id === id) ?? null;
}

export async function createNote(
  partial: Partial<MeetingNote> & { title: string },
): Promise<MeetingNote> {
  const t = await loadTracker();
  const nowIso = new Date().toISOString();
  const note: MeetingNote = {
    id: `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    title: partial.title,
    date: partial.date ?? new Date().toISOString().slice(0, 10),
    body: partial.body ?? '',
    source: partial.source ?? 'manual',
    linkedArtifactId: partial.linkedArtifactId,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const next: TrackerState = { ...t, notes: [note, ...t.notes], updatedAt: nowIso };
  await saveTracker(next);
  return note;
}

export async function updateNote(id: string, patch: Partial<MeetingNote>): Promise<MeetingNote | null> {
  const t = await loadTracker();
  const idx = t.notes.findIndex((n) => n.id === id);
  if (idx < 0) return null;
  const merged: MeetingNote = {
    ...t.notes[idx],
    ...patch,
    id: t.notes[idx].id, // never let id change
    updatedAt: new Date().toISOString(),
  };
  const nextNotes = [...t.notes];
  nextNotes[idx] = merged;
  await saveTracker({ ...t, notes: nextNotes, updatedAt: new Date().toISOString() });
  return merged;
}

export async function deleteNote(id: string): Promise<boolean> {
  const t = await loadTracker();
  const next = t.notes.filter((n) => n.id !== id);
  if (next.length === t.notes.length) return false;
  await saveTracker({ ...t, notes: next, updatedAt: new Date().toISOString() });
  return true;
}

/** Render a MeetingArtifact as a clean markdown note body. */
export function meetingArtifactToMarkdown(a: MeetingArtifact): string {
  const lines: string[] = [];
  lines.push(`# ${a.meetingTitle}`);
  lines.push('');
  lines.push(`*${new Date(a.generatedAt).toLocaleString()}*`);
  lines.push('');
  if (a.actionItems.length > 0) {
    lines.push('## Action items');
    lines.push('');
    for (const ai of a.actionItems) {
      const owner = ai.owner ? ` — ${ai.owner}` : '';
      const due = ai.dueDate ? ` (due ${ai.dueDate})` : '';
      lines.push(`- [ ] ${ai.title}${owner}${due}`);
    }
    lines.push('');
  }
  if (a.summaries) {
    lines.push('## Summaries');
    lines.push('');
    if (a.summaries.team) {
      lines.push('### Team');
      lines.push('');
      lines.push(a.summaries.team);
      lines.push('');
    }
    if (a.summaries.exec) {
      lines.push('### Exec');
      lines.push('');
      lines.push(a.summaries.exec);
      lines.push('');
    }
    if (a.summaries.client) {
      lines.push('### Client');
      lines.push('');
      lines.push(a.summaries.client);
      lines.push('');
    }
  }
  if (a.riskEntries.length > 0) {
    lines.push('## New risks');
    lines.push('');
    for (const r of a.riskEntries) {
      lines.push(`- **[${r.severity}]** ${r.title}${r.notes ? ` — ${r.notes}` : ''}`);
    }
    lines.push('');
  }
  if (a.followUpInvites.length > 0) {
    lines.push('## Follow-up invites');
    lines.push('');
    for (const f of a.followUpInvites) {
      lines.push(`- ${f.title}${f.attendees.length ? ` (${f.attendees.join(', ')})` : ''}`);
    }
    lines.push('');
  }
  if (a.ticketDrafts.length > 0) {
    lines.push('## Ticket drafts');
    lines.push('');
    for (const t of a.ticketDrafts) {
      lines.push(`- ${t.title}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

