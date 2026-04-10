import { TASK_FIXTURES } from '@/lib/taskflow-fixtures';
import type { DateFilter, Task, TaskStatus, ViewMode } from '@/types/taskflow';

export type TaskFlowShellBaseState = {
  tasks: Task[];
  selectedTaskId: string | null;
  viewMode: ViewMode;
  dateFilter: DateFilter | null;
  assistantOpen: boolean;
};

export type TaskFlowShellState = TaskFlowShellBaseState & {
  selectedTask: Task | null;
  activeTasks: Task[];
  deletedTasks: Task[];
  todoTasks: Task[];
  inProgressTasks: Task[];
  reviewTasks: Task[];
  doneTasks: Task[];
  totalCount: number;
  todoCount: number;
  inProgressCount: number;
  reviewCount: number;
  doneCount: number;
  deletedCount: number;
};

export type TaskFlowShellAction =
  | { type: 'selectTask'; taskId: string | null }
  | { type: 'changeView'; mode: ViewMode }
  | { type: 'setDateFilter'; filter: DateFilter | null }
  | { type: 'moveTask'; taskId: string; newStatus: TaskStatus; timestamp: string }
  | { type: 'softDeleteTask'; id: string; timestamp: string }
  | { type: 'restoreTask'; id: string; timestamp: string }
  | { type: 'permanentlyDeleteTask'; id: string }
  | { type: 'emptyTrash' }
  | { type: 'toggleAssistant'; open: boolean };

function cloneTask(task: Task): Task {
  return {
    ...task,
    tags: [...task.tags],
  };
}

function cloneTasks(tasks: Task[]): Task[] {
  return tasks.map(cloneTask);
}

export function createInitialTaskFlowShellBaseState(
  tasks: Task[] = TASK_FIXTURES,
): TaskFlowShellBaseState {
  return {
    tasks: cloneTasks(tasks),
    selectedTaskId: null,
    viewMode: 'kanban',
    dateFilter: null,
    assistantOpen: false,
  };
}

function clearSelectionIfMatches(
  selectedTaskId: string | null,
  targetTaskId: string,
): string | null {
  return selectedTaskId === targetTaskId ? null : selectedTaskId;
}

export function taskFlowShellReducer(
  state: TaskFlowShellBaseState,
  action: TaskFlowShellAction,
): TaskFlowShellBaseState {
  const selectedDeletedTaskStillExists =
    state.selectedTaskId !== null &&
    state.tasks.some(
      (task) => task.id === state.selectedTaskId && task.deletedAt !== null,
    );

  switch (action.type) {
    case 'selectTask':
      return {
        ...state,
        selectedTaskId: action.taskId,
      };

    case 'changeView':
      return {
        ...state,
        viewMode: action.mode,
      };

    case 'setDateFilter':
      return {
        ...state,
        dateFilter: action.filter,
      };

    case 'moveTask':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.taskId
            ? {
                ...task,
                status: action.newStatus,
                updatedAt: action.timestamp,
              }
            : task,
        ),
      };

    case 'softDeleteTask':
      return {
        ...state,
        selectedTaskId: clearSelectionIfMatches(state.selectedTaskId, action.id),
        tasks: state.tasks.map((task) =>
          task.id === action.id
            ? {
                ...task,
                deletedAt: action.timestamp,
                updatedAt: action.timestamp,
              }
            : task,
        ),
      };

    case 'restoreTask':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.id
            ? {
                ...task,
                deletedAt: null,
                updatedAt: action.timestamp,
              }
            : task,
        ),
      };

    case 'permanentlyDeleteTask':
      return {
        ...state,
        selectedTaskId: clearSelectionIfMatches(state.selectedTaskId, action.id),
        tasks: state.tasks.filter((task) => task.id !== action.id),
      };

    case 'emptyTrash':
      return {
        ...state,
        selectedTaskId: selectedDeletedTaskStillExists ? null : state.selectedTaskId,
        tasks: state.tasks.filter((task) => task.deletedAt === null),
      };

    case 'toggleAssistant':
      return {
        ...state,
        assistantOpen: action.open,
      };

    default:
      return state;
  }
}

export function deriveTaskFlowShellState(
  state: TaskFlowShellBaseState,
): TaskFlowShellState {
  const activeTasks = state.tasks.filter((task) => task.deletedAt === null);
  const deletedTasks = state.tasks.filter((task) => task.deletedAt !== null);
  const todoTasks = activeTasks.filter((task) => task.status === 'todo');
  const inProgressTasks = activeTasks.filter(
    (task) => task.status === 'in-progress',
  );
  const reviewTasks = activeTasks.filter((task) => task.status === 'review');
  const doneTasks = activeTasks.filter((task) => task.status === 'done');

  return {
    ...state,
    selectedTask:
      state.tasks.find((task) => task.id === state.selectedTaskId) ?? null,
    activeTasks,
    deletedTasks,
    todoTasks,
    inProgressTasks,
    reviewTasks,
    doneTasks,
    totalCount: activeTasks.length,
    todoCount: todoTasks.length,
    inProgressCount: inProgressTasks.length,
    reviewCount: reviewTasks.length,
    doneCount: doneTasks.length,
    deletedCount: deletedTasks.length,
  };
}
