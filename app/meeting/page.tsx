import { MeetingPanel } from '../../components/MeetingPanel';
import { syntheticTranscript } from '../../fixtures/synthetic-project/index';

export default function MeetingPage() {
  return (
    <div className="grid gap-8">
      <header className="grid gap-3">
        <p className="eyebrow">Workflow B</p>
        <h1 className="serif text-4xl text-[color:var(--forest)] leading-tight">Meeting Mode</h1>
        <p className="text-[color:var(--charcoal-soft)] max-w-2xl">
          Drop in a transcript and let specialized agents produce action items, three audience-tailored
          summaries, risk register entries, and ticket drafts. Every external action waits on your
          explicit approval.
        </p>
      </header>

      <hr className="rule" />

      <MeetingPanel defaultTranscript={syntheticTranscript} />
    </div>
  );
}
