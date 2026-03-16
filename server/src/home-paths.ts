import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const DEFAULT_INSTANCE_ID = "default";
const INSTANCE_ID_RE = /^[a-zA-Z0-9_-]+$/;
const PATH_SEGMENT_RE = /^[a-zA-Z0-9_-]+$/;

function ensureHomeMigration(): void {
  const oldHome = path.resolve(os.homedir(), ".paperclip");
  const newHome = path.resolve(os.homedir(), ".zephyr-nexus");

  if (fs.existsSync(oldHome)) {
    if (fs.existsSync(newHome)) {
      // If both exist, we assume oldHome is the latest active one (per user feedback)
      // and newHome might be a stale/partial artifact. Backup newHome before migrating.
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupNewHome = `${newHome}.backup-${timestamp}`;
      try {
        fs.renameSync(newHome, backupNewHome);
        console.log(`[Zephyr Nexus] Backed up existing ${newHome} to ${backupNewHome}`);
      } catch (err) {
        console.warn(`[Zephyr Nexus] Failed to backup existing ${newHome}, skipping migration:`, err);
        return;
      }
    }

    try {
      fs.renameSync(oldHome, newHome);
      console.log(`[Zephyr Nexus] Migrated legacy data from ${oldHome} to ${newHome}`);
    } catch (err) {
      console.warn(`[Zephyr Nexus] Failed to migrate ${oldHome} to ${newHome}:`, err);
    }
  }

  // Also migrate worktrees if they exist
  const oldWorktrees = path.resolve(os.homedir(), ".paperclip-worktrees");
  const newWorktrees = path.resolve(os.homedir(), ".zephyr-nexus-worktrees");
  if (fs.existsSync(oldWorktrees) && !fs.existsSync(newWorktrees)) {
    try {
      fs.renameSync(oldWorktrees, newWorktrees);
      console.log(`[Zephyr Nexus] Migrated legacy worktrees from ${oldWorktrees} to ${newWorktrees}`);
    } catch (err) {
      // Ignore errors for worktrees
    }
  }
}

function expandHomePrefix(value: string): string {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.resolve(os.homedir(), value.slice(2));
  return value;
}

export function resolvePaperclipHomeDir(): string {
  const envHome = process.env.ZEPHYR_HOME?.trim();
  if (envHome) return path.resolve(expandHomePrefix(envHome));

  ensureHomeMigration();
  return path.resolve(os.homedir(), ".zephyr-nexus");
}

export function resolvePaperclipInstanceId(): string {
  const raw = process.env.ZEPHYR_INSTANCE_ID?.trim() || DEFAULT_INSTANCE_ID;
  if (!INSTANCE_ID_RE.test(raw)) {
    throw new Error(`Invalid ZEPHYR_INSTANCE_ID '${raw}'.`);
  }
  return raw;
}

export function resolvePaperclipInstanceRoot(): string {
  return path.resolve(resolvePaperclipHomeDir(), "instances", resolvePaperclipInstanceId());
}

export function resolveDefaultConfigPath(): string {
  return path.resolve(resolvePaperclipInstanceRoot(), "config.json");
}

export function resolveDefaultEmbeddedPostgresDir(): string {
  return path.resolve(resolvePaperclipInstanceRoot(), "db");
}

export function resolveDefaultLogsDir(): string {
  return path.resolve(resolvePaperclipInstanceRoot(), "logs");
}

export function resolveDefaultSecretsKeyFilePath(): string {
  return path.resolve(resolvePaperclipInstanceRoot(), "secrets", "master.key");
}

export function resolveDefaultStorageDir(): string {
  return path.resolve(resolvePaperclipInstanceRoot(), "data", "storage");
}

export function resolveDefaultBackupDir(): string {
  return path.resolve(resolvePaperclipInstanceRoot(), "data", "backups");
}

export function resolveDefaultAgentWorkspaceDir(agentId: string): string {
  const trimmed = agentId.trim();
  if (!PATH_SEGMENT_RE.test(trimmed)) {
    throw new Error(`Invalid agent id for workspace path '${agentId}'.`);
  }
  return path.resolve(resolvePaperclipInstanceRoot(), "workspaces", trimmed);
}

export function resolveHomeAwarePath(value: string): string {
  return path.resolve(expandHomePrefix(value));
}
