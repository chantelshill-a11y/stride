'use client';

import type { Risk } from '../agents/shared/types';

const SEV_CLS: Record<Risk['severity'], string> = {
  low: 'rag-green',
  medium: 'rag-amber',
  high: 'rag-red',
};

const STATUS_LABEL: Record<Risk['status'], string> = {
  open: 'Open',
  mitigating: 'Mitigating',
  resolved: 'Resolved',
  'aged-out': 'Aged out',
};

export function RiskRegister({ risks }: { risks: Risk[] }) {
  const open = risks.filter((r) => r.status === 'open' || r.status === 'mitigating');
  const closed = risks.filter((r) => r.status === 'resolved' || r.status === 'aged-out');

  if (open.length === 0 && closed.length === 0) {
    return (
      <p className="text-sm text-[color:var(--charcoal-mute)]">No risks tracked.</p>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <p className="eyebrow">Open · {open.length}</p>
        {open.length === 0 ? (
          <p className="text-sm text-[color:var(--charcoal-mute)]">No open risks.</p>
        ) : (
          <ul className="grid gap-2">
            {open.map((r) => (
              <RiskRow key={r.id} risk={r} />
            ))}
          </ul>
        )}
      </div>

      {closed.length > 0 && (
        <details className="grid gap-2">
          <summary className="cursor-pointer">
            <span className="eyebrow">Closed / aged out · {closed.length}</span>
          </summary>
          <ul className="grid gap-2 mt-2">
            {closed.map((r) => (
              <RiskRow key={r.id} risk={r} faded />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function RiskRow({ risk, faded }: { risk: Risk; faded?: boolean }) {
  return (
    <li className={`border border-[color:var(--rule)] p-3 ${faded ? 'opacity-60' : ''}`}>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-3">
          <span className={`text-xs uppercase tracking-widest border px-2 py-0.5 ${SEV_CLS[risk.severity]}`}>
            {risk.severity}
          </span>
          <span className="font-medium">{risk.title}</span>
        </div>
        <span className="text-xs uppercase tracking-widest text-[color:var(--charcoal-mute)]">
          {STATUS_LABEL[risk.status]}
        </span>
      </div>
      {risk.notes && (
        <p className="text-sm text-[color:var(--charcoal-soft)] mt-1">{risk.notes}</p>
      )}
      <div className="text-xs text-[color:var(--charcoal-mute)] mt-1 flex flex-wrap gap-x-3">
        {risk.owner && <span>owner: {risk.owner}</span>}
        <span>first seen: {risk.firstSeen}</span>
        <span>last seen: {risk.lastSeen}</span>
        <span className="mono">{risk.source.kind}:{risk.source.ref}</span>
      </div>
    </li>
  );
}
