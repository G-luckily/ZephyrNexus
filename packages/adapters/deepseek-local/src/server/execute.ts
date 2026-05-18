import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
} from "@zephyr-nexus/adapter-utils";
import { asString, parseObject } from "@zephyr-nexus/adapter-utils/server-utils";
import { execute as openCodeExecute } from "@zephyr-nexus/adapter-opencode-local/server";
import { execute as codexExecute } from "@zephyr-nexus/adapter-codex-local/server";
import {
  DEEPSEEK_API_BASE_URL,
  DEEPSEEK_API_KEY_ENV,
  DEFAULT_DEEPSEEK_ENGINE,
  DEFAULT_DEEPSEEK_MODEL,
  type DeepSeekEngine,
} from "../index.js";

type EngineExecute = (ctx: AdapterExecutionContext) => Promise<AdapterExecutionResult>;

/** Engine implementations are injectable so tests can run without the CLIs installed. */
export interface DeepSeekEngineOverrides {
  opencode?: EngineExecute;
  codex?: EngineExecute;
}

function resolveEngine(value: unknown): DeepSeekEngine {
  return asString(value, DEFAULT_DEEPSEEK_ENGINE).trim().toLowerCase() === "codex"
    ? "codex"
    : "opencode";
}

/** Strip a leading "<provider>/" prefix so Codex receives a bare model id. */
function bareModelId(model: string): string {
  return model.includes("/") ? model.slice(model.lastIndexOf("/") + 1) : model;
}

/** Route the model through the OpenCode "deepseek" provider namespace. */
function openCodeModelId(model: string): string {
  return model.includes("/") ? model : `deepseek/${bareModelId(model)}`;
}

function hasDeepSeekApiKey(env: Record<string, unknown>): boolean {
  const raw = env[DEEPSEEK_API_KEY_ENV];
  return typeof raw === "string" && raw.trim().length > 0;
}

function buildCodexProviderArgs(apiBaseUrl: string): string[] {
  // Codex consumes repeated `-c key=value` overrides; values are TOML literals.
  const overrides: Array<[string, string]> = [
    ["model_provider", "deepseek"],
    ["model_providers.deepseek.name", "DeepSeek"],
    ["model_providers.deepseek.base_url", apiBaseUrl],
    ["model_providers.deepseek.env_key", DEEPSEEK_API_KEY_ENV],
    ["model_providers.deepseek.wire_api", "chat"],
  ];
  return overrides.flatMap(([key, value]) => ["-c", `${key}=${JSON.stringify(value)}`]);
}

/**
 * Execute a DeepSeek-backed run by delegating to the configured local engine.
 *
 * The DeepSeek API key must be supplied via the DEEPSEEK_API_KEY environment
 * variable in `config.env` — validated here at the system boundary.
 */
export async function execute(
  ctx: AdapterExecutionContext,
  overrides: DeepSeekEngineOverrides = {},
): Promise<AdapterExecutionResult> {
  const config = parseObject(ctx.config);
  const env = parseObject(config.env);
  if (!hasDeepSeekApiKey(env)) {
    throw new Error(
      `deepseek_local requires the ${DEEPSEEK_API_KEY_ENV} environment variable. ` +
        `Add it under the agent's environment variables (plaintext or a secret reference).`,
    );
  }

  const engine = resolveEngine(config.engine);
  const model = asString(config.model, DEFAULT_DEEPSEEK_MODEL).trim() || DEFAULT_DEEPSEEK_MODEL;
  const apiBaseUrl = asString(config.apiBaseUrl, DEEPSEEK_API_BASE_URL).trim() || DEEPSEEK_API_BASE_URL;

  if (engine === "codex") {
    const existingArgs = Array.isArray(config.extraArgs) ? config.extraArgs : [];
    const codexConfig: Record<string, unknown> = {
      ...config,
      model: bareModelId(model),
      extraArgs: [...buildCodexProviderArgs(apiBaseUrl), ...existingArgs],
    };
    const codexExec = overrides.codex ?? codexExecute;
    return codexExec({ ...ctx, config: codexConfig });
  }

  const openCodeConfig: Record<string, unknown> = {
    ...config,
    model: openCodeModelId(model),
  };
  const openCodeExec = overrides.opencode ?? openCodeExecute;
  return openCodeExec({ ...ctx, config: openCodeConfig });
}
