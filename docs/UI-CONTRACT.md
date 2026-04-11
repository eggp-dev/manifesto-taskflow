# TaskFlow UI Contract

This document describes the UI-facing state and action contract. For the system-level integration story, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Core Types

From [`src/types/taskflow.ts`](../src/types/taskflow.ts):

- `Task`
- `TaskDraft`
- `TaskStatus`
- `TaskPriority`
- `ViewMode`
- `DateFilter`
- `TaskFlowClockStamp`
- `TaskFlowHistoryEntry`

From [`src/types/taskflow-assistant.ts`](../src/types/taskflow-assistant.ts):

- `TaskFlowAgentContext`
- `TaskFlowHoveredTarget`
- `TaskFlowAssistantUIMessage`

From [`src/types/taskflow-webmcp.ts`](../src/types/taskflow-webmcp.ts):

- `TaskFlowWebMcpContext`
- `TaskFlowWebMcpNotification`
- `TaskFlowWebMcpDeleteInput`
- `TaskFlowWebMcpToolResult`

## `useTaskFlow`

[`useTaskFlow`](../src/hooks/useTaskFlow.ts) returns:

- `ready: boolean`
- `state: TaskFlowViewState | null`
- `actions: TaskFlowActions`

## Runtime-Backed View State

Base state:

- `tasks`
- `selectedTaskId`
- `viewMode`
- `assistantOpen`
- `clock`

Derived task views:

- `activeTasks`
- `deletedTasks`
- `todoTasks`
- `inProgressTasks`
- `reviewTasks`
- `doneTasks`
- `schedulableTasks`
- `dueTodayTasks`
- `overdueTasks`
- `selectedTask`

Derived counts:

- `totalCount`
- `todoCount`
- `inProgressCount`
- `reviewCount`
- `doneCount`
- `deletedCount`
- `dueTodayCount`
- `overdueCount`

Lineage-backed context:

- `historyEntries`
- `activeBranchName`
- `visibleWorldId`

## Ephemeral UI Session State

- `dateFilter`
- `hoveredTarget`
- `historyOpen`
- `createDialogOpen`
- `datePickerOpen`

`hoveredTarget` is local assistant-grounding state only. It is not written to MEL or Lineage and is cleared on session reset.

## Action Surface

Lineaged actions:

- `createTask(draft)`
- `updateTask(id, draft)`
- `selectTask(taskId | null)`
- `changeView(mode)`
- `moveTask(taskId, newStatus)`
- `softDeleteTask(id)`
- `restoreTask(id)`
- `permanentlyDeleteTask(id)`
- `emptyTrash()`
- `toggleAssistant(open)`

Client-only UI actions:

- `setDateFilter(filter | null)`
- `setHistoryOpen(open)`
- `setCreateDialogOpen(open)`
- `setDatePickerOpen(open)`

Lineaged actions commit through the client runtime and appear in history. Client-only UI actions do not create lineage worlds.

## Assistant Contract

Client responsibilities:

- build `TaskFlowAgentContext`
- execute tool calls against the local runtime
- persist assistant chat locally
- require explicit confirmation for `delete_task`

Server responsibilities:

- validate request payload
- build the prompt
- register tool schemas
- stream model output and tool calls

Assistant tool surface:

- `create_task`
- `update_task`
- `move_task`
- `delete_task`
- `restore_task`
- `select_task`
- `search_lineage`
- `task_brief_list`
- `inspect_hovered_target`
- `activate_hovered_target`

`TaskFlowAgentContext` includes snapshot payload, task summaries, counts, recent history, causal graph, selected task, and hovered target.

## WebMCP Contract

Internal ownership:

- [`TaskFlowToolGateway`](../src/lib/taskflow-tool-gateway.ts): shared runtime-facing tool seam
- [`taskflow-webmcp-service.ts`](../src/lib/taskflow-webmcp-service.ts): lifecycle and debug state
- [`webmcp-host-adapter.ts`](../src/lib/webmcp-host-adapter.ts): `navigator.modelContext`

WebMCP tool surface:

- `get_taskflow_context`
- `create_task`
- `update_task`
- `move_task`
- `delete_task`
- `restore_task`
- `select_task`
- `search_lineage`
- `task_brief_list`
- `inspect_hovered_target`
- `activate_hovered_target`

`TaskFlowWebMcpContext` contains `contextVersion`, full `TaskFlowAgentContext`, and `uiState`.

`TaskFlowWebMcpNotification` contains `contextVersion`, selection, hover, counts, branch/world ids, and UI session flags.

WebMCP-specific rules:

- `delete_task` uses a two-step confirmation handshake
- `get_taskflow_context` is the authoritative host-facing read seam
- tool registrations are long-lived and not refreshed on each state change
- `window.__taskflowWebMcp` is a dev aid, not a product contract

## Boundaries

- There is no server-owned canonical runtime.
- There is no shared persistence or collaborative state.
- Assistant operations are grounded in the local client runtime only.
- WebMCP operations are grounded in the same local client runtime only.
- Hover context is local and ephemeral.
- Assistant and WebMCP do not restore worlds or switch branches.
