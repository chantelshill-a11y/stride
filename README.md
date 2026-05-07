# Stride

Multi-agent orchestration for project managers. Morning briefs, meeting artifacts, and a persistent project status tracker, with human-in-the-loop control at every handoff.

Portfolio project for Chantel Hill — targets `stride.chantelhill.com`.

> **For stakeholders / hiring managers:** [WHAT_STRIDE_DEMONSTRATES.md](WHAT_STRIDE_DEMONSTRATES.md) — a portable plain-English summary of the skills and architectural decisions visible in this project. Or visit `/about` in the running app for the in-product tour.

## Stack

- Next.js 15 (App Router) + React 19 + Tailwind CSS, deployed on Netlify
- Anthropic SDK for agent execution; Claude Sonnet 4.6 for doers, Claude Opus 4.7 for the orchestrator and reviewer
- Server-Sent Events for live agent traces
- Upstash Redis for run rate limiting and persistent tracker state
- NextAuth + Microsoft Graph + Google for real-mode integrations (Phase 9)

## Local development

```bash
cp .env.example .env.local
# fill in ANTHROPIC_API_KEY at minimum
npm install
npm run dev
```

Visit http://localhost:3000 — the landing page links to the three workflows. Synthetic mode is on by default; no auth required.

## Architecture

```
app/                      Next.js routes (UI + API)
  api/run/route.ts        SSE endpoint that streams agent events
  api/approve/route.ts    HITL gate resolution
  brief/page.tsx          Morning Brief workflow
  meeting/page.tsx        Meeting Mode workflow
  tracker/page.tsx        Persistent Status Tracker
agents/
  orchestrator.ts         Plans + dispatches doers + assembles outputs
  status-synthesizer.ts   Doer: sprint board + threads + mail → status read
  risk-detective.ts       Doer: blockers, slips, dependency conflicts (Phase 3)
  meeting-prep.ts         Doer: per-meeting agenda + prep notes (Phase 3)
  comms-tailor.ts         Doer: standup / exec / client / skip-level drafts (Phase 3)
  action-tracker.ts       Doer: extract action items from transcripts/threads (Phase 3)
  tracker-curator.ts      Doer: reconciles outputs into persistent tracker (Phase 5)
  reviewer-analyst.ts     Reviewer: critiques every doer output before HITL
  shared/
    types.ts              Stable contracts (events, gates, tracker, integrations)
    trace.ts              In-memory run registry (events + gates)
    hitl.ts               Gate primitives — every external action passes through here
    tracker.ts            Tracker state read/write (in-memory now, Upstash later)
    integrations/
      registry.ts         Adapter registry — agents query this, not specific adapters
      synthetic.ts        Synthetic adapter for visitor-mode demo
      # Phase 9: google.ts, microsoft.ts
      # Future: jira.ts, linear.ts, slack.ts, notion.ts
  lib/
    anthropic.ts          Shared client + model selection + prompt caching
    run-agent.ts          Boilerplate for streaming + tool-use agent loops
fixtures/synthetic-project/
  index.ts                Northridge Financial Phase 2 — sprint, calendar, mail, threads, transcript
components/
  RunPlayer.tsx           SSE consumer; renders trace + gates + brief
  AgentTracePanel.tsx     Live per-agent state with reviewer pills
  HITLGateCard.tsx        Approve / edit / reject surface
  BriefView.tsx           Final brief artifact rendering
evals/                    (Phase 8) golden-set harness
```

## Build phases

1. ✅ Foundations — scaffold, brand, shared primitives, integration registry, synthetic fixture
2. ✅ First agent end-to-end — Status Synthesizer + Reviewer/Analyst over SSE with HITL gate
3. ✅ Remaining doer agents — Risk Detective, Meeting Prep, Comms Tailor, Action Tracker
4. ✅ Orchestrator + full Morning Brief workflow
5. ✅ Status Tracker (Tracker Curator + persistent state + tracker UI)
6. ✅ Meeting Mode workflow
7. ✅ Polish — trace/polished toggle, brand styles, navigation
8. ✅ Eval harness — Zod-backed schemas + golden sets, shape & live modes
9. ✅ Real-mode integrations — Microsoft Graph + Google adapter skeletons behind password gate
10. ✅ Deploy — Netlify config + env contract + Upstash hooks
11. ✅ Notes workspace + meeting-mode auto-save
12. ✅ Word + Calendar exports per workflow output (HITL-gated, corporate-formatted)
13. ✅ Stakeholder review surface — `/about` page + WHAT_STRIDE_DEMONSTRATES.md
14. ✅ Replay mode — deterministic playback when no Anthropic key, so every visitor sees a working demo
15. ✅ Productivity metrics in Status Tracker — live "hours saved" computation from history
16. ✅ Mobile responsive pass — nav, hero, tracker header

### Roadmap (deliberately deferred)

- Multi-project switcher (cookie-backed; tracker store already keys by project ID)
- Real OAuth for Microsoft Graph + Google (NextAuth/Auth.js v5; adapters document the API calls in TODO comments)

## Deploying

1. **Netlify project** — point at this repo. `netlify.toml` declares the
   `@netlify/plugin-nextjs` plugin; build command and publish dir are set.

2. **Custom domain** — add `stride.chantelhill.com` in Netlify; CNAME to the
   default Netlify subdomain.

3. **Environment variables** (Netlify → Site settings → Environment):
   - `ANTHROPIC_API_KEY` — required
   - `STRIDE_DOER_MODEL`, `STRIDE_REVIEWER_MODEL`, `STRIDE_ORCHESTRATOR_MODEL` — optional model overrides
   - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — for tracker persistence + rate limiting
   - `STRIDE_REAL_MODE_PASSWORD` — gate for /real
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — when wiring Google
   - `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` — when wiring Microsoft

4. **Tracker persistence (production)** — `agents/shared/tracker.ts` uses an
   in-memory Map on a single instance. For multi-instance Netlify Functions,
   swap to Upstash Redis (already a dependency). The shape (`TrackerState`)
   doesn't change, so it's a one-file edit.

## Adding a new integration (e.g. Jira)

The registry is the only file that needs updating outside the new adapter:

1. Create `agents/shared/integrations/jira.ts` exporting `jiraAdapter` (an
   `IntegrationAdapter`) and `isJiraConfigured()`.
2. In `agents/shared/integrations/registry.ts`, add the import and:
   ```ts
   if (isJiraConfigured()) register(jiraAdapter);
   ```
3. Add a card in `app/real/page.tsx` so the integration appears in settings.

That's the entire change. No agent, orchestrator, or UI logic touches the
adapter directly — they all go through `getAdapter(id)` or `listAdapters()`.

## Verification checklist

End-to-end checks that should all pass before declaring a release ready:

1. **Synthetic demo path** — `/`, click "Run morning brief," watch each agent in the trace, hit each HITL gate, approve through, end with a rendered brief.
2. **Reviewer fires on ambiguity** — seed an ambiguous risk in the synthetic fixture and confirm the Reviewer flags it as low-confidence and forces a HITL pause.
3. **Per-agent eval** — `npm run eval` (shape) and `npm run eval:live` (model). All agents pass.
4. **Meeting mode** — paste/use the synthetic transcript, get action items + three tailored summaries + risk entries + ticket drafts behind HITL gates.
5. **Status Tracker persistence** — run two consecutive briefs, confirm tracker reflects updated RAG, deduped risks, reconciled action items. Reload the page; state survives.
6. **Adapter registry** — drop in a stub `jira.ts`, register it, confirm the /real page shows it; remove it. No agent or orchestrator code touched.
7. **External-action gates** — in real mode, attempt to send an email; confirm nothing leaves Stride without an explicit approval click. Test reject path too.
8. **Brand pass** — forest green #2C4A35, cream #F7F5F1, Playfair Display + Jost, sharp corners, no emojis. Side-by-side against attribution.chantelhill.com and triage.chantelhill.com.
9. **Daily-driver smoke test** — connect real Outlook + Google, run a real morning brief on an actual workday, confirm artifacts are useful enough to actually use.

## Why this exists

PMs lose hours/day to context-switching: gathering scattered status, retelling the same update for different audiences, prepping for back-to-back meetings. Stride puts a specialized agent on each pain point, a reviewer agent on each output, and a human gate at every handoff and external action — saving the morning ritual hours while keeping the PM in control.
