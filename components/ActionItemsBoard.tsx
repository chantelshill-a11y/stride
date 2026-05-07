'use client';

import type { ActionItem } from '../agents/shared/types';

const COLUMNS: Array<{ key: ActionItem['status']; label: string }> = [
  { key: 'open', label: 'Open' },
  { key: 'in-progress', label: 'In progress' },
  { key: 'done', label: 'Done' },
];

export function ActionItemsBoard({ items }: { items: ActionItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-[color:var(--charcoal-mute)]">No action items tracked.</p>;
  }
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {COLUMNS.map((col) => {
        const colItems = items.filter((a) => a.status === col.key);
        return (
          <div key={col.key} className="grid gap-2">
            <p className="eyebrow">
              {col.label} · {colItems.length}
            </p>
            <ul className="grid gap-2">
              {colItems.length === 0 && (
                <li className="text-sm text-[color:var(--charcoal-mute)] italic">empty</li>
              )}
              {colItems.map((a) => (
                <li key={a.id} className="border border-[color:var(--rule)] p-3">
                  <div className="text-sm">{a.title}</div>
                  <div className="text-xs text-[color:var(--charcoal-mute)] mt-1 flex flex-wrap gap-x-2">
                    {a.owner && <span>{a.owner}</span>}
                    {a.dueDate && <span>· due {a.dueDate}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
