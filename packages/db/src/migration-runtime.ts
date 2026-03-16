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
    const adminConnectionString = `postgres://zephyr:zephyr_nexus@127.0.0.1:${port}/postgres`;
    try {
      await ensurePostgresDatabase(adminConnectionString, "zephyr_nexus");
    } catch (err: any) {
      if (err?.message?.includes('role "zephyr" does not exist')) {
        const legacyAdminUrl = `postgres://paperclip:paperclip@127.0.0.1:${port}/postgres`;
        const sql = (await import("postgres")).default(legacyAdminUrl);
        try {
          await sql.unsafe("CREATE ROLE zephyr WITH LOGIN SUPERUSER PASSWORD 'zephyr_nexus'");
          await ensurePostgresDatabase(adminConnectionString, "zephyr_nexus");
        } finally {
          await sql.end();
        }
      } else {
        throw err;
      }
    }
    return {
      connectionString: `postgres://zephyr:zephyr_nexus@127.0.0.1:${port}/zephyr_nexus`,
      source: `embedded-postgres@${port}`,
      stop: async () => {},
    };
  }

  const instance = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "paperclip",
    password: "paperclip",
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

  const adminConnectionString = `postgres://zephyr:zephyr_nexus@127.0.0.1:${preferredPort}/postgres`;
  try {
    await ensurePostgresDatabase(adminConnectionString, "zephyr_nexus");
  } catch (err: any) {
    if (err?.message?.includes('role "zephyr" does not exist')) {
      const legacyAdminUrl = `postgres://paperclip:paperclip@127.0.0.1:${preferredPort}/postgres`;
      const sql = (await import("postgres")).default(legacyAdminUrl);
      try {
        await sql.unsafe("CREATE ROLE zephyr WITH LOGIN SUPERUSER PASSWORD 'zephyr_nexus'");
        await ensurePostgresDatabase(adminConnectionString, "zephyr_nexus");
      } finally {
        await sql.end();
      }
    } else {
      throw err;
    }
  }

  return {
    connectionString: `postgres://zephyr:zephyr_nexus@127.0.0.1:${preferredPort}/zephyr_nexus`,
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
