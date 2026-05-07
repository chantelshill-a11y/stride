'use client';

/**
 * Productivity metrics — surfaces the cost/time-saved value of using Stride.
 *
 * Computed live from TrackerState.history so we don't need a separate metrics
 * store. The estimates per artifact are deliberately conservative (based on a
 * back-of-the-envelope model of what each ritual takes a PM to produce
 * unaided): writing a morning brief from scratch ≈ 90 minutes, processing a
 * meeting transcript into clean artifacts ≈ 45 minutes.
 */

import type { HistoryEntry } from '../agents/shared/types';

const MINUTES_PER_BRIEF = 90;
const MINUTES_PER_MEETING = 45;

interface Props {
  history: HistoryEntry[];
}

export function ProductivityMetrics({ history }: Props) {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const recent = history.filter((h) => new Date(h.ts).getTime() >= sevenDaysAgo);

  const briefsThisWeek = recent.filter((h) => h.kind === 'morning-brief').length;
  const meetingsThisWeek = recent.filter((h) => h.kind === 'meeting-artifact').length;
  const briefsAllTime = history.filter((h) => h.kind === 'morning-brief').length;
  const meetingsAllTime = history.filter((h) => h.kind === 'meeting-artifact').length;

  const minutesThisWeek = briefsThisWeek * MINUTES_PER_BRIEF + meetingsThisWeek * MINUTES_PER_MEETING;
  const minutesAllTime = briefsAllTime * MINUTES_PER_BRIEF + meetingsAllTime * MINUTES_PER_MEETING;
  const hoursThisWeek = (minutesThisWeek / 60).toFixed(1);
  const hoursAllTime = (minutesAllTime / 60).toFixed(1);

  if (history.length === 0) {
    return (
      <div className="card card-pad text-sm text-[color:var(--charcoal-mute)]">
        Run a Morning Brief or Meeting Mode session — productivity metrics will appear here.
      </div>
    );
  }

  return (
    <div className="card card-pad grid gap-4">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <p className="eyebrow">Productivity</p>
          <p className="serif text-2xl text-[color:var(--forest)]">~{hoursThisWeek} hours saved this week</p>
        </div>
        <p className="text-xs text-[color:var(--charcoal-mute)] mono">
          all time: ~{hoursAllTime} h · {briefsAllTime + meetingsAllTime} run{(briefsAllTime + meetingsAllTime) === 1 ? '' : 's'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Briefs this week"
          value={briefsThisWeek}
          sub={`× ${MINUTES_PER_BRIEF} min ≈ ${((briefsThisWeek * MINUTES_PER_BRIEF) / 60).toFixed(1)} h`}
        />
        <Stat
          label="Meetings this week"
          value={meetingsThisWeek}
          sub={`× ${MINUTES_PER_MEETING} min ≈ ${((meetingsThisWeek * MINUTES_PER_MEETING) / 60).toFixed(1)} h`}
        />
      </div>

      <p className="text-xs text-[color:var(--charcoal-mute)] leading-relaxed">
        Estimates are conservative against the unaided time to produce each artifact: a hand-written
        morning brief (status + risks + meeting prep + tailored comms) ≈ {MINUTES_PER_BRIEF} min;
        meeting → action items + three audience summaries + risk entries ≈ {MINUTES_PER_MEETING} min.
        Adjust in <span className="mono">components/ProductivityMetrics.tsx</span>.
      </p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="border border-[color:var(--rule)] p-3 text-center">
      <div className="serif text-3xl text-[color:var(--forest)]">{value}</div>
      <div className="eyebrow mt-1">{label}</div>
      <div className="text-xs text-[color:var(--charcoal-mute)] mono mt-1">{sub}</div>
    </div>
  );
}
