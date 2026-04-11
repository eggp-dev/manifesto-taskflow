import { describe, expect, it, vi } from 'vitest';
import {
  TaskFlowToolGateway,
  type TaskFlowToolGatewayContext,
} from '@/lib/taskflow-tool-gateway';
import type { TaskFlowAgentContext, TaskFlowAgentToolResult } from '@/types/taskflow-assistant';

function createAgentContext(): TaskFlowAgentContext {
  return {
    snapshot: {
      data: {
        selectedTaskId: null,
      },
      computed: {},
      system: {},
    },
    branchName: 'main',
    visibleWorldId: 'world-1',
    selectedTaskId: null,
    selectedTask: null,
    hoveredTarget: null,
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
    causalGraph: {
      activeBranchId: 'branch-main',
      activeBranchName: 'main',
      visibleWorldId: 'world-1',
      headWorldIds: [],
      nodes: [],
      edges: [],
    },
  };
}

describe('taskflow tool gateway', () => {
  it('keeps delete confirmation in the WebMCP layer only', async () => {
    const executeAgentTool: TaskFlowToolGatewayContext['executeAgentTool'] = vi.fn(
      async () =>
        ({
          state: 'output-available',
          output: {
            ok: true,
            summary: 'Deleted "Task 1".',
            taskId: 'task-1',
            title: 'Task 1',
          },
        }) satisfies TaskFlowAgentToolResult,
    );

    const gateway = new TaskFlowToolGateway({
      getAgentContext: createAgentContext,
      getWebMcpUiState: () => ({
        historyOpen: false,
        createDialogOpen: false,
        datePickerOpen: false,
      }),
      getWebMcpContextVersion: () => 4,
      executeAgentTool,
      findTaskTitle: (taskId) => (taskId === 'task-1' ? 'Task 1' : null),
    });

    const assistantResult = await gateway.executeAssistantTool('delete_task', {
      taskId: 'task-1',
    });

    expect(assistantResult.state).toBe('output-available');
    expect(executeAgentTool).toHaveBeenCalledTimes(1);

    const webMcpPending = await gateway.executeWebMcpTool('delete_task', {
      taskId: 'task-1',
    });

    expect(webMcpPending).toEqual({
      state: 'requires_confirmation',
      summary: 'Delete "Task 1"? Call delete_task again with confirmed=true to proceed.',
      confirmation: {
        toolName: 'delete_task',
        input: {
          taskId: 'task-1',
          confirmed: true,
        },
      },
    });
    expect(executeAgentTool).toHaveBeenCalledTimes(1);

    const webMcpConfirmed = await gateway.executeWebMcpTool('delete_task', {
      taskId: 'task-1',
      confirmed: true,
    });

    expect(webMcpConfirmed.state).toBe('success');
    expect(executeAgentTool).toHaveBeenCalledTimes(2);
  });

  it('builds the host-facing context snapshot without mutating agent state', () => {
    const executeAgentTool = vi.fn(async () => ({
      state: 'output-error',
      errorText: 'unused',
    } satisfies TaskFlowAgentToolResult));

    const gateway = new TaskFlowToolGateway({
      getAgentContext: createAgentContext,
      getWebMcpUiState: () => ({
        historyOpen: true,
        createDialogOpen: false,
        datePickerOpen: true,
      }),
      getWebMcpContextVersion: () => 7,
      executeAgentTool,
      findTaskTitle: () => null,
    });

    expect(gateway.buildWebMcpContext()).toEqual({
      ...createAgentContext(),
      contextVersion: 7,
      uiState: {
        historyOpen: true,
        createDialogOpen: false,
        datePickerOpen: true,
      },
    });
    expect(gateway.buildWebMcpNotification()).toEqual({
      contextVersion: 7,
      branchName: 'main',
      visibleWorldId: 'world-1',
      selectedTaskId: null,
      hoveredTarget: null,
      counts: {
        active: 3,
        deleted: 1,
        todo: 1,
        inProgress: 1,
        review: 1,
        done: 0,
      },
      uiState: {
        historyOpen: true,
        createDialogOpen: false,
        datePickerOpen: true,
      },
    });
  });
});
