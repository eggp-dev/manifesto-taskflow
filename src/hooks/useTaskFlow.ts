'use client';

import { useReducer } from 'react';
import { TASK_FIXTURES } from '@/lib/taskflow-fixtures';
import {
  createInitialTaskFlowShellBaseState,
  deriveTaskFlowShellState,
  taskFlowShellReducer,
} from '@/lib/taskflow-shell-state';
import type {
  TaskFlowShellState,
} from '@/lib/taskflow-shell-state';
import type { DateFilter, TaskStatus, ViewMode } from '@/types/taskflow';

export type TaskFlowActions = {
  selectTask: (taskId: string | null) => void;
  changeView: (mode: ViewMode) => void;
  setDateFilter: (filter: DateFilter | null) => void;
  moveTask: (taskId: string, newStatus: TaskStatus) => void;
  softDeleteTask: (id: string) => void;
  restoreTask: (id: string) => void;
  permanentlyDeleteTask: (id: string) => void;
  emptyTrash: () => void;
  toggleAssistant: (open: boolean) => void;
};

export type UseTaskFlowResult = {
  state: TaskFlowShellState;
  actions: TaskFlowActions;
};

export function useTaskFlow(): UseTaskFlowResult {
  const [baseState, dispatchAction] = useReducer(
    taskFlowShellReducer,
    TASK_FIXTURES,
    createInitialTaskFlowShellBaseState,
  );

  const actions: TaskFlowActions = {
    selectTask(taskId) {
      dispatchAction({ type: 'selectTask', taskId });
    },
    changeView(mode) {
      dispatchAction({ type: 'changeView', mode });
    },
    setDateFilter(filter) {
      dispatchAction({ type: 'setDateFilter', filter });
    },
    moveTask(taskId, newStatus) {
      dispatchAction({
        type: 'moveTask',
        taskId,
        newStatus,
        timestamp: new Date().toISOString(),
      });
    },
    softDeleteTask(id) {
      dispatchAction({
        type: 'softDeleteTask',
        id,
        timestamp: new Date().toISOString(),
      });
    },
    restoreTask(id) {
      dispatchAction({
        type: 'restoreTask',
        id,
        timestamp: new Date().toISOString(),
      });
    },
    permanentlyDeleteTask(id) {
      dispatchAction({ type: 'permanentlyDeleteTask', id });
    },
    emptyTrash() {
      dispatchAction({ type: 'emptyTrash' });
    },
    toggleAssistant(open) {
      dispatchAction({ type: 'toggleAssistant', open });
    },
  };

  return {
    state: deriveTaskFlowShellState(baseState),
    actions,
  };
}
