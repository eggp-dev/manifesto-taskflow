import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { compile } from '@manifesto-ai/compiler';
import { createInMemoryLineageStore, withLineage } from '@manifesto-ai/lineage';
import { createLineageService } from '@manifesto-ai/lineage/provider';
import { createManifesto } from '@manifesto-ai/sdk';
import type { Task } from '@/types/taskflow';
import type { TaskFlowRuntimeDomain } from '@/types/taskflow-runtime';

async function createRuntime() {
  const source = await readFile(
    new URL('../domain/taskflow.mel', import.meta.url),
    'utf8',
  );
  const result = compile(source, { mode: 'domain' });

  if (!result.success || !result.schema) {
    throw new Error('Failed to compile taskflow.mel for lineage test.');
  }

  const store = createInMemoryLineageStore();
  const service = createLineageService(store);
  const runtime = withLineage(
    createManifesto<TaskFlowRuntimeDomain>(result.schema, {}),
    { service },
  ).activate();

  await runtime.getActiveBranch();

  return { runtime, service };
}

describe('taskflow lineage runtime', () => {
  it('commits task changes into lineage history', async () => {
    const { runtime, service } = await createRuntime();
    const task: Task = {
      id: 'lineage-task-1',
      title: 'Connect lineage',
      description: 'Verify commit history is available.',
      status: 'todo',
      priority: 'high',
      assignee: null,
      dueDate: null,
      tags: ['lineage'],
      createdAt: '2026-04-10T00:00:00.000Z',
      updatedAt: '2026-04-10T00:00:00.000Z',
      deletedAt: null,
    };

    await runtime.commitAsync(
      runtime.createIntent(runtime.MEL.actions.createTask, task),
    );
    await runtime.commitAsync(
      runtime.createIntent(runtime.MEL.actions.updateTask, {
        ...task,
        title: 'Connect lineage history',
        description: null,
        status: 'review',
        priority: 'medium',
        assignee: 'SDK Team',
        dueDate: '2026-04-11T12:00:00.000Z',
        tags: ['lineage', 'crud'],
        updatedAt: '2026-04-10T01:00:00.000Z',
      }),
    );
    await runtime.commitAsync(
      runtime.createIntent(runtime.MEL.actions.moveTask, task.id, 'done'),
    );

    const snapshot = runtime.getSnapshot();
    const branch = await runtime.getActiveBranch();
    const heads = await runtime.getHeads();
    const attempts = await service.getAttemptsByBranch(branch.id);

    expect(snapshot.data.tasks).toHaveLength(1);
    expect(snapshot.data.tasks[0]).toMatchObject({
      title: 'Connect lineage history',
      description: null,
      priority: 'medium',
      assignee: 'SDK Team',
      dueDate: '2026-04-11T12:00:00.000Z',
      tags: ['lineage', 'crud'],
    });
    expect(snapshot.computed.doneCount).toBe(1);
    expect(heads).toHaveLength(1);
    expect(heads[0]?.worldId).toBe(branch.head);
    expect(attempts.length).toBeGreaterThanOrEqual(4);

    runtime.dispose();
  });
});
