import { describe, expect, it } from 'vitest';
import {
  dropToolCallById,
  dropUnresolvedToolCalls,
} from '@/lib/taskflow-assistant-tool-resolution';
import type { TaskFlowAssistantUIMessage } from '@/types/taskflow-assistant';

describe('taskflow assistant tool resolution', () => {
  it('drops unresolved tool calls from assistant history', () => {
    const messages: TaskFlowAssistantUIMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'I am preparing a delete step.',
          },
          {
            type: 'tool-delete_task',
            toolCallId: 'call-delete',
            state: 'input-available',
            input: {
              taskId: 'task-7',
            },
          },
        ],
      },
    ];

    expect(dropUnresolvedToolCalls(messages)).toEqual([
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'I am preparing a delete step.',
          },
        ],
      },
    ]);
  });

  it('drops assistant messages that only contained unresolved tool parts', () => {
    const messages: TaskFlowAssistantUIMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-update_task',
            toolCallId: 'call-update',
            state: 'input-available',
            input: {
              taskId: 'task-2',
              title: 'Rename task',
            },
          },
        ],
      },
      {
        id: 'user-1',
        role: 'user',
        parts: [
          {
            type: 'text',
            text: 'next',
          },
        ],
      },
    ];

    expect(dropUnresolvedToolCalls(messages)).toEqual([
      {
        id: 'user-1',
        role: 'user',
        parts: [
          {
            type: 'text',
            text: 'next',
          },
        ],
      },
    ]);
  });

  it('drops a specific tool call by id when the user cancels it', () => {
    const messages: TaskFlowAssistantUIMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Delete this task?',
          },
          {
            type: 'tool-delete_task',
            toolCallId: 'call-delete',
            state: 'input-available',
            input: {
              taskId: 'task-7',
            },
          },
        ],
      },
    ];

    expect(dropToolCallById(messages, 'call-delete')).toEqual([
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Delete this task?',
          },
        ],
      },
    ]);
  });
});
