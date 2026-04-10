import { describe, expect, it } from 'vitest';
import { TASK_FIXTURES } from '@/lib/taskflow-fixtures';
import {
  createInitialTaskFlowShellBaseState,
  deriveTaskFlowShellState,
  taskFlowShellReducer,
} from '@/lib/taskflow-shell-state';

describe('taskflow shell state', () => {
  it('derives the initial shell snapshot from fixtures', () => {
    const state = deriveTaskFlowShellState(
      createInitialTaskFlowShellBaseState(TASK_FIXTURES),
    );

    expect(state.viewMode).toBe('kanban');
    expect(state.dateFilter).toBeNull();
    expect(state.assistantOpen).toBe(false);
    expect(state.selectedTask).toBeNull();
    expect(state.totalCount).toBe(4);
    expect(state.todoCount).toBe(1);
    expect(state.inProgressCount).toBe(1);
    expect(state.reviewCount).toBe(1);
    expect(state.doneCount).toBe(1);
    expect(state.deletedCount).toBe(1);
  });

  it('changes view modes locally', () => {
    const next = taskFlowShellReducer(
      createInitialTaskFlowShellBaseState(TASK_FIXTURES),
      { type: 'changeView', mode: 'table' },
    );

    expect(next.viewMode).toBe('table');
  });

  it('selects and deselects tasks', () => {
    const selected = taskFlowShellReducer(
      createInitialTaskFlowShellBaseState(TASK_FIXTURES),
      { type: 'selectTask', taskId: 'task-2' },
    );

    expect(deriveTaskFlowShellState(selected).selectedTask?.id).toBe('task-2');

    const deselected = taskFlowShellReducer(selected, {
      type: 'selectTask',
      taskId: null,
    });

    expect(deriveTaskFlowShellState(deselected).selectedTask).toBeNull();
  });

  it('moves tasks across statuses', () => {
    const moved = taskFlowShellReducer(
      createInitialTaskFlowShellBaseState(TASK_FIXTURES),
      {
        type: 'moveTask',
        taskId: 'task-1',
        newStatus: 'review',
        timestamp: '2026-04-10T10:00:00.000Z',
      },
    );
    const state = deriveTaskFlowShellState(moved);

    expect(state.tasks.find((task) => task.id === 'task-1')?.status).toBe('review');
    expect(state.tasks.find((task) => task.id === 'task-1')?.updatedAt).toBe(
      '2026-04-10T10:00:00.000Z',
    );
    expect(state.todoCount).toBe(0);
    expect(state.reviewCount).toBe(2);
  });

  it('soft deletes tasks and clears selection', () => {
    const selected = taskFlowShellReducer(
      createInitialTaskFlowShellBaseState(TASK_FIXTURES),
      { type: 'selectTask', taskId: 'task-2' },
    );
    const deleted = taskFlowShellReducer(selected, {
      type: 'softDeleteTask',
      id: 'task-2',
      timestamp: '2026-04-10T11:00:00.000Z',
    });
    const state = deriveTaskFlowShellState(deleted);

    expect(state.selectedTaskId).toBeNull();
    expect(state.totalCount).toBe(3);
    expect(state.deletedCount).toBe(2);
    expect(state.tasks.find((task) => task.id === 'task-2')?.deletedAt).toBe(
      '2026-04-10T11:00:00.000Z',
    );
  });

  it('restores deleted tasks', () => {
    const restored = taskFlowShellReducer(
      createInitialTaskFlowShellBaseState(TASK_FIXTURES),
      {
        type: 'restoreTask',
        id: 'task-5',
        timestamp: '2026-04-10T12:00:00.000Z',
      },
    );
    const state = deriveTaskFlowShellState(restored);

    expect(state.deletedCount).toBe(0);
    expect(state.totalCount).toBe(5);
    expect(state.tasks.find((task) => task.id === 'task-5')?.deletedAt).toBeNull();
    expect(state.tasks.find((task) => task.id === 'task-5')?.updatedAt).toBe(
      '2026-04-10T12:00:00.000Z',
    );
  });

  it('permanently deletes tasks from the shell state', () => {
    const deleted = taskFlowShellReducer(
      createInitialTaskFlowShellBaseState(TASK_FIXTURES),
      { type: 'permanentlyDeleteTask', id: 'task-5' },
    );
    const state = deriveTaskFlowShellState(deleted);

    expect(state.tasks.some((task) => task.id === 'task-5')).toBe(false);
    expect(state.deletedCount).toBe(0);
    expect(state.tasks).toHaveLength(4);
  });

  it('empties trash and clears deleted selection', () => {
    const selected = taskFlowShellReducer(
      createInitialTaskFlowShellBaseState(TASK_FIXTURES),
      { type: 'selectTask', taskId: 'task-5' },
    );
    const emptied = taskFlowShellReducer(selected, { type: 'emptyTrash' });
    const state = deriveTaskFlowShellState(emptied);

    expect(state.selectedTaskId).toBeNull();
    expect(state.deletedCount).toBe(0);
    expect(state.tasks).toHaveLength(4);
  });

  it('toggles the assistant shell open and closed', () => {
    const opened = taskFlowShellReducer(
      createInitialTaskFlowShellBaseState(TASK_FIXTURES),
      { type: 'toggleAssistant', open: true },
    );
    const closed = taskFlowShellReducer(opened, {
      type: 'toggleAssistant',
      open: false,
    });

    expect(opened.assistantOpen).toBe(true);
    expect(closed.assistantOpen).toBe(false);
  });
});
