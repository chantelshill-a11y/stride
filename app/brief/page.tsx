import { RunPlayer } from '../../components/RunPlayer';

export default function BriefPage() {
  return (
    <div className="grid gap-8">
      <header className="grid gap-3">
        <p className="eyebrow">Workflow A</p>
        <h1 className="serif text-4xl text-[color:var(--forest)] leading-tight">Morning Brief</h1>
        <p className="text-[color:var(--charcoal-soft)] max-w-2xl">
          Specialized doer agents pull from your sources in parallel. A reviewer agent critiques each
          output. You approve, edit, or reject at every handoff. Final brief publishes only on your
          explicit click.
        </p>
      </header>

      <hr className="rule" />

      <RunPlayer
        mode="morning-brief"
        ctaLabel="Run morning brief"
        description="Running on the synthetic Northridge Financial Phase 2 engagement fixture. Each agent appears in the trace as it starts; the reviewer's verdict attaches to its row; the human gate appears in the right column when it's your turn."
      />
    </div>
  );
}
