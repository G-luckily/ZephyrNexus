/**
 * SQLite implementation of ContextStore (one DB file per repo).
 */

import Database from "better-sqlite3";
import type {
  ContextStore,
  GetDiffSnapshotsOptions,
  InsertDiffSnapshotInput,
  StoredDiffSnapshotRow,
} from "./store.js";
import type { ModuleRow, GitChangeRow } from "./types.js";

function jsonStringify(arr: unknown): string {
  return JSON.stringify(arr ?? []);
}

function jsonParse<T>(s: string): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return [] as unknown as T;
  }
}

export interface SqliteContextStoreOptions {
  /** Path to SQLite file (e.g. .paperclip/context.db in repo root). */
  dbPath: string;
}

export class SqliteContextStore implements ContextStore {
  private db: Database.Database;

  constructor(options: SqliteContextStoreOptions) {
    this.db = new Database(options.dbPath);
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS modules (
        file_path TEXT PRIMARY KEY,
        exports TEXT NOT NULL DEFAULT '[]',
        imports TEXT NOT NULL DEFAULT '[]',
        loc INTEGER NOT NULL DEFAULT 0,
        last_modified TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS git_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL,
        commit_hash TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        date TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS idx_git_changes_date ON git_changes(date);
      CREATE TABLE IF NOT EXISTS diff_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        worker_id TEXT NOT NULL,
        touched_files TEXT NOT NULL DEFAULT '[]',
        signature_changes TEXT NOT NULL DEFAULT '{}',
        new_dependencies TEXT NOT NULL DEFAULT '{}',
        broken_contracts TEXT NOT NULL DEFAULT '{}',
        plain_summary TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_diff_snapshots_task ON diff_snapshots(task_id);
      CREATE INDEX IF NOT EXISTS idx_diff_snapshots_created ON diff_snapshots(created_at);
    `);
  }

  async getModules(): Promise<ModuleRow[]> {
    const rows = this.db.prepare("SELECT file_path, exports, imports, loc, last_modified FROM modules").all() as Array<{
      file_path: string;
      exports: string;
      imports: string;
      loc: number;
      last_modified: string;
    }>;
    return rows.map((r) => ({
      filePath: r.file_path,
      exports: jsonParse<string[]>(r.exports),
      imports: jsonParse<string[]>(r.imports),
      loc: r.loc,
      lastModified: r.last_modified,
    }));
  }

  async getGitChanges(sinceDays: number = 7): Promise<GitChangeRow[]> {
    const since = new Date();
    since.setDate(since.getDate() - sinceDays);
    const sinceStr = since.toISOString();
    const rows = this.db
      .prepare(
        "SELECT file_path, commit_hash, summary, date FROM git_changes WHERE date >= ? ORDER BY date DESC",
      )
      .all(sinceStr) as Array<{
      file_path: string;
      commit_hash: string;
      summary: string;
      date: string;
    }>;
    return rows.map((r) => ({
      filePath: r.file_path,
      commitHash: r.commit_hash,
      summary: r.summary,
      date: r.date,
    }));
  }

  async upsertModules(modules: ModuleRow[]): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO modules (file_path, exports, imports, loc, last_modified)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(file_path) DO UPDATE SET
        exports = excluded.exports,
        imports = excluded.imports,
        loc = excluded.loc,
        last_modified = excluded.last_modified
    `);
    const run = this.db.transaction(() => {
      for (const m of modules) {
        stmt.run(
          m.filePath,
          jsonStringify(m.exports),
          jsonStringify(m.imports),
          m.loc,
          m.lastModified,
        );
      }
    });
    run();
  }

  async upsertGitChanges(changes: GitChangeRow[]): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO git_changes (file_path, commit_hash, summary, date) VALUES (?, ?, ?, ?)
    `);
    const run = this.db.transaction(() => {
      for (const c of changes) {
        stmt.run(c.filePath, c.commitHash, c.summary, c.date);
      }
    });
    run();
  }

  async getDiffSnapshots(opts?: GetDiffSnapshotsOptions): Promise<StoredDiffSnapshotRow[]> {
    let sql = "SELECT id, task_id, run_id, worker_id, touched_files, signature_changes, new_dependencies, broken_contracts, plain_summary, created_at FROM diff_snapshots";
    const params: (string | number)[] = [];
    if (opts?.taskId) {
      sql += " WHERE task_id = ?";
      params.push(opts.taskId);
    }
    sql += " ORDER BY created_at DESC";
    if (opts?.limit != null && opts.limit > 0) {
      sql += " LIMIT ?";
      params.push(opts.limit);
    }
    const rows = this.db.prepare(sql).all(...params) as Array<{
      id: number;
      task_id: string;
      run_id: string;
      worker_id: string;
      touched_files: string;
      signature_changes: string;
      new_dependencies: string;
      broken_contracts: string;
      plain_summary: string;
      created_at: string;
    }>;
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      taskId: r.task_id,
      runId: r.run_id,
      workerId: r.worker_id,
      touchedFiles: jsonParse<string[]>(r.touched_files),
      signatureChanges: jsonParse<Record<string, unknown>>(r.signature_changes),
      newDependencies: jsonParse<Record<string, unknown>>(r.new_dependencies),
      brokenContracts: jsonParse<Record<string, unknown>>(r.broken_contracts),
      plainSummary: r.plain_summary,
    }));
  }

  async insertDiffSnapshot(snapshot: InsertDiffSnapshotInput): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO diff_snapshots (task_id, run_id, worker_id, touched_files, signature_changes, new_dependencies, broken_contracts, plain_summary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        snapshot.taskId,
        snapshot.runId,
        snapshot.workerId,
        jsonStringify(snapshot.touchedFiles),
        jsonStringify(snapshot.signatureChanges),
        jsonStringify(snapshot.newDependencies),
        jsonStringify(snapshot.brokenContracts),
        snapshot.plainSummary,
      );
  }

  /** Close the database (optional, for cleanup). */
  close(): void {
    this.db.close();
  }
}
