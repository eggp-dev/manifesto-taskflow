# TaskFlow

TaskFlow is a Manifesto-powered task workspace demo that runs its domain runtime in the browser and layers a lineage-aware assistant on top of the same local state.

## What It Does

- Manual task CRUD backed by a client-owned Manifesto runtime
- Lineage history with visible branch/head context
- Live multi-step assistant with tool calling
- Hover-grounded references such as "this", "that", and hovered header actions
- Lineage search from the assistant
- Browser-local persistence for lineage state and assistant chat

## Architecture Summary

The UI is rendered by Next.js and composed in [`src/components/taskflow/TaskFlowPageClient.tsx`](./src/components/taskflow/TaskFlowPageClient.tsx). Runtime ownership stays on the client through [`src/hooks/useTaskFlow.ts`](./src/hooks/useTaskFlow.ts) and [`src/lib/taskflow-runtime-controller.ts`](./src/lib/taskflow-runtime-controller.ts), which activate the Manifesto + Lineage runtime, persist local state, and expose view actions. The server route at [`src/app/api/assistant/route.ts`](./src/app/api/assistant/route.ts) only orchestrates model streaming and tool schemas. TaskFlow's domain source remains authored in [`src/domain/taskflow.mel`](./src/domain/taskflow.mel), imported through [`src/domain/taskflow.schema.ts`](./src/domain/taskflow.schema.ts), and code-generated into [`src/domain/taskflow.domain.ts`](./src/domain/taskflow.domain.ts) during webpack builds.

## Quickstart

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

## Local Persistence

- TaskFlow stores lineage runtime state in `localStorage`.
- Assistant chat history is also stored in `localStorage`.
- If the MEL/schema hash changes, persisted lineage state is discarded and the app reseeds from fixtures.
- The workspace is intentionally local to one browser profile. There is no shared backend state or cross-device sync.

## Constraints

- The client runtime is the source of truth. The server does not own task state.
- Assistant tools are constrained to the client runtime surface.
- Hover grounding is ephemeral UI context, not lineaged state.
- Lineage entries are searchable and inspectable, but not directly restorable by the assistant.
- The app uses webpack in `pnpm dev` and `pnpm build` so the Manifesto compiler/codegen pipeline can process `.mel` imports on the live Next.js path.

## Key Entry Points

- [`src/components/taskflow/TaskFlowPageClient.tsx`](./src/components/taskflow/TaskFlowPageClient.tsx)
- [`src/hooks/useTaskFlow.ts`](./src/hooks/useTaskFlow.ts)
- [`src/hooks/useTaskFlowAssistant.ts`](./src/hooks/useTaskFlowAssistant.ts)
- [`src/lib/taskflow-runtime-controller.ts`](./src/lib/taskflow-runtime-controller.ts)
- [`src/app/api/assistant/route.ts`](./src/app/api/assistant/route.ts)
- [`src/domain/taskflow.mel`](./src/domain/taskflow.mel)

## Docs

- [Architecture](./docs/ARCHITECTURE.md)
- [UI Contract](./docs/UI-CONTRACT.md)
