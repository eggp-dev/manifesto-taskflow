# TaskFlow: Manifesto + WebMCP Showcase

TaskFlow is a Manifesto showcase built as a real product UI, not a toy domain sample. MEL defines the domain, a client-owned Manifesto runtime owns state, Lineage makes state transitions visible, and both the in-app assistant and Chrome WebMCP consume the same runtime contract.

## What It Demonstrates

- Manifesto as the application state engine of a live UI
- MEL on the real app path through `.mel` imports and webpack codegen
- Lineage as visible product history
- manual UI actions and assistant actions converging on one runtime
- browser-local WebMCP over the same runtime-backed capability surface
- local persistence for lineage state and assistant chat

## Architecture in One Paragraph

The browser activates the Manifesto + Lineage runtime and exposes a projected UI contract through a controller. React renders that contract, the in-app assistant uses a shared tool gateway against the same runtime, and the WebMCP path publishes that same gateway to a browser host. The server only streams model output for the in-app assistant; it does not own task state.

## Run

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Configure the assistant:

   ```bash
   cp .env.local.example .env.local
   ```

   Required env vars:

   - `OPENAI_API_KEY`
   - `OPENAI_MODEL`

3. Start the app:

   ```bash
   pnpm dev
   ```

4. Validation:

   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```

## Constraints

- The client runtime is the source of truth.
- The workspace is local to one browser profile.
- Lineage and assistant chat are stored in `localStorage`.
- Schema hash mismatches reset stored lineage state.
- WebMCP is optional and only activates when the browser exposes `navigator.modelContext`.
- `delete_task` requires a second-step confirmation in WebMCP.

## Key Entry Points

- [`src/domain/taskflow.mel`](./src/domain/taskflow.mel)
- [`src/lib/taskflow-runtime-controller.ts`](./src/lib/taskflow-runtime-controller.ts)
- [`src/lib/taskflow-tool-gateway.ts`](./src/lib/taskflow-tool-gateway.ts)
- [`src/hooks/useTaskFlowAssistant.ts`](./src/hooks/useTaskFlowAssistant.ts)
- [`src/hooks/useTaskFlowWebMcp.ts`](./src/hooks/useTaskFlowWebMcp.ts)
- [`src/app/api/assistant/route.ts`](./src/app/api/assistant/route.ts)

## Docs

- [Architecture](./docs/ARCHITECTURE.md)
- [UI Contract](./docs/UI-CONTRACT.md)
- [Chrome WebMCP](./docs/CHROME-WEBMCP.md)
