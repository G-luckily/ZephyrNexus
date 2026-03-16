import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const DEFAULT_INSTANCE_ID = "default";
const INSTANCE_ID_RE = /^[a-zA-Z0-9_-]+$/;

function ensureHomeMigration(): void {
  const oldHome = path.resolve(os.homedir(), ".paperclip");
  const newHome = path.resolve(os.homedir(), ".zephyr-nexus");

  if (fs.existsSync(oldHome)) {
    if (fs.existsSync(newHome)) {
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
      // Ignore errors for worktrees, they are less critical
    }
  }
}

export function resolvePaperclipHomeDir(): string {
  const envHome = process.env.ZEPHYR_HOME?.trim();
  if (envHome) return path.resolve(expandHomePrefix(envHome));

  ensureHomeMigration();
  return path.resolve(os.homedir(), ".zephyr-nexus");
}

export function resolvePaperclipInstanceId(override?: string): string {
  const raw = override?.trim() || process.env.ZEPHYR_INSTANCE_ID?.trim() || DEFAULT_INSTANCE_ID;
  if (!INSTANCE_ID_RE.test(raw)) {
    throw new Error(
      `Invalid instance id '${raw}'. Allowed characters: letters, numbers, '_' and '-'.`,
    );
  }
  return raw;
}

export function resolvePaperclipInstanceRoot(instanceId?: string): string {
  const id = resolvePaperclipInstanceId(instanceId);
  return path.resolve(resolvePaperclipHomeDir(), "instances", id);
}

export function resolveDefaultConfigPath(instanceId?: string): string {
  return path.resolve(resolvePaperclipInstanceRoot(instanceId), "config.json");
}

export function resolveDefaultContextPath(): string {
  return path.resolve(resolvePaperclipHomeDir(), "context.json");
}

export function resolveDefaultEmbeddedPostgresDir(instanceId?: string): string {
  return path.resolve(resolvePaperclipInstanceRoot(instanceId), "db");
}

export function resolveDefaultLogsDir(instanceId?: string): string {
  return path.resolve(resolvePaperclipInstanceRoot(instanceId), "logs");
}

export function resolveDefaultSecretsKeyFilePath(instanceId?: string): string {
  return path.resolve(resolvePaperclipInstanceRoot(instanceId), "secrets", "master.key");
}

export function resolveDefaultStorageDir(instanceId?: string): string {
  return path.resolve(resolvePaperclipInstanceRoot(instanceId), "data", "storage");
}

export function resolveDefaultBackupDir(instanceId?: string): string {
  return path.resolve(resolvePaperclipInstanceRoot(instanceId), "data", "backups");
}

export function expandHomePrefix(value: string): string {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.resolve(os.homedir(), value.slice(2));
  return value;
}

export function describeLocalInstancePaths(instanceId?: string) {
  const resolvedInstanceId = resolvePaperclipInstanceId(instanceId);
  const instanceRoot = resolvePaperclipInstanceRoot(resolvedInstanceId);
  return {
    homeDir: resolvePaperclipHomeDir(),
    instanceId: resolvedInstanceId,
    instanceRoot,
    configPath: resolveDefaultConfigPath(resolvedInstanceId),
    embeddedPostgresDataDir: resolveDefaultEmbeddedPostgresDir(resolvedInstanceId),
    backupDir: resolveDefaultBackupDir(resolvedInstanceId),
    logDir: resolveDefaultLogsDir(resolvedInstanceId),
    secretsKeyFilePath: resolveDefaultSecretsKeyFilePath(resolvedInstanceId),
    storageDir: resolveDefaultStorageDir(resolvedInstanceId),
  };
}
