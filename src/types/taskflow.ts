export type TaskStatus = "todo" | "in-progress" | "review" | "done";

export type TaskPriority = "low" | "medium" | "high";

export type ViewMode = "todo" | "kanban" | "table" | "trash";

export type DateFilterField = "dueDate" | "createdAt";

export type DateFilterType = "all" | "today" | "week" | "month" | "custom";

export interface DateFilter {
  field: DateFilterField;
  type: DateFilterType;
  startDate?: Date;
  endDate?: Date;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string | null;
  dueDate: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface TaskDraft {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  dueDate: string;
  tags: string[];
}

export type AssistantStage = "thinking" | "executing" | "responding" | "done" | "error";

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tone?: "default" | "muted";
  stage?: AssistantStage;
}

export type TaskFlowHistoryKind = "genesis" | "seed" | "ui" | "mutation";

export interface TaskFlowHistoryEntry {
  attemptId: string;
  worldId: string;
  branchId: string;
  branchName: string;
  actionName: string;
  summary: string;
  kind: TaskFlowHistoryKind;
  createdAt: number;
  isHead: boolean;
  isVisible: boolean;
}
