'use client';

import { useEffect, useRef, useState } from 'react';
import { createManifesto } from '@manifesto-ai/sdk';
import type {
  Snapshot,
  TypedIntent,
} from '@manifesto-ai/sdk';
import {
  createInMemoryLineageStore,
  withLineage,
  type LineageInstance,
} from '@manifesto-ai/lineage';
import {
  createLineageService,
  type BranchInfo,
  type LineageService,
  type SealAttempt,
  type WorldHead,
} from '@manifesto-ai/lineage/provider';
import taskflowSchema from '@/domain/taskflow.schema';
import { TASK_FIXTURES } from '@/lib/taskflow-fixtures';
import type {
  DateFilter,
  Task,
  TaskDraft,
  TaskFlowHistoryEntry,
  TaskFlowHistoryKind,
  TaskStatus,
  ViewMode,
} from '@/types/taskflow';
import type { TaskFlowRuntimeDomain } from '@/types/taskflow-runtime';

type TaskFlowRuntimeState = TaskFlowRuntimeDomain['state'] &
  TaskFlowRuntimeDomain['computed'];

type TaskFlowHistoryMeta = {
  actionName: string;
  summary: string;
  kind: TaskFlowHistoryKind;
};

export type TaskFlowActions = {
  createTask: (draft: TaskDraft) => void;
  updateTask: (id: string, draft: TaskDraft) => void;
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

export type TaskFlowViewState = TaskFlowRuntimeState & {
  dateFilter: DateFilter | null;
  historyEntries: TaskFlowHistoryEntry[];
  activeBranchName: string | null;
  visibleWorldId: string | null;
};

export type UseTaskFlowResult = {
  ready: boolean;
  state: TaskFlowViewState | null;
  actions: TaskFlowActions;
};

function extractState(
  snapshot: Snapshot<TaskFlowRuntimeDomain['state']>,
): TaskFlowRuntimeState {
  const computed = snapshot.computed as TaskFlowRuntimeDomain['computed'];

  return {
    tasks: snapshot.data.tasks ?? [],
    selectedTaskId: snapshot.data.selectedTaskId ?? null,
    viewMode: snapshot.data.viewMode ?? 'kanban',
    assistantOpen: snapshot.data.assistantOpen ?? false,
    activeTasks: computed.activeTasks ?? [],
    deletedTasks: computed.deletedTasks ?? [],
    todoTasks: computed.todoTasks ?? [],
    inProgressTasks: computed.inProgressTasks ?? [],
    reviewTasks: computed.reviewTasks ?? [],
    doneTasks: computed.doneTasks ?? [],
    selectedTask: computed.selectedTask ?? null,
    totalCount: computed.totalCount ?? 0,
    todoCount: computed.todoCount ?? 0,
    inProgressCount: computed.inProgressCount ?? 0,
    reviewCount: computed.reviewCount ?? 0,
    doneCount: computed.doneCount ?? 0,
    deletedCount: computed.deletedCount ?? 0,
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

function normalizeOptionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDueDate(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = new Date(`${trimmed}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeTags(tags: readonly string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function buildTaskFromDraft(draft: TaskDraft, existingTask?: Task): Task | null {
  const title = draft.title.trim();
  if (title.length === 0) {
    return null;
  }

  const timestamp = new Date().toISOString();

  return {
    id: existingTask?.id ?? crypto.randomUUID(),
    title,
    description: normalizeOptionalText(draft.description),
    status: draft.status,
    priority: draft.priority,
    assignee: normalizeOptionalText(draft.assignee),
    dueDate: normalizeDueDate(draft.dueDate),
    tags: normalizeTags(draft.tags),
    createdAt: existingTask?.createdAt ?? timestamp,
    updatedAt: timestamp,
    deletedAt: existingTask?.deletedAt ?? null,
  };
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

export function useTaskFlow(): UseTaskFlowResult {
  const runtimeRef = useRef<LineageInstance<TaskFlowRuntimeDomain> | null>(null);
  const lineageServiceRef = useRef<LineageService | null>(null);
  const historyMetaRef = useRef<Map<string, TaskFlowHistoryMeta>>(new Map());
  const visibleWorldIdRef = useRef<string | null>(null);

  const [ready, setReady] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(null);
  const [runtimeState, setRuntimeState] = useState<TaskFlowRuntimeState | null>(null);
  const [historyEntries, setHistoryEntries] = useState<TaskFlowHistoryEntry[]>([]);
  const [activeBranchName, setActiveBranchName] = useState<string | null>(null);
  const [visibleWorldId, setVisibleWorldId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refreshHistory = async (overrideVisibleWorldId?: string | null) => {
      const runtime = runtimeRef.current;
      const lineageService = lineageServiceRef.current;

      if (!runtime || !lineageService || cancelled) {
        return;
      }

      const activeBranch = await runtime.getActiveBranch();
      const [branches, heads, attempts] = await Promise.all([
        runtime.getBranches(),
        runtime.getHeads(),
        lineageService.getAttemptsByBranch(activeBranch.id),
      ]);

      if (cancelled) {
        return;
      }

      const visibleWorldId = overrideVisibleWorldId ?? visibleWorldIdRef.current;

      setActiveBranchName(activeBranch.name);
      setHistoryEntries(
        buildHistoryEntries(
          attempts,
          branches,
          heads,
          visibleWorldId,
          historyMetaRef.current,
        ),
      );
    };

    const createRuntime = async () => {
      const store = createInMemoryLineageStore();
      const lineageService = createLineageService(store);
      const runtime = withLineage(
        createManifesto<TaskFlowRuntimeDomain>(taskflowSchema, {}),
        { service: lineageService },
      ).activate();

      runtimeRef.current = runtime;
      lineageServiceRef.current = lineageService;

      const unsubscribe = runtime.subscribe(
        (snapshot) => extractState(snapshot),
        (nextState) => {
          if (!cancelled) {
            setRuntimeState(nextState);
          }
        },
      );

      await runtime.getActiveBranch();

      if (cancelled) {
        unsubscribe();
        runtime.dispose();
        return;
      }

      setRuntimeState(extractState(runtime.getSnapshot()));

      if ((runtime.getSnapshot().data.tasks ?? []).length === 0) {
        for (const task of TASK_FIXTURES) {
          const intent = runtime.createIntent(runtime.MEL.actions.createTask, task);
          await runtime.commitAsync(intent);
          const activeBranch = await runtime.getActiveBranch();

          historyMetaRef.current.set(activeBranch.head, {
            actionName: 'createTask',
            summary: `Seeded "${task.title}"`,
            kind: 'seed',
          });
          visibleWorldIdRef.current = activeBranch.head;
          setVisibleWorldId(activeBranch.head);
        }

        setRuntimeState(extractState(runtime.getSnapshot()));
      } else {
        const activeBranch = await runtime.getActiveBranch();
        visibleWorldIdRef.current = activeBranch.head;
        setVisibleWorldId(activeBranch.head);
      }

      await refreshHistory(visibleWorldIdRef.current);

      if (!cancelled) {
        setReady(true);
      }

      return () => {
        unsubscribe();
        runtime.dispose();
      };
    };

    let cleanup: (() => void) | undefined;

    void createRuntime().then((result) => {
      cleanup = result;
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  const commitIntent = async (
    createIntent: (
      runtime: LineageInstance<TaskFlowRuntimeDomain>,
    ) => TypedIntent<TaskFlowRuntimeDomain>,
    metadata: TaskFlowHistoryMeta,
  ) => {
    const runtime = runtimeRef.current;
    const lineageService = lineageServiceRef.current;

    if (!runtime || !lineageService) {
      return;
    }

    try {
      const intent = createIntent(runtime);
      await runtime.commitAsync(intent);

      const activeBranch = await runtime.getActiveBranch();
      visibleWorldIdRef.current = activeBranch.head;
      setVisibleWorldId(activeBranch.head);
      historyMetaRef.current.set(activeBranch.head, metadata);
      setRuntimeState(extractState(runtime.getSnapshot()));

      const [branches, heads, attempts] = await Promise.all([
        runtime.getBranches(),
        runtime.getHeads(),
        lineageService.getAttemptsByBranch(activeBranch.id),
      ]);

      setActiveBranchName(activeBranch.name);
      setHistoryEntries(
        buildHistoryEntries(
          attempts,
          branches,
          heads,
          activeBranch.head,
          historyMetaRef.current,
        ),
      );
    } catch (error) {
      console.error(error);
    }
  };

  const actions: TaskFlowActions = {
    createTask(draft) {
      const runtime = runtimeRef.current;
      if (!runtime) {
        return;
      }

      const task = buildTaskFromDraft(draft);
      if (!task) {
        return;
      }

      const metadata = describeAction('createTask', runtime, { task });
      void commitIntent(
        (instance) => instance.createIntent(instance.MEL.actions.createTask, task),
        metadata,
      );
    },
    updateTask(id, draft) {
      const runtime = runtimeRef.current;
      if (!runtime) {
        return;
      }

      const existingTask = runtime.getSnapshot().data.tasks?.find((task) => task.id === id);
      if (!existingTask) {
        return;
      }

      const task = buildTaskFromDraft(draft, existingTask);
      if (!task) {
        return;
      }

      const metadata = describeAction('updateTask', runtime, { task });
      void commitIntent(
        (instance) => instance.createIntent(instance.MEL.actions.updateTask, task),
        metadata,
      );
    },
    selectTask(taskId) {
      const runtime = runtimeRef.current;
      if (!runtime) {
        return;
      }

      const metadata = describeAction('selectTask', runtime, { taskId });
      void commitIntent(
        (instance) => instance.createIntent(instance.MEL.actions.selectTask, taskId),
        metadata,
      );
    },
    changeView(mode) {
      const runtime = runtimeRef.current;
      if (!runtime) {
        return;
      }

      const metadata = describeAction('changeView', runtime, { mode });
      void commitIntent(
        (instance) => instance.createIntent(instance.MEL.actions.changeView, mode),
        metadata,
      );
    },
    setDateFilter(filter) {
      setDateFilter(filter);
    },
    moveTask(taskId, newStatus) {
      const runtime = runtimeRef.current;
      if (!runtime) {
        return;
      }

      const metadata = describeAction('moveTask', runtime, { taskId, newStatus });
      void commitIntent(
        (instance) => instance.createIntent(instance.MEL.actions.moveTask, taskId, newStatus),
        metadata,
      );
    },
    softDeleteTask(id) {
      const runtime = runtimeRef.current;
      if (!runtime) {
        return;
      }

      const timestamp = new Date().toISOString();
      const metadata = describeAction('softDeleteTask', runtime, { id });
      void commitIntent(
        (instance) => instance.createIntent(instance.MEL.actions.softDeleteTask, id, timestamp),
        metadata,
      );
    },
    restoreTask(id) {
      const runtime = runtimeRef.current;
      if (!runtime) {
        return;
      }

      const metadata = describeAction('restoreTask', runtime, { id });
      void commitIntent(
        (instance) => instance.createIntent(instance.MEL.actions.restoreTask, id),
        metadata,
      );
    },
    permanentlyDeleteTask(id) {
      const runtime = runtimeRef.current;
      if (!runtime) {
        return;
      }

      const metadata = describeAction('permanentlyDeleteTask', runtime, { id });
      void commitIntent(
        (instance) => instance.createIntent(instance.MEL.actions.permanentlyDeleteTask, id),
        metadata,
      );
    },
    emptyTrash() {
      const runtime = runtimeRef.current;
      if (!runtime) {
        return;
      }

      const metadata = describeAction('emptyTrash', runtime, {});
      void commitIntent(
        (instance) => instance.createIntent(instance.MEL.actions.emptyTrash),
        metadata,
      );
    },
    toggleAssistant(open) {
      const runtime = runtimeRef.current;
      if (!runtime) {
        return;
      }

      const metadata = describeAction('toggleAssistant', runtime, { open });
      void commitIntent(
        (instance) => instance.createIntent(instance.MEL.actions.toggleAssistant, open),
        metadata,
      );
    },
  };

  if (!runtimeState) {
    return {
      ready,
      state: null,
      actions,
    };
  }

  return {
    ready,
      state: {
        ...runtimeState,
        dateFilter,
        historyEntries,
        activeBranchName,
        visibleWorldId,
      },
    actions,
  };
}
