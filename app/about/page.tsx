import Link from 'next/link';

export default function AboutPage() {
  return (
    <article className="grid gap-12">
      <header className="grid gap-3">
        <p className="eyebrow">About Stride</p>
        <h1 className="serif text-4xl text-[color:var(--forest)] leading-tight">
          What Stride is, how it works, and what it demonstrates.
        </h1>
        <p className="text-[color:var(--charcoal-soft)] max-w-2xl">
          Stride is a multi-agent orchestration tool that does the work a project manager otherwise
          spends a morning on — synthesized status, surfaced risk, prepped meetings, audience-tailored
          stakeholder comms, and a curated project tracker — with human review at every handoff and
          before every external action.
        </p>
      </header>

      <hr className="rule" />

      <Section number="01" title="Three workflows">
        <div className="grid md:grid-cols-3 gap-6">
          <Card eyebrow="Workflow A" title="Morning Brief">
            Pulls from your sources in parallel, drafts your standup and exec update, surfaces
            today&apos;s meetings with prep, and reconciles the tracker. One synthesized brief in
            minutes.
          </Card>
          <Card eyebrow="Workflow B" title="Meeting → Artifacts">
            Drop in a transcript. Get action items with owners, three audience-tailored summaries
            (team / exec / client), risk register entries, and ticket drafts.
          </Card>
          <Card eyebrow="Workflow C" title="Status Tracker">
            A persistent project view that updates with every approved artifact: RAG status per
            workstream, milestone timeline, open risks, action item board, browsable history.
          </Card>
        </div>
      </Section>

      <Section number="02" title="Agent roster">
        <p className="text-[color:var(--charcoal-soft)] max-w-2xl mb-4">
          Seven specialized agents plus one shared reviewer. The orchestrator plans which doers run
          and in what order; the reviewer critiques every doer&apos;s output before a human ever sees
          it.
        </p>
        <ul className="grid md:grid-cols-2 gap-4">
          <AgentRow name="Orchestrator" role="planner" what="Plans the run, dispatches doers, assembles the final brief, archives to history." />
          <AgentRow name="Status Synthesizer" role="doer" what="Sprint board + threads + mail → factual status read with velocity, slipping, and on-track items." />
          <AgentRow name="Risk Detective" role="doer" what="Surfaces blockers, slips, and dependencies; deduplicates against tracker; flags risks aging out." />
          <AgentRow name="Meeting Prep" role="doer" what="For each meeting today, an agenda + prior context + 3-5 actionable talking points." />
          <AgentRow name="Comms Tailor" role="doer" what="One status, four audience drafts: standup, exec, client, skip-level. Calibrated tone per audience." />
          <AgentRow name="Action Tracker" role="doer" what="Extracts action items from transcripts and threads; reconciles against existing tracker items." />
          <AgentRow name="Tracker Curator" role="curator" what="Reconciles approved outputs into persistent state; recomputes RAG; appends history; saves." />
          <AgentRow name="Reviewer / Analyst" role="reviewer" what="Critiques every doer output before a human reviews it. Verdict: pass / flag / block, with confidence." />
        </ul>
      </Section>

      <Section number="03" title="Human-in-the-loop, by design">
        <p className="text-[color:var(--charcoal-soft)] max-w-2xl">
          Four structural gate types make sure no agent ever acts unilaterally:
        </p>
        <ul className="grid md:grid-cols-2 gap-4 mt-4">
          <GateRow
            kind="Between-agent handoff"
            blurb="After every doer + reviewer pair finishes, the user can edit the output before it feeds the next agent. Edits flow through the gate and become the next agent's input."
          />
          <GateRow
            kind="External action"
            blurb="Sending email, posting Slack, creating Jira tickets, scheduling calendar events — each fires an explicit approve / edit / reject card. Nothing leaves Stride without a click."
          />
          <GateRow
            kind="Final publish"
            blurb="Morning brief and meeting artifacts always end with a final review-and-publish gate. The tracker only commits on approval."
          />
          <GateRow
            kind="Low-confidence escalation"
            blurb="Reviewer can flag any output as low-confidence, which forces a mandatory human pause even in a fast-path mode. Escalation is structural, not optional."
          />
        </ul>
        <p className="text-[color:var(--charcoal-soft)] max-w-2xl mt-6">
          On every gate, the payload renders as a real card (not JSON). The PM can either edit
          inline (e.g. calendar events have date / time / duration / attendees fields, plus
          include / exclude toggles) or type a natural-language instruction (&ldquo;move all to 1 hour,
          drop the Tuesday block&rdquo;) and a Claude call rewrites the payload in the same schema.
        </p>
      </Section>

      <Section number="04" title="Architecture decisions worth highlighting">
        <ul className="grid gap-3 text-[color:var(--charcoal-soft)] list-disc list-inside max-w-3xl">
          <li>
            <span className="text-[color:var(--charcoal)] font-medium">Doer + reviewer pattern.</span>{' '}
            Every agent output passes through a separate reviewer agent before reaching the human gate.
            Mirrors how good PMs work: do, peer-check, then ship.
          </li>
          <li>
            <span className="text-[color:var(--charcoal)] font-medium">Integration registry.</span>{' '}
            Adapters self-register based on env vars; agents query the registry, never specific
            adapters. Adding Jira, Linear, Slack, or Notion is a one-file drop with no agent or
            orchestrator changes.
          </li>
          <li>
            <span className="text-[color:var(--charcoal)] font-medium">SSE-first orchestration.</span>{' '}
            Agent events stream over Server-Sent Events; the trace panel renders state as it happens.
            HITL gates are open Promises that resolve when the user clicks approve.
          </li>
          <li>
            <span className="text-[color:var(--charcoal)] font-medium">Eval rigor.</span>{' '}
            Per-agent Zod schemas enforce shape correctness; golden sets test
            &ldquo;must mention&rdquo; / &ldquo;must not mention&rdquo; assertions per audience. Run shape-only
            in CI, live with model calls when changing prompts.
          </li>
          <li>
            <span className="text-[color:var(--charcoal)] font-medium">Corporate-formatted exports.</span>{' '}
            Every workflow output extracts to a Word doc with proper page header / footer, document
            properties, data tables, and Microsoft-standard typography. Calendar exports are
            interactive, gated, and idempotent.
          </li>
          <li>
            <span className="text-[color:var(--charcoal)] font-medium">Brand discipline.</span>{' '}
            One palette, two fonts, sharp corners, no emojis. Same visual language as the rest of
            the portfolio (Attribution Truth-Checker, Triage, Pack).
          </li>
        </ul>
      </Section>

      <Section number="05" title="What this project demonstrates">
        <ul className="grid md:grid-cols-2 gap-x-8 gap-y-4 text-[color:var(--charcoal-soft)]">
          <Demonstrates
            title="Multi-agent orchestration design"
            body="Decomposing a fuzzy job into specialized agents, wiring them with an orchestrator, and adding a verification layer that critiques every output."
          />
          <Demonstrates
            title="Human-in-the-loop maturity"
            body="Every gate has a clear surface, a way to revise (natural language or inline), and a default-to-skeptical posture."
          />
          <Demonstrates
            title="PM domain depth"
            body="Workflows calibrated to actual PM rituals — RAG status, ship-date confidence, attorney sign-off bottlenecks, exec readout prep."
          />
          <Demonstrates
            title="Production architecture"
            body="Registry-based extensibility, SSE streaming, persistent state across hot-reload, env-gated adapters. Production decisions, not toy decisions."
          />
          <Demonstrates
            title="Evaluation craftsmanship"
            body="Zod schemas + golden sets + shape and live modes. Cost-aware testing that catches regressions before they ship."
          />
          <Demonstrates
            title="Output craftsmanship"
            body="Drafts read like prose. Word exports use real corporate formatting. Calendar exports are interactive and gated."
          />
        </ul>
      </Section>

      <hr className="rule" />

      <section className="grid gap-3">
        <p className="eyebrow">Try it</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/brief" className="btn btn-primary">Run a morning brief</Link>
          <Link href="/meeting" className="btn btn-ghost">Try meeting mode</Link>
          <Link href="/tracker" className="btn btn-ghost">Open the status tracker</Link>
        </div>
        <p className="text-xs text-[color:var(--charcoal-mute)] mt-2">
          The synthetic project — Northridge Financial Phase 2 — is modeled on a real CLM AI delivery
          engagement. Same workstreams, same risks, same accuracy gates that Chantel runs at her day
          job.
        </p>
      </section>
    </article>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4">
      <header className="flex items-baseline gap-4">
        <span className="eyebrow mono">{number}</span>
        <h2 className="serif text-3xl text-[color:var(--forest)]">{title}</h2>
      </header>
      <div>{children}</div>
    </section>
  );
}

function Card({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="card card-pad grid gap-2">
      <p className="eyebrow">{eyebrow}</p>
      <h3 className="serif text-xl text-[color:var(--forest)]">{title}</h3>
      <p className="text-sm text-[color:var(--charcoal-soft)] leading-relaxed">{children}</p>
    </article>
  );
}

function AgentRow({ name, role, what }: { name: string; role: string; what: string }) {
  return (
    <li className="border-l-2 border-[color:var(--forest)] pl-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <span className="font-medium">{name}</span>
        <span className="eyebrow">{role}</span>
      </div>
      <p className="text-sm text-[color:var(--charcoal-soft)] mt-1 leading-relaxed">{what}</p>
    </li>
  );
}

function GateRow({ kind, blurb }: { kind: string; blurb: string }) {
  return (
    <li className="border border-[color:var(--rule)] p-4">
      <p className="eyebrow mb-2">{kind}</p>
      <p className="text-sm text-[color:var(--charcoal-soft)] leading-relaxed">{blurb}</p>
    </li>
  );
}

function Demonstrates({ title, body }: { title: string; body: string }) {
  return (
    <li className="border-l-2 border-[color:var(--forest)] pl-4">
      <p className="font-medium text-[color:var(--charcoal)]">{title}</p>
      <p className="text-sm leading-relaxed mt-1">{body}</p>
    </li>
  );
}
