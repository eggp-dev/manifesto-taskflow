import type {
  TaskFlowClockStamp,
  Task,
  TaskStatus,
  ViewMode,
} from '@/types/taskflow';

export interface TaskFlowRuntimeDomain {
  readonly state: {
    tasks: Task[];
    selectedTaskId: string | null;
    viewMode: ViewMode;
    assistantOpen: boolean;
    clock: TaskFlowClockStamp | null;
  };
  readonly computed: {
    activeTasks: Task[];
    deletedTasks: Task[];
    todoTasks: Task[];
    inProgressTasks: Task[];
    reviewTasks: Task[];
    doneTasks: Task[];
    schedulableTasks: Task[];
    dueTodayTasks: Task[];
    overdueTasks: Task[];
    selectedTask: Task | null;
    totalCount: number;
    todoCount: number;
    inProgressCount: number;
    reviewCount: number;
    doneCount: number;
    deletedCount: number;
    dueTodayCount: number;
    overdueCount: number;
  };
  readonly actions: {
    createTask: (task: Task, stamp: TaskFlowClockStamp) => void;
    updateTask: (task: Task, stamp: TaskFlowClockStamp) => void;
    moveTask: (taskId: string, newStatus: TaskStatus, stamp: TaskFlowClockStamp) => void;
    softDeleteTask: (id: string, stamp: TaskFlowClockStamp) => void;
    restoreTask: (id: string, stamp: TaskFlowClockStamp) => void;
    permanentlyDeleteTask: (id: string, stamp: TaskFlowClockStamp) => void;
    emptyTrash: (stamp: TaskFlowClockStamp) => void;
    selectTask: (taskId: string | null, stamp: TaskFlowClockStamp) => void;
    changeView: (mode: ViewMode, stamp: TaskFlowClockStamp) => void;
    toggleAssistant: (open: boolean, stamp: TaskFlowClockStamp) => void;
  };
}
