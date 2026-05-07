import { listAdapters } from '../../agents/shared/integrations/registry';
import Link from 'next/link';

export default function RealHomePage() {
  const adapters = listAdapters();
  const hasGoogle = adapters.some((a) => a.id === 'google');
  const hasMicrosoft = adapters.some((a) => a.id === 'microsoft');

  return (
    <div className="grid gap-8">
      <header className="grid gap-3">
        <p className="eyebrow">Real mode</p>
        <h1 className="serif text-4xl text-[color:var(--forest)] leading-tight">
          Connected sources
        </h1>
        <p className="text-[color:var(--charcoal-soft)] max-w-2xl">
          Real mode runs the same workflows as the synthetic demo, but against your connected
          accounts. Manage which integrations are active here. Each integration adapter is a
          self-contained file — adding Jira, Linear, Slack, or Notion later is a one-file change.
        </p>
      </header>

      <hr className="rule" />

      <section className="grid md:grid-cols-2 gap-4">
        <AdapterCard
          name="Microsoft 365"
          description="Outlook calendar + mail via Microsoft Graph."
          status={hasMicrosoft ? 'configured' : 'not-configured'}
          envHint="MICROSOFT_CLIENT_ID + MICROSOFT_CLIENT_SECRET + MICROSOFT_TENANT_ID"
        />
        <AdapterCard
          name="Google Workspace"
          description="Calendar + Gmail via Google APIs."
          status={hasGoogle ? 'configured' : 'not-configured'}
          envHint="GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET"
        />
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <AdapterCard
          name="Jira"
          description="Issues, sprints, comments. Future addition — registry-ready."
          status="future"
          envHint="JIRA_BASE_URL + JIRA_EMAIL + JIRA_API_TOKEN"
        />
        <AdapterCard
          name="Linear"
          description="Issues + project cycles. Future addition — registry-ready."
          status="future"
          envHint="LINEAR_API_KEY"
        />
      </section>

      <section className="grid gap-4">
        <hr className="rule" />
        <p className="eyebrow">Run a real-mode workflow</p>
        <div className="flex gap-3">
          <Link href="/brief" className="btn btn-primary">Morning brief</Link>
          <Link href="/meeting" className="btn btn-ghost">Meeting mode</Link>
          <Link href="/tracker" className="btn btn-ghost">Status tracker</Link>
        </div>
        <p className="text-xs text-[color:var(--charcoal-mute)]">
          When real-mode adapters are configured, the orchestrator will use them in addition to (or
          instead of) the synthetic adapter. With no real adapter configured, runs fall back to the
          synthetic Northridge engagement — same agents, same gates, same UI.
        </p>
      </section>
    </div>
  );
}

function AdapterCard({
  name,
  description,
  status,
  envHint,
}: {
  name: string;
  description: string;
  status: 'configured' | 'not-configured' | 'future';
  envHint: string;
}) {
  const label =
    status === 'configured' ? 'Connected' : status === 'not-configured' ? 'Not configured' : 'Future';
  const cls =
    status === 'configured' ? 'rag-green' : status === 'not-configured' ? 'rag-amber' : 'agent-state-queued';

  return (
    <article className="card card-pad grid gap-2">
      <div className="flex items-baseline justify-between">
        <h3 className="serif text-xl text-[color:var(--forest)]">{name}</h3>
        <span className={`text-xs uppercase tracking-widest border px-2 py-0.5 ${cls}`}>{label}</span>
      </div>
      <p className="text-sm text-[color:var(--charcoal-soft)]">{description}</p>
      {status !== 'configured' && (
        <p className="text-xs text-[color:var(--charcoal-mute)] mono">env: {envHint}</p>
      )}
    </article>
  );
}
