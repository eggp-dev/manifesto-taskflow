import type {
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
  };
  readonly computed: {
    activeTasks: Task[];
    deletedTasks: Task[];
    todoTasks: Task[];
    inProgressTasks: Task[];
    reviewTasks: Task[];
    doneTasks: Task[];
    selectedTask: Task | null;
    totalCount: number;
    todoCount: number;
    inProgressCount: number;
    reviewCount: number;
    doneCount: number;
    deletedCount: number;
  };
  readonly actions: {
    createTask: (task: Task) => void;
    updateTask: (task: Task) => void;
    moveTask: (taskId: string, newStatus: TaskStatus) => void;
    softDeleteTask: (id: string, timestamp: string) => void;
    restoreTask: (id: string) => void;
    permanentlyDeleteTask: (id: string) => void;
    emptyTrash: () => void;
    selectTask: (taskId: string | null) => void;
    changeView: (mode: ViewMode) => void;
    toggleAssistant: (open: boolean) => void;
  };
}
