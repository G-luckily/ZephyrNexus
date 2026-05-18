# Known Issues

## Technical Debt
- Home directory is currently cluttered; manual cleanup in progress.
- `paperclip` has some hardcoded paths in early scripts that may need updating post-migration.

## Risks / Environment
- Full `pnpm vitest run` shows 12 pre-existing failures on Windows
  (cursor / opencode-environment / cli-worktree suites). Causes: symlink
  privileges, temp shell-script execution, missing `cursor`/`opencode` CLIs.
  These are environmental and unrelated to the `deepseek_local` adapter.
- `deepseek_local` end-to-end run is unverified — it needs a real
  `DEEPSEEK_API_KEY` and a locally installed OpenCode or Codex CLI.
- `pnpm -r typecheck` fails unless `@zephyr-nexus/context-manager` is built
  first (build-ordering quirk in the monorepo).

## Bugs
- None reported in the context of workspace organization.
