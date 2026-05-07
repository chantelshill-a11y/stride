'use client';

import type { Workstream } from '../agents/shared/types';

const LABEL: Record<Workstream['rag'], string> = {
  green: 'Green',
  amber: 'Amber',
  red: 'Red',
};

export function RAGBadge({ rag }: { rag: Workstream['rag'] }) {
  const cls =
    rag === 'green'
      ? 'rag-green'
      : rag === 'amber'
        ? 'rag-amber'
        : 'rag-red';
  return (
    <span className={`text-xs uppercase tracking-widest border px-2 py-0.5 ${cls}`}>
      {LABEL[rag]}
    </span>
  );
}
