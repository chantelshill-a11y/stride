import Link from 'next/link';

export default function Home() {
  return (
    <div className="grid gap-16">
      <section className="grid gap-6 max-w-3xl">
        <p className="eyebrow">Multi-agent orchestration for project managers</p>
        <h1 className="serif text-4xl sm:text-5xl md:text-6xl text-[color:var(--forest)] leading-[1.05]">
          Reclaim four hours of your day, without losing the wheel.
        </h1>
        <p className="text-lg text-[color:var(--charcoal-soft)] max-w-2xl">
          Stride orchestrates specialized agents to do the work a PM otherwise spends a morning on:
          synthesizing status, surfacing risk, prepping meetings, drafting tailored stakeholder comms,
          and curating a persistent project tracker. Every agent passes through a reviewer and a human
          gate before anything leaves your desk.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/brief" className="btn btn-primary">Run a morning brief</Link>
          <Link href="/meeting" className="btn btn-ghost">Try meeting mode</Link>
          <Link href="/about" className="btn btn-quiet">How it works</Link>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-6">
        <Feature
          eyebrow="Workflow A"
          title="Morning Brief"
          body="Specialized agents run in parallel against your sources. Reviewer agents critique each output. You approve, edit, or reject at every handoff. The result: one synthesized brief in minutes, not hours."
        />
        <Feature
          eyebrow="Workflow B"
          title="Meeting → Artifacts"
          body="Drop in a transcript. Get action items with owners, three audience-tailored summaries, risk register entries, and ticket drafts. Nothing leaves Stride without an explicit approval click."
        />
        <Feature
          eyebrow="Workflow C"
          title="Status Tracker"
          body="A persistent project view that updates with every brief and every approved artifact. RAG status, milestone timeline, open risks, action items, and a browsable history of past briefs."
        />
      </section>

      <section className="grid gap-4">
        <hr className="rule" />
        <p className="eyebrow">Designed for daily use, built to demonstrate orchestration</p>
        <div className="grid md:grid-cols-2 gap-10 text-[color:var(--charcoal-soft)]">
          <p>
            Visitors run Stride on a baked-in synthetic project so the demo is honest and self-contained.
            No accounts to connect, no auth burden — click and watch the agents work.
          </p>
          <p>
            In real mode, Stride connects to Outlook + Calendar and Google Workspace. Each workflow
            output extracts to a clean Word doc on demand, and approved action items can be scheduled
            as time blocks on your calendar behind a human gate. The integration layer is registry-based,
            so adding Jira, Linear, Slack, or Notion later is a self-contained file drop.
          </p>
        </div>
      </section>
    </div>
  );
}

function Feature({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <article className="card card-pad grid gap-3">
      <p className="eyebrow">{eyebrow}</p>
      <h3 className="serif text-2xl text-[color:var(--forest)]">{title}</h3>
      <p className="text-sm leading-relaxed text-[color:var(--charcoal-soft)]">{body}</p>
    </article>
  );
}
