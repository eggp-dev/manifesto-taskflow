import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { TaskFlowAgentContext } from '@/types/taskflow-assistant';

let melSourcePromise: Promise<string> | null = null;

export async function loadTaskFlowMelSource(): Promise<string> {
  melSourcePromise ??= readFile(
    path.join(process.cwd(), 'src/domain/taskflow.mel'),
    'utf8',
  );

  return melSourcePromise;
}

export async function buildTaskFlowAssistantSystemPrompt(
  context: TaskFlowAgentContext,
  melSource?: string,
): Promise<string> {
  const source = melSource ?? (await loadTaskFlowMelSource());

  return [
    'Operate this TaskFlow runtime using the provided tools only.',
    'Choose the tool that best matches the user request. Do not call tools that are unrelated to the request.',
    'Use search_lineage when the user asks about prior changes, history, lineage, or what happened before.',
    'Do not invent ids or state. If the request is ambiguous, ask one short question.',
    '',
    'MEL source:',
    '```mel',
    source,
    '```',
    '',
    'Current snapshot:',
    '```json',
    JSON.stringify(context.snapshot, null, 2),
    '```',
    '',
    'Current causal graph:',
    '```json',
    JSON.stringify(context.causalGraph, null, 2),
    '```',
  ].join('\n');
}
