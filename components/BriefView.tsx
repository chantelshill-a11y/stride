'use client';

import type { BriefArtifact } from '../agents/shared/types';
import { ExportPanel } from './ExportPanel';
import { buildBriefEvents } from './lib/proposed-events';

export function BriefView({ brief }: { brief: BriefArtifact }) {
  const proposedEvents = buildBriefEvents(brief);
  return (
    <article className="card card-pad grid gap-6">
      <header className="flex items-baseline justify-between">
        <p className="eyebrow">Morning brief · ready for publish</p>
        <span className="text-xs text-[color:var(--charcoal-mute)] mono">
          {new Date(brief.generatedAt).toLocaleString()}
        </span>
      </header>

      <Section title="Yesterday">
        <p className="text-[color:var(--charcoal-soft)]">{brief.yesterdayProgress}</p>
      </Section>

      {brief.todayMeetings.length > 0 && (
        <Section title="Today">
          <ul className="grid gap-3">
            {brief.todayMeetings.map((m, i) => (
              <li key={i} className="border-l-2 border-[color:var(--forest)] pl-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{m.title}</span>
                  <span className="text-xs mono text-[color:var(--charcoal-mute)]">{m.time}</span>
                </div>
                <p className="text-sm text-[color:var(--charcoal-soft)] mt-1">{m.prepNotes}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {brief.risks.length > 0 && (
        <Section title="Risks">
          <ul className="grid gap-2">
            {brief.risks.map((r) => (
              <li key={r.id} className="text-sm">
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

      <Section title="Standup draft">
        <DraftBlock text={brief.standupDraft} />
      </Section>

      <Section title="Exec update draft">
        <DraftBlock text={brief.execUpdateDraft} />
      </Section>

      {brief.openActionItems.length > 0 && (
        <Section title="Open action items">
          <ul className="grid gap-1 text-sm">
            {brief.openActionItems.map((a) => (
              <li key={a.id} className="flex items-baseline gap-3">
                <span className="text-[color:var(--charcoal-mute)] mono text-xs">
                  {a.dueDate ?? 'no date'}
                </span>
                <span>{a.title}</span>
                {a.owner && <span className="text-[color:var(--charcoal-mute)]">· {a.owner}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <ExportPanel
        source={{ kind: 'brief', payload: brief }}
        proposedEvents={proposedEvents}
        sourceLabel="Morning brief"
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

/**
 * A drafted communication block (standup, exec update, etc.).
 * Sans-serif body font, comfortable size + line-height, subtle left border so
 * it reads like a quoted draft instead of code output.
 */
function DraftBlock({ text }: { text: string }) {
  return (
    <blockquote className="border-l-2 border-[color:var(--forest)] pl-4 py-1 text-[color:var(--charcoal)] text-base leading-relaxed whitespace-pre-wrap">
      {text}
    </blockquote>
  );
}
