'use client';

import { useState } from 'react';
import type { GateDecision, HITLGate } from '../agents/shared/types';
import { GatePayloadView } from './GatePayloadView';

interface Props {
  runId: string;
  gate: HITLGate;
  onResolved: () => void;
  /**
   * Optional client-side decision handler. When provided, the card calls this
   * with the user's decision instead of POSTing to /api/approve. Used by the
   * client-side orchestrator (live mode) so it can resolve its in-memory gate
   * Promise. Replay/server mode keeps the /api/approve round-trip.
   */
  onDecide?: (decision: GateDecision) => void | Promise<void>;
}

export function HITLGateCard({ runId, gate, onResolved, onDecide }: Props) {
  const [currentPayload, setCurrentPayload] = useState<unknown>(gate.payload);
  const [instruction, setInstruction] = useState('');
  const [revising, setRevising] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviseHistory, setReviseHistory] = useState<string[]>([]);

  const isEdited = JSON.stringify(currentPayload) !== JSON.stringify(gate.payload);

  async function applyRevision() {
    if (!instruction.trim()) return;
    setRevising(true);
    setError(null);
    try {
      const res = await fetch('/api/revise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: gate.agent,
          payload: currentPayload,
          instruction: instruction.trim(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Revision failed (${res.status})`);
      }
      const j = await res.json();
      setCurrentPayload(j.revised);
      setReviseHistory((h) => [...h, instruction.trim()]);
      setInstruction('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRevising(false);
    }
  }

  function resetRevisions() {
    setCurrentPayload(gate.payload);
    setReviseHistory([]);
    setInstruction('');
    setError(null);
  }

  async function submit(decision: GateDecision) {
    setSubmitting(true);
    setError(null);
    try {
      if (onDecide) {
        // Client-side orchestrator: resolve the in-memory gate Promise.
        await onDecide(decision);
      } else {
        // Replay / server-side orchestrator: POST to /api/approve.
        const res = await fetch('/api/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runId, gateId: gate.id, decision }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `Approve failed (${res.status})`);
        }
      }
      onResolved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const approveOrSave = () => {
    if (isEdited) submit({ kind: 'edit', edited: currentPayload });
    else submit({ kind: 'approve' });
  };
  const reject = () => submit({ kind: 'reject', reason: 'Rejected by reviewer' });

  const kindLabel = {
    'between-agents': 'Between agents',
    'external-action': 'External action',
    'final-publish': 'Final publish',
    'low-confidence-escalation': 'Low-confidence escalation',
  }[gate.kind];

  return (
    <div className="card card-pad border-2 border-[color:var(--forest)] grid gap-4">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">{kindLabel} · awaiting your decision</p>
        {gate.externalAction && (
          <span className="text-xs uppercase tracking-widest rag-amber">
            external: {gate.externalAction.target}
          </span>
        )}
      </div>

      <div>
        <h3 className="serif text-2xl text-[color:var(--forest)]">{gate.title}</h3>
        <p className="text-sm text-[color:var(--charcoal-soft)] mt-1">{gate.description}</p>
      </div>

      {gate.reviewerCritique && (
        <details className="border border-[color:var(--rule)] p-3 text-sm" open={gate.reviewerCritique.verdict !== 'pass'}>
          <summary className="cursor-pointer">
            <span className="eyebrow">Reviewer note</span>
            <span className="ml-2 uppercase tracking-widest">{gate.reviewerCritique.verdict}</span>
            <span className="ml-2 text-xs mono text-[color:var(--charcoal-mute)]">
              conf {(gate.reviewerCritique.confidence * 100).toFixed(0)}%
            </span>
          </summary>
          {gate.reviewerCritique.issues.length > 0 && (
            <ul className="mt-2 list-disc list-inside space-y-0.5 text-[color:var(--charcoal-soft)]">
              {gate.reviewerCritique.issues.map((i, idx) => (
                <li key={idx}>
                  <span className="uppercase tracking-wider mr-1">[{i.severity}]</span>
                  {i.note}
                </li>
              ))}
            </ul>
          )}
          {gate.reviewerCritique.suggestedEdits && (
            <p className="mt-2 text-[color:var(--charcoal-soft)]">
              <span className="eyebrow">Suggested edit</span>
              <br />
              {gate.reviewerCritique.suggestedEdits}
            </p>
          )}
        </details>
      )}

      {/* Rendered payload — the surface view, no JSON */}
      <div className="card-tight bg-[color:var(--cream-warm)]">
        <GatePayloadView
          agent={gate.agent}
          payload={currentPayload}
          onChange={(next) => setCurrentPayload(next)}
        />
      </div>

      {/* Revision history breadcrumbs */}
      {reviseHistory.length > 0 && (
        <div className="text-xs text-[color:var(--charcoal-mute)]">
          <span className="eyebrow mr-2">Revisions applied</span>
          <ol className="mt-1 list-decimal list-inside space-y-0.5">
            {reviseHistory.map((r, i) => (
              <li key={i} className="italic">"{r}"</li>
            ))}
          </ol>
          <button className="mt-2 text-xs underline text-[color:var(--charcoal-soft)]" onClick={resetRevisions}>
            Reset to original
          </button>
        </div>
      )}

      {/* Natural-language revision input */}
      <div className="grid gap-2">
        <label className="eyebrow" htmlFor={`revise-${gate.id}`}>
          Want to revise? Tell me what to change
        </label>
        <textarea
          id={`revise-${gate.id}`}
          rows={2}
          placeholder='e.g. "drop confidence to 55%, and add Megan to the playbook timeline action item"'
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          disabled={revising || submitting}
          className="card-tight bg-white text-sm w-full resize-y outline-none border border-[color:var(--rule)] focus:border-[color:var(--forest)]"
        />
        <div className="flex justify-end">
          <button
            className="btn btn-quiet"
            onClick={applyRevision}
            disabled={!instruction.trim() || revising || submitting}
          >
            {revising ? 'Revising…' : 'Apply revision'}
          </button>
        </div>
      </div>

      {error && <div className="rag-red border border-current p-2 text-xs">{error}</div>}

      {/* Hidden raw view, available on demand */}
      <details className="text-xs">
        <summary className="cursor-pointer text-[color:var(--charcoal-mute)] eyebrow">
          Show raw payload
        </summary>
        <pre className="mt-2 card-tight bg-[color:var(--cream-warm)] mono whitespace-pre-wrap overflow-auto max-h-72">
          {JSON.stringify(currentPayload, null, 2)}
        </pre>
      </details>

      {/* Approve / reject */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[color:var(--rule)]">
        <span className="text-xs text-[color:var(--charcoal-mute)]">
          {isEdited ? 'You\'ve revised this. Continuing will use the revised version.' : 'No revisions yet.'}
        </span>
        <div className="flex gap-2">
          <button className="btn btn-quiet" disabled={submitting || revising} onClick={reject}>
            Reject
          </button>
          <button className="btn btn-primary" disabled={submitting || revising} onClick={approveOrSave}>
            {isEdited ? 'Save & continue' : 'Approve & continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
