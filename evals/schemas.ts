/**
 * Zod schemas for agent outputs.
 *
 * Used by the eval harness to enforce shape correctness in CI without making
 * any model calls. `npm run eval` validates fixtures + golden outputs against
 * these. `npm run eval:live` additionally runs the agents and validates their
 * real outputs.
 */

import { z } from 'zod';

export const StatusSynthesizerSchema = z.object({
  yesterdayProgress: z.string().min(10),
  velocity: z.object({
    completed: z.number().int().nonnegative(),
    inProgress: z.number().int().nonnegative(),
    blocked: z.number().int().nonnegative(),
  }),
  slipping: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      reason: z.string(),
    }),
  ),
  onTrack: z.array(z.object({ id: z.string(), title: z.string() })),
  observations: z.array(z.string()).min(0).max(8),
});

export const RiskDetectiveSchema = z.object({
  newRisks: z.array(
    z.object({
      title: z.string().min(3),
      severity: z.enum(['low', 'medium', 'high']),
      status: z.enum(['open', 'mitigating']),
      owner: z.string().optional(),
      workstreamId: z.string().optional(),
      notes: z.string(),
      evidence: z.string(),
    }),
  ),
  updates: z.array(
    z.object({
      id: z.string(),
      status: z.enum(['open', 'mitigating', 'resolved', 'aged-out']).optional(),
      severity: z.enum(['low', 'medium', 'high']).optional(),
      notes: z.string().optional(),
    }),
  ),
  agedOut: z.array(z.string()),
});

export const MeetingPrepSchema = z.object({
  meetings: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      time: z.string(),
      attendees: z.array(z.string()),
      agenda: z.string(),
      priorContext: z.string(),
      talkingPoints: z.array(z.string()).min(1).max(8),
    }),
  ),
});

export const ActionTrackerSchema = z.object({
  newItems: z.array(
    z.object({
      title: z.string().min(3),
      owner: z.string().optional(),
      dueDate: z.string().optional(),
      sourceRef: z.string(),
      evidence: z.string(),
    }),
  ),
  statusUpdates: z.array(
    z.object({
      id: z.string(),
      status: z.enum(['open', 'in-progress', 'done']),
      note: z.string().optional(),
    }),
  ),
});

export const CommsTailorSchema = z.object({
  standup: z.string().min(20),
  exec: z.string().min(20),
  client: z.string().min(20),
  skipLevel: z.string().min(20),
});

export const MeetingSummarizerSchema = z.object({
  team: z.string().min(20),
  exec: z.string().min(20),
  client: z.string().min(20),
});

export const ReviewerCritiqueSchema = z.object({
  verdict: z.enum(['pass', 'flag', 'block']),
  confidence: z.number().min(0).max(1),
  issues: z.array(
    z.object({
      severity: z.enum(['low', 'medium', 'high']),
      note: z.string(),
    }),
  ),
  suggestedEdits: z.string().optional(),
});

export const SCHEMAS = {
  'status-synthesizer': StatusSynthesizerSchema,
  'risk-detective': RiskDetectiveSchema,
  'meeting-prep': MeetingPrepSchema,
  'action-tracker': ActionTrackerSchema,
  'comms-tailor': CommsTailorSchema,
  'meeting-summarizer': MeetingSummarizerSchema,
  'reviewer-analyst': ReviewerCritiqueSchema,
} as const;

export type AgentKey = keyof typeof SCHEMAS;
