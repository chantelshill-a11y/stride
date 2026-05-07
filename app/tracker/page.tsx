import { StatusTracker } from '../../components/StatusTracker';

export default function TrackerPage() {
  return (
    <div className="grid gap-8">
      <header className="grid gap-3">
        <p className="eyebrow">Workflow C</p>
        <h1 className="serif text-4xl text-[color:var(--forest)] leading-tight">Status Tracker</h1>
        <p className="text-[color:var(--charcoal-soft)] max-w-2xl">
          A persistent project view that updates with every approved Morning Brief and Meeting
          artifact. RAG status, milestone timeline, open risks, action items, and a browsable history
          of past briefs.
        </p>
      </header>

      <hr className="rule" />

      <StatusTracker />
    </div>
  );
}
