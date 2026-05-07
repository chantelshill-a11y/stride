/**
 * Shared Anthropic client + thin helpers.
 *
 * Models default from env so prod and demo can run different tiers without
 * code changes. Doers default to Sonnet 4.6, Orchestrator + Reviewer to Opus 4.7.
 * System prompt is wrapped in cache_control to amortize the cost of repeat
 * visitor demo runs.
 */

import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;

export function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and add your key.',
    );
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

export const MODELS = {
  doer: process.env.STRIDE_DOER_MODEL ?? 'claude-sonnet-4-6',
  reviewer: process.env.STRIDE_REVIEWER_MODEL ?? 'claude-opus-4-7',
  orchestrator: process.env.STRIDE_ORCHESTRATOR_MODEL ?? 'claude-opus-4-7',
};

/** Build a system block with cache_control set so repeat runs hit the prompt cache. */
export function cachedSystem(text: string): Anthropic.Messages.TextBlockParam[] {
  return [
    {
      type: 'text',
      text,
      cache_control: { type: 'ephemeral' },
    } as unknown as Anthropic.Messages.TextBlockParam,
  ];
}

/**
 * Helper to extract the first JSON object from a model response.
 * Agents use a structured tool-call where possible; this is the fallback.
 */
export function extractJSON<T = unknown>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`No JSON object found in model response: ${text.slice(0, 200)}`);
  }
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}
