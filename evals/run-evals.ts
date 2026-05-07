/**
 * Stride eval harness.
 *
 * Two modes:
 *   `npm run eval`        — shape-only checks. Validates that golden inputs
 *                           and (optional) recorded outputs match the agent
 *                           schemas. No model calls. Fast, runs in CI.
 *   `npm run eval:live`   — actually invokes each agent against the synthetic
 *                           fixture, validates output shape, runs golden
 *                           assertions ("must mention", "must not mention",
 *                           etc.), and prints a summary table.
 *
 * Live mode requires ANTHROPIC_API_KEY in env.
 */

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

import { SCHEMAS, type AgentKey } from './schemas';
import { createRun, newRunId } from '../agents/shared/trace';
import { loadTracker } from '../agents/shared/tracker';
import { runStatusSynthesizer, type StatusSynthesizerOutput } from '../agents/status-synthesizer';
import { runRiskDetective, type RiskDetectiveOutput } from '../agents/risk-detective';
import { runMeetingPrep, type MeetingPrepOutput } from '../agents/meeting-prep';
import { runActionTracker, type ActionTrackerOutput } from '../agents/action-tracker';
import { runCommsTailor, type CommsTailorOutput } from '../agents/comms-tailor';
import { runMeetingSummarizer, type MeetingSummarizerOutput } from '../agents/meeting-summarizer';
import { syntheticTranscript } from '../fixtures/synthetic-project/index';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = join(__dirname, 'golden');

interface Golden {
  name: string;
  description?: string;
  expected: Record<string, unknown>;
}

interface EvalResult {
  agent: AgentKey;
  goldenName: string;
  shapeOk: boolean;
  assertionsPassed: number;
  assertionsFailed: number;
  failures: string[];
  durationMs: number;
}

const live = process.argv.includes('--mode=live');

async function loadGolden(file: string): Promise<Golden> {
  const text = await readFile(join(GOLDEN_DIR, file), 'utf8');
  return JSON.parse(text) as Golden;
}

function checkShape(schema: z.ZodTypeAny, value: unknown, failures: string[]): boolean {
  const r = schema.safeParse(value);
  if (!r.success) {
    failures.push(`shape: ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    return false;
  }
  return true;
}

function checkContainsTitles(items: Array<{ title: string }>, expected: string[], failures: string[]): number {
  let passed = 0;
  for (const needle of expected) {
    const found = items.some((i) => i.title.toLowerCase().includes(needle.toLowerCase()));
    if (found) passed++;
    else failures.push(`expected an item with title containing "${needle}"`);
  }
  return passed;
}

function checkMentions(text: string, mustMention: string[], mustNotMention: string[], failures: string[]): number {
  let passed = 0;
  for (const m of mustMention) {
    if (text.toLowerCase().includes(m.toLowerCase())) passed++;
    else failures.push(`expected text to mention "${m}"`);
  }
  for (const m of mustNotMention) {
    if (!text.toLowerCase().includes(m.toLowerCase())) passed++;
    else failures.push(`expected text NOT to mention "${m}"`);
  }
  return passed;
}

async function runOneAgent(agent: AgentKey): Promise<unknown> {
  if (!live) return null;
  const run = createRun(newRunId());
  const tracker = await loadTracker();
  switch (agent) {
    case 'status-synthesizer': {
      const out = await runStatusSynthesizer(run);
      return out.body as StatusSynthesizerOutput;
    }
    case 'risk-detective': {
      const out = await runRiskDetective(run, { tracker });
      return out.body as RiskDetectiveOutput;
    }
    case 'meeting-prep': {
      const out = await runMeetingPrep(run);
      return out.body as MeetingPrepOutput;
    }
    case 'action-tracker': {
      const out = await runActionTracker(run, { tracker, transcript: syntheticTranscript });
      return out.body as ActionTrackerOutput;
    }
    case 'comms-tailor': {
      const status: StatusSynthesizerOutput = {
        yesterdayProgress:
          'Term & Termination shipped to production; indemnification + LoL accuracy gating in flight; attorney training playbook slipping ~2 days.',
        velocity: { completed: 2, inProgress: 4, blocked: 1 },
        slipping: [
          { id: 'NRF-205', title: 'Attorney training playbook — Phase 2 handoff', reason: 'Northridge legal ops requested additional FP review SOP walkthrough.' },
        ],
        onTrack: [{ id: 'NRF-203', title: 'Term & Termination — ship to production' }],
        observations: ['Phase 2 ship-date confidence dropped from 80% to 60% per Rohan.'],
      };
      const out = await runCommsTailor(run, { status, risks: tracker.risks });
      return out.body as CommsTailorOutput;
    }
    case 'meeting-summarizer': {
      const out = await runMeetingSummarizer(run, {
        transcript: syntheticTranscript,
        meetingTitle: 'Northridge Phase 2 — Sprint 4 mid-sprint check',
        actions: { newItems: [], statusUpdates: [] },
        risks: tracker.risks,
      });
      return out.body as MeetingSummarizerOutput;
    }
    default:
      return null;
  }
}

const PLAN: Array<{ agent: AgentKey; goldenFile: string }> = [
  { agent: 'status-synthesizer', goldenFile: 'status-synthesizer.json' },
  { agent: 'risk-detective', goldenFile: 'risk-detective.json' },
  { agent: 'meeting-prep', goldenFile: 'meeting-prep.json' },
  { agent: 'action-tracker', goldenFile: 'action-tracker.json' },
  { agent: 'comms-tailor', goldenFile: 'comms-tailor.json' },
  { agent: 'meeting-summarizer', goldenFile: 'meeting-summarizer.json' },
];

async function runOneEval({ agent, goldenFile }: { agent: AgentKey; goldenFile: string }): Promise<EvalResult> {
  const golden = await loadGolden(goldenFile);
  const failures: string[] = [];
  let passed = 0;
  let failed = 0;
  const start = Date.now();

  let output: unknown = null;
  try {
    output = await runOneAgent(agent);
  } catch (err) {
    failures.push(`agent threw: ${(err as Error).message}`);
  }

  let shapeOk = true;
  if (output) {
    shapeOk = checkShape(SCHEMAS[agent], output, failures);
  }

  if (live && output && shapeOk) {
    const exp = golden.expected;
    if (agent === 'status-synthesizer') {
      const o = output as StatusSynthesizerOutput;
      if (Array.isArray(exp.containsTitles)) {
        passed += checkContainsTitles(o.slipping, exp.containsTitles as string[], failures);
        failed = (exp.containsTitles as string[]).length - passed;
      }
      if (typeof exp.minObservations === 'number' && o.observations.length < exp.minObservations) {
        failures.push(`expected at least ${exp.minObservations} observations, got ${o.observations.length}`);
        failed++;
      } else if (typeof exp.minObservations === 'number') passed++;
      if (typeof exp.minSlipping === 'number' && o.slipping.length < exp.minSlipping) {
        failures.push(`expected at least ${exp.minSlipping} slipping items, got ${o.slipping.length}`);
        failed++;
      } else if (typeof exp.minSlipping === 'number') passed++;
      if (typeof exp.blockedAtLeast === 'number' && o.velocity.blocked < exp.blockedAtLeast) {
        failures.push(`expected at least ${exp.blockedAtLeast} blocked, got ${o.velocity.blocked}`);
        failed++;
      } else if (typeof exp.blockedAtLeast === 'number') passed++;
    }
    if (agent === 'risk-detective') {
      const o = output as RiskDetectiveOutput;
      if (Array.isArray(exp.noDuplicateOf)) {
        for (const needle of exp.noDuplicateOf as string[]) {
          const dup = o.newRisks.some((r) => r.title.toLowerCase().includes(needle.toLowerCase()));
          if (dup) {
            failures.push(`expected NO new risk titled like "${needle}"`);
            failed++;
          } else passed++;
        }
      }
      if (typeof exp.maxNewRisks === 'number' && o.newRisks.length > exp.maxNewRisks) {
        failures.push(`expected ≤${exp.maxNewRisks} newRisks, got ${o.newRisks.length}`);
        failed++;
      } else if (typeof exp.maxNewRisks === 'number') passed++;
    }
    if (agent === 'meeting-prep') {
      const o = output as MeetingPrepOutput;
      if (typeof exp.meetingCount === 'number' && o.meetings.length !== exp.meetingCount) {
        failures.push(`expected ${exp.meetingCount} meetings, got ${o.meetings.length}`);
        failed++;
      } else if (typeof exp.meetingCount === 'number') passed++;
      if (Array.isArray(exp.containsTitles)) {
        passed += checkContainsTitles(o.meetings, exp.containsTitles as string[], failures);
        failed += (exp.containsTitles as string[]).length - passed;
      }
      if (typeof exp.minTalkingPointsPerMeeting === 'number') {
        const ok = o.meetings.every((m) => m.talkingPoints.length >= (exp.minTalkingPointsPerMeeting as number));
        if (ok) passed++;
        else {
          failures.push(`every meeting should have ≥${exp.minTalkingPointsPerMeeting} talking points`);
          failed++;
        }
      }
    }
    if (agent === 'action-tracker') {
      const o = output as ActionTrackerOutput;
      if (typeof exp.minNewItems === 'number' && o.newItems.length < exp.minNewItems) {
        failures.push(`expected ≥${exp.minNewItems} newItems, got ${o.newItems.length}`);
        failed++;
      } else if (typeof exp.minNewItems === 'number') passed++;
      if (Array.isArray(exp.containsTitles)) {
        passed += checkContainsTitles(o.newItems, exp.containsTitles as string[], failures);
        failed += (exp.containsTitles as string[]).length - passed;
      }
    }
    if (agent === 'comms-tailor') {
      const o = output as CommsTailorOutput;
      const must = (exp.execMustMention as string[]) ?? [];
      const mustNot = (exp.clientMustNotMention as string[]) ?? [];
      passed += checkMentions(o.exec, must, [], failures);
      passed += checkMentions(o.client, [], mustNot, failures);
      if (typeof exp.execMaxWords === 'number') {
        const wc = o.exec.split(/\s+/).length;
        if (wc <= exp.execMaxWords) passed++;
        else {
          failures.push(`exec word count ${wc} > ${exp.execMaxWords}`);
          failed++;
        }
      }
    }
    if (agent === 'meeting-summarizer') {
      const o = output as MeetingSummarizerOutput;
      const must = (exp.execMustMention as string[]) ?? [];
      const mustNot = (exp.clientMustNotMention as string[]) ?? [];
      passed += checkMentions(o.exec, must, [], failures);
      passed += checkMentions(o.client, [], mustNot, failures);
    }
  }

  return {
    agent,
    goldenName: golden.name,
    shapeOk,
    assertionsPassed: passed,
    assertionsFailed: failed,
    failures,
    durationMs: Date.now() - start,
  };
}

(async function main() {
  console.log('Stride eval harness');
  console.log(`Mode: ${live ? 'LIVE (calls Anthropic)' : 'shape-only (no model calls)'}`);
  console.log(`Golden directory: ${GOLDEN_DIR}\n`);

  const results: EvalResult[] = [];
  for (const item of PLAN) {
    process.stdout.write(`▶ ${item.agent} … `);
    const r = await runOneEval(item);
    results.push(r);
    if (r.shapeOk && r.assertionsFailed === 0) {
      process.stdout.write(`pass (${r.durationMs}ms, ${r.assertionsPassed} assertions)\n`);
    } else {
      process.stdout.write(`FAIL (${r.durationMs}ms)\n`);
      for (const f of r.failures) process.stdout.write(`    - ${f}\n`);
    }
  }

  const passing = results.filter((r) => r.shapeOk && r.assertionsFailed === 0).length;
  console.log(`\n${passing}/${results.length} agents passing.`);

  // Also enumerate golden files in the directory we didn't run, so the harness
  // surfaces any missing PLAN entries.
  const onDisk = (await readdir(GOLDEN_DIR)).filter((f) => f.endsWith('.json'));
  const planned = new Set(PLAN.map((p) => p.goldenFile));
  for (const f of onDisk) {
    if (!planned.has(f)) console.log(`(unrunnable) ${f} — no PLAN entry; add one in run-evals.ts`);
  }

  process.exit(passing === results.length ? 0 : 1);
})().catch((err) => {
  console.error('Eval harness crashed:', err);
  process.exit(2);
});
