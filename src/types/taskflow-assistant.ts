import type { UIMessage } from 'ai';
import type {
  Task,
  TaskPriority,
  TaskStatus,
  TaskFlowHistoryKind,
} from '@/types/taskflow';

export interface TaskFlowAgentTaskSummary {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string | null;
  dueDate: string | null;
  tags: string[];
  deletedAt: string | null;
}

export interface TaskFlowAgentHistorySummary {
  worldId: string;
  actionName: string;
  summary: string;
  kind: TaskFlowHistoryKind;
  createdAt: number;
}

export interface TaskFlowAgentSnapshot {
  data: Record<string, unknown>;
  computed: Record<string, unknown>;
  system: Record<string, unknown> | null;
}

export interface TaskFlowAgentCausalGraphNode {
  worldId: string;
  attemptId: string;
  branchId: string;
  branchName: string;
  parentWorldId: string | null;
  baseWorldId: string | null;
  actionName: string;
  summary: string;
  kind: TaskFlowHistoryKind;
  createdAt: number;
  isHead: boolean;
  isVisible: boolean;
}

export interface TaskFlowAgentCausalGraphEdge {
  edgeId: string;
  from: string;
  to: string;
}

export interface TaskFlowAgentCausalGraph {
  activeBranchId: string | null;
  activeBranchName: string | null;
  visibleWorldId: string | null;
  headWorldIds: string[];
  nodes: TaskFlowAgentCausalGraphNode[];
  edges: TaskFlowAgentCausalGraphEdge[];
}

export interface TaskFlowAgentContext {
  branchName: string | null;
  visibleWorldId: string | null;
  selectedTaskId: string | null;
  selectedTask: TaskFlowAgentTaskSummary | null;
  snapshot: TaskFlowAgentSnapshot;
  causalGraph: TaskFlowAgentCausalGraph;
  counts: {
    active: number;
    deleted: number;
    todo: number;
    inProgress: number;
    review: number;
    done: number;
  };
  activeTasks: TaskFlowAgentTaskSummary[];
  deletedTasks: TaskFlowAgentTaskSummary[];
  recentHistory: TaskFlowAgentHistorySummary[];
}

export interface TaskFlowToolOutput {
  ok: boolean;
  summary: string;
  taskId?: string;
  title?: string;
  status?: TaskStatus;
  skipped?: boolean;
  snapshotDiff?: string[];
  matches?: TaskFlowLineageMatch[];
}

export interface TaskFlowCreateTaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string | null;
  dueDate?: string | null;
  tags?: string[];
}

export interface TaskFlowUpdateTaskInput {
  taskId: string;
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string | null;
  dueDate?: string | null;
  tags?: string[];
}

export interface TaskFlowMoveTaskInput {
  taskId: string;
  newStatus: TaskStatus;
}

export interface TaskFlowDeleteTaskInput {
  taskId: string;
}

export interface TaskFlowRestoreTaskInput {
  taskId: string;
}

export interface TaskFlowSelectTaskInput {
  taskId: string;
}

export interface TaskFlowSearchLineageInput {
  query?: string;
  actionNames?: string[];
  kinds?: TaskFlowHistoryKind[];
  branchName?: string;
  onlyHeads?: boolean;
  limit?: number;
}

export interface TaskFlowLineageMatch {
  worldId: string;
  branchName: string;
  actionName: string;
  summary: string;
  kind: TaskFlowHistoryKind;
  createdAt: number;
  isHead: boolean;
  isVisible: boolean;
}

export interface TaskFlowAssistantToolMap {
  create_task: {
    input: TaskFlowCreateTaskInput;
    output: TaskFlowToolOutput;
  };
  update_task: {
    input: TaskFlowUpdateTaskInput;
    output: TaskFlowToolOutput;
  };
  move_task: {
    input: TaskFlowMoveTaskInput;
    output: TaskFlowToolOutput;
  };
  delete_task: {
    input: TaskFlowDeleteTaskInput;
    output: TaskFlowToolOutput;
  };
  restore_task: {
    input: TaskFlowRestoreTaskInput;
    output: TaskFlowToolOutput;
  };
  select_task: {
    input: TaskFlowSelectTaskInput;
    output: TaskFlowToolOutput;
  };
  search_lineage: {
    input: TaskFlowSearchLineageInput;
    output: TaskFlowToolOutput;
  };
}

export type TaskFlowAssistantUITools = TaskFlowAssistantToolMap & Record<
  string,
  {
    input: unknown;
    output: unknown;
  }
>;

export type TaskFlowAssistantToolName = keyof TaskFlowAssistantToolMap;

const TASKFLOW_ASSISTANT_TOOL_NAMES = [
  'create_task',
  'update_task',
  'move_task',
  'delete_task',
  'restore_task',
  'select_task',
  'search_lineage',
] as const satisfies readonly TaskFlowAssistantToolName[];

export function isTaskFlowAssistantToolName(value: string): value is TaskFlowAssistantToolName {
  return (
    TASKFLOW_ASSISTANT_TOOL_NAMES as readonly string[]
  ).includes(value);
}

export type TaskFlowAssistantUIMessage = UIMessage<
  unknown,
  never,
  TaskFlowAssistantUITools
>;

export type TaskFlowAgentToolResult =
  | {
      state: 'output-available';
      output: TaskFlowToolOutput;
    }
  | {
      state: 'output-error';
      errorText: string;
    };

export interface PersistedLineageState {
  schemaVersion: 2;
  schemaHash: string;
  runtimeStore: string;
  historyMetadata: Array<
    [
      string,
      {
        actionName: string;
        summary: string;
        kind: TaskFlowHistoryKind;
      },
    ]
  >;
}

export function toTaskFlowAgentTaskSummary(task: Task): TaskFlowAgentTaskSummary {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assignee: task.assignee,
    dueDate: task.dueDate,
    tags: task.tags,
    deletedAt: task.deletedAt,
  };
}
