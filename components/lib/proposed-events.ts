/**
 * Helpers to turn brief / meeting outputs into ProposedEvent[] for the
 * calendar export workflow. Run client-side so the user can review/edit
 * before kicking off the run.
 */

import type { ProposedEvent } from '../../agents/calendar-export';
import type {
  ActionItem,
  BriefArtifact,
  MeetingArtifact,
  TrackerState,
} from '../../agents/shared/types';

/** Schedule an action item as a 30-min self block at 09:00 on its due date (or tomorrow). */
export function actionItemToProposedEvent(item: ActionItem, fallbackDate: string): ProposedEvent {
  const date = item.dueDate || fallbackDate;
  return {
    id: `pe_${item.id}`,
    title: item.title,
    date,
    startTime: '09:00',
    durationMinutes: 30,
    attendees: [],
    agenda: item.owner ? `Owner: ${item.owner}.` : undefined,
    kind: 'time-block',
    source: { kind: 'action-item', ref: item.id },
  };
}

/** Turn a follow-up invite into a 30-min meeting tomorrow at 14:00. */
export function followUpToProposedEvent(
  invite: MeetingArtifact['followUpInvites'][number],
  fallbackDate: string,
  index: number,
): ProposedEvent {
  return {
    id: `pe_followup_${index}`,
    title: invite.title,
    date: fallbackDate,
    startTime: '14:00',
    durationMinutes: 30,
    attendees: invite.attendees,
    agenda: invite.rationale,
    kind: 'meeting',
    source: { kind: 'follow-up', ref: String(index) },
  };
}

export function nextWorkdayIso(daysAhead = 1): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  // Skip Sat/Sun.
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function buildBriefEvents(brief: BriefArtifact): ProposedEvent[] {
  const fallback = nextWorkdayIso(1);
  return brief.openActionItems.map((a) => actionItemToProposedEvent(a, fallback));
}

export function buildMeetingEvents(artifact: MeetingArtifact): ProposedEvent[] {
  const fallback = nextWorkdayIso(1);
  const fromActions = artifact.actionItems.map((a) => actionItemToProposedEvent(a, fallback));
  const fromInvites = artifact.followUpInvites.map((inv, i) =>
    followUpToProposedEvent(inv, fallback, i),
  );
  return [...fromActions, ...fromInvites];
}

/**
 * Tracker → proposed events. Schedules every open / in-progress action item
 * (skips done ones) as a 30-min self block. Sequenced from 09:00 in 30-min
 * increments per day so a stack of items on the same date doesn't double-book.
 */
export function buildTrackerEvents(tracker: TrackerState): ProposedEvent[] {
  const fallback = nextWorkdayIso(1);
  const open = tracker.actionItems.filter((a) => a.status !== 'done');
  // Sequence per-date so multiple items don't all collide at 09:00.
  const slotByDate = new Map<string, number>();
  return open.map((a) => {
    const date = a.dueDate || fallback;
    const slot = slotByDate.get(date) ?? 0;
    slotByDate.set(date, slot + 1);
    const startMinutes = 9 * 60 + slot * 30;
    const hh = Math.floor(startMinutes / 60);
    const mm = startMinutes % 60;
    return {
      id: `pe_${a.id}`,
      title: a.title,
      date,
      startTime: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
      durationMinutes: 30,
      attendees: [],
      agenda: a.owner ? `Owner: ${a.owner}.` : undefined,
      kind: 'time-block',
      source: { kind: 'action-item', ref: a.id },
    };
  });
}
