'use client';

import {
  createManifesto,
  type Snapshot,
  type TypedIntent,
} from '@manifesto-ai/sdk';
import {
  InMemoryLineageStore,
  createInMemoryLineageStore,
  type LineageInstance,
  withLineage,
} from '@manifesto-ai/lineage';
import {
  createLineageService,
  type BranchInfo,
  type LineageService,
  type SealAttempt,
  type WorldHead,
} from '@manifesto-ai/lineage/provider';
import taskflowSchema from '@/domain/taskflow.schema';
import { createClockStamp } from '@/lib/taskflow-clock';
import { TASK_FIXTURES } from '@/lib/taskflow-fixtures';
import {
  clearPersistedAssistantMessages,
  clearPersistedLineageState,
  deserializeLineageStoreState,
  loadPersistedAssistantMessages,
  loadPersistedLineageState,
  savePersistedAssistantMessages,
  savePersistedLineageState,
  serializeLineageStoreState,
  type StorageLike,
} from '@/lib/taskflow-runtime-persistence';
import type {
  DateFilter,
  Task,
  TaskDraft,
  TaskFlowClockStamp,
  TaskFlowHistoryEntry,
  TaskFlowHistoryKind,
  TaskStatus,
  ViewMode,
} from '@/types/taskflow';
import type {
  TaskFlowAgentCausalGraph,
  TaskFlowLineageMatch,
  PersistedLineageState,
  TaskFlowAgentContext,
  TaskFlowAgentToolResult,
  TaskFlowAssistantToolName,
  TaskFlowAssistantUITools,
  TaskFlowAssistantUIMessage,
  TaskFlowHoveredInspection,
  TaskFlowHoveredTarget,
} from '@/types/taskflow-assistant';
import {
  toTaskFlowAgentTaskSummary,
} from '@/types/taskflow-assistant';
import type { TaskFlowRuntimeDomain } from '@/types/taskflow-runtime';

type TaskFlowRuntimeState = TaskFlowRuntimeDomain['state'] &
  TaskFlowRuntimeDomain['computed'];

type TaskFlowHistoryMeta = {
  actionName: string;
  summary: string;
  kind: TaskFlowHistoryKind;
};

type TaskFlowClockFactory = (referenceDate?: Date) => TaskFlowClockStamp;

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableSerialize(nestedValue)}`);

  return `{${entries.join(',')}}`;
}

function hashString(value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

const TASKFLOW_SCHEMA_HASH = hashString(stableSerialize(taskflowSchema));

export type TaskFlowActions = {
  createTask: (draft: TaskDraft) => void;
  updateTask: (id: string, draft: TaskDraft) => void;
  selectTask: (taskId: string | null) => void;
  changeView: (mode: ViewMode) => void;
  setDateFilter: (filter: DateFilter | null) => void;
  setHistoryOpen: (open: boolean) => void;
  setCreateDialogOpen: (open: boolean) => void;
  setDatePickerOpen: (open: boolean) => void;
  moveTask: (taskId: string, newStatus: TaskStatus) => void;
  softDeleteTask: (id: string) => void;
  restoreTask: (id: string) => void;
  permanentlyDeleteTask: (id: string) => void;
  emptyTrash: () => void;
  toggleAssistant: (open: boolean) => void;
};

type TaskFlowUiSessionState = {
  hoveredTarget: TaskFlowHoveredTarget | null;
  historyOpen: boolean;
  createDialogOpen: boolean;
  datePickerOpen: boolean;
};

export type TaskFlowViewState = TaskFlowRuntimeState & {
  dateFilter: DateFilter | null;
  historyEntries: TaskFlowHistoryEntry[];
  activeBranchName: string | null;
  visibleWorldId: string | null;
} & TaskFlowUiSessionState;

export type TaskFlowControllerSnapshot = {
  ready: boolean;
  state: TaskFlowViewState | null;
};

function getBrowserStorage(): StorageLike | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function extractState(
  snapshot: Snapshot<TaskFlowRuntimeDomain['state']>,
): TaskFlowRuntimeState {
  const computed = snapshot.computed as TaskFlowRuntimeDomain['computed'];

  return {
    tasks: snapshot.data.tasks ?? [],
    selectedTaskId: snapshot.data.selectedTaskId ?? null,
    viewMode: snapshot.data.viewMode ?? 'kanban',
    assistantOpen: snapshot.data.assistantOpen ?? false,
    clock: snapshot.data.clock ?? null,
    activeTasks: computed.activeTasks ?? [],
    deletedTasks: computed.deletedTasks ?? [],
    todoTasks: computed.todoTasks ?? [],
    inProgressTasks: computed.inProgressTasks ?? [],
    reviewTasks: computed.reviewTasks ?? [],
    doneTasks: computed.doneTasks ?? [],
    schedulableTasks: computed.schedulableTasks ?? [],
    dueTodayTasks: computed.dueTodayTasks ?? [],
    overdueTasks: computed.overdueTasks ?? [],
    selectedTask: computed.selectedTask ?? null,
    totalCount: computed.totalCount ?? 0,
    todoCount: computed.todoCount ?? 0,
    inProgressCount: computed.inProgressCount ?? 0,
    reviewCount: computed.reviewCount ?? 0,
    doneCount: computed.doneCount ?? 0,
    deletedCount: computed.deletedCount ?? 0,
    dueTodayCount: computed.dueTodayCount ?? 0,
    overdueCount: computed.overdueCount ?? 0,
  };
}

function describeAction(
  actionName: string,
  runtime: LineageInstance<TaskFlowRuntimeDomain>,
  payload: Record<string, unknown>,
): TaskFlowHistoryMeta {
  const tasks = runtime.getSnapshot().data.tasks ?? [];
  const findTaskTitle = (id: string): string =>
    tasks.find((task) => task.id === id)?.title ?? id;

  switch (actionName) {
    case 'createTask': {
      const task = payload.task as Task;
      const isSeed = payload.seed === true;
      return {
        actionName,
        summary: `${isSeed ? 'Seeded' : 'Created'} "${task.title}"`,
        kind: isSeed ? 'seed' : 'mutation',
      };
    }
    case 'updateTask': {
      const task = payload.task as Task;
      return {
        actionName,
        summary: `Updated "${task.title}"`,
        kind: 'mutation',
      };
    }
    case 'selectTask': {
      const taskId = payload.taskId as string | null;
      return {
        actionName,
        summary: taskId ? `Selected "${findTaskTitle(taskId)}"` : 'Cleared selection',
        kind: 'ui',
      };
    }
    case 'changeView':
      return {
        actionName,
        summary: `Switched to ${(payload.mode as ViewMode) ?? 'kanban'} view`,
        kind: 'ui',
      };
    case 'toggleAssistant':
      return {
        actionName,
        summary: (payload.open as boolean) ? 'Opened assistant panel' : 'Closed assistant panel',
        kind: 'ui',
      };
    case 'moveTask':
      return {
        actionName,
        summary: `Moved "${findTaskTitle(payload.taskId as string)}" to ${payload.newStatus as string}`,
        kind: 'mutation',
      };
    case 'softDeleteTask':
      return {
        actionName,
        summary: `Deleted "${findTaskTitle(payload.id as string)}"`,
        kind: 'mutation',
      };
    case 'restoreTask':
      return {
        actionName,
        summary: `Restored "${findTaskTitle(payload.id as string)}"`,
        kind: 'mutation',
      };
    case 'permanentlyDeleteTask':
      return {
        actionName,
        summary: `Permanently deleted "${findTaskTitle(payload.id as string)}"`,
        kind: 'mutation',
      };
    case 'emptyTrash':
      return {
        actionName,
        summary: 'Emptied trash',
        kind: 'mutation',
      };
    default:
      return {
        actionName,
        summary: actionName,
        kind: 'mutation',
      };
  }
}

function normalizeTextValue(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTags(tags: readonly string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function normalizeDueDateValue(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = trimmed.includes('T') ? new Date(trimmed) : new Date(`${trimmed}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toTimestamp(value: string | null): number {
  if (!value) {
    return 0;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function buildTaskFromDraft(
  draft: TaskDraft,
  stamp: TaskFlowClockStamp,
  existingTask?: Task,
): Task | null {
  const title = draft.title.trim();
  if (title.length === 0) {
    return null;
  }
  const dueDate = normalizeDueDateValue(draft.dueDate);

  return {
    id: existingTask?.id ?? crypto.randomUUID(),
    title,
    description: normalizeTextValue(draft.description),
    status: draft.status,
    priority: draft.priority,
    assignee: normalizeTextValue(draft.assignee),
    dueDate,
    dueDateTimestamp: toTimestamp(dueDate),
    tags: normalizeTags(draft.tags),
    createdAt: existingTask?.createdAt ?? stamp.now,
    updatedAt: stamp.now,
    deletedAt: existingTask?.deletedAt ?? null,
  };
}

function buildTaskFromCreateToolInput(
  input: TaskFlowAssistantUITools['create_task']['input'],
): TaskDraft {
  return {
    title: input.title,
    description: input.description ?? '',
    status: input.status ?? 'todo',
    priority: input.priority ?? 'medium',
    assignee: input.assignee ?? '',
    dueDate: input.dueDate ?? '',
    tags: input.tags ?? [],
  };
}

function buildUpdatedTaskFromToolInput(
  existingTask: Task,
  input: TaskFlowAssistantUITools['update_task']['input'],
  stamp: TaskFlowClockStamp,
): Task | null {
  const nextTitle =
    input.title !== undefined ? input.title.trim() : existingTask.title;

  if (nextTitle.length === 0) {
    return null;
  }

  const nextDueDate =
    input.dueDate !== undefined
      ? normalizeDueDateValue(input.dueDate)
      : existingTask.dueDate;

  return {
    ...existingTask,
    title: nextTitle,
    description:
      input.description !== undefined
        ? normalizeTextValue(input.description)
        : existingTask.description,
    status: input.status ?? existingTask.status,
    priority: input.priority ?? existingTask.priority,
    assignee:
      input.assignee !== undefined
        ? normalizeTextValue(input.assignee)
        : existingTask.assignee,
    dueDate: nextDueDate,
    dueDateTimestamp: toTimestamp(nextDueDate),
    tags: input.tags !== undefined ? normalizeTags(input.tags) : existingTask.tags,
    updatedAt: stamp.now,
  };
}

type TraceCounts = {
  active: number;
  deleted: number;
  todo: number;
  inProgress: number;
  review: number;
  done: number;
};

type TaskFlowTraceSnapshot = {
  counts: TraceCounts;
  selectedTaskId: string | null;
  tasksById: Map<string, Task>;
};

function captureTraceSnapshot(
  runtime: LineageInstance<TaskFlowRuntimeDomain>,
): TaskFlowTraceSnapshot {
  const snapshot = runtime.getSnapshot();
  const state = extractState(snapshot);

  return {
    counts: {
      active: state.totalCount,
      deleted: state.deletedCount,
      todo: state.todoCount,
      inProgress: state.inProgressCount,
      review: state.reviewCount,
      done: state.doneCount,
    },
    selectedTaskId: state.selectedTaskId,
    tasksById: new Map(
      (snapshot.data.tasks ?? []).map((task) => [
        task.id,
        {
          ...task,
          tags: [...task.tags],
        },
      ]),
    ),
  };
}

function formatTraceValue(value: string | null): string {
  return value ?? 'none';
}

function buildSnapshotDiff(
  before: TaskFlowTraceSnapshot,
  after: TaskFlowTraceSnapshot,
  taskId?: string,
): string[] {
  const diff: string[] = [];
  const countLabels: Record<keyof TraceCounts, string> = {
    active: 'active count',
    deleted: 'deleted count',
    todo: 'todo count',
    inProgress: 'in-progress count',
    review: 'review count',
    done: 'done count',
  };

  for (const key of Object.keys(countLabels) as Array<keyof TraceCounts>) {
    if (before.counts[key] !== after.counts[key]) {
      diff.push(`${countLabels[key]}: ${before.counts[key]} -> ${after.counts[key]}`);
    }
  }

  if (before.selectedTaskId !== after.selectedTaskId) {
    diff.push(
      `selected task: ${formatTraceValue(before.selectedTaskId)} -> ${formatTraceValue(after.selectedTaskId)}`,
    );
  }

  if (!taskId) {
    return diff;
  }

  const beforeTask = before.tasksById.get(taskId);
  const afterTask = after.tasksById.get(taskId);

  if (!beforeTask && afterTask) {
    diff.unshift(`task created: "${afterTask.title}"`);
    return diff;
  }

  if (beforeTask && !afterTask) {
    diff.unshift(`task removed: "${beforeTask.title}"`);
    return diff;
  }

  if (!beforeTask || !afterTask) {
    return diff;
  }

  if (beforeTask.title !== afterTask.title) {
    diff.push(`title: ${beforeTask.title} -> ${afterTask.title}`);
  }
  if (beforeTask.status !== afterTask.status) {
    diff.push(`status: ${beforeTask.status} -> ${afterTask.status}`);
  }
  if (beforeTask.priority !== afterTask.priority) {
    diff.push(`priority: ${beforeTask.priority} -> ${afterTask.priority}`);
  }
  if (beforeTask.assignee !== afterTask.assignee) {
    diff.push(
      `assignee: ${formatTraceValue(beforeTask.assignee)} -> ${formatTraceValue(afterTask.assignee)}`,
    );
  }
  if (beforeTask.dueDate !== afterTask.dueDate) {
    diff.push(
      `due date: ${formatTraceValue(beforeTask.dueDate)} -> ${formatTraceValue(afterTask.dueDate)}`,
    );
  }
  if (beforeTask.deletedAt !== afterTask.deletedAt) {
    diff.push(
      `deletedAt: ${formatTraceValue(beforeTask.deletedAt)} -> ${formatTraceValue(afterTask.deletedAt)}`,
    );
  }
  if (beforeTask.tags.join(',') !== afterTask.tags.join(',')) {
    diff.push(
      `tags: ${beforeTask.tags.join(', ') || 'none'} -> ${afterTask.tags.join(', ') || 'none'}`,
    );
  }

  return diff.slice(0, 6);
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase();
}

function searchLineageEntries(args: {
  entries: TaskFlowHistoryEntry[];
  activeBranchName: string | null;
  query?: string;
  actionNames?: string[];
  kinds?: TaskFlowHistoryKind[];
  branchName?: string;
  onlyHeads?: boolean;
  limit?: number;
}): TaskFlowLineageMatch[] {
  const normalizedQuery = args.query ? normalizeSearchValue(args.query) : null;
  const normalizedBranchName = args.branchName ? normalizeSearchValue(args.branchName) : null;
  const normalizedActionNames = new Set(
    (args.actionNames ?? []).map((actionName) => normalizeSearchValue(actionName)),
  );
  const allowedKinds = new Set(args.kinds ?? []);
  const onlyHeads = args.onlyHeads === true;
  const limit = Math.min(Math.max(args.limit ?? 8, 1), 20);

  return args.entries
    .filter((entry) => {
      if (onlyHeads && !entry.isHead) {
        return false;
      }

      if (normalizedBranchName && normalizeSearchValue(entry.branchName) !== normalizedBranchName) {
        return false;
      }

      if (normalizedActionNames.size > 0 && !normalizedActionNames.has(normalizeSearchValue(entry.actionName))) {
        return false;
      }

      if (allowedKinds.size > 0 && !allowedKinds.has(entry.kind)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [
        entry.worldId,
        entry.branchName,
        entry.actionName,
        entry.summary,
        args.activeBranchName ?? '',
      ]
        .map((value) => value.toLowerCase())
        .some((value) => value.includes(normalizedQuery));
    })
    .slice(0, limit)
    .map((entry) => ({
      worldId: entry.worldId,
      branchName: entry.branchName,
      actionName: entry.actionName,
      summary: entry.summary,
      kind: entry.kind,
      createdAt: entry.createdAt,
      isHead: entry.isHead,
      isVisible: entry.isVisible,
    }));
}

function buildHistoryEntries(
  attempts: readonly SealAttempt[],
  branches: readonly BranchInfo[],
  heads: readonly WorldHead[],
  visibleWorldId: string | null,
  metadataByWorldId: ReadonlyMap<string, TaskFlowHistoryMeta>,
): TaskFlowHistoryEntry[] {
  const branchNames = new Map(branches.map((branch) => [branch.id, branch.name]));
  const headWorldIds = new Set(heads.map((head) => head.worldId));

  return [...attempts]
    .sort((left, right) => right.createdAt - left.createdAt)
    .map((attempt) => {
      const metadata = metadataByWorldId.get(attempt.worldId);

      if (metadata) {
        return {
          attemptId: attempt.attemptId,
          worldId: attempt.worldId,
          branchId: attempt.branchId,
          branchName: branchNames.get(attempt.branchId) ?? attempt.branchId,
          actionName: metadata.actionName,
          summary: metadata.summary,
          kind: metadata.kind,
          createdAt: attempt.createdAt,
          isHead: headWorldIds.has(attempt.worldId),
          isVisible: visibleWorldId === attempt.worldId,
        };
      }

      return {
        attemptId: attempt.attemptId,
        worldId: attempt.worldId,
        branchId: attempt.branchId,
        branchName: branchNames.get(attempt.branchId) ?? attempt.branchId,
        actionName: attempt.parentWorldId === null ? 'genesis' : 'lineage',
        summary:
          attempt.parentWorldId === null
            ? 'Bootstrapped lineage genesis world'
            : 'Committed lineage world',
        kind: 'genesis',
        createdAt: attempt.createdAt,
        isHead: headWorldIds.has(attempt.worldId),
        isVisible: visibleWorldId === attempt.worldId,
      };
    });
}

function toSerializableRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function buildAgentCausalGraph(args: {
  activeBranch: BranchInfo;
  branches: readonly BranchInfo[];
  attempts: readonly SealAttempt[];
  heads: readonly WorldHead[];
  visibleWorldId: string | null;
  metadataByWorldId: ReadonlyMap<string, TaskFlowHistoryMeta>;
}): TaskFlowAgentCausalGraph {
  const branchNames = new Map(args.branches.map((branch) => [branch.id, branch.name]));
  const headWorldIds = new Set(args.heads.map((head) => head.worldId));
  const edges = new Map<string, { edgeId: string; from: string; to: string }>();

  const nodes = [...args.attempts]
    .sort((left, right) => left.createdAt - right.createdAt)
    .map((attempt) => {
      const metadata = args.metadataByWorldId.get(attempt.worldId);

      if (attempt.parentWorldId) {
        const edgeId = `${attempt.parentWorldId}:${attempt.worldId}`;
        edges.set(edgeId, {
          edgeId,
          from: attempt.parentWorldId,
          to: attempt.worldId,
        });
      }

      return {
        worldId: attempt.worldId,
        attemptId: attempt.attemptId,
        branchId: attempt.branchId,
        branchName: branchNames.get(attempt.branchId) ?? attempt.branchId,
        parentWorldId: attempt.parentWorldId,
        baseWorldId: attempt.baseWorldId,
        actionName:
          metadata?.actionName ??
          (attempt.parentWorldId === null ? 'genesis' : 'lineage'),
        summary:
          metadata?.summary ??
          (attempt.parentWorldId === null
            ? 'Bootstrapped lineage genesis world'
            : 'Committed lineage world'),
        kind: metadata?.kind ?? 'genesis',
        createdAt: attempt.createdAt,
        isHead: headWorldIds.has(attempt.worldId),
        isVisible: args.visibleWorldId === attempt.worldId,
      };
    });

  return {
    activeBranchId: args.activeBranch.id,
    activeBranchName: args.activeBranch.name,
    visibleWorldId: args.visibleWorldId,
    headWorldIds: [...headWorldIds],
    nodes,
    edges: [...edges.values()],
  };
}

function getHoveredTargetIdentity(target: TaskFlowHoveredTarget | null): string {
  if (!target) {
    return 'null';
  }

  switch (target.kind) {
    case 'task-card':
      return `task-card:${target.taskId}`;
    case 'header-action':
      return `header-action:${target.actionId}`;
    case 'lineage-entry':
      return `lineage-entry:${target.worldId}`;
  }
}

export class TaskFlowRuntimeController {
  private readonly storage: StorageLike | null;
  private readonly clockFactory: TaskFlowClockFactory;
  private readonly listeners = new Set<() => void>();
  private readonly historyMeta = new Map<string, TaskFlowHistoryMeta>();

  private runtime: LineageInstance<TaskFlowRuntimeDomain> | null = null;
  private lineageService: LineageService | null = null;
  private store: InMemoryLineageStore | null = null;
  private unsubscribeRuntime: (() => void) | null = null;
  private startPromise: Promise<void> | null = null;
  private resetPromise: Promise<void> | null = null;
  private hoveredTargetTimer: ReturnType<typeof setTimeout> | null = null;

  private ready = false;
  private state: TaskFlowViewState | null = null;
  private runtimeState: TaskFlowRuntimeState | null = null;
  private dateFilter: DateFilter | null = null;
  private hoveredTarget: TaskFlowHoveredTarget | null = null;
  private historyOpen = false;
  private createDialogOpen = false;
  private datePickerOpen = false;
  private historyEntries: TaskFlowHistoryEntry[] = [];
  private activeBranchId: string | null = null;
  private activeBranchName: string | null = null;
  private visibleWorldId: string | null = null;
  private agentCausalGraph: TaskFlowAgentCausalGraph | null = null;
  private controllerSnapshot: TaskFlowControllerSnapshot = {
    ready: false,
    state: null,
  };

  readonly actions: TaskFlowActions = {
    createTask: (draft) => {
      void this.createTaskFromDraft(draft);
    },
    updateTask: (id, draft) => {
      void this.updateTaskFromDraft(id, draft);
    },
    selectTask: (taskId) => {
      void this.commitUiIntent(
        'selectTask',
        (instance, stamp) => instance.createIntent(instance.MEL.actions.selectTask, taskId, stamp),
        { taskId },
      );
    },
    changeView: (mode) => {
      void this.commitUiIntent(
        'changeView',
        (instance, stamp) => instance.createIntent(instance.MEL.actions.changeView, mode, stamp),
        { mode },
      );
    },
    setDateFilter: (filter) => {
      this.dateFilter = filter;
      this.rebuildState({ persistRuntime: false });
    },
    setHistoryOpen: (open) => {
      this.setHistoryOpen(open);
    },
    setCreateDialogOpen: (open) => {
      this.setCreateDialogOpen(open);
    },
    setDatePickerOpen: (open) => {
      this.setDatePickerOpen(open);
    },
    moveTask: (taskId, newStatus) => {
      void this.moveTask(taskId, newStatus);
    },
    softDeleteTask: (id) => {
      void this.softDeleteTask(id);
    },
    restoreTask: (id) => {
      void this.restoreTask(id);
    },
    permanentlyDeleteTask: (id) => {
      void this.permanentlyDeleteTask(id);
    },
    emptyTrash: () => {
      void this.emptyTrash();
    },
    toggleAssistant: (open) => {
      void this.commitUiIntent(
        'toggleAssistant',
        (instance, stamp) => instance.createIntent(instance.MEL.actions.toggleAssistant, open, stamp),
        { open },
      );
    },
  };

  constructor(options?: { storage?: StorageLike | null; clockFactory?: TaskFlowClockFactory }) {
    this.storage = options?.storage ?? getBrowserStorage();
    this.clockFactory = options?.clockFactory ?? createClockStamp;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): TaskFlowControllerSnapshot => this.controllerSnapshot;

  setHistoryOpen(open: boolean): void {
    if (this.historyOpen === open) {
      return;
    }

    this.historyOpen = open;
    this.rebuildState({ persistRuntime: false });
  }

  setCreateDialogOpen(open: boolean): void {
    if (this.createDialogOpen === open) {
      return;
    }

    this.createDialogOpen = open;
    this.rebuildState({ persistRuntime: false });
  }

  setDatePickerOpen(open: boolean): void {
    if (this.datePickerOpen === open) {
      return;
    }

    this.datePickerOpen = open;
    this.rebuildState({ persistRuntime: false });
  }

  setHoveredTarget(target: TaskFlowHoveredTarget | null): void {
    this.cancelHoveredTargetSchedule();

    if (getHoveredTargetIdentity(this.hoveredTarget) === getHoveredTargetIdentity(target)) {
      return;
    }

    this.hoveredTarget = target;
    this.rebuildState({ persistRuntime: false });
  }

  scheduleHoveredTarget(target: TaskFlowHoveredTarget | null, delay = 150): void {
    this.cancelHoveredTargetSchedule();

    if (!target) {
      return;
    }

    if (delay <= 0) {
      this.setHoveredTarget(target);
      return;
    }

    this.hoveredTargetTimer = setTimeout(() => {
      this.hoveredTargetTimer = null;
      this.setHoveredTarget(target);
    }, delay);
  }

  cancelHoveredTargetSchedule(): void {
    if (!this.hoveredTargetTimer) {
      return;
    }

    clearTimeout(this.hoveredTargetTimer);
    this.hoveredTargetTimer = null;
  }

  async start(): Promise<void> {
    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = this.initialize();
    return this.startPromise;
  }

  async resetSession(): Promise<void> {
    if (this.resetPromise) {
      return this.resetPromise;
    }

    this.resetPromise = (async () => {
      const reopenAssistant = this.state?.assistantOpen === true;

      clearPersistedAssistantMessages(this.storage);
      clearPersistedLineageState(this.storage);
      this.historyMeta.clear();
      this.dateFilter = null;
      this.hoveredTarget = null;
      this.historyOpen = false;
      this.createDialogOpen = false;
      this.datePickerOpen = false;

      this.dispose();
      await this.start();

      if (reopenAssistant && this.runtime) {
        await this.commitUiIntent(
          'toggleAssistant',
          (instance, stamp) => instance.createIntent(instance.MEL.actions.toggleAssistant, true, stamp),
          { open: true },
        );
      }
    })().finally(() => {
      this.resetPromise = null;
    });

    return this.resetPromise;
  }

  dispose(): void {
    this.cancelHoveredTargetSchedule();
    this.unsubscribeRuntime?.();
    this.unsubscribeRuntime = null;
    this.runtime?.dispose();
    this.runtime = null;
    this.lineageService = null;
    this.store = null;
    this.ready = false;
    this.runtimeState = null;
    this.state = null;
    this.hoveredTarget = null;
    this.historyOpen = false;
    this.createDialogOpen = false;
    this.datePickerOpen = false;
    this.historyEntries = [];
    this.activeBranchId = null;
    this.activeBranchName = null;
    this.visibleWorldId = null;
    this.agentCausalGraph = null;
    this.dateFilter = null;
    this.startPromise = null;
    this.updateControllerSnapshot();
    this.emit();
  }

  buildAgentContext(): TaskFlowAgentContext {
    const state = this.state;
    const snapshot = this.runtime?.getSnapshot();

    return {
      branchName: state?.activeBranchName ?? null,
      visibleWorldId: state?.visibleWorldId ?? null,
      selectedTaskId: state?.selectedTaskId ?? null,
      selectedTask: state?.selectedTask ? toTaskFlowAgentTaskSummary(state.selectedTask) : null,
      hoveredTarget: this.hoveredTarget,
      snapshot: {
        data: snapshot ? toSerializableRecord(snapshot.data) : {},
        computed: snapshot ? toSerializableRecord(snapshot.computed) : {},
        system: snapshot ? toSerializableRecord(snapshot.system) : null,
      },
      causalGraph: this.agentCausalGraph ?? {
        activeBranchId: this.activeBranchId,
        activeBranchName: this.activeBranchName,
        visibleWorldId: this.visibleWorldId,
        headWorldIds: [],
        nodes: [],
        edges: [],
      },
      counts: {
        active: state?.totalCount ?? 0,
        deleted: state?.deletedCount ?? 0,
        todo: state?.todoCount ?? 0,
        inProgress: state?.inProgressCount ?? 0,
        review: state?.reviewCount ?? 0,
        done: state?.doneCount ?? 0,
      },
      activeTasks: (state?.activeTasks ?? []).map(toTaskFlowAgentTaskSummary),
      deletedTasks: (state?.deletedTasks ?? []).map(toTaskFlowAgentTaskSummary),
      recentHistory: (state?.historyEntries ?? []).slice(0, 12).map((entry) => ({
        worldId: entry.worldId,
        actionName: entry.actionName,
        summary: entry.summary,
        kind: entry.kind,
        createdAt: entry.createdAt,
      })),
    };
  }

  private buildHoveredInspection(target: TaskFlowHoveredTarget): TaskFlowHoveredInspection | null {
    switch (target.kind) {
      case 'task-card': {
        const task = this.findTaskById(target.taskId);

        if (!task) {
          return null;
        }

        return {
          title: task.title,
          description:
            task.description ??
            `Status ${task.status}, priority ${task.priority}.`,
          metadata: [
            { label: 'Task ID', value: task.id },
            { label: 'Status', value: task.status },
            { label: 'Priority', value: task.priority },
            { label: 'Assignee', value: task.assignee ?? 'none' },
            { label: 'Due date', value: task.dueDate ?? 'none' },
          ],
        };
      }
      case 'header-action':
        return {
          title: target.label,
          description: (() => {
            switch (target.actionId) {
              case 'create-task':
                return 'Opens the create-task dialog so you can add a new task.';
              case 'date-filter':
                return 'Opens the date filter popover for due date or created date presets.';
              case 'history':
                return 'Opens the lineage history panel for recent commits and branch activity.';
            }
          })(),
          metadata: [
            { label: 'Action ID', value: target.actionId },
            { label: 'Available actions', value: target.availableActions.join(', ') },
          ],
        };
      case 'lineage-entry': {
        const entry =
          this.historyEntries.find((historyEntry) => historyEntry.worldId === target.worldId) ??
          null;

        return {
          title: target.label,
          description: target.summary,
          metadata: [
            { label: 'World ID', value: target.worldId },
            { label: 'Branch', value: target.branchName },
            { label: 'Action', value: target.actionName },
            {
              label: 'Created',
              value: entry ? new Date(entry.createdAt).toISOString() : 'unknown',
            },
          ],
        };
      }
    }
  }

  private activateHoveredTarget(): TaskFlowAgentToolResult | Promise<TaskFlowAgentToolResult> {
    const hoveredTarget = this.hoveredTarget;

    if (!hoveredTarget) {
      return {
        state: 'output-error',
        errorText: 'There is no hovered semantic target in the current TaskFlow context.',
      };
    }

    switch (hoveredTarget.kind) {
      case 'task-card':
        return this.executeAgentTool('select_task', { taskId: hoveredTarget.taskId });
      case 'header-action': {
        switch (hoveredTarget.actionId) {
          case 'create-task':
            this.setCreateDialogOpen(true);
            return {
              state: 'output-available',
              output: {
                ok: true,
                summary: 'Opened the create-task dialog.',
                hoveredTarget,
                uiAction: 'open_create_dialog',
              },
            };
          case 'date-filter':
            this.setDatePickerOpen(true);
            return {
              state: 'output-available',
              output: {
                ok: true,
                summary: 'Opened the date filter popover.',
                hoveredTarget,
                uiAction: 'open_date_filter',
              },
            };
          case 'history':
            this.setHistoryOpen(true);
            return {
              state: 'output-available',
              output: {
                ok: true,
                summary: 'Opened the lineage history panel.',
                hoveredTarget,
                uiAction: 'open_history',
              },
            };
        }
      }
      case 'lineage-entry':
        return {
          state: 'output-error',
          errorText:
            'Hovered lineage entries are read-only. I can inspect or search related history, but I cannot open or restore them directly.',
        };
    }
  }

  async executeAgentTool<T extends TaskFlowAssistantToolName>(
    toolName: T,
    input: TaskFlowAssistantUITools[T]['input'],
  ): Promise<TaskFlowAgentToolResult> {
    await this.start();

    switch (toolName) {
      case 'create_task': {
        const stamp = this.createIntentClock();
        const task = buildTaskFromDraft(
          buildTaskFromCreateToolInput(input as TaskFlowAssistantUITools['create_task']['input']),
          stamp,
        );

        if (!task) {
          return {
            state: 'output-error',
            errorText: 'A task title is required to create a task.',
          };
        }

        const beforeSnapshot = this.runtime ? captureTraceSnapshot(this.runtime) : null;
        const result = await this.commitMutationIntent(
          'createTask',
          (instance, commitStamp) => instance.createIntent(instance.MEL.actions.createTask, task, commitStamp),
          { task },
          stamp,
        );

        if (result.state === 'output-error') {
          return result;
        }

        return {
          state: 'output-available',
          output: {
            ok: true,
            summary: result.metadata.summary,
            taskId: task.id,
            title: task.title,
            status: task.status,
            snapshotDiff:
              beforeSnapshot && this.runtime
                ? buildSnapshotDiff(beforeSnapshot, captureTraceSnapshot(this.runtime), task.id)
                : undefined,
          },
        };
      }
      case 'update_task': {
        const stamp = this.createIntentClock();
        const existingTask = this.findTaskById(
          (input as TaskFlowAssistantUITools['update_task']['input']).taskId,
        );

        if (!existingTask) {
          return {
            state: 'output-error',
            errorText: 'The requested task could not be found in the current TaskFlow context.',
          };
        }

        const nextTask = buildUpdatedTaskFromToolInput(
          existingTask,
          input as TaskFlowAssistantUITools['update_task']['input'],
          stamp,
        );

        if (!nextTask) {
          return {
            state: 'output-error',
            errorText: 'Task updates must keep a non-empty title.',
          };
        }

        const beforeSnapshot = this.runtime ? captureTraceSnapshot(this.runtime) : null;
        const result = await this.commitMutationIntent(
          'updateTask',
          (instance, commitStamp) => instance.createIntent(instance.MEL.actions.updateTask, nextTask, commitStamp),
          { task: nextTask },
          stamp,
        );

        if (result.state === 'output-error') {
          return result;
        }

        return {
          state: 'output-available',
          output: {
            ok: true,
            summary: result.metadata.summary,
            taskId: nextTask.id,
            title: nextTask.title,
            status: nextTask.status,
            snapshotDiff:
              beforeSnapshot && this.runtime
                ? buildSnapshotDiff(
                    beforeSnapshot,
                    captureTraceSnapshot(this.runtime),
                    nextTask.id,
                  )
                : undefined,
          },
        };
      }
      case 'move_task': {
        const stamp = this.createIntentClock();
        const { taskId, newStatus } = input as TaskFlowAssistantUITools['move_task']['input'];
        const task = this.findTaskById(taskId);

        if (!task) {
          return {
            state: 'output-error',
            errorText: 'The requested task could not be found in the current TaskFlow context.',
          };
        }

        if (task.status === newStatus) {
          return {
            state: 'output-available',
            output: {
              ok: true,
              skipped: true,
              summary: `"${task.title}" is already in ${newStatus}.`,
              taskId,
              title: task.title,
              status: task.status,
              snapshotDiff: [],
            },
          };
        }

        const beforeSnapshot = this.runtime ? captureTraceSnapshot(this.runtime) : null;
        const result = await this.commitMutationIntent(
          'moveTask',
          (instance, commitStamp) => instance.createIntent(instance.MEL.actions.moveTask, taskId, newStatus, commitStamp),
          { taskId, newStatus },
          stamp,
        );

        if (result.state === 'output-error') {
          return result;
        }

        return {
          state: 'output-available',
          output: {
            ok: true,
            summary: result.metadata.summary,
            taskId,
            title: task.title,
            status: newStatus,
            snapshotDiff:
              beforeSnapshot && this.runtime
                ? buildSnapshotDiff(beforeSnapshot, captureTraceSnapshot(this.runtime), taskId)
                : undefined,
          },
        };
      }
      case 'delete_task': {
        const stamp = this.createIntentClock();
        const { taskId } = input as TaskFlowAssistantUITools['delete_task']['input'];
        const task = this.findTaskById(taskId);

        if (!task) {
          return {
            state: 'output-error',
            errorText: 'The requested task could not be found in the current TaskFlow context.',
          };
        }

        if (task.deletedAt) {
          return {
            state: 'output-error',
            errorText: `"${task.title}" is already in trash.`,
          };
        }

        const beforeSnapshot = this.runtime ? captureTraceSnapshot(this.runtime) : null;
        const result = await this.commitMutationIntent(
          'softDeleteTask',
          (instance, commitStamp) => instance.createIntent(instance.MEL.actions.softDeleteTask, taskId, commitStamp),
          { id: taskId },
          stamp,
        );

        if (result.state === 'output-error') {
          return result;
        }

        return {
          state: 'output-available',
          output: {
            ok: true,
            summary: result.metadata.summary,
            taskId,
            title: task.title,
            snapshotDiff:
              beforeSnapshot && this.runtime
                ? buildSnapshotDiff(beforeSnapshot, captureTraceSnapshot(this.runtime), taskId)
                : undefined,
          },
        };
      }
      case 'restore_task': {
        const stamp = this.createIntentClock();
        const { taskId } = input as TaskFlowAssistantUITools['restore_task']['input'];
        const task = this.findTaskById(taskId);

        if (!task) {
          return {
            state: 'output-error',
            errorText: 'The requested task could not be found in the current TaskFlow context.',
          };
        }

        if (!task.deletedAt) {
          return {
            state: 'output-error',
            errorText: `"${task.title}" is not currently in trash.`,
          };
        }

        const beforeSnapshot = this.runtime ? captureTraceSnapshot(this.runtime) : null;
        const result = await this.commitMutationIntent(
          'restoreTask',
          (instance, commitStamp) => instance.createIntent(instance.MEL.actions.restoreTask, taskId, commitStamp),
          { id: taskId },
          stamp,
        );

        if (result.state === 'output-error') {
          return result;
        }

        return {
          state: 'output-available',
          output: {
            ok: true,
            summary: result.metadata.summary,
            taskId,
            title: task.title,
            status: task.status,
            snapshotDiff:
              beforeSnapshot && this.runtime
                ? buildSnapshotDiff(beforeSnapshot, captureTraceSnapshot(this.runtime), taskId)
                : undefined,
          },
        };
      }
      case 'select_task': {
        const stamp = this.createIntentClock();
        const { taskId } = input as TaskFlowAssistantUITools['select_task']['input'];
        const task = this.findTaskById(taskId);

        if (!task) {
          return {
            state: 'output-error',
            errorText: 'The requested task could not be found in the current TaskFlow context.',
          };
        }

        const selectedTaskId = this.runtime?.getSnapshot().data.selectedTaskId ?? null;
        if (selectedTaskId === taskId) {
          return {
            state: 'output-available',
            output: {
              ok: true,
              skipped: true,
              summary: `"${task.title}" is already selected.`,
              taskId,
              title: task.title,
              status: task.status,
              snapshotDiff: [],
            },
          };
        }

        const beforeSnapshot = this.runtime ? captureTraceSnapshot(this.runtime) : null;
        const result = await this.commitUiIntent(
          'selectTask',
          (instance, commitStamp) => instance.createIntent(instance.MEL.actions.selectTask, taskId, commitStamp),
          { taskId },
          stamp,
        );

        if (result.state === 'output-error') {
          return result;
        }

        return {
          state: 'output-available',
          output: {
            ok: true,
            summary: result.metadata.summary,
            taskId,
            title: task.title,
            status: task.status,
            snapshotDiff:
              beforeSnapshot && this.runtime
                ? buildSnapshotDiff(beforeSnapshot, captureTraceSnapshot(this.runtime), taskId)
                : undefined,
          },
        };
      }
      case 'search_lineage': {
        const searchInput = input as TaskFlowAssistantUITools['search_lineage']['input'];
        const matches = searchLineageEntries({
          entries: this.historyEntries,
          activeBranchName: this.activeBranchName,
          query: searchInput.query,
          actionNames: searchInput.actionNames,
          kinds: searchInput.kinds,
          branchName: searchInput.branchName,
          onlyHeads: searchInput.onlyHeads,
          limit: searchInput.limit,
        });

        return {
          state: 'output-available',
          output: {
            ok: true,
            summary:
              matches.length > 0
                ? `Found ${matches.length} lineage entr${matches.length === 1 ? 'y' : 'ies'}.`
                : 'No lineage entries matched the requested search.',
            matches,
          },
        };
      }
      case 'inspect_hovered_target': {
        const hoveredTarget = this.hoveredTarget;

        if (!hoveredTarget) {
          return {
            state: 'output-error',
            errorText: 'There is no hovered semantic target in the current TaskFlow context.',
          };
        }

        const inspection = this.buildHoveredInspection(hoveredTarget);

        if (!inspection) {
          return {
            state: 'output-error',
            errorText: 'The hovered target could not be resolved in the current TaskFlow context.',
          };
        }

        return {
          state: 'output-available',
          output: {
            ok: true,
            summary: inspection.description,
            hoveredTarget,
            inspection,
          },
        };
      }
      case 'activate_hovered_target':
        return this.activateHoveredTarget();
      default:
        return {
          state: 'output-error',
          errorText: `Unsupported tool: ${String(toolName)}`,
        };
    }
  }

  loadAssistantMessages(): TaskFlowAssistantUIMessage[] {
    return loadPersistedAssistantMessages(this.storage);
  }

  saveAssistantMessages(messages: TaskFlowAssistantUIMessage[]): void {
    savePersistedAssistantMessages(this.storage, messages);
  }

  clearAssistantMessages(): void {
    clearPersistedAssistantMessages(this.storage);
  }

  private async initialize(): Promise<void> {
    const store = createInMemoryLineageStore();
    const persisted = loadPersistedLineageState(this.storage);

    if (persisted) {
      if (persisted.schemaHash !== TASKFLOW_SCHEMA_HASH) {
        clearPersistedLineageState(this.storage);
      } else {
        try {
          store.restoreState(deserializeLineageStoreState(persisted.runtimeStore));
          for (const [worldId, metadata] of persisted.historyMetadata) {
            this.historyMeta.set(worldId, metadata);
          }
        } catch (error) {
          console.error(error);
          clearPersistedLineageState(this.storage);
        }
      }
    }

    const lineageService = createLineageService(store);
    const runtime = withLineage(
      createManifesto<TaskFlowRuntimeDomain>(taskflowSchema, {}),
      { service: lineageService },
    ).activate();

    this.store = store;
    this.lineageService = lineageService;
    this.runtime = runtime;
    this.unsubscribeRuntime = runtime.subscribe(
      (snapshot) => extractState(snapshot),
      (nextState) => {
        this.runtimeState = nextState;
        this.rebuildState();
      },
    );

    await runtime.getActiveBranch();
    this.runtimeState = extractState(runtime.getSnapshot());

    if ((runtime.getSnapshot().data.tasks ?? []).length === 0) {
      for (const task of TASK_FIXTURES) {
        const referenceDate = new Date(task.updatedAt || task.createdAt);
        const intent = runtime.createIntent(
          runtime.MEL.actions.createTask,
          task,
          this.clockFactory(referenceDate),
        );
        await runtime.commitAsync(intent);
        const activeBranch = await runtime.getActiveBranch();

        this.historyMeta.set(activeBranch.head, {
          actionName: 'createTask',
          summary: `Seeded "${task.title}"`,
          kind: 'seed',
        });
      }
    }

    await this.refreshHistory();
    this.ready = true;
    this.rebuildState();
  }

  private async refreshHistory(overrideVisibleWorldId?: string | null): Promise<void> {
    if (!this.runtime || !this.lineageService) {
      return;
    }

    const activeBranch = await this.runtime.getActiveBranch();
    const [branches, heads, attempts] = await Promise.all([
      this.runtime.getBranches(),
      this.runtime.getHeads(),
      this.lineageService.getAttemptsByBranch(activeBranch.id),
    ]);

    this.activeBranchId = activeBranch.id;
    this.activeBranchName = activeBranch.name;
    this.visibleWorldId = overrideVisibleWorldId ?? activeBranch.head;
    this.historyEntries = buildHistoryEntries(
      attempts,
      branches,
      heads,
      this.visibleWorldId,
      this.historyMeta,
    );
    this.agentCausalGraph = buildAgentCausalGraph({
      activeBranch,
      branches,
      attempts,
      heads,
      visibleWorldId: this.visibleWorldId,
      metadataByWorldId: this.historyMeta,
    });
  }

  private rebuildState(options?: { persistRuntime?: boolean }): void {
    if (!this.runtimeState) {
      this.state = null;
      this.updateControllerSnapshot();
      this.emit();
      return;
    }

    this.state = {
      ...this.runtimeState,
      dateFilter: this.dateFilter,
      hoveredTarget: this.hoveredTarget,
      historyOpen: this.historyOpen,
      createDialogOpen: this.createDialogOpen,
      datePickerOpen: this.datePickerOpen,
      historyEntries: this.historyEntries,
      activeBranchName: this.activeBranchName,
      visibleWorldId: this.visibleWorldId,
    };

    this.updateControllerSnapshot();
    if (options?.persistRuntime !== false) {
      this.persistRuntimeState();
    }
    this.emit();
  }

  private updateControllerSnapshot(): void {
    this.controllerSnapshot = {
      ready: this.ready,
      state: this.state,
    };
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private persistRuntimeState(): void {
    if (!this.store) {
      return;
    }

    const value: PersistedLineageState = {
      schemaVersion: 2,
      schemaHash: TASKFLOW_SCHEMA_HASH,
      runtimeStore: serializeLineageStoreState(this.store.snapshotState()),
      historyMetadata: [...this.historyMeta.entries()],
    };

    savePersistedLineageState(this.storage, value);
  }

  private findTaskById(taskId: string): Task | null {
    return this.runtime?.getSnapshot().data.tasks?.find((task) => task.id === taskId) ?? null;
  }

  private createIntentClock(referenceDate?: Date): TaskFlowClockStamp {
    return this.clockFactory(referenceDate);
  }

  private async commitUiIntent(
    actionName: string,
    createIntent: (
      runtime: LineageInstance<TaskFlowRuntimeDomain>,
      stamp: TaskFlowClockStamp,
    ) => TypedIntent<TaskFlowRuntimeDomain>,
    payload: Record<string, unknown>,
    stamp = this.createIntentClock(),
  ): Promise<
    | {
        state: 'output-available';
        metadata: TaskFlowHistoryMeta;
      }
    | {
        state: 'output-error';
        errorText: string;
      }
  > {
    if (!this.runtime) {
      return {
        state: 'output-error',
        errorText: 'TaskFlow runtime is not ready yet.',
      };
    }

    const metadata = describeAction(actionName, this.runtime, payload);
    const result = await this.commitIntent(createIntent, metadata, stamp);

    if (!result.ok) {
      return {
        state: 'output-error',
        errorText: result.errorText,
      };
    }

    return {
      state: 'output-available',
      metadata,
    };
  }

  private async commitMutationIntent(
    actionName: string,
    createIntent: (
      runtime: LineageInstance<TaskFlowRuntimeDomain>,
      stamp: TaskFlowClockStamp,
    ) => TypedIntent<TaskFlowRuntimeDomain>,
    payload: Record<string, unknown>,
    stamp = this.createIntentClock(),
  ): Promise<
    | {
        state: 'output-available';
        metadata: TaskFlowHistoryMeta;
      }
    | {
        state: 'output-error';
        errorText: string;
      }
  > {
    if (!this.runtime) {
      return {
        state: 'output-error',
        errorText: 'TaskFlow runtime is not ready yet.',
      };
    }

    const metadata = describeAction(actionName, this.runtime, payload);
    const result = await this.commitIntent(createIntent, metadata, stamp);

    if (!result.ok) {
      return {
        state: 'output-error',
        errorText: result.errorText,
      };
    }

    return {
      state: 'output-available',
      metadata,
    };
  }

  private async commitIntent(
    createIntent: (
      runtime: LineageInstance<TaskFlowRuntimeDomain>,
      stamp: TaskFlowClockStamp,
    ) => TypedIntent<TaskFlowRuntimeDomain>,
    metadata: TaskFlowHistoryMeta,
    stamp: TaskFlowClockStamp,
  ): Promise<{ ok: true } | { ok: false; errorText: string }> {
    if (!this.runtime || !this.lineageService) {
      return {
        ok: false,
        errorText: 'TaskFlow runtime is not ready yet.',
      };
    }

    try {
      const intent = createIntent(this.runtime, stamp);
      const blockers = this.runtime.whyNot(intent);

      if (blockers) {
        return {
          ok: false,
          errorText:
            blockers[0]?.description ??
            'The requested action is blocked by the current TaskFlow state.',
        };
      }

      await this.runtime.commitAsync(intent);

      const activeBranch = await this.runtime.getActiveBranch();
      this.visibleWorldId = activeBranch.head;
      this.historyMeta.set(activeBranch.head, metadata);
      this.runtimeState = extractState(this.runtime.getSnapshot());
      await this.refreshHistory(activeBranch.head);
      this.rebuildState();

      return { ok: true };
    } catch (error) {
      console.error(error);
      return {
        ok: false,
        errorText: 'TaskFlow could not apply that change.',
      };
    }
  }

  private async createTaskFromDraft(draft: TaskDraft): Promise<void> {
    const stamp = this.createIntentClock();
    const task = buildTaskFromDraft(draft, stamp);
    if (!task) {
      return;
    }

    await this.commitMutationIntent(
      'createTask',
      (instance, commitStamp) => instance.createIntent(instance.MEL.actions.createTask, task, commitStamp),
      { task },
      stamp,
    );
  }

  private async updateTaskFromDraft(id: string, draft: TaskDraft): Promise<void> {
    const existingTask = this.findTaskById(id);
    if (!existingTask) {
      return;
    }

    const stamp = this.createIntentClock();
    const task = buildTaskFromDraft(draft, stamp, existingTask);
    if (!task) {
      return;
    }

    await this.commitMutationIntent(
      'updateTask',
      (instance, commitStamp) => instance.createIntent(instance.MEL.actions.updateTask, task, commitStamp),
      { task },
      stamp,
    );
  }

  private async moveTask(taskId: string, newStatus: TaskStatus): Promise<void> {
    if (!this.findTaskById(taskId)) {
      return;
    }

    await this.commitMutationIntent(
      'moveTask',
      (instance, stamp) => instance.createIntent(instance.MEL.actions.moveTask, taskId, newStatus, stamp),
      { taskId, newStatus },
    );
  }

  private async softDeleteTask(id: string): Promise<void> {
    if (!this.findTaskById(id)) {
      return;
    }

    await this.commitMutationIntent(
      'softDeleteTask',
      (instance, stamp) => instance.createIntent(instance.MEL.actions.softDeleteTask, id, stamp),
      { id },
    );
  }

  private async restoreTask(id: string): Promise<void> {
    if (!this.findTaskById(id)) {
      return;
    }

    await this.commitMutationIntent(
      'restoreTask',
      (instance, stamp) => instance.createIntent(instance.MEL.actions.restoreTask, id, stamp),
      { id },
    );
  }

  private async permanentlyDeleteTask(id: string): Promise<void> {
    if (!this.findTaskById(id)) {
      return;
    }

    await this.commitMutationIntent(
      'permanentlyDeleteTask',
      (instance, stamp) => instance.createIntent(instance.MEL.actions.permanentlyDeleteTask, id, stamp),
      { id },
    );
  }

  private async emptyTrash(): Promise<void> {
    await this.commitMutationIntent(
      'emptyTrash',
      (instance, stamp) => instance.createIntent(instance.MEL.actions.emptyTrash, stamp),
      {},
    );
  }
}

let controllerSingleton: TaskFlowRuntimeController | null = null;

export function createTaskFlowRuntimeController(options?: {
  storage?: StorageLike | null;
  clockFactory?: TaskFlowClockFactory;
}): TaskFlowRuntimeController {
  return new TaskFlowRuntimeController(options);
}

export function getTaskFlowRuntimeController(): TaskFlowRuntimeController {
  controllerSingleton ??= new TaskFlowRuntimeController();
  return controllerSingleton;
}
