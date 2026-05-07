import { NotesWorkspace } from '../../components/NotesWorkspace';

export default function NotesPage() {
  return (
    <div className="grid gap-8">
      <header className="grid gap-3">
        <p className="eyebrow">Notes</p>
        <h1 className="serif text-4xl text-[color:var(--forest)] leading-tight">Meeting notes</h1>
        <p className="text-[color:var(--charcoal-soft)] max-w-2xl">
          Type notes during a meeting or pull up an artifact Meeting Mode produced. Every note can be
          exported to a clean Word document on demand. Action items extracted from briefs and meetings
          schedule onto your calendar through a human-in-the-loop gate so nothing leaves Stride
          without your approval.
        </p>
      </header>

      <hr className="rule" />

      <NotesWorkspace />
    </div>
  );
}
