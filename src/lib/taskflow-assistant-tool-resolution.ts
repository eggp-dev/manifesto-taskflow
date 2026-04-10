import type { TaskFlowAssistantUIMessage } from '@/types/taskflow-assistant';

type AssistantPart = TaskFlowAssistantUIMessage['parts'][number];

function isUnresolvedToolPart(part: AssistantPart): boolean {
  if (!('toolCallId' in part) || !part.type.startsWith('tool-')) {
    return false;
  }

  return !(
    part.state === 'output-available' ||
    part.state === 'output-error' ||
    part.state === 'output-denied' ||
    part.state === 'approval-responded'
  );
}

function hasMeaningfulPart(part: AssistantPart): boolean {
  return part.type !== 'step-start';
}

export function dropUnresolvedToolCalls(
  messages: TaskFlowAssistantUIMessage[],
): TaskFlowAssistantUIMessage[] {
  let changed = false;

  const nextMessages = messages.flatMap<TaskFlowAssistantUIMessage>((message) => {
    if (message.role !== 'assistant') {
      return [message];
    }

    const nextParts = message.parts.filter((part) => !isUnresolvedToolPart(part));

    if (nextParts.length !== message.parts.length) {
      changed = true;
    }

    if (!nextParts.some(hasMeaningfulPart)) {
      if (message.parts.length > 0) {
        changed = true;
      }

      return [];
    }

    return nextParts.length === message.parts.length
      ? [message]
      : [{ ...message, parts: nextParts }];
  });

  return changed ? nextMessages : messages;
}

export function dropToolCallById(
  messages: TaskFlowAssistantUIMessage[],
  toolCallId: string,
): TaskFlowAssistantUIMessage[] {
  let changed = false;

  const nextMessages = messages.flatMap<TaskFlowAssistantUIMessage>((message) => {
    if (message.role !== 'assistant') {
      return [message];
    }

    const nextParts = message.parts.filter((part) => {
      if ('toolCallId' in part && part.toolCallId === toolCallId) {
        changed = true;
        return false;
      }

      return true;
    });

    if (!nextParts.some(hasMeaningfulPart)) {
      if (message.parts.length > 0) {
        changed = true;
      }

      return [];
    }

    return nextParts.length === message.parts.length
      ? [message]
      : [{ ...message, parts: nextParts }];
  });

  return changed ? nextMessages : messages;
}
