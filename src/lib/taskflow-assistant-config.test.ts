import { describe, expect, it } from 'vitest';
import { getTaskFlowAssistantAvailability } from '@/lib/taskflow-assistant-config';
import { buildTaskFlowAssistantSystemPrompt } from '@/lib/taskflow-assistant-prompt';
import type { TaskFlowAgentContext } from '@/types/taskflow-assistant';

const baseContext: TaskFlowAgentContext = {
  branchName: 'main',
  visibleWorldId: 'world-1',
  selectedTaskId: 'task-1',
  selectedTask: {
    id: 'task-1',
    title: 'Wire assistant',
    description: 'Connect the client runtime to the assistant route.',
    status: 'in-progress',
    priority: 'high',
    assignee: 'SDK Team',
    dueDate: null,
    tags: ['assistant'],
    deletedAt: null,
  },
  hoveredTarget: {
    kind: 'task-card',
    taskId: 'task-1',
    label: 'Wire assistant',
    capturedAt: 1,
    availableActions: ['inspect_hovered_target', 'activate_hovered_target'],
  },
  snapshot: {
    data: {
      tasks: [
        {
          id: 'task-1',
          title: 'Wire assistant',
        },
      ],
      selectedTaskId: 'task-1',
    },
    computed: {
      selectedTask: {
        id: 'task-1',
        title: 'Wire assistant',
      },
    },
    system: null,
  },
  causalGraph: {
    activeBranchId: 'branch-main',
    activeBranchName: 'main',
    visibleWorldId: 'world-1',
    headWorldIds: ['world-1'],
    nodes: [
      {
        worldId: 'world-1',
        attemptId: 'attempt-1',
        branchId: 'branch-main',
        branchName: 'main',
        parentWorldId: null,
        baseWorldId: null,
        actionName: 'createTask',
        summary: 'Created "Wire assistant"',
        kind: 'mutation',
        createdAt: 1,
        isHead: true,
        isVisible: true,
      },
    ],
    edges: [],
  },
  counts: {
    active: 3,
    deleted: 1,
    todo: 1,
    inProgress: 1,
    review: 1,
    done: 0,
  },
  activeTasks: [],
  deletedTasks: [],
  recentHistory: [],
};

describe('taskflow assistant availability', () => {
  it('reports a disabled message when api key or model is missing', () => {
    expect(getTaskFlowAssistantAvailability({})).toEqual({
      configured: false,
      message: 'Assistant is disabled. Set OPENAI_API_KEY and OPENAI_MODEL to enable live task automation.',
    });
  });

  it('reports configured when both env vars are present', () => {
    expect(
      getTaskFlowAssistantAvailability({
        OPENAI_API_KEY: 'sk-test',
        OPENAI_MODEL: 'gpt-5-mini',
      }),
    ).toEqual({
      configured: true,
    });
  });
});

describe('taskflow assistant prompt', () => {
  it('embeds the mel source, snapshot, and causal graph in the system prompt', async () => {
    const prompt = await buildTaskFlowAssistantSystemPrompt(
      baseContext,
      'domain TaskFlow { action noop() {} }',
    );

    expect(prompt).toContain('Choose the tool that best matches the user request.');
    expect(prompt).toContain('Use task_brief_list when the user asks which tasks match');
    expect(prompt).toContain('resolve that reference to hoveredTarget first');
    expect(prompt).toContain('do not ask the user which item they mean');
    expect(prompt).toContain('TaskFlow');
    expect(prompt).toContain('domain TaskFlow');
    expect(prompt).toContain('"selectedTaskId": "task-1"');
    expect(prompt).toContain('Hovered target summary: task-card "Wire assistant"');
    expect(prompt).toContain('Current hovered target:');
    expect(prompt).toContain('"kind": "task-card"');
    expect(prompt).toContain('"visibleWorldId": "world-1"');
    expect(prompt).toContain('"actionName": "createTask"');
  });
});
