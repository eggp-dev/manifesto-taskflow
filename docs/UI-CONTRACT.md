# TaskFlow UI Contract

This document defines the state and action contract that the TaskFlow UI consumes today. For the higher-level Manifesto integration story, see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Core Types

The main app-facing types live in [`src/types/taskflow.ts`](../src/types/taskflow.ts):

- `Task`
- `TaskDraft`
- `TaskStatus`
- `TaskPriority`
- `ViewMode`
- `DateFilter`
- `TaskFlowClockStamp`
- `TaskFlowHistoryEntry`

Assistant-facing contract types live in [`src/types/taskflow-assistant.ts`](../src/types/taskflow-assistant.ts), including:

- `TaskFlowAgentContext`
- `TaskFlowHoveredTarget`
- `TaskFlowAssistantUIMessage`

WebMCP-facing contract types live in [`src/types/taskflow-webmcp.ts`](../src/types/taskflow-webmcp.ts), including:

- `TaskFlowWebMcpContext`
- `TaskFlowWebMcpNotification`
- `TaskFlowWebMcpDeleteInput`
- `TaskFlowWebMcpToolResult`

## Runtime-Backed View State

[`useTaskFlow`](../src/hooks/useTaskFlow.ts) returns:

- `ready: boolean`
- `state: TaskFlowViewState | null`
- `actions: TaskFlowActions`

`TaskFlowViewState` is assembled by [`TaskFlowRuntimeController`](../src/lib/taskflow-runtime-controller.ts) from the live Manifesto snapshot plus controller-owned UI state.

The runtime-backed portion of the view state includes:

- base state: `tasks`, `selectedTaskId`, `viewMode`, `assistantOpen`, `clock`
- derived task projections:
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
- derived counts:
  - `totalCount`
  - `todoCount`
  - `inProgressCount`
  - `reviewCount`
  - `doneCount`
  - `deletedCount`
  - `dueTodayCount`
  - `overdueCount`
- lineage-backed context:
  - `historyEntries`
  - `activeBranchName`
  - `visibleWorldId`

This state is snapshot-driven and remains aligned with the activated MEL domain.

## Ephemeral UI Session State

Some UI state is intentionally not lineaged and not persisted as domain snapshot state.

Ephemeral session fields exposed through `TaskFlowViewState`:

- `dateFilter`
- `hoveredTarget`
- `historyOpen`
- `createDialogOpen`
- `datePickerOpen`

Important boundary:

- `hoveredTarget` is semantic assistant grounding state only
- it is not written to MEL state
- it is not stored in lineage worlds
- it is cleared on session reset

Hover registration itself is handled through [`useTaskFlowSemanticHoverTarget`](../src/hooks/useTaskFlowSemanticHoverTarget.ts).

## UI Action Surface

The UI writes through `TaskFlowActions`, exposed from [`useTaskFlow`](../src/hooks/useTaskFlow.ts).

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

Contract rule:

- lineaged actions commit through the client runtime and appear in history
- client-only UI actions do not create lineage worlds

## Assistant Contract

[`useTaskFlowAssistant`](../src/hooks/useTaskFlowAssistant.ts) is the assistant-facing UI seam.

Client responsibility:

- prepare the latest `TaskFlowAgentContext`
- execute tool calls against the local runtime
- persist assistant chat locally
- gate `delete_task` behind explicit confirmation

Server responsibility:

- validate the request payload
- construct the system prompt
- register tool schemas
- stream model output and tool calls

The assistant tool surface is:

- CRUD tools:
  - `create_task`
  - `update_task`
  - `move_task`
  - `delete_task`
  - `restore_task`
  - `select_task`
- lineage read tool:
  - `search_lineage`
  - `task_brief_list`
- hover tools:
  - `inspect_hovered_target`
  - `activate_hovered_target`

`TaskFlowAgentContext` includes:

- raw snapshot data/computed/system
- active and deleted task summaries
- counts
- recent history
- causal graph
- selected task
- hovered semantic target

## WebMCP Contract

[`useTaskFlowWebMcp`](../src/hooks/useTaskFlowWebMcp.ts) boots a browser-side WebMCP bridge over the same controller contract.

Client responsibility:

- feature-detect `navigator.modelContext`
- retry bridge startup after later user activation if `modelContext` was unavailable on first mount
- register imperative WebMCP tools for the current tab through `registerTool(..., { signal })`
- execute WebMCP tool calls against the local runtime

Internal ownership is split explicitly:

- [`TaskFlowToolGateway`](../src/lib/taskflow-tool-gateway.ts) is the shared runtime-facing tool seam
- [`taskflow-webmcp-service.ts`](../src/lib/taskflow-webmcp-service.ts) owns lifecycle, registration ownership, and debug state
- [`webmcp-host-adapter.ts`](../src/lib/webmcp-host-adapter.ts) owns `navigator.modelContext`

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

`TaskFlowWebMcpContext` includes:

- `contextVersion`
- the full `TaskFlowAgentContext` payload
- non-lineaged UI state under `uiState`

`TaskFlowWebMcpNotification` is the compact invalidation payload. It contains:

- `contextVersion`
- selected task id
- hovered target
- counts
- branch and visible world ids
- UI session flags

WebMCP-specific behavior:

- `delete_task` uses a two-step confirmation handshake with `confirmed?: boolean`
- `get_taskflow_context` is the authoritative host-facing read seam
- tool registrations are long-lived and self-owned by the bridge; they are not re-registered on every runtime state change
- WebMCP activation never moves state ownership off the client runtime
- `window.__taskflowWebMcp` is a dev inspection aid owned by the service, not part of the product contract

## Component Expectations

[`TaskFlowPageClient`](../src/components/taskflow/TaskFlowPageClient.tsx) composes the application around this contract.

View components:

- Todo, Kanban, and Table consume filtered active tasks plus selection state
- Trash consumes deleted tasks and destructive actions
- Task detail consumes the selected task and save/delete callbacks

Assistant components:

- the assistant panel consumes live `TaskFlowAssistantUIMessage[]`
- tool cards render step state, results, lineage matches, inspections, and collapsible snapshot diffs
- hovered references can be resolved to tasks, header actions, or lineage entries

History components:

- `LineagePanel` consumes `historyEntries`, active branch information, and the currently hovered lineage world
- it behaves as a read-only explorer, not a restore or branch-management UI

## Explicit Boundaries

- There is no server-owned canonical runtime.
- There is no shared persistence or collaborative state.
- Assistant operations are grounded in the local client runtime only.
- WebMCP operations are grounded in the same local client runtime only.
- Hover context is ephemeral and local.
- The assistant cannot restore worlds, switch branches, or directly activate lineage entries.
