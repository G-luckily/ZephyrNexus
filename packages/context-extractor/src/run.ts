/**
 * Run full extraction (modules + git) and write to store.
 */

import type { ContextStore } from "@zephyr-nexus/context-manager";
import { extractModules } from "./extract-modules.js";
import { extractGitChanges } from "./extract-git.js";

export interface RunOptions {
  /** Repo root path. */
  repoRoot: string;
  /** Store to write to (e.g. SqliteContextStore for that repo). */
  store: ContextStore;
  /** Days for git history. */
  sinceDays?: number;
}

/**
 * Extract modules and git changes, then upsert into the store.
 */
export async function run(options: RunOptions): Promise<void> {
  const { repoRoot, store, sinceDays = 7 } = options;
  const modules = extractModules({ repoRoot });
  const gitChanges = extractGitChanges({ repoRoot, sinceDays });
  await store.upsertModules(modules);
  await store.upsertGitChanges(gitChanges);
}
