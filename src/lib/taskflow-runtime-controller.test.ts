import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { compile } from '@manifesto-ai/compiler';
import { createClockStamp } from '@/lib/taskflow-clock';
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
});
