/**
 * Natural-language payload revision.
 *
 * Used by the HITL gate UI: instead of editing raw JSON, the PM types a
 * natural-language instruction ("change the Phase 2 confidence to 65% and add
 * Megan to the playbook timeline action item") and a Claude call produces a
 * revised payload in the same schema.
 *
 * The model only sees what the gate already shows the user — payload + a
 * short description of the agent that produced it — so revision can't escape
 * the gate's scope.
 */

import { client, MODELS, cachedSystem } from './anthropic';
import type { AgentName } from '../shared/types';

const AGENT_DESCRIPTIONS: Partial<Record<AgentName | 'final-brief' | 'final-meeting', string>> = {
  'status-synthesizer':
    'A status read for a project manager: yesterdayProgress (string), velocity {completed, inProgress, blocked}, slipping (array), onTrack (array), observations (array of short notes).',
  'risk-detective':
    'A risk delta: newRisks (array of {title, severity, status, owner?, workstreamId?, notes, evidence}), updates (array of {id, status?, severity?, notes?}), agedOut (array of risk IDs).',
  'meeting-prep':
    'Meeting prep blocks: meetings (array of {id, title, time, attendees, agenda, priorContext, talkingPoints[]}).',
  'action-tracker':
    'Action items: newItems (array of {title, owner?, dueDate?, sourceRef, evidence}), statusUpdates (array of {id, status, note?}).',
  'comms-tailor':
    'Tailored comms drafts. May be {standup, exec, client, skipLevel} for morning brief or {team, exec, client} for meeting summaries.',
  'final-brief':
    'A morning brief artifact: yesterdayProgress, todayMeetings (array), risks (array), standupDraft, execUpdateDraft, openActionItems (array).',
  'final-meeting':
    'A meeting artifact: meetingTitle, actionItems, summaries {team, exec, client}, riskEntries, followUpInvites, ticketDrafts.',
};

const SYSTEM = `
You revise a structured payload according to a natural-language instruction from a project manager.

Hard rules:
- Return ONLY the revised JSON object, no prose, no code fences, no commentary.
- Preserve the exact same top-level schema as the input. Do not add, rename, or remove fields.
- Apply only what the instruction asks. Leave everything else byte-for-byte identical.
- If the instruction is ambiguous, make the smallest plausible change and proceed; do not ask questions.
- Never invent specifics (names, numbers, dates, ticket IDs) the instruction didn't supply or that aren't already in the payload.
`.trim();

export async function revisePayload(
  agent: AgentName | 'final-brief' | 'final-meeting' | undefined,
  payload: unknown,
  instruction: string,
): Promise<unknown> {
  const c = client();
  const description = (agent && AGENT_DESCRIPTIONS[agent]) ?? 'A structured payload.';

  const response = await c.messages.create({
    model: MODELS.doer,
    max_tokens: 4096,
    system: cachedSystem(SYSTEM),
    messages: [
      {
        role: 'user',
        content: `Payload schema description:
${description}

Current payload:
${JSON.stringify(payload, null, 2)}

PM revision instruction:
"""
${instruction}
"""

Return the revised payload as a single JSON object.`,
      },
    ],
  });

  const text = response.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
    .trim();

  // Strip code fences if the model added any despite instructions.
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`Revision response was not JSON. Got: ${text.slice(0, 240)}`);
  }
  return JSON.parse(candidate.slice(start, end + 1));
}
