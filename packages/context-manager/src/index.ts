/**
 * @paperclipai/context-manager — Context store abstraction, builder, and snapshot write-back.
 */

export type {
  ModuleRow,
  GitChangeRow,
  DiffSnapshotRow,
  SubtaskScope,
  ContextBuildOptions,
  ContextBlock,
} from "./types.js";
export type { ContextStore, GetDiffSnapshotsOptions, StoredDiffSnapshotRow, InsertDiffSnapshotInput } from "./store.js";
export { SqliteContextStore } from "./sqlite-store.js";
export type { SqliteContextStoreOptions } from "./sqlite-store.js";
export { buildContext, serializeContextBlock } from "./builder.js";
export { writeDiffSnapshot, normalizeDiffSnapshotInput } from "./snapshot.js";
