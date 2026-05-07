'use client';

import { useState } from 'react';
import { RunPlayer } from './RunPlayer';

interface Props {
  defaultTranscript: string;
}

export function MeetingPanel({ defaultTranscript }: Props) {
  const [transcript, setTranscript] = useState(defaultTranscript);
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <div className="grid gap-4">
        <p className="text-[color:var(--charcoal-soft)] max-w-2xl">
          Paste a meeting transcript below or use the synthetic Northridge Phase 2 mid-sprint
          check baked in by default. When you press the run button on the next screen, agents will
          extract action items, surface risks, and draft three audience-tailored summaries — all
          behind HITL gates.
        </p>
        <textarea
          className="card-tight bg-white mono text-xs w-full h-72 resize-y outline-none border border-[color:var(--rule)] focus:border-[color:var(--forest)]"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
        />
        <div>
          <button className="btn btn-primary" onClick={() => setArmed(true)}>
            Use this transcript
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="card card-pad text-xs flex items-baseline justify-between">
        <span className="text-[color:var(--charcoal-soft)]">
          Transcript loaded ({transcript.split(/\s+/).length} words). You can change it below.
        </span>
        <button className="btn btn-quiet" onClick={() => setArmed(false)}>
          Edit transcript
        </button>
      </div>
      <RunPlayer
        mode="meeting-mode"
        ctaLabel="Run meeting mode"
        description="Synthetic Northridge Phase 2 mid-sprint transcript by default. Each agent appears in the trace as it starts; the reviewer's verdict attaches to its row; HITL gates appear in the right column when it's your turn."
        meetingTranscript={transcript}
        meetingTitle="Northridge Phase 2 — Sprint 4 mid-sprint check"
      />
    </div>
  );
}
