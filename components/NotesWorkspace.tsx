'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MeetingNote } from '../agents/shared/types';
import { ExportPanel } from './ExportPanel';

export function NotesWorkspace() {
  const [notes, setNotes] = useState<MeetingNote[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ title: string; body: string; date: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => notes?.find((n) => n.id === selectedId) ?? null,
    [notes, selectedId],
  );

  const loadNotes = useCallback(async () => {
    try {
      const res = await fetch('/api/notes', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load notes: ${res.status}`);
      const list: MeetingNote[] = await res.json();
      setNotes(list);
      if (selectedId && !list.some((n) => n.id === selectedId)) setSelectedId(null);
      if (!selectedId && list.length > 0) setSelectedId(list[0].id);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [selectedId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    if (selected) {
      setDraft({ title: selected.title, body: selected.body, date: selected.date });
    } else {
      setDraft(null);
    }
  }, [selected?.id, selected]);

  async function createBlank() {
    setError(null);
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Untitled note',
          date: new Date().toISOString().slice(0, 10),
          body: '',
        }),
      });
      if (!res.ok) throw new Error(`Create failed: ${res.status}`);
      const note: MeetingNote = await res.json();
      setSelectedId(note.id);
      await loadNotes();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function save() {
    if (!selected || !draft) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/notes/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      await loadNotes();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!selected) return;
    if (!confirm(`Delete "${selected.title}"? This can't be undone.`)) return;
    try {
      const res = await fetch(`/api/notes/${selected.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      setSelectedId(null);
      await loadNotes();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const isDirty =
    selected !== null &&
    draft !== null &&
    (draft.title !== selected.title ||
      draft.body !== selected.body ||
      draft.date !== selected.date);

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-6 items-start">
      <aside className="grid gap-3">
        <button className="btn btn-primary w-full" onClick={createBlank}>
          New note
        </button>
        {notes === null ? (
          <p className="text-sm text-[color:var(--charcoal-mute)]">Loading…</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-[color:var(--charcoal-mute)]">
            No notes yet. Click "New note" to start, or run Meeting Mode — its artifacts are saved
            here automatically.
          </p>
        ) : (
          <ul className="grid gap-1">
            {notes.map((n) => (
              <li key={n.id}>
                <button
                  className={`w-full text-left p-3 border ${
                    n.id === selectedId
                      ? 'border-[color:var(--forest)] bg-[color:var(--cream-warm)]'
                      : 'border-[color:var(--rule)]'
                  }`}
                  onClick={() => setSelectedId(n.id)}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-sm truncate">{n.title}</span>
                    <span className="text-xs text-[color:var(--charcoal-mute)] mono shrink-0">
                      {n.date}
                    </span>
                  </div>
                  <div className="text-xs text-[color:var(--charcoal-mute)] mt-1 flex items-baseline gap-2">
                    <span className="uppercase tracking-widest">
                      {n.source === 'meeting-mode' ? 'Meeting' : 'Manual'}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="grid gap-4">
        {error && (
          <div className="card card-tight rag-red border border-current">
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!selected || !draft ? (
          <div className="card card-pad text-sm text-[color:var(--charcoal-mute)]">
            {notes === null ? 'Loading…' : 'Select a note on the left, or create a new one.'}
          </div>
        ) : (
          <>
            <header className="grid gap-2">
              <input
                className="serif text-3xl text-[color:var(--forest)] bg-transparent outline-none border-b border-[color:var(--rule)] focus:border-[color:var(--forest)] py-1"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-baseline gap-3">
                  <input
                    type="date"
                    className="text-xs mono bg-transparent border border-[color:var(--rule)] px-2 py-1 focus:border-[color:var(--forest)] outline-none"
                    value={draft.date}
                    onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                  />
                  <span className="text-xs text-[color:var(--charcoal-mute)] uppercase tracking-widest">
                    {selected.source === 'meeting-mode' ? 'Meeting Mode artifact' : 'Manual note'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-quiet" onClick={remove} disabled={saving}>
                    Delete
                  </button>
                  <button
                    className={`btn ${isDirty ? 'btn-primary' : 'btn-quiet'}`}
                    onClick={save}
                    disabled={saving || !isDirty}
                  >
                    {saving ? 'Saving…' : isDirty ? 'Save' : 'Saved'}
                  </button>
                </div>
              </div>
            </header>

            <textarea
              className="bg-white w-full min-h-[400px] resize-y outline-none border border-[color:var(--rule)] focus:border-[color:var(--forest)] px-5 py-4 text-base leading-7 text-[color:var(--charcoal)]"
              style={{ fontFamily: "'Jost', system-ui, sans-serif" }}
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              placeholder="Markdown supported. Headings (#, ##), - bullets, - [ ] checkboxes, **bold**, *italic*."
            />

            {!isDirty && <ExportPanel source={{ kind: 'note', noteId: selected.id }} />}
            {isDirty && (
              <p className="text-xs text-[color:var(--charcoal-mute)] italic">
                Save your changes to enable Word export.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
