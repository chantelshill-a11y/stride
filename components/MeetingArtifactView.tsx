'use client';

import type { MeetingArtifact } from '../agents/shared/types';
import { ExportPanel } from './ExportPanel';
import { buildMeetingEvents } from './lib/proposed-events';

export function MeetingArtifactView({ artifact }: { artifact: MeetingArtifact }) {
  const proposedEvents = buildMeetingEvents(artifact);
  return (
    <article className="card card-pad grid gap-6">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="eyebrow">Meeting artifact · ready for publish</p>
          <h2 className="serif text-2xl text-[color:var(--forest)] mt-1">{artifact.meetingTitle}</h2>
        </div>
        <span className="text-xs text-[color:var(--charcoal-mute)] mono">
          {new Date(artifact.generatedAt).toLocaleString()}
        </span>
      </header>

      <Section title="Action items">
        {artifact.actionItems.length === 0 ? (
          <p className="text-sm text-[color:var(--charcoal-mute)]">None.</p>
        ) : (
          <ul className="grid gap-1 text-sm">
            {artifact.actionItems.map((a) => (
              <li key={a.id} className="flex items-baseline gap-3 flex-wrap">
                <span className="text-xs uppercase tracking-widest text-[color:var(--charcoal-mute)]">
                  {a.status}
                </span>
                <span>{a.title}</span>
                {a.owner && (
                  <span className="text-[color:var(--charcoal-mute)]">· {a.owner}</span>
                )}
                {a.dueDate && (
                  <span className="text-[color:var(--charcoal-mute)] mono">due {a.dueDate}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Tailored summaries">
        <SummaryPanels summaries={artifact.summaries} />
      </Section>

      {artifact.riskEntries.length > 0 && (
        <Section title="New risk register entries">
          <ul className="grid gap-2 text-sm">
            {artifact.riskEntries.map((r) => (
              <li key={r.id}>
                <span className={`uppercase tracking-widest mr-2 text-xs rag-${r.severity === 'high' ? 'red' : r.severity === 'medium' ? 'amber' : 'green'}`}>
                  {r.severity}
                </span>
                {r.title}
                {r.notes && <span className="text-[color:var(--charcoal-soft)]"> — {r.notes}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {artifact.followUpInvites.length > 0 && (
        <Section title="Suggested follow-up invites">
          <ul className="grid gap-2 text-sm">
            {artifact.followUpInvites.map((f, i) => (
              <li key={i} className="border-l-2 border-[color:var(--forest)] pl-3">
                <div className="font-medium">{f.title}</div>
                {f.attendees.length > 0 && (
                  <div className="text-xs text-[color:var(--charcoal-mute)]">
                    Attendees: {f.attendees.join(', ')}
                  </div>
                )}
                <div className="text-xs text-[color:var(--charcoal-soft)] mt-1">{f.rationale}</div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {artifact.ticketDrafts.length > 0 && (
        <Section title="Ticket drafts">
          <div className="grid gap-3">
            {artifact.ticketDrafts.map((t, i) => (
              <div key={i} className="border border-[color:var(--rule)] p-3">
                <div className="font-medium">{t.title}</div>
                <pre className="text-xs whitespace-pre-wrap text-[color:var(--charcoal-soft)] mt-2">
                  {t.body}
                </pre>
              </div>
            ))}
          </div>
        </Section>
      )}

      <ExportPanel
        source={{ kind: 'meeting', payload: artifact }}
        proposedEvents={proposedEvents}
        sourceLabel={artifact.meetingTitle}
      />
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="serif text-xl text-[color:var(--forest)]">{title}</h3>
      {children}
    </section>
  );
}

function SummaryPanels({ summaries }: { summaries: MeetingArtifact['summaries'] }) {
  return (
    <div className="grid md:grid-cols-3 gap-3">
      {(['team', 'exec', 'client'] as const).map((k) => (
        <div key={k} className="border border-[color:var(--rule)] px-5 py-4 grid gap-2">
          <p className="eyebrow">{k}</p>
          <p className="text-base leading-relaxed whitespace-pre-wrap text-[color:var(--charcoal)]">
            {summaries[k]}
          </p>
        </div>
      ))}
    </div>
  );
}
