import { createHash, randomBytes } from "node:crypto";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { and, eq, gt, isNull } from "drizzle-orm";
import { createDb, instanceUserRoles, invites } from "@zephyr-nexus/db";
import { loadPaperclipEnvFile } from "../config/env.js";
import { readConfig, resolveConfigPath } from "../config/store.js";
import type { PaperclipConfig } from "../config/schema.js";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createInviteToken() {
  return `zn_bootstrap_${randomBytes(24).toString("hex")}`;
}

type BootstrapRuntime =
  | {
      shouldCreateInvite: true;
      dbUrl: string;
      baseUrl: string;
    }
  | {
      shouldCreateInvite: false;
      reason: "missing_config";
      configPath: string;
    }
  | {
      shouldCreateInvite: false;
      reason: "not_authenticated";
    }
  | {
      shouldCreateInvite: false;
      reason: "missing_database";
    };

function resolveDeploymentMode(config: PaperclipConfig | null, env: NodeJS.ProcessEnv) {
  const raw = env.ZEPHYR_DEPLOYMENT_MODE?.trim();
  if (raw === "authenticated" || raw === "local_trusted") return raw;
  return config?.server.deploymentMode ?? null;
}

function resolveDbUrl(config: PaperclipConfig | null, explicitDbUrl?: string, env: NodeJS.ProcessEnv = process.env) {
  if (explicitDbUrl) return explicitDbUrl;
  if (env.DATABASE_URL) return env.DATABASE_URL;
  if (config?.database.mode === "postgres" && config.database.connectionString) {
    return config.database.connectionString;
  }
  if (config?.database.mode === "embedded-postgres") {
    const port = config.database.embeddedPostgresPort ?? 54329;
    return `postgres://zephyr:zephyr_nexus@127.0.0.1:${port}/zephyr_nexus`;
  }
  return null;
}

function resolveBaseUrl(config: PaperclipConfig | null, explicitBaseUrl?: string, env: NodeJS.ProcessEnv = process.env) {
  if (explicitBaseUrl) return explicitBaseUrl.replace(/\/+$/, "");
  const fromEnv =
    env.ZEPHYR_PUBLIC_URL ??
    env.ZEPHYR_AUTH_PUBLIC_BASE_URL ??
    env.BETTER_AUTH_URL ??
    env.BETTER_AUTH_BASE_URL;
  if (fromEnv?.trim()) return fromEnv.trim().replace(/\/+$/, "");
  if (config?.auth.baseUrlMode === "explicit" && config.auth.publicBaseUrl) {
    return config.auth.publicBaseUrl.replace(/\/+$/, "");
  }
  const host = config?.server.host ?? "localhost";
  const port = config?.server.port ?? 3100;
  const publicHost = host === "0.0.0.0" ? "localhost" : host;
  return `http://${publicHost}:${port}`;
}

export function resolveBootstrapCeoRuntime(opts: {
  config?: string;
  baseUrl?: string;
  dbUrl?: string;
  env?: NodeJS.ProcessEnv;
}): BootstrapRuntime {
  const env = opts.env ?? process.env;
  const configPath = resolveConfigPath(opts.config);
  const config = readConfig(configPath);
  const deploymentMode = resolveDeploymentMode(config, env);

  if (!config && !deploymentMode) {
    return {
      shouldCreateInvite: false,
      reason: "missing_config",
      configPath,
    };
  }

  if (deploymentMode !== "authenticated") {
    return {
      shouldCreateInvite: false,
      reason: "not_authenticated",
    };
  }

  const dbUrl = resolveDbUrl(config, opts.dbUrl, env);
  if (!dbUrl) {
    return {
      shouldCreateInvite: false,
      reason: "missing_database",
    };
  }

  return {
    shouldCreateInvite: true,
    dbUrl,
    baseUrl: resolveBaseUrl(config, opts.baseUrl, env),
  };
}

export async function bootstrapCeoInvite(opts: {
  config?: string;
  force?: boolean;
  expiresHours?: number;
  baseUrl?: string;
  dbUrl?: string;
}) {
  const configPath = resolveConfigPath(opts.config);
  loadPaperclipEnvFile(configPath);
  const runtime = resolveBootstrapCeoRuntime({
    config: opts.config,
    baseUrl: opts.baseUrl,
    dbUrl: opts.dbUrl,
  });

  if (!runtime.shouldCreateInvite && runtime.reason === "missing_config") {
    p.log.error(
      `No config found at ${runtime.configPath}. Run ${pc.cyan("zephyr onboard")} first, or set ZEPHYR_DEPLOYMENT_MODE=authenticated for env-only deployments.`,
    );
    return;
  }

  if (!runtime.shouldCreateInvite && runtime.reason === "not_authenticated") {
    p.log.info("Deployment mode is local_trusted. Bootstrap CEO invite is only required for authenticated mode.");
    return;
  }

  if (!runtime.shouldCreateInvite && runtime.reason === "missing_database") {
    p.log.error(
      "Could not resolve database connection for bootstrap. Set DATABASE_URL or configure a PostgreSQL database.",
    );
    return;
  }

  const db = createDb(runtime.dbUrl);
  const closableDb = db as typeof db & {
    $client?: {
      end?: (options?: { timeout?: number }) => Promise<void>;
    };
  };
  try {
    const existingAdminCount = await db
      .select()
      .from(instanceUserRoles)
      .where(eq(instanceUserRoles.role, "instance_admin"))
      .then((rows) => rows.length);

    if (existingAdminCount > 0 && !opts.force) {
      p.log.info("Instance already has an admin user. Use --force to generate a new bootstrap invite.");
      return;
    }

    const now = new Date();
    await db
      .update(invites)
      .set({ revokedAt: now, updatedAt: now })
      .where(
        and(
          eq(invites.inviteType, "bootstrap_ceo"),
          isNull(invites.revokedAt),
          isNull(invites.acceptedAt),
          gt(invites.expiresAt, now),
        ),
      );

    const token = createInviteToken();
    const expiresHours = Math.max(1, Math.min(24 * 30, opts.expiresHours ?? 72));
    const created = await db
      .insert(invites)
      .values({
        inviteType: "bootstrap_ceo",
        tokenHash: hashToken(token),
        allowedJoinTypes: "human",
        expiresAt: new Date(Date.now() + expiresHours * 60 * 60 * 1000),
        invitedByUserId: "system",
      })
      .returning()
      .then((rows) => rows[0]);

    const inviteUrl = `${runtime.baseUrl}/invite/${token}`;
    p.log.success("Created bootstrap CEO invite.");
    p.log.message(`Invite URL: ${pc.cyan(inviteUrl)}`);
    p.log.message(`Expires: ${pc.dim(created.expiresAt.toISOString())}`);
  } catch (err) {
    p.log.error(`Could not create bootstrap invite: ${err instanceof Error ? err.message : String(err)}`);
    p.log.info("If using embedded-postgres, start the Zephyr Nexus server and run this command again.");
  } finally {
    await closableDb.$client?.end?.({ timeout: 5 }).catch(() => undefined);
  }
}
