import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@zephyr-nexus/adapter-utils";
import { asString, parseObject } from "@zephyr-nexus/adapter-utils/server-utils";
import { testEnvironment as openCodeTestEnvironment } from "@zephyr-nexus/adapter-opencode-local/server";
import { testEnvironment as codexTestEnvironment } from "@zephyr-nexus/adapter-codex-local/server";
import { DEEPSEEK_API_KEY_ENV, DEFAULT_DEEPSEEK_ENGINE } from "../index.js";

type EngineTest = (
  ctx: AdapterEnvironmentTestContext,
) => Promise<AdapterEnvironmentTestResult>;

export interface DeepSeekEngineTestOverrides {
  opencode?: EngineTest;
  codex?: EngineTest;
}

function summarizeStatus(
  checks: AdapterEnvironmentCheck[],
): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
  overrides: DeepSeekEngineTestOverrides = {},
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const env = parseObject(config.env);

  const engineRaw = asString(config.engine, DEFAULT_DEEPSEEK_ENGINE).trim().toLowerCase();
  const engine = engineRaw === "codex" ? "codex" : "opencode";
  checks.push({
    code: "deepseek_engine_selected",
    level: "info",
    message: `DeepSeek runs via the ${engine} engine.`,
  });

  const apiKey = env[DEEPSEEK_API_KEY_ENV] ?? process.env[DEEPSEEK_API_KEY_ENV];
  if (isNonEmpty(apiKey)) {
    checks.push({
      code: "deepseek_api_key_present",
      level: "info",
      message: `${DEEPSEEK_API_KEY_ENV} is set for DeepSeek authentication.`,
    });
  } else {
    checks.push({
      code: "deepseek_api_key_missing",
      level: "error",
      message: `${DEEPSEEK_API_KEY_ENV} is not set. DeepSeek runs will fail until it is configured.`,
      hint: `Add ${DEEPSEEK_API_KEY_ENV} under the agent's environment variables.`,
    });
  }

  const engineTest =
    engine === "codex"
      ? overrides.codex ?? codexTestEnvironment
      : overrides.opencode ?? openCodeTestEnvironment;
  const delegated = await engineTest({ ...ctx, config });
  checks.push(...delegated.checks);

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
