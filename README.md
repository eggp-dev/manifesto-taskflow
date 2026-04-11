# TaskFlow: Manifesto + WebMCP Showcase

TaskFlow is the first end-to-end showcase in this repo for using Manifesto as the state engine of a real interactive product UI. It demonstrates a concrete integration direction: MEL defines the domain, an activated Manifesto runtime owns application state, Lineage turns execution into visible continuity, and an assistant operates through the same runtime contract instead of bypassing it.

## What This Showcase Is Proving

TaskFlow is meant to show that Manifesto can sit in the middle of a modern UI system, not off to the side as an isolated rules engine.

This repo demonstrates:

- a client-owned Manifesto runtime as the source of truth
- MEL on the real app path through `.mel` imports and webpack codegen
- Lineage as a product feature, not just an internal log
- manual UI actions and assistant tool calls converging on the same runtime
- a browser-side WebMCP bridge exposing the same runtime-backed task capabilities to agent hosts
- semantic UI grounding around the runtime, without polluting core state
- browser-local persistence for a self-contained interactive demo

## What You Can Experience

- Manual task CRUD backed by Manifesto + Lineage
- A visible lineage history panel with branch/head context
- A live multi-step assistant that uses tool calling
- A WebMCP-capable browser surface for host agents
- Hover-grounded references such as "this", "that", and hovered header actions
- Lineage search from inside the assistant
- Local persistence for lineage state and assistant chat

## Manifesto-First Architecture

The architectural story is the point of this repo.

- [`src/domain/taskflow.mel`](./src/domain/taskflow.mel) defines the domain state, actions, and computed projections.
- [`src/domain/taskflow.schema.ts`](./src/domain/taskflow.schema.ts) keeps the `.mel` source on the live Next.js path so webpack codegen emits [`src/domain/taskflow.domain.ts`](./src/domain/taskflow.domain.ts).
- [`src/lib/taskflow-runtime-controller.ts`](./src/lib/taskflow-runtime-controller.ts) activates the Manifesto + Lineage runtime in the browser and exposes the app-facing view contract.
- [`src/lib/taskflow-tool-gateway.ts`](./src/lib/taskflow-tool-gateway.ts) is the shared read/write seam used by both the in-app assistant and the WebMCP path.
- [`src/lib/taskflow-webmcp.ts`](./src/lib/taskflow-webmcp.ts) is the public browser-side WebMCP entrypoint.
- [`src/lib/taskflow-webmcp-service.ts`](./src/lib/taskflow-webmcp-service.ts) owns WebMCP lifecycle, debug state, and registration ownership.
- [`src/lib/webmcp-host-adapter.ts`](./src/lib/webmcp-host-adapter.ts) isolates `navigator.modelContext` and `registerTool(..., { signal })`.
- [`src/hooks/useTaskFlowWebMcp.ts`](./src/hooks/useTaskFlowWebMcp.ts) boots the WebMCP bridge from the live client page.
- [`src/components/taskflow/TaskFlowPageClient.tsx`](./src/components/taskflow/TaskFlowPageClient.tsx) renders the product UI from projected snapshot state.
- [`src/app/api/assistant/route.ts`](./src/app/api/assistant/route.ts) only orchestrates model streaming and tool schemas; it does not own task state.

The intended direction is explicit: Manifesto owns meaning and transitions, React renders projected state, Lineage explains how the app got here, the in-app assistant is one runtime consumer, and WebMCP is another.

## Run the Showcase

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Configure the assistant:

   ```bash
   cp .env.local.example .env.local
   ```

   Required environment variables:

   - `OPENAI_API_KEY`
   - `OPENAI_MODEL`

3. Start the app:

   ```bash
   pnpm dev
   ```

4. Validation commands:

   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```

## Demo Constraints

- The client runtime is the source of truth.
- The server does not own task state.
- The workspace is local to one browser profile.
- Lineage and assistant chat are stored in `localStorage`.
- Schema hash mismatches invalidate stored lineage state and reseed the demo.
- Hover grounding is ephemeral UI context, not lineaged domain state.
- Lineage entries are searchable and inspectable, but not directly restorable by the assistant.
- WebMCP requires a browser with `navigator.modelContext` preview support; otherwise the bridge stays dormant and the app still works normally.
- WebMCP mirrors current task/lineage/hover capabilities and requires a second-step confirmation for `delete_task`.
- `pnpm dev` and `pnpm build` intentionally use webpack so the Manifesto compiler/codegen pipeline can process `.mel` imports on the live Next.js path.

## Entry Points

- [`src/components/taskflow/TaskFlowPageClient.tsx`](./src/components/taskflow/TaskFlowPageClient.tsx)
- [`src/hooks/useTaskFlow.ts`](./src/hooks/useTaskFlow.ts)
- [`src/hooks/useTaskFlowAssistant.ts`](./src/hooks/useTaskFlowAssistant.ts)
- [`src/hooks/useTaskFlowWebMcp.ts`](./src/hooks/useTaskFlowWebMcp.ts)
- [`src/lib/taskflow-runtime-controller.ts`](./src/lib/taskflow-runtime-controller.ts)
- [`src/lib/taskflow-tool-gateway.ts`](./src/lib/taskflow-tool-gateway.ts)
- [`src/lib/taskflow-webmcp.ts`](./src/lib/taskflow-webmcp.ts)
- [`src/lib/taskflow-webmcp-service.ts`](./src/lib/taskflow-webmcp-service.ts)
- [`src/app/api/assistant/route.ts`](./src/app/api/assistant/route.ts)
- [`src/domain/taskflow.mel`](./src/domain/taskflow.mel)

## Further Reading

- [Architecture](./docs/ARCHITECTURE.md)
- [Chrome WebMCP Showcase](./docs/CHROME-WEBMCP.md)
- [UI Contract](./docs/UI-CONTRACT.md)
