import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { compile } from '@manifesto-ai/compiler';
import { createClockStamp } from '@/lib/taskflow-clock';
import { TASK_FIXTURES } from '@/lib/taskflow-fixtures';
import { savePersistedLineageState, type StorageLike } from '@/lib/taskflow-runtime-persistence';
import type { TaskFlowAssistantUIMessage } from '@/types/taskflow-assistant';

vi.mock('@/domain/taskflow.schema', async () => {
  const source = await readFile(
    new URL('../domain/taskflow.mel', import.meta.url),
    'utf8',
  );
  const result = compile(source, { mode: 'domain' });

  if (!result.success || !result.schema) {
    throw new Error('Failed to compile taskflow.mel for controller test.');
  }

  return {
    default: result.schema,
    taskflowSchema: result.schema,
  };
});

function createMemoryStorage(): StorageLike {
  const entries = new Map<string, string>();

  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
    removeItem: (key) => {
      entries.delete(key);
    },
  };
}

describe('taskflow runtime controller', () => {
  it('executes assistant CRUD tools against the client-owned runtime', async () => {
    const { createTaskFlowRuntimeController } = await import('@/lib/taskflow-runtime-controller');
    const clockFactory = () => createClockStamp(new Date('2026-04-10T09:00:00.000Z'));
    const controller = createTaskFlowRuntimeController({
      storage: createMemoryStorage(),
      clockFactory,
    });

    await controller.start();
    const historyCountBeforeCreate = controller.getSnapshot().state?.historyEntries.length ?? 0;

    const createResult = await controller.executeAgentTool('create_task', {
      title: 'Assistant task',
      description: 'Created from the multi-step tool loop.',
      priority: 'high',
      status: 'todo',
      tags: ['assistant'],
    });

    expect(createResult.state).toBe('output-available');
    if (createResult.state !== 'output-available' || !createResult.output.taskId) {
      throw new Error('Expected task creation to succeed.');
    }
    expect(createResult.output.snapshotDiff?.length).toBeGreaterThan(0);

    const taskId = createResult.output.taskId;
    const historyCountAfterCreate = controller.getSnapshot().state?.historyEntries.length ?? 0;

    const updateResult = await controller.executeAgentTool('update_task', {
      taskId,
      title: 'Assistant task updated',
      status: 'in-progress',
      assignee: 'Codex',
    });
    const moveResult = await controller.executeAgentTool('move_task', {
      taskId,
      newStatus: 'review',
    });
    const selectResult = await controller.executeAgentTool('select_task', {
      taskId,
    });
    const searchResult = await controller.executeAgentTool('search_lineage', {
      actionNames: ['selectTask'],
      limit: 3,
    });
    const deleteResult = await controller.executeAgentTool('delete_task', {
      taskId,
    });
    const restoreResult = await controller.executeAgentTool('restore_task', {
      taskId,
    });

    expect(updateResult.state).toBe('output-available');
    expect(moveResult.state).toBe('output-available');
    expect(selectResult.state).toBe('output-available');
    expect(searchResult.state).toBe('output-available');
    expect(deleteResult.state).toBe('output-available');
    expect(restoreResult.state).toBe('output-available');
    expect(historyCountAfterCreate - historyCountBeforeCreate).toBe(1);
    if (moveResult.state === 'output-available') {
      expect(moveResult.output.snapshotDiff).toContain('status: in-progress -> review');
    }
    if (selectResult.state === 'output-available') {
      expect(selectResult.output.snapshotDiff).toContain(`selected task: none -> ${taskId}`);
    }
    if (searchResult.state === 'output-available') {
      expect(searchResult.output.matches?.some((match) => match.actionName === 'selectTask')).toBe(true);
    }

    const state = controller.getSnapshot().state;
    const agentContext = controller.buildAgentContext();
    expect(state?.activeTasks.some((task) => task.id === taskId)).toBe(true);
    expect(state?.deletedTasks.some((task) => task.id === taskId)).toBe(false);
    expect(state?.selectedTaskId).toBe(taskId);
    expect(state?.historyEntries.some((entry) => entry.summary.includes('Restored'))).toBe(true);
    expect(state?.clock?.now).toBe(clockFactory().now);
    expect(agentContext.snapshot.data).toHaveProperty('tasks');
    expect(agentContext.snapshot.data).toHaveProperty('clock');
    expect(agentContext.causalGraph.nodes.length).toBeGreaterThan(0);
    expect(agentContext.causalGraph.visibleWorldId).toBeTruthy();

    controller.dispose();
  });

  it('returns blocker errors for missing task ids and preserves persisted chat', async () => {
    const { createTaskFlowRuntimeController } = await import('@/lib/taskflow-runtime-controller');
    const storage = createMemoryStorage();
    const controller = createTaskFlowRuntimeController({
      storage,
      clockFactory: () => createClockStamp(new Date('2026-04-10T09:00:00.000Z')),
    });

    await controller.start();

    const invalidMove = await controller.executeAgentTool('move_task', {
      taskId: 'missing-task',
      newStatus: 'done',
    });

    expect(invalidMove).toEqual({
      state: 'output-error',
      errorText: 'The requested task could not be found in the current TaskFlow context.',
    });

    const messages: TaskFlowAssistantUIMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'I can work from the restored chat thread.',
          },
        ],
      },
    ];

    controller.saveAssistantMessages(messages);
    controller.dispose();

    const restoredController = createTaskFlowRuntimeController({ storage });
    expect(restoredController.loadAssistantMessages()).toEqual(messages);

    restoredController.dispose();
  });

  it('captures semantic hover state and exposes hover tools without creating lineage noise', async () => {
    vi.useFakeTimers();

    try {
      const { createTaskFlowRuntimeController } = await import('@/lib/taskflow-runtime-controller');
      const controller = createTaskFlowRuntimeController({
        storage: createMemoryStorage(),
        clockFactory: () => createClockStamp(new Date('2026-04-10T09:00:00.000Z')),
      });

      await controller.start();
      const taskId = controller.getSnapshot().state?.activeTasks[0]?.id;

      if (!taskId) {
        throw new Error('Expected a seeded task to exist.');
      }

      const historyCountBeforeHover = controller.getSnapshot().state?.historyEntries.length ?? 0;
      controller.scheduleHoveredTarget({
        kind: 'task-card',
        taskId,
        label: 'Hovered task',
        capturedAt: Date.now(),
        availableActions: ['inspect_hovered_target', 'activate_hovered_target'],
      });

      expect(controller.getSnapshot().state?.hoveredTarget).toBeNull();

      vi.advanceTimersByTime(150);

      expect(controller.getSnapshot().state?.hoveredTarget).toMatchObject({
        kind: 'task-card',
        taskId,
      });
      expect(controller.buildAgentContext().hoveredTarget).toMatchObject({
        kind: 'task-card',
        taskId,
      });
      expect(controller.getSnapshot().state?.historyEntries.length).toBe(historyCountBeforeHover);

      const inspectTask = await controller.executeAgentTool('inspect_hovered_target', {});
      expect(inspectTask.state).toBe('output-available');
      if (inspectTask.state === 'output-available') {
        expect(inspectTask.output.inspection?.metadata.some((item) => item.label === 'Task ID')).toBe(true);
      }

      const activateTask = await controller.executeAgentTool('activate_hovered_target', {});
      expect(activateTask.state).toBe('output-available');
      expect(controller.getSnapshot().state?.selectedTaskId).toBe(taskId);

      controller.setHoveredTarget({
        kind: 'header-action',
        actionId: 'history',
        label: 'Lineage history',
        capturedAt: Date.now(),
        availableActions: ['inspect_hovered_target', 'activate_hovered_target'],
      });

      const activateHistory = await controller.executeAgentTool('activate_hovered_target', {});
      expect(activateHistory.state).toBe('output-available');
      expect(controller.getSnapshot().state?.historyOpen).toBe(true);

      controller.setHoveredTarget({
        kind: 'lineage-entry',
        worldId: 'world-test',
        branchName: 'main',
        actionName: 'selectTask',
        summary: 'Selected a task',
        label: 'Selected a task',
        capturedAt: Date.now(),
        availableActions: ['inspect_hovered_target', 'search_lineage'],
      });

      const activateLineage = await controller.executeAgentTool('activate_hovered_target', {});
      expect(activateLineage).toEqual({
        state: 'output-error',
        errorText:
          'Hovered lineage entries are read-only. I can inspect or search related history, but I cannot open or restore them directly.',
      });

      controller.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns the same controller snapshot reference until state changes', async () => {
    const { createTaskFlowRuntimeController } = await import('@/lib/taskflow-runtime-controller');
    const controller = createTaskFlowRuntimeController({
      storage: createMemoryStorage(),
      clockFactory: () => createClockStamp(new Date('2026-04-10T09:00:00.000Z')),
    });

    const firstSnapshot = controller.getSnapshot();
    const secondSnapshot = controller.getSnapshot();

    expect(secondSnapshot).toBe(firstSnapshot);

    await controller.start();

    const readySnapshot = controller.getSnapshot();
    const readySnapshotAgain = controller.getSnapshot();

    expect(readySnapshotAgain).toBe(readySnapshot);

    controller.dispose();
  });

  it('drops persisted lineage history when the schema hash changes', async () => {
    const { createTaskFlowRuntimeController } = await import('@/lib/taskflow-runtime-controller');
    const storage = createMemoryStorage();

    savePersistedLineageState(storage, {
      schemaVersion: 2,
      schemaHash: 'outdated-schema-hash',
      runtimeStore: '{"invalid":true}',
      historyMetadata: [
        [
          'world-old',
          {
            actionName: 'createTask',
            summary: 'Old persisted world',
            kind: 'mutation',
          },
        ],
      ],
    });

    const controller = createTaskFlowRuntimeController({
      storage,
      clockFactory: () => createClockStamp(new Date('2026-04-10T09:00:00.000Z')),
    });

    await controller.start();

    const state = controller.getSnapshot().state;
    expect(state?.historyEntries.some((entry) => entry.summary === 'Old persisted world')).toBe(false);
    expect(state?.activeTasks.length).toBeGreaterThan(0);

    controller.dispose();
  });

  it('resets the local session back to a fresh seeded runtime', async () => {
    const { createTaskFlowRuntimeController } = await import('@/lib/taskflow-runtime-controller');
    const storage = createMemoryStorage();
    const controller = createTaskFlowRuntimeController({
      storage,
      clockFactory: () => createClockStamp(new Date('2026-04-10T09:00:00.000Z')),
    });

    await controller.start();

    await controller.executeAgentTool('create_task', {
      title: 'Temporary task',
      status: 'todo',
    });

    controller.saveAssistantMessages([
      {
        id: 'assistant-reset-me',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'This message should be cleared by reset.',
          },
        ],
      },
    ]);
    controller.setHistoryOpen(true);
    controller.setCreateDialogOpen(true);
    controller.setDatePickerOpen(true);
    controller.setHoveredTarget({
      kind: 'header-action',
      actionId: 'history',
      label: 'Lineage history',
      capturedAt: Date.now(),
      availableActions: ['inspect_hovered_target', 'activate_hovered_target'],
    });

    const stateBeforeReset = controller.getSnapshot().state;
    expect(stateBeforeReset?.activeTasks.some((task) => task.title === 'Temporary task')).toBe(true);

    await controller.resetSession();

    const state = controller.getSnapshot().state;
    expect(state?.activeTasks.length).toBe(TASK_FIXTURES.filter((task) => task.deletedAt === null).length);
    expect(state?.activeTasks.some((task) => task.title === 'Temporary task')).toBe(false);
    expect(state?.hoveredTarget).toBeNull();
    expect(state?.historyOpen).toBe(false);
    expect(state?.createDialogOpen).toBe(false);
    expect(state?.datePickerOpen).toBe(false);
    expect(controller.loadAssistantMessages()).toEqual([]);

    controller.dispose();
  });
});
