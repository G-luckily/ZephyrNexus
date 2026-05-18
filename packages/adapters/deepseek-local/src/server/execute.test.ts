import { describe, expect, it } from "vitest";
import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
} from "@zephyr-nexus/adapter-utils";
import { execute } from "./execute.js";

const OK_RESULT: AdapterExecutionResult = {
  exitCode: 0,
  signal: null,
  timedOut: false,
};

function makeContext(config: Record<string, unknown>): AdapterExecutionContext {
  return {
    runId: "run-1",
    agent: {
      id: "agent-1",
      companyId: "company-1",
      name: "DeepSeek Agent",
      adapterType: "deepseek_local",
      adapterConfig: config,
    },
    runtime: {
      sessionId: null,
      sessionParams: null,
      sessionDisplayId: null,
      taskKey: null,
    },
    config,
    context: {},
    onLog: async () => {},
  };
}

describe("deepseek_local execute", () => {
  it("test_execute_with_opencode_engine_rewrites_model_to_provider_prefix", async () => {
    let received: AdapterExecutionContext | null = null;
    const config = {
      engine: "opencode",
      model: "deepseek-chat",
      env: { DEEPSEEK_API_KEY: "sk-test" },
    };
    await execute(makeContext(config), {
      opencode: async (ctx) => {
        received = ctx;
        return OK_RESULT;
      },
    });
    expect(received).not.toBeNull();
    expect(received!.config.model).toBe("deepseek/deepseek-chat");
  });

  it("test_execute_with_codex_engine_injects_provider_config_args", async () => {
    let received: AdapterExecutionContext | null = null;
    const config = {
      engine: "codex",
      model: "deepseek-reasoner",
      apiBaseUrl: "https://api.deepseek.com",
      env: { DEEPSEEK_API_KEY: "sk-test" },
    };
    await execute(makeContext(config), {
      codex: async (ctx) => {
        received = ctx;
        return OK_RESULT;
      },
    });
    expect(received).not.toBeNull();
    expect(received!.config.model).toBe("deepseek-reasoner");
    const args = received!.config.extraArgs as string[];
    expect(args).toContain("-c");
    expect(args).toContain('model_provider="deepseek"');
    expect(args).toContain('model_providers.deepseek.base_url="https://api.deepseek.com"');
    expect(args).toContain('model_providers.deepseek.env_key="DEEPSEEK_API_KEY"');
  });

  it("test_execute_without_deepseek_api_key_raises_error", async () => {
    const config = { engine: "opencode", model: "deepseek-chat", env: {} };
    await expect(
      execute(makeContext(config), {
        opencode: async () => OK_RESULT,
        codex: async () => OK_RESULT,
      }),
    ).rejects.toThrow(/DEEPSEEK_API_KEY/);
  });

  it("test_execute_with_codex_engine_strips_provider_prefix_from_model", async () => {
    let received: AdapterExecutionContext | null = null;
    const config = {
      engine: "codex",
      model: "deepseek/deepseek-chat",
      env: { DEEPSEEK_API_KEY: "sk-test" },
    };
    await execute(makeContext(config), {
      codex: async (ctx) => {
        received = ctx;
        return OK_RESULT;
      },
    });
    expect(received!.config.model).toBe("deepseek-chat");
  });
});
