# TaskFlow UI Shell

TaskFlow is currently a preserved UI shell on top of the SDK `3.8.0` dependency baseline.

The old `2.0.0`-era Manifesto runtime, MEL domain, agent routes, and intent plumbing have been hard-cut from the app. This repo is now the visual/reference surface for the next clean rebuild, not a partial runtime migration.

The domain source is now wired back into the real Next.js module graph through a `.mel` import, and webpack codegen emits [`src/domain/taskflow.domain.ts`](./src/domain/taskflow.domain.ts) from [`src/domain/taskflow.mel`](./src/domain/taskflow.mel) during build.

## Current State

- Local fixture data only
- No Manifesto runtime activation in the app path
- No persistence
- No networked assistant or `/api/agent` execution path
- The app imports [`src/domain/taskflow.mel`](./src/domain/taskflow.mel) through [`src/domain/taskflow.schema.ts`](./src/domain/taskflow.schema.ts) so compiler/codegen run on the real Next path
- `pnpm dev` and `pnpm build` use webpack so the installed Manifesto compiler/codegen integration can process `.mel`
- `manifesto.config.ts` and the `3.8.0` package baseline stay in place for the future rebuild

## Preserved Interactions

- View switching between todo, kanban, table, and trash
- Task selection and detail panel open/close
- Kanban status moves
- Soft delete, restore, permanent delete, and empty trash
- Date filtering
- Assistant panel open/close with disabled shell messaging

## Shell Boundary

The active controller surface is local-only:

- [`src/hooks/useTaskFlow.ts`](./src/hooks/useTaskFlow.ts)
- [`src/lib/taskflow-shell-state.ts`](./src/lib/taskflow-shell-state.ts)
- [`docs/UI-CONTRACT.md`](./docs/UI-CONTRACT.md)

The surviving app-facing types remain in [`src/types/taskflow.ts`](./src/types/taskflow.ts).

## Commands

```bash
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Rebuild Rule

Do not incrementally revive the deleted runtime files. The next SDK integration should start from this shell boundary and reconnect the app to the SDK `3.8.x` surface intentionally.
