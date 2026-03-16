/**
 * Write back diff snapshot after a worker run.
 */

import type { ContextStore, InsertDiffSnapshotInput } from "./store.js";

/**
 * Normalize adapter result or minimal payload into InsertDiffSnapshotInput.
 * Safe for missing or partial resultJson.paperclipDiffSnapshot.
 */
export function normalizeDiffSnapshotInput(input: {
  taskId: string;
  runId: string;
  workerId: string;
  touchedFiles?: string[];
  signatureChanges?: Record<string, unknown>;
  newDependencies?: Record<string, unknown>;
  brokenContracts?: Record<string, unknown>;
  plainSummary?: string;
}): InsertDiffSnapshotInput {
  return {
    taskId: input.taskId,
    runId: input.runId,
    workerId: input.workerId,
    touchedFiles: Array.isArray(input.touchedFiles) ? input.touchedFiles : [],
    signatureChanges:
      input.signatureChanges && typeof input.signatureChanges === "object"
        ? input.signatureChanges
        : {},
    newDependencies:
      input.newDependencies && typeof input.newDependencies === "object"
        ? input.newDependencies
        : {},
    brokenContracts:
      input.brokenContracts && typeof input.brokenContracts === "object"
        ? input.brokenContracts
        : {},
    plainSummary: typeof input.plainSummary === "string" ? input.plainSummary : "",
  };
}

/**
 * Write a diff snapshot to the store (e.g. after worker run).
 */
export async function writeDiffSnapshot(
  store: ContextStore,
  snapshot: InsertDiffSnapshotInput,
): Promise<void> {
  const normalized = normalizeDiffSnapshotInput(snapshot);
  await store.insertDiffSnapshot(normalized);
}
