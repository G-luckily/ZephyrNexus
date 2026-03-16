/**
 * Context store interface — abstract over SQLite (or other backends).
 */

import type { ModuleRow, GitChangeRow, DiffSnapshotRow } from "./types.js";

export interface GetDiffSnapshotsOptions {
  taskId?: string;
  limit?: number;
}

/** Stored diff snapshot may include id and createdAt (set by store). */
export type StoredDiffSnapshotRow = DiffSnapshotRow & {
  id?: number;
  createdAt?: string;
};

/** Input for inserting a diff snapshot (no id/createdAt). */
export type InsertDiffSnapshotInput = DiffSnapshotRow;

export interface ContextStore {
  getModules(): Promise<ModuleRow[]>;
  getGitChanges(sinceDays?: number): Promise<GitChangeRow[]>;
  upsertModules(modules: ModuleRow[]): Promise<void>;
  upsertGitChanges(changes: GitChangeRow[]): Promise<void>;
  getDiffSnapshots(opts?: GetDiffSnapshotsOptions): Promise<StoredDiffSnapshotRow[]>;
  insertDiffSnapshot(snapshot: InsertDiffSnapshotInput): Promise<void>;
}
