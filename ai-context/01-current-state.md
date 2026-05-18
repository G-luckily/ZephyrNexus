# Current State (as of 2026-05-18)

## active_goal
Let agents run on third-party OpenAI-compatible providers (DeepSeek first) through
the agent configurator.

## recent_achievements (2026-05-18)
- Merged `origin/main` into the working branch `claude/elegant-merkle-ab140c` (clean merge).
- Added a dedicated `deepseek_local` adapter package
  (`packages/adapters/deepseek-local/`) that delegates execution to either the
  OpenCode or Codex engine via an `engine` config switch.
- Registered the adapter in the server / UI / CLI registries and the
  `AGENT_ADAPTER_TYPES` enum; surfaced it in the configurator (not "coming soon").
- Configurator now exposes engine selection + API base URL and guides the user to
  set `DEEPSEEK_API_KEY` via the environment-variable / secret-reference editor.
- New adapter unit tests pass (4/4); repo typecheck and full build pass.

## running_commands
- Install: `pnpm install`
- Typecheck: `pnpm -r typecheck`  (build `@zephyr-nexus/context-manager` first)
- Build: `pnpm -r build`
- Test (new adapter): `pnpm vitest run --project @zephyr-nexus/adapter-deepseek-local`
- Dev server: `pnpm dev`

# Current State (history — 2026-03-16)

## active_goal
Establishing a unified workspace structure and shared context layer for multi-tool AI collaboration.

## recent_achievements
- Audited workspace and identified tool-hidden paths vs project paths.
- Designed `AGENTS.md` + `ai-context/` standard memory layer.
- Received user approval for the implementation plan.
- Created top-level `~/workspace`, `~/sandbox`, `~/archive`, `~/tools` directories.

# Project Brief: Zephyr Nexus (风之灵枢)

Zephyr Nexus is an open-source orchestration platform for autonomous AI companies. It manages the lifecycle, orchestration, and monitoring of autonomous agent teams in a collaborative, goal-aligned environment.

## in_progress
- Populating initial project brief and current state.

## blocker_or_risks
- None identified at this stage. Workspace migration is being handled conservatively.
