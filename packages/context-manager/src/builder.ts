/**
 * Build structured context block for a subtask scope (length-budgeted).
 */

import type { ContextStore } from "./store.js";
import type { ContextBlock, ContextBuildOptions, SubtaskScope } from "./types.js";

const DEFAULT_MAX_LENGTH = 16_000;
const DEFAULT_MAX_SNAPSHOTS = 10;
const DEFAULT_RECENT_DAYS = 7;

function estimateLength(block: ContextBlock): number {
  const s =
    JSON.stringify(block.moduleSignatures) +
    JSON.stringify(block.dependencySummaries) +
    JSON.stringify(block.recentChanges) +
    JSON.stringify(block.priorSnapshots);
  return s.length;
}

/**
 * Build a structured context block from store for the given scope.
 * Uses scope.projectRoot only (store is already scoped to one repo).
 * Applies length budget: prioritizes module signatures and prior snapshots, trims recent changes.
 */
export async function buildContext(
  store: ContextStore,
  _scope: SubtaskScope,
  options?: ContextBuildOptions,
): Promise<ContextBlock> {
  const maxLength = options?.maxLength ?? DEFAULT_MAX_LENGTH;
  const maxSnapshots = options?.maxSnapshots ?? DEFAULT_MAX_SNAPSHOTS;
  const recentDays = options?.recentDays ?? DEFAULT_RECENT_DAYS;

  const [modules, gitChanges, snapshots] = await Promise.all([
    store.getModules(),
    store.getGitChanges(recentDays),
    store.getDiffSnapshots({ limit: maxSnapshots }),
  ]);

  const moduleSignatures = modules.map((m) => ({
    filePath: m.filePath,
    exports: m.exports,
    loc: m.loc,
  }));

  const dependencySummaries = modules.map((m) => ({
    filePath: m.filePath,
    exports: m.exports,
  }));

  const recentChanges = gitChanges.map((c) => ({
    filePath: c.filePath,
    commitHash: c.commitHash,
    summary: c.summary,
    date: c.date,
  }));

  const priorSnapshots = snapshots.map((s) => ({
    taskId: s.taskId,
    runId: s.runId,
    workerId: s.workerId,
    touchedFiles: s.touchedFiles,
    plainSummary: s.plainSummary,
  }));

  const block: ContextBlock = {
    moduleSignatures,
    dependencySummaries,
    recentChanges,
    priorSnapshots,
  };

  let total = estimateLength(block);
  if (total <= maxLength) return block;

  // Trim recent changes first (keep signatures and prior snapshots).
  while (block.recentChanges.length > 0 && total > maxLength) {
    block.recentChanges.pop();
    total = estimateLength(block);
  }
  return block;
}

/**
 * Serialize context block to a string for injection into worker context (e.g. Markdown).
 */
export function serializeContextBlock(block: ContextBlock): string {
  const sections: string[] = [];

  sections.push("## Module signatures");
  for (const m of block.moduleSignatures) {
    sections.push(`- ${m.filePath}: exports [${m.exports.join(", ")}] (${m.loc} LOC)`);
  }

  sections.push("\n## Direct dependency summaries");
  for (const d of block.dependencySummaries) {
    sections.push(`- ${d.filePath}: [${d.exports.join(", ")}]`);
  }

  sections.push("\n## Recent changes (last 7 days)");
  for (const c of block.recentChanges) {
    sections.push(`- ${c.filePath}: ${c.commitHash.slice(0, 7)} ${c.summary} (${c.date})`);
  }

  sections.push("\n## Prior task diff snapshots");
  for (const s of block.priorSnapshots) {
    sections.push(`- task=${s.taskId} run=${s.runId} worker=${s.workerId}`);
    sections.push(`  files: ${s.touchedFiles.join(", ") || "(none)"}`);
    sections.push(`  summary: ${s.plainSummary}`);
  }

  return sections.join("\n");
}
