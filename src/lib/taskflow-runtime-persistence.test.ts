import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { compile } from '@manifesto-ai/compiler';
import { createInMemoryLineageStore, withLineage } from '@manifesto-ai/lineage';
import { createLineageService } from '@manifesto-ai/lineage/provider';
import { createManifesto } from '@manifesto-ai/sdk';
import { createClockStamp } from '@/lib/taskflow-clock';
import {
  deserializeLineageStoreState,
  loadPersistedAssistantMessages,
  loadPersistedLineageState,
  savePersistedAssistantMessages,
  savePersistedLineageState,
  serializeLineageStoreState,
  type StorageLike,
} from '@/lib/taskflow-runtime-persistence';
import type { Task } from '@/types/taskflow';
import type { TaskFlowAssistantUIMessage } from '@/types/taskflow-assistant';
import type { TaskFlowRuntimeDomain } from '@/types/taskflow-runtime';

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

async function createRuntime() {
  const store = createInMemoryLineageStore();
  const service = createLineageService(store);
  const runtime = withLineage(
    createManifesto<TaskFlowRuntimeDomain>(await compileSchema(), {}),
    { service },
  ).activate();

  await runtime.getActiveBranch();

  return { runtime, service, store };
}

async function compileSchema() {
  const source = await readFile(
    new URL('../domain/taskflow.mel', import.meta.url),
    'utf8',
  );
  const result = compile(source, { mode: 'domain' });

  if (!result.success || !result.schema) {
    throw new Error('Failed to compile taskflow.mel for persistence test.');
  }

  return result.schema;
}

describe('taskflow runtime persistence', () => {
  it('serializes and restores lineage store state', async () => {
    const { runtime, service, store } = await createRuntime();
    const createStamp = createClockStamp(new Date('2026-04-10T00:00:00.000Z'));
    const moveStamp = createClockStamp(new Date('2026-04-10T02:00:00.000Z'));

    const task: Task = {
      id: 'persist-task-1',
      title: 'Persist lineage',
      description: 'Verify branch, attempts, and snapshot survive reload.',
      status: 'todo',
      priority: 'medium',
      assignee: null,
      dueDate: null,
      dueDateTimestamp: 0,
      tags: ['persistence'],
      createdAt: '2026-04-10T00:00:00.000Z',
      updatedAt: '2026-04-10T00:00:00.000Z',
      deletedAt: null,
    };

    await runtime.commitAsync(
      runtime.createIntent(runtime.MEL.actions.createTask, task, createStamp),
    );
    await runtime.commitAsync(
      runtime.createIntent(runtime.MEL.actions.moveTask, task.id, 'done', moveStamp),
    );

    const branch = await runtime.getActiveBranch();
    const heads = await runtime.getHeads();
    const attempts = await service.getAttemptsByBranch(branch.id);
    const snapshot = runtime.getSnapshot();

    const restoredStore = createInMemoryLineageStore();
    restoredStore.restoreState(
      deserializeLineageStoreState(serializeLineageStoreState(store.snapshotState())),
    );

    const restoredService = createLineageService(restoredStore);
    const restoredRuntime = withLineage(
      createManifesto<TaskFlowRuntimeDomain>(await compileSchema(), {}),
      { service: restoredService },
    ).activate();

    const restoredBranch = await restoredRuntime.getActiveBranch();
    const restoredHeads = await restoredRuntime.getHeads();
    const restoredAttempts = await restoredService.getAttemptsByBranch(restoredBranch.id);
    const restoredSnapshot = restoredRuntime.getSnapshot();

    expect(restoredBranch.id).toBe(branch.id);
    expect(restoredBranch.head).toBe(branch.head);
    expect(restoredHeads).toEqual(heads);
    expect(restoredAttempts.map((attempt) => attempt.worldId)).toEqual(
      attempts.map((attempt) => attempt.worldId),
    );
    expect(restoredSnapshot.data.tasks).toEqual(snapshot.data.tasks);
    expect(restoredSnapshot.data.clock).toEqual(snapshot.data.clock);
    expect(restoredSnapshot.computed.doneCount).toBe(1);

    runtime.dispose();
    restoredRuntime.dispose();
  });

  it('persists lineage metadata and assistant chat records', () => {
    const storage = createMemoryStorage();
    const messages: TaskFlowAssistantUIMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Ready to manage tasks.',
          },
        ],
      },
    ];

    savePersistedLineageState(storage, {
      schemaVersion: 2,
      schemaHash: 'schema-hash-1',
      runtimeStore: '{"heads":[]}',
      historyMetadata: [
        [
          'world-1',
          {
            actionName: 'createTask',
            summary: 'Created "Persist lineage"',
            kind: 'mutation',
          },
        ],
      ],
    });
    savePersistedAssistantMessages(storage, messages);

    expect(loadPersistedLineageState(storage)).toEqual({
      schemaVersion: 2,
      schemaHash: 'schema-hash-1',
      runtimeStore: '{"heads":[]}',
      historyMetadata: [
        [
          'world-1',
          {
            actionName: 'createTask',
            summary: 'Created "Persist lineage"',
            kind: 'mutation',
          },
        ],
      ],
    });
    expect(loadPersistedAssistantMessages(storage)).toEqual(messages);
  });
});
