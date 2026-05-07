/**
 * Boilerplate for running a doer or reviewer agent against Claude with
 * streaming + tool use.
 *
 * Each agent supplies:
 *   - name, role, displayName
 *   - system prompt
 *   - user prompt
 *   - tools (the integration fetch tools + the structured-output submit tool)
 *   - onSubmit(submission) → returns AgentOutput
 *
 * runAgent emits the full event sequence (start, tool, tool-result, token,
 * done) on the run's event bus so the trace panel can render every step.
 */

import type Anthropic from '@anthropic-ai/sdk';
import { client, MODELS, cachedSystem } from './anthropic';
import { emit, type Run } from '../shared/trace';
import type { AgentName, AgentOutput, AgentRole } from '../shared/types';
import { getAdapter } from '../shared/integrations/registry';

export interface RunAgentArgs {
  run: Run;
  agent: AgentName;
  role: AgentRole;
  model?: string;
  system: string;
  user: string;
  /** Tools the agent can call. Use `dataFetchTools()` for integration access. */
  tools: Anthropic.Messages.Tool[];
  /** Called when the agent calls the `submit` tool with its final output. */
  onSubmit: (submission: { output: unknown; confidence: number; notes?: string }) => AgentOutput;
  /** Optional: integration adapter id to route fetch tools through. Defaults to "synthetic". */
  adapterId?: 'synthetic' | 'google' | 'microsoft' | 'jira' | 'linear' | 'slack' | 'notion';
  /** Soft cap to prevent runaway loops. */
  maxSteps?: number;
}

export const SUBMIT_TOOL: Anthropic.Messages.Tool = {
  name: 'submit',
  description:
    'Submit your final output. Call this exactly once when done. The structure must match the agent-specific schema described in your system prompt.',
  input_schema: {
    type: 'object',
    properties: {
      output: { type: 'object' },
      confidence: { type: 'number' },
      notes: { type: 'string' },
    },
    required: ['output', 'confidence'],
  },
};

/** Standard fetch tools backed by the integration adapter registry. */
export function dataFetchTools(): Anthropic.Messages.Tool[] {
  return [
    {
      name: 'fetch_sprint_board',
      description: 'Read the current sprint board: items, statuses, assignees, story points.',
      input_schema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'fetch_calendar',
      description: 'Read calendar events in a date range.',
      input_schema: {
        type: 'object',
        properties: {
          rangeStart: { type: 'string' },
          rangeEnd: { type: 'string' },
        },
        required: ['rangeStart', 'rangeEnd'],
      },
    },
    {
      name: 'fetch_threads',
      description: 'Read recent Slack/Teams channel messages relevant to the project.',
      input_schema: {
        type: 'object',
        properties: { since: { type: 'string' } },
        required: ['since'],
      },
    },
    {
      name: 'fetch_mail',
      description: 'Read recent project-relevant mail.',
      input_schema: {
        type: 'object',
        properties: { since: { type: 'string' } },
        required: ['since'],
      },
    },
    {
      name: 'fetch_docs',
      description: 'Search relevant project docs (milestone plans, decision logs).',
      input_schema: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
  ];
}

export async function runAgent(args: RunAgentArgs): Promise<AgentOutput> {
  const { run, agent, role, system, user, onSubmit } = args;
  const model = args.model ?? (role === 'reviewer' ? MODELS.reviewer : MODELS.doer);
  const tools: Anthropic.Messages.Tool[] = [...args.tools, SUBMIT_TOOL];
  const adapter = getAdapter(args.adapterId ?? 'synthetic');
  const maxSteps = args.maxSteps ?? 8;

  emit(run, { type: 'agent:start', runId: run.runId, agent, ts: Date.now() });

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: 'user', content: user },
  ];

  let submission: AgentOutput | null = null;
  const c = client();

  for (let step = 0; step < maxSteps; step++) {
    let assistantText = '';
    const toolUses: Anthropic.Messages.ToolUseBlock[] = [];

    const stream = c.messages.stream({
      model,
      max_tokens: 2048,
      system: cachedSystem(system),
      tools,
      messages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const text = event.delta.text;
        assistantText += text;
        emit(run, { type: 'agent:token', runId: run.runId, agent, delta: text, ts: Date.now() });
      }
    }

    const finalMessage = await stream.finalMessage();

    for (const block of finalMessage.content) {
      if (block.type === 'tool_use') toolUses.push(block);
    }

    messages.push({ role: 'assistant', content: finalMessage.content });

    if (finalMessage.stop_reason === 'end_turn' && toolUses.length === 0) {
      // Agent stopped without submitting. Treat assistant text as a JSON fallback.
      try {
        submission = onSubmit({ output: assistantText, confidence: 0.5 });
      } catch (err) {
        emit(run, {
          type: 'agent:error',
          runId: run.runId,
          agent,
          message: `Agent stopped without calling submit; fallback parse failed: ${(err as Error).message}`,
          ts: Date.now(),
        });
      }
      break;
    }

    // Emit agent:tool events synchronously for the trace, then run all
    // tool executions in parallel. Synthetic adapter is in-process and fast,
    // but real adapters (Graph / Google Calendar) make network calls — the
    // parallelism matters for them, and the trace reads more honestly when
    // multiple fetches actually happen concurrently.
    for (const toolUse of toolUses) {
      emit(run, {
        type: 'agent:tool',
        runId: run.runId,
        agent,
        tool: toolUse.name,
        input: toolUse.input,
        ts: Date.now(),
      });
    }

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = await Promise.all(
      toolUses.map(async (toolUse) => {
        let resultText = '';
        try {
          if (toolUse.name === 'submit') {
            const sub = toolUse.input as { output: unknown; confidence: number; notes?: string };
            submission = onSubmit(sub);
            resultText = 'submitted';
          } else if (toolUse.name === 'fetch_sprint_board') {
            const board = await adapter.fetch('sprint-board', {});
            resultText = JSON.stringify(board);
          } else if (toolUse.name === 'fetch_calendar') {
            const input = toolUse.input as { rangeStart: string; rangeEnd: string };
            const cal = await adapter.fetch('calendar', input);
            resultText = JSON.stringify(cal);
          } else if (toolUse.name === 'fetch_threads') {
            const input = toolUse.input as { since: string };
            const threads = await adapter.fetch('threads', input);
            resultText = JSON.stringify(threads);
          } else if (toolUse.name === 'fetch_mail') {
            const input = toolUse.input as { since: string };
            const mail = await adapter.fetch('mail', input);
            resultText = JSON.stringify(mail);
          } else if (toolUse.name === 'fetch_docs') {
            const input = toolUse.input as { query: string };
            const docs = await adapter.fetch('docs', input);
            resultText = JSON.stringify(docs);
          } else {
            resultText = `Unknown tool: ${toolUse.name}`;
          }
        } catch (err) {
          resultText = `Tool error: ${(err as Error).message}`;
        }

        emit(run, {
          type: 'agent:tool-result',
          runId: run.runId,
          agent,
          tool: toolUse.name,
          output: resultText.length > 1200 ? `${resultText.slice(0, 1200)}…` : resultText,
          ts: Date.now(),
        });

        return {
          type: 'tool_result' as const,
          tool_use_id: toolUse.id,
          content: resultText,
        };
      }),
    );

    messages.push({ role: 'user', content: toolResults });

    if (submission) break;
  }

  if (!submission) {
    const err = `Agent ${agent} did not submit within ${maxSteps} steps.`;
    emit(run, { type: 'agent:error', runId: run.runId, agent, message: err, ts: Date.now() });
    throw new Error(err);
  }

  emit(run, { type: 'agent:done', runId: run.runId, agent, output: submission, ts: Date.now() });
  return submission;
}
