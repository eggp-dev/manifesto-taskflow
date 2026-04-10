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

function summarizeHoveredTarget(context: TaskFlowAgentContext): string {
  const hoveredTarget = context.hoveredTarget;

  if (!hoveredTarget) {
    return 'none';
  }

  switch (hoveredTarget.kind) {
    case 'task-card':
      return `task-card "${hoveredTarget.label}" (taskId: ${hoveredTarget.taskId})`;
    case 'header-action':
      return `header-action "${hoveredTarget.label}" (actionId: ${hoveredTarget.actionId})`;
    case 'lineage-entry':
      return `lineage-entry "${hoveredTarget.label}" (worldId: ${hoveredTarget.worldId}, branch: ${hoveredTarget.branchName}, action: ${hoveredTarget.actionName})`;
  }
}

export async function buildTaskFlowAssistantSystemPrompt(
  context: TaskFlowAgentContext,
  melSource?: string,
): Promise<string> {
  const source = melSource ?? (await loadTaskFlowMelSource());
  const hoveredTargetSummary = summarizeHoveredTarget(context);

  return [
    'Operate this TaskFlow runtime using the provided tools only.',
    'Choose the tool that best matches the user request. Do not call tools that are unrelated to the request.',
    'Use search_lineage when the user asks about prior changes, history, lineage, or what happened before.',
    'If hoveredTarget is present and the user refers to "this", "that", "이거", "그거", "이건", or "이 버튼", resolve that reference to hoveredTarget first.',
    'When hoveredTarget is present and compatible with the request, do not ask the user which item they mean.',
    'Prefer inspect_hovered_target or activate_hovered_target for hoveredTarget requests before asking clarifying questions.',
    'Do not invent ids or state. If the request is ambiguous, ask one short question.',
    '',
    `Hovered target summary: ${hoveredTargetSummary}`,
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
    'Current hovered target:',
    '```json',
    JSON.stringify(context.hoveredTarget, null, 2),
    '```',
    '',
    'Current causal graph:',
    '```json',
    JSON.stringify(context.causalGraph, null, 2),
    '```',
  ].join('\n');
}
