/**
 * Phase 1 Context Layer — shared types for store, builder, and snapshot.
 */

/** Single module record as stored / returned by store. */
export interface ModuleRow {
  filePath: string;
  exports: string[];
  imports: string[];
  loc: number;
  lastModified: string; // ISO date
}

/** Single git change record (e.g. from git log). */
export interface GitChangeRow {
  filePath: string;
  commitHash: string;
  summary: string;
  date: string; // ISO date
}

/** Diff snapshot written back after a worker run. */
export interface DiffSnapshotRow {
  taskId: string;
  runId: string;
  workerId: string;
  touchedFiles: string[];
  signatureChanges: Record<string, unknown>; // structured, JSON-serializable
  newDependencies: Record<string, unknown>;
  brokenContracts: Record<string, unknown>;
  plainSummary: string;
}

/** Scope for building context: project root + optional task/issue. */
export interface SubtaskScope {
  projectRoot: string;
  issueId?: string | null;
  taskKey?: string | null;
}

/** Options for context builder (e.g. length budget). */
export interface ContextBuildOptions {
  /** Max total character length for the context block; excess trimmed (recent changes first). */
  maxLength?: number;
  /** Max number of prior diff snapshots to include. */
  maxSnapshots?: number;
  /** Number of days for "recent" git changes. */
  recentDays?: number;
}

/** Structured context block passed to worker (can be serialized to string by consumer). */
export interface ContextBlock {
  /** Export signatures for modules in scope (e.g. file path -> export names). */
  moduleSignatures: Array<{ filePath: string; exports: string[]; loc: number }>;
  /** Direct dependency summaries (module path -> brief interface summary). */
  dependencySummaries: Array<{ filePath: string; exports: string[] }>;
  /** Recent git changes (possibly trimmed to fit budget). */
  recentChanges: Array<{ filePath: string; commitHash: string; summary: string; date: string }>;
  /** Prior task diff snapshots (newest first, limited by maxSnapshots). */
  priorSnapshots: Array<{
    taskId: string;
    runId: string;
    workerId: string;
    touchedFiles: string[];
    plainSummary: string;
  }>;
}
