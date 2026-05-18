# Agent Handoff

## Summary (2026-05-18)
Added a `deepseek_local` adapter so agents can run on DeepSeek (and other
OpenAI-compatible third-party providers) from the configurator. The adapter
delegates to the OpenCode or Codex engine; the DeepSeek API key is supplied via
the `DEEPSEEK_API_KEY` environment variable / company secret reference.

## Context Sync
- New package: `packages/adapters/deepseek-local/` (server / ui / cli entrypoints).
- New UI adapter: `ui/src/adapters/deepseek-local/`.
- Registered in `packages/shared/src/constants.ts`, `server/src/adapters/registry.ts`,
  `ui/src/adapters/registry.ts`, `cli/src/adapters/registry.ts`, and `vitest.config.ts`.
- Typecheck + build pass; 4 new adapter tests pass.

## Last Action
- Updated `ai-context/` files 01-05 to reflect the DeepSeek adapter work.
- Pending: end-to-end run verification with a real API key (see `04-next-actions.md`).

## Handoff (legacy — workspace reorg)
- The main entry point is `AGENTS.md`, which points to this `ai-context/` directory.
- Verify the `~/projects/paperclip` -> `~/workspace/paperclip` move if continuing the reorganization.
