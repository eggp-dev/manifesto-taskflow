# TaskFlow UI Contract

This document defines the preserved shell boundary for the next SDK `3.8.x` rebuild.

## Core Types

These app-facing types remain the source of truth:

- `TaskStatus`
- `TaskPriority`
- `ViewMode`
- `DateFilter`
- `Task`
- `AssistantMessage`

They live in [`src/types/taskflow.ts`](../src/types/taskflow.ts).

## Shell State

The active controller is local-only and fixture-backed. The base state is:

- `tasks: Task[]`
- `selectedTaskId: string | null`
- `viewMode: ViewMode`
- `dateFilter: DateFilter | null`
- `assistantOpen: boolean`

Derived state is computed locally from that base:

- `selectedTask`
- `activeTasks`
- `deletedTasks`
- `todoTasks`
- `inProgressTasks`
- `reviewTasks`
- `doneTasks`
- `totalCount`
- `todoCount`
- `inProgressCount`
- `reviewCount`
- `doneCount`
- `deletedCount`

Implementation seam:

- [`src/lib/taskflow-shell-state.ts`](../src/lib/taskflow-shell-state.ts)
- [`src/hooks/useTaskFlow.ts`](../src/hooks/useTaskFlow.ts)

## Supported Actions

The shell action surface is intentionally narrow:

- `selectTask(id | null)`
- `changeView(mode)`
- `setDateFilter(filter | null)`
- `moveTask(taskId, newStatus)`
- `softDeleteTask(id)`
- `restoreTask(id)`
- `permanentlyDeleteTask(id)`
- `emptyTrash()`
- `toggleAssistant(open)`

There is no `dispatch`, runtime instance, intent layer, persistence layer, or network API in the active app path.

## Component Expectations

[`src/app/page.tsx`](../src/app/page.tsx) composes the preserved shell and expects:

- local shell state from `useTaskFlow`
- date-filtered active task lists
- responsive detail and assistant panels

Surviving view/sidebar/assistant components remain props-driven:

- Kanban/Todo/Table render active tasks and selection state
- Trash renders deleted tasks and destructive actions
- Task detail renders the selected task
- Assistant renders static disabled-shell messaging and does not execute requests

## Explicit Non-Goals

- No SDK activation
- No intent parsing or lowering
- No `/api/agent` routes
- No legacy runtime restore for convenience

## Domain Source

The shell still does not execute a Manifesto runtime, but the domain source is present and wired into Next for compile/codegen:

- [`src/domain/taskflow.mel`](../src/domain/taskflow.mel)
- [`src/domain/taskflow.schema.ts`](../src/domain/taskflow.schema.ts)
- [`src/domain/taskflow.domain.ts`](../src/domain/taskflow.domain.ts)

That seam exists so the app uses a real `.mel` import path and webpack codegen stays current while the runtime rebuild is pending.
