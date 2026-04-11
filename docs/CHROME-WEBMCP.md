# TaskFlow as a Chrome WebMCP Showcase

This document explains why TaskFlow is a strong Chrome WebMCP showcase and how the current implementation is structured.

TaskFlow is not using WebMCP as a bolt-on demo. The app already had the hard part in place before the browser integration was added:

- a client-owned Manifesto runtime
- a stable task and lineage contract
- a runtime-backed UI that updates from the same snapshot the tools mutate
- a local tool execution path that does not require a server-owned state replica

That combination is exactly why WebMCP fits this codebase cleanly.

## Manifesto <> WebMCP Integration

The integration point is simple to describe and important to preserve:

- Manifesto owns domain meaning, transition legality, and snapshot projection
- Lineage records meaningful committed continuity
- WebMCP exposes that already-grounded runtime contract to a browser host

TaskFlow therefore does **not** use WebMCP to invent a second agent API beside the app. It uses WebMCP to publish the same runtime-backed capability surface the app already trusts.

In TaskFlow, the integration chain is:

1. [`taskflow.mel`](../src/domain/taskflow.mel) defines state, actions, and computed projections.
2. [`TaskFlowRuntimeController`](../src/lib/taskflow-runtime-controller.ts) activates the Manifesto + Lineage runtime in the browser and turns snapshots into the app-facing view contract.
3. [`TaskFlowToolGateway`](../src/lib/taskflow-tool-gateway.ts) exposes runtime reads and writes through a stable tool seam.
4. [`taskflow-webmcp-service.ts`](../src/lib/taskflow-webmcp-service.ts) and [`webmcp-host-adapter.ts`](../src/lib/webmcp-host-adapter.ts) publish that seam through Chrome WebMCP.

That is the architectural point of the showcase:

- Manifesto stays the source of truth
- WebMCP stays a transport and host-integration layer
- neither layer has to impersonate the other

## What the Integration Buys You

This integration is valuable because it avoids the usual failure modes of browser agent demos.

### 1. One state model instead of two

Without Manifesto in the middle, WebMCP tools often end up targeting ad hoc page state, DOM-derived state, or imperative UI handlers.

TaskFlow avoids that. The WebMCP tool surface is grounded in the same runtime contract used by:

- the visible React UI
- the in-app ChatUI assistant
- lineage/history features

That means the browser host is not acting on a shadow API. It is acting on the real product state model.

### 2. Tool legality and state semantics are already defined

Manifesto already gives the app:

- explicit actions
- explicit computed reads
- explicit snapshot shape
- a stable intent path for mutations

WebMCP therefore does not need to invent semantics such as:

- what "select task" means
- what state is read when listing tasks
- how a status move should affect the visible UI

The semantics are already defined by the runtime contract.

### 3. UI and agent state stay synchronized by construction

Because tool execution runs against the client-owned runtime, the page does not need a separate reconciliation system to reflect agent-driven changes.

When a WebMCP host calls a tool:

- the tool executes against the same runtime the UI reads
- the runtime snapshot changes
- the UI re-renders from that snapshot
- lineage/history updates from the same commit path

That is a stronger integration story than DOM automation or host-side state mirroring.

### 4. Lineage makes the browser integration explainable

Manifesto alone gives a clear runtime contract. Lineage adds visible continuity.

That means WebMCP in TaskFlow is not limited to "do something". It can also expose:

- what changed
- what was selected
- what history led to the current state
- which lineage entries match a query

For a showcase, this matters because it turns WebMCP from a thin command pipe into a stateful, explainable product integration.

### 5. Browser-native context can stay local without polluting the domain

WebMCP is strongest when it can use live tab-local context. TaskFlow demonstrates this with semantic hover grounding and local UI session state.

Manifesto does not need to absorb raw browser noise such as pointer movement. Instead:

- runtime state stays domain-focused
- ephemeral UI context stays local to the tab
- WebMCP can still consume that context when it improves grounding

This is a practical pattern for real apps: keep the domain pure, compose browser semantics around it, and expose both through a clean tool layer.

### 6. The browser host stays thin

Another benefit of the integration is that Chrome WebMCP does not need to become the app.

TaskFlow keeps Chrome-specific logic narrow:

- feature detection
- tool registration ownership
- lifecycle retry
- host debug inspection

Everything interesting still happens in the runtime and the shared tool gateway. That keeps the WebMCP layer maintainable and prevents browser preview APIs from leaking deep into the app core.

## Why TaskFlow Fits WebMCP

Chrome positions WebMCP as the frontend counterpart to MCP: a browser-native way for a live website to expose structured tools to a browser agent while the tab is open.

Relevant Chrome references:

- [WebMCP is available for early preview](https://developer.chrome.com/blog/webmcp-epp)
- [When to use WebMCP and MCP](https://developer.chrome.com/blog/webmcp-mcp-usage)

The important WebMCP properties for this repo are:

- tools are exposed by the page itself
- tool execution happens in live page JavaScript
- the browser mediates agent access
- tools are ephemeral and tab-bound
- the site remains the owner of its UI and session state

TaskFlow already works that way:

- the Manifesto + Lineage runtime is activated in the browser
- the UI reads from the same runtime snapshot that tool calls mutate
- selection, history, hover grounding, and local session state all live in the tab
- there is no server-owned canonical runtime to keep in sync

That makes TaskFlow a better WebMCP showcase than an app that would need to mirror browser state back to a backend before exposing tools.

## Showcase Positioning

TaskFlow demonstrates a specific integration direction:

- Manifesto defines the domain in MEL
- the browser activates the runtime and owns state
- Lineage turns runtime commits into visible history and causal context
- React renders projected snapshot state
- ChatUI uses the runtime through client-executed tools
- Chrome WebMCP exposes that same runtime contract to a browser host

The point is not merely that TaskFlow "supports WebMCP". The point is that WebMCP can sit on top of a real runtime-owned product UI without introducing a second state model.

## Current Chrome WebMCP Scope

TaskFlow currently targets the imperative WebMCP path.

It does not currently implement a declarative HTML-first WebMCP layer. That is intentional. The interesting part of this showcase is the runtime-backed imperative tool surface.

Current exposed tool surface:

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

Current policy:

- reads and safe navigation are direct
- writes execute against the same client runtime as the rest of the app
- `delete_task` requires a second explicit confirmation call
- lineage entries are inspectable but not directly restorable or activated through WebMCP

## Architectural Shape

The WebMCP path is intentionally thin.

### 1. Client runtime remains the source of truth

[`TaskFlowRuntimeController`](../src/lib/taskflow-runtime-controller.ts) is still the owner of:

- Manifesto runtime activation
- Lineage history bookkeeping
- runtime-derived view state
- ephemeral UI session state such as hover and dialog visibility

WebMCP does not replace or wrap that state model. It consumes it.

### 2. A shared tool gateway sits above the controller

[`TaskFlowToolGateway`](../src/lib/taskflow-tool-gateway.ts) is the shared read/write seam for:

- in-app assistant tools
- WebMCP tools

This is important for the showcase story. It proves that the same runtime-backed capability surface can be consumed by multiple agent interfaces without duplicating tool logic.

### 3. Browser-specific logic is isolated

The Chrome-specific integration is split into dedicated transport layers:

- [`taskflow-webmcp-service.ts`](../src/lib/taskflow-webmcp-service.ts)
  lifecycle, retry, debug API, and registration ownership
- [`webmcp-host-adapter.ts`](../src/lib/webmcp-host-adapter.ts)
  direct interaction with `navigator.modelContext`
- [`taskflow-webmcp-catalog.ts`](../src/lib/taskflow-webmcp-catalog.ts)
  fixed tool catalog and schema definitions

This keeps the controller free of browser transport concerns.

### 4. The page bootstraps WebMCP, but does not own it

[`useTaskFlowWebMcp`](../src/hooks/useTaskFlowWebMcp.ts) boots the service from the live page.

The hook is deliberately minimal:

- attempt startup on mount
- retry after user interaction, focus regain, or visibility regain
- expose a dev-only debug hook on `window`

That is the right ownership boundary. The page should start the integration, not implement it.

## Chrome Preview Assumptions

TaskFlow assumes a Chrome environment where `navigator.modelContext` is available.

At the time of writing, Chrome documents WebMCP as an Early Preview Program feature:

- [WebMCP is available for early preview](https://developer.chrome.com/blog/webmcp-epp)

The app therefore treats WebMCP as optional capability:

- if `navigator.modelContext` exists, the WebMCP service registers tools
- if it does not exist, the app behaves normally and the bridge remains dormant

This behavior is intentional. The WebMCP path should never be required for the product UI to function.

## Lifecycle Model

TaskFlow uses long-lived tool registration ownership.

The current implementation is aligned with the additive `registerTool()` model rather than the older "replace all tools on every update" approach.

Key properties:

- tools are registered once per active WebMCP session
- registrations are owned by the page and cleaned up by the service
- registration ownership is managed with `registerTool(..., { signal })`
- compatibility cleanup may call `unregisterTool?.(...)`, but that is not the main lifecycle model
- state changes do not cause tool re-registration
- hosts read fresh state through `get_taskflow_context`

That makes the WebMCP layer predictable and keeps runtime state updates separate from transport lifecycle.

## Why Lineage Matters Here

WebMCP would be much less interesting in this app if it only exposed current tasks.

Because TaskFlow is lineage-backed, a browser host can work with:

- current task state
- recent task history
- causal graph information
- selected task context
- hovered semantic target context

This lets TaskFlow expose not just imperative actions, but also grounded read context about how the visible state was reached.

For a showcase, that matters. It demonstrates that WebMCP can expose a richer application contract than "click this button" or "fill this form".

## Why Hover Grounding Matters Here

TaskFlow also demonstrates something useful for browser-native agents: semantic UI grounding that remains outside the lineaged domain state.

The app captures meaningful hover targets such as:

- task cards
- header actions
- lineage rows

That data is:

- local to the tab
- not committed into lineage
- included in agent-facing context when needed

This is a good browser showcase because it uses live UI semantics without polluting the domain model with pointer noise.

## How to Verify the Integration

Open TaskFlow in a Chrome environment where WebMCP is available and check:

```js
'modelContext' in navigator
Object.getOwnPropertyNames(Object.getPrototypeOf(navigator.modelContext))
```

Then inspect the TaskFlow debug hook:

```js
window.__taskflowWebMcp?.status()
window.__taskflowWebMcp?.listTools()
window.__taskflowWebMcp?.lastLifecycleEvents()
```

Expected behavior:

- `status().supported === true`
- `status().active === true` after startup succeeds
- `listTools()` contains the TaskFlow tool surface listed above

If `modelContext` becomes available only after user interaction, TaskFlow retries startup automatically on:

- pointer interaction
- keyboard interaction
- focus regain
- visibility regain

The debug hook also exposes:

```js
await window.__taskflowWebMcp?.restart()
```

This is a dev inspection aid only. It is not part of the product contract.

## What This Showcase Is Explicitly Not Doing

TaskFlow is not trying to demonstrate every possible WebMCP pattern.

Non-goals of the current showcase:

- a server-owned canonical task runtime
- a remote MCP server pretending to be the browser tab
- declarative WebMCP forms as the primary integration path
- branch switching or world restore through WebMCP
- re-registering tools on every UI or runtime state change

These omissions are deliberate. The current showcase is meant to stay sharp and defensible:

- browser-local runtime
- browser-local tool execution
- browser-native host integration
- one runtime contract shared across UI, ChatUI, and WebMCP

## Recommended Demo Narrative

If TaskFlow is presented as a formal WebMCP showcase, the strongest narrative is:

1. Open the live UI and show that the app is already runtime-backed.
2. Show lineage and hover grounding in the product itself.
3. Verify `navigator.modelContext` and the registered TaskFlow tool list.
4. Trigger a browser-hosted agent flow that reads context and mutates tasks.
5. Show that the visible UI, history, and runtime state all stay in sync because the browser host is using the same client-owned Manifesto runtime contract.

That is the cleanest statement this repo can make:

TaskFlow is a Manifesto-powered UI that becomes agent-ready in Chrome without surrendering runtime ownership or introducing a parallel integration backend.
