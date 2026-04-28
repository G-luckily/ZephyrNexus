import { existsSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ensurePostgresDatabase } from "./client.js";
import { resolveDatabaseTarget } from "./runtime-config.js";

type EmbeddedPostgresInstance = {
  initialise(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
};

type EmbeddedPostgresCtor = new (opts: {
  databaseDir: string;
  user: string;
  password: string;
  port: number;
  persistent: boolean;
  onLog?: (message: unknown) => void;
  onError?: (message: unknown) => void;
}) => EmbeddedPostgresInstance;

const EMBEDDED_POSTGRES_USER = "zephyr";
const EMBEDDED_POSTGRES_PASSWORD = "zephyr_nexus";
const LEGACY_EMBEDDED_POSTGRES_USER = "paperclip";
const LEGACY_EMBEDDED_POSTGRES_PASSWORD = "paperclip";

export type MigrationConnection = {
  connectionString: string;
  source: string;
  stop: () => Promise<void>;
};

function readRunningPostmasterPid(postmasterPidFile: string): number | null {
  if (!existsSync(postmasterPidFile)) return null;
  try {
    const pid = Number(readFileSync(postmasterPidFile, "utf8").split("\n")[0]?.trim());
    if (!Number.isInteger(pid) || pid <= 0) return null;
    process.kill(pid, 0);
    return pid;
  } catch {
    return null;
  }
}

function readPidFilePort(postmasterPidFile: string): number | null {
  if (!existsSync(postmasterPidFile)) return null;
  try {
    const lines = readFileSync(postmasterPidFile, "utf8").split("\n");
    const port = Number(lines[3]?.trim());
    return Number.isInteger(port) && port > 0 ? port : null;
  } catch {
    return null;
  }
}

async function loadEmbeddedPostgresCtor(): Promise<EmbeddedPostgresCtor> {
  const require = createRequire(import.meta.url);
  const resolveCandidates = [
    path.resolve(fileURLToPath(new URL("../..", import.meta.url))),
    path.resolve(fileURLToPath(new URL("../../server", import.meta.url))),
    path.resolve(fileURLToPath(new URL("../../cli", import.meta.url))),
    process.cwd(),
  ];

  try {
    const resolvedModulePath = require.resolve("embedded-postgres", { paths: resolveCandidates });
    const mod = await import(pathToFileURL(resolvedModulePath).href);
    return mod.default as EmbeddedPostgresCtor;
  } catch {
    throw new Error(
      "Embedded PostgreSQL support requires dependency `embedded-postgres`. Reinstall dependencies and try again.",
    );
  }
}

function embeddedAdminConnectionString(port: number): string {
  return `postgres://${EMBEDDED_POSTGRES_USER}:${EMBEDDED_POSTGRES_PASSWORD}@127.0.0.1:${port}/postgres`;
}

function embeddedAppConnectionString(port: number): string {
  return `postgres://${EMBEDDED_POSTGRES_USER}:${EMBEDDED_POSTGRES_PASSWORD}@127.0.0.1:${port}/zephyr_nexus`;
}

function isZephyrCredentialBootstrapError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return (
    message.includes('role "zephyr" does not exist') ||
    message.includes('password authentication failed for user "zephyr"')
  );
}

async function repairZephyrRoleWithLegacyCredentials(port: number): Promise<void> {
  const legacyAdminUrl = `postgres://${LEGACY_EMBEDDED_POSTGRES_USER}:${LEGACY_EMBEDDED_POSTGRES_PASSWORD}@127.0.0.1:${port}/postgres`;
  const sql = (await import("postgres")).default(legacyAdminUrl);
  try {
    await sql.unsafe(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${EMBEDDED_POSTGRES_USER}') THEN
          ALTER ROLE ${EMBEDDED_POSTGRES_USER} WITH LOGIN SUPERUSER PASSWORD '${EMBEDDED_POSTGRES_PASSWORD}';
        ELSE
          CREATE ROLE ${EMBEDDED_POSTGRES_USER} WITH LOGIN SUPERUSER PASSWORD '${EMBEDDED_POSTGRES_PASSWORD}';
        END IF;
      END
      $$;
    `);
  } finally {
    await sql.end();
  }
}

async function ensureEmbeddedDatabaseWithCompat(port: number): Promise<void> {
  const adminConnectionString = embeddedAdminConnectionString(port);
  try {
    await ensurePostgresDatabase(adminConnectionString, "zephyr_nexus");
  } catch (err) {
    if (!isZephyrCredentialBootstrapError(err)) {
      throw err;
    }
    await repairZephyrRoleWithLegacyCredentials(port);
    await ensurePostgresDatabase(adminConnectionString, "zephyr_nexus");
  }
}

async function ensureEmbeddedPostgresConnection(
  dataDir: string,
  preferredPort: number,
): Promise<MigrationConnection> {
  const EmbeddedPostgres = await loadEmbeddedPostgresCtor();
  const postmasterPidFile = path.resolve(dataDir, "postmaster.pid");
  const runningPid = readRunningPostmasterPid(postmasterPidFile);
  const runningPort = readPidFilePort(postmasterPidFile);

  if (runningPid) {
    const port = runningPort ?? preferredPort;
    await ensureEmbeddedDatabaseWithCompat(port);
    return {
      connectionString: embeddedAppConnectionString(port),
      source: `embedded-postgres@${port}`,
      stop: async () => {},
    };
  }

  const instance = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: EMBEDDED_POSTGRES_USER,
    password: EMBEDDED_POSTGRES_PASSWORD,
    port: preferredPort,
    persistent: true,
    onLog: () => {},
    onError: () => {},
  });

  const pgVersionPath = path.resolve(dataDir, "PG_VERSION");
  if (!existsSync(pgVersionPath)) {
    await instance.initialise();
  }
  if (existsSync(postmasterPidFile)) {
    rmSync(postmasterPidFile, { force: true });
  }
  await instance.start();

  await ensureEmbeddedDatabaseWithCompat(preferredPort);

  return {
    connectionString: embeddedAppConnectionString(preferredPort),
    source: `embedded-postgres@${preferredPort}`,
    stop: async () => {
      await instance.stop();
    },
  };
}

export async function resolveMigrationConnection(): Promise<MigrationConnection> {
  const target = resolveDatabaseTarget();
  if (target.mode === "postgres") {
    return {
      connectionString: target.connectionString,
      source: target.source,
      stop: async () => {},
    };
  }

  return ensureEmbeddedPostgresConnection(target.dataDir, target.port);
}
