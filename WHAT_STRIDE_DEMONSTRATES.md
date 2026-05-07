# What Stride demonstrates

A portable, plain-English summary of the skills and decisions visible in this project. Use it as cover-letter ammunition, interview talking points, or context for a stakeholder review. Every claim below traces to specific code in this repo.

---

## The product, in one sentence

Stride is a multi-agent orchestration tool that does the work a project manager otherwise spends a morning on — synthesized status, surfaced risk, prepped meetings, audience-tailored stakeholder comms, and a curated project tracker — with human review at every handoff and before every external action.

Live demo: [stride.chantelhill.com](https://stride.chantelhill.com) · Repo: [github.com/chantelshill-a11y/stride](https://github.com)

---

## What it demonstrates about me

### 1. Multi-agent orchestration design

Stride decomposes the fuzzy job of "morning brief for a PM" into seven specialized agents plus a shared reviewer:

- **Orchestrator** plans which doers run, in what order, and assembles the final brief.
- **Status Synthesizer** turns a sprint board + threads + mail into a factual status read.
- **Risk Detective** surfaces blockers and slips, deduplicating against the existing tracker.
- **Meeting Prep** produces a per-meeting agenda + prep notes for today's calendar.
- **Comms Tailor** drafts four audience versions of the same status: standup, exec, client, skip-level.
- **Action Tracker** extracts action items from transcripts and threads.
- **Tracker Curator** reconciles approved outputs into persistent state and recomputes RAG.
- **Reviewer / Analyst** critiques every doer's output before it ever reaches the human.

The doer + reviewer pattern mirrors how good PMs work: do the work, get a peer check, then ship. Implemented at [agents/orchestrator.ts](agents/orchestrator.ts) and [agents/reviewer-analyst.ts](agents/reviewer-analyst.ts).

### 2. Human-in-the-loop maturity

Four structural gate types make sure no agent ever acts unilaterally:

| Gate | When it fires |
| --- | --- |
| Between-agent handoff | After every doer + reviewer pair, before the output feeds the next agent |
| External action | Sending email, posting Slack, creating Jira tickets, scheduling calendar events |
| Final publish | Every Morning Brief and Meeting Mode artifact ends here |
| Low-confidence escalation | Reviewer can force a mandatory human pause regardless of mode |

Every gate has two ways to revise without leaving the surface:
1. **Inline editing** — calendar events have date/time/duration/attendees fields plus include/exclude toggles.
2. **Natural-language revision** — type *"move all to 1 hour, drop the Tuesday block"* and a Claude call rewrites the payload in the same schema.

JSON is hidden behind a "show raw" details panel. The PM doesn't see code unless they ask for it.

Code: [agents/shared/hitl.ts](agents/shared/hitl.ts), [components/HITLGateCard.tsx](components/HITLGateCard.tsx), [components/GatePayloadView.tsx](components/GatePayloadView.tsx).

### 3. Project management domain depth

The synthetic project — *Northridge Financial — Contracts AI Phase 2* — is modeled on a real CLM AI delivery engagement. Workstreams are calibrated to actual PM rituals:

- Clause Model Expansion (Relativity Contracts Pro, DocuSign Insight)
- Validation & Accuracy Gating (precision/recall/F1 sweeps, attorney sign-off SOPs)
- Client Governance & Rollout (workshops, playbook handoff, change management)

Risks include the kinds that actually slip these programs: attorney sign-off bottlenecks, training-set gaps on carve-out language, vendor feature delays. Mid-sprint transcripts read like real delivery team check-ins. Confidence on the ship date is calibrated against milestones, not vibes.

This isn't a generic SaaS demo. It demonstrates that the PM workflows are calibrated by someone who has actually run programs like this.

Code: [fixtures/synthetic-project/index.ts](fixtures/synthetic-project/index.ts).

### 4. Production architecture awareness

Decisions visible in the codebase that signal production thinking:

- **Integration registry pattern.** Adapters self-register based on env vars; agents query the registry, never specific adapters. Adding Jira, Linear, Slack, or Notion is a one-file drop with no agent or orchestrator changes. Code: [agents/shared/integrations/registry.ts](agents/shared/integrations/registry.ts).
- **SSE-first orchestration.** Agent events stream over Server-Sent Events with heartbeats and abort handling; the trace panel renders agent state as it happens. HITL gates are open Promises that resolve on user action. Code: [app/api/run/route.ts](app/api/run/route.ts), [agents/shared/trace.ts](agents/shared/trace.ts).
- **State that survives hot-reload.** In-memory tracker and run registry are pinned to `globalThis` so Next.js HMR doesn't reset them mid-session. Production deploys swap to Upstash Redis with no shape change.
- **Prompt caching.** System prompts wrap in `cache_control: ephemeral` so repeat visitor demos amortize the cache cost.
- **Real-mode password gate.** `/real/*` routes are protected by middleware checking a signed cookie. Real OAuth flows for Microsoft Graph + Google Workspace are stubbed with TODO comments showing the exact API calls.

### 5. Evaluation craftsmanship

[evals/run-evals.ts](evals/run-evals.ts) ships a real eval harness:

- **Zod-backed schemas** enforce shape correctness for every agent output.
- **Golden sets** test "must mention" / "must not mention" / "max words" / "minimum count" assertions per audience. The Comms Tailor exec draft *must* mention "May 22" and "60% confidence"; the client draft *must not* mention "DocuSign" or internal names.
- **Two modes**: `npm run eval` for shape-only checks (free, runs in CI), `npm run eval:live` for real model calls when changing prompts.

This is how production AI systems get tested. Translates directly from the precision/recall/F1 work I do in extraction model validation.

### 6. Output craftsmanship

Every workflow output extracts to two destinations behind HITL gates:

- **Word docs** with corporate-standard formatting: page header (`STRIDE · {project} · {date}`) and footer (`stride.chantelhill.com   Page X of Y`), Microsoft typography (Calibri 11pt body, Georgia 22/16/13pt headings), real data tables with header rows + alternating shading + severity pills, document properties wired to Word's Info panel for SharePoint searchability. Code: [agents/lib/docx-export.ts](agents/lib/docx-export.ts).
- **Calendar time blocks / meetings** via the configured adapter (Outlook via Microsoft Graph, Google Calendar via Calendar v3, synthetic in demo mode). Each event is fully editable inline before approval; per-event include/exclude toggle; sensible default sequencing so a stack of items on the same date doesn't double-book.

Drafts in the UI render as proper prose — Jost 16px, 1.75 line-height, charcoal text — not as raw JSON or monospace output.

### 7. Visual + brand discipline

Same palette, fonts, and design language as my other portfolio pieces:

- Forest green `#2C4A35`, cream `#F7F5F1`, charcoal `#2A2A2A`
- Playfair Display (serif) for headings, Jost (sans) for body
- Sharp corners everywhere
- No emojis, no marketing stock photography

Stakeholder-presentable on a hiring manager's screen the moment the page loads.

### 8. Engineering taste

- TypeScript strict mode across the codebase
- Next.js 15 App Router with React 19
- Proper SSE pipe with heartbeat + client-disconnect cleanup
- ReadableStream parsing on the client for live event consumption
- No emoji bloat, no AI-generated marketing copy, no boilerplate cruft

---

## How to read this project in 5 minutes

1. Visit [/](https://stride.chantelhill.com/) — read the hero and the three workflow cards.
2. Click **Run a morning brief**. Watch the Agent Trace panel populate left-to-right as each doer + reviewer pair runs. (No Anthropic key on the demo deploy? Replay mode kicks in automatically — same event flow, same gates, hand-authored outputs against the synthetic fixture.)
3. Hit the first HITL gate — the Status Synthesizer's output renders as a card, not JSON. Try the natural-language revision input ("change Phase 2 confidence to 55%"). Approve.
4. Continue through the remaining gates (Risk Detective → Meeting Prep → Action Tracker → Comms Tailor → Final publish). The Tracker Curator runs deterministically before the comms drafts so they see the post-approval risk view.
5. Visit [/tracker](https://stride.chantelhill.com/tracker) — the snapshot updated. The productivity metric ("~X hours saved this week") computes live from history. Click **Export to Word** for a corporate-formatted .docx. Click **Schedule action items** to open the calendar gate with editable per-event fields.
6. Visit [/about](https://stride.chantelhill.com/about) for the architecture story.

---

## What's shipped (launch state)

Eight pieces of work that together make the project demo-ready:

- ✅ Multi-agent orchestration (7 agents + shared reviewer)
- ✅ HITL gates at every handoff, external action, final publish, and low-confidence escalation
- ✅ Three workflows: Morning Brief, Meeting Mode, persistent Status Tracker
- ✅ Notes workspace (manual + auto-saved meeting artifacts)
- ✅ Word export (corporate formatting, page chrome, data tables) for every workflow output
- ✅ Calendar export with HITL gate + per-event inline editing
- ✅ Replay mode (deterministic playback when no Anthropic key) — every visitor sees a working demo
- ✅ Productivity metrics surfaced live in the Status Tracker
- ✅ Mobile responsive pass on nav + tracker header + hero
- ✅ `/about` page + this `WHAT_STRIDE_DEMONSTRATES.md` for stakeholder review

## What's deferred to the next session

Documented here so the architectural story stays honest:

- **Multi-project switcher.** Tracker is currently single-tenant per Stride instance. The store at [agents/shared/tracker.ts](agents/shared/tracker.ts) already keys by project ID (`'synthetic'` is the default), so the work is: add a cookie-backed current-project selector, route handlers read the cookie and pass the project ID through to the orchestrator, agents use it on every `loadTracker` call. Half a day's work; out of scope for this launch because portfolio demo is single-project.
- **Real OAuth for Microsoft Graph + Google.** Adapter stubs at [agents/shared/integrations/](agents/shared/integrations/) document every Graph and Calendar API call needed — the gap is wiring NextAuth (Auth.js v5) with the Microsoft and Google providers, storing encrypted tokens in Upstash, and replacing the `TODO(real-mode)` comments in each adapter with the documented `fetch` calls. Untestable without my own OAuth app credentials, so deferred until I'm running Stride against my actual Outlook + Google accounts daily.

---

*Built by Chantel Hill — AI Solutions Delivery Consultant.*
