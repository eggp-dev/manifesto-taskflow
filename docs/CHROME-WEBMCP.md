# TaskFlow as a Chrome WebMCP Showcase

TaskFlow is a good Chrome WebMCP showcase because the hard part already exists before the browser integration: a client-owned Manifesto runtime, a stable runtime contract, and a UI that already reads and writes through that contract.

## Overview

WebMCP is optional in TaskFlow. When Chrome exposes `navigator.modelContext`, the page publishes runtime-backed tools to a browser host. When it does not, the app still works normally.

This makes TaskFlow a clean showcase of browser-native agent integration over a real application state engine.

## Manifesto <> WebMCP Integration

The integration chain is:

1. [`taskflow.mel`](../src/domain/taskflow.mel) defines state, actions, and computed projections.
2. [`TaskFlowRuntimeController`](../src/lib/taskflow-runtime-controller.ts) activates the Manifesto + Lineage runtime in the browser and assembles the app-facing state contract.
3. [`TaskFlowToolGateway`](../src/lib/taskflow-tool-gateway.ts) exposes the shared runtime capability seam.
4. [`taskflow-webmcp-service.ts`](../src/lib/taskflow-webmcp-service.ts) and [`webmcp-host-adapter.ts`](../src/lib/webmcp-host-adapter.ts) publish that seam through Chrome WebMCP.

The boundary is deliberate:

- Manifesto owns state meaning and transitions
- WebMCP owns browser-host integration
- the browser host consumes the same runtime contract the UI already trusts

## What This Buys You

### One state model

WebMCP tools do not target DOM-derived shadow state or ad hoc handlers. They target the same runtime contract used by the UI and the in-app assistant.

### Synchronized UI and agent behavior

When a WebMCP host mutates state:

- the tool executes against the local runtime
- the runtime snapshot updates
- the UI re-renders from that snapshot
- lineage updates through the same commit path

No extra reconciliation layer is needed.

### Lineage-backed explainability

Because TaskFlow is lineage-backed, WebMCP can expose more than imperative actions. It can expose current context, history, and causal continuity.

### Local browser context without domain pollution

TaskFlow keeps semantic hover and local UI session state outside MEL and Lineage, but still makes that context available when it improves grounding.

### Thin Chrome-specific code

Chrome-specific logic stays narrow:

- feature detection
- tool registration ownership
- lifecycle retry
- debug inspection

The runtime and tool semantics remain browser-agnostic.

## Current Scope

Current WebMCP tool surface:

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

- reads and safe UI activation are direct
- writes run against the same client runtime as the rest of the app
- `delete_task` requires a second explicit confirmation call
- lineage entries are inspectable but not directly activated or restored

## Lifecycle Model

TaskFlow uses long-lived WebMCP tool registration ownership.

Rules:

- tools are registered once per active WebMCP session
- registrations are owned by the page
- registration uses `registerTool(..., { signal })`
- compatibility cleanup may call `unregisterTool?.(...)`
- state changes do not trigger tool re-registration
- hosts fetch fresh state through `get_taskflow_context`

This keeps runtime state updates separate from browser transport lifecycle.

## How to Verify

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
- `listTools()` contains the TaskFlow WebMCP surface

The app also exposes:

```js
await window.__taskflowWebMcp?.restart()
```

This is a dev inspection aid only.

Chrome references:

- [WebMCP is available for early preview](https://developer.chrome.com/blog/webmcp-epp)
- [When to use WebMCP and MCP](https://developer.chrome.com/blog/webmcp-mcp-usage)

## Non-Goals

- a server-owned task runtime
- a remote MCP server standing in for the live tab
- declarative HTML-first WebMCP as the primary path
- branch switching or world restore through WebMCP
- tool re-registration on every runtime change

The showcase stays focused on one claim: a Manifesto-powered UI can expose a browser-native agent surface without giving up runtime ownership or inventing a second state model.
