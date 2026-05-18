import type { AdapterConfigFieldsProps } from "../types";
import { Field, DraftInput } from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

const DEFAULT_API_BASE_URL = "https://api.deepseek.com";

const engineHint =
  "运行 DeepSeek 的本地执行引擎。OpenCode 通过其 deepseek provider 路由模型；Codex 使用自定义 OpenAI 兼容 provider。";
const baseUrlHint =
  "OpenAI 兼容 API 端点。保留 DeepSeek 默认值，或指向其它兼容的第三方服务商。";

export function DeepSeekLocalConfigFields({
  isCreate,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  const engine = isCreate
    ? "opencode"
    : String(eff("adapterConfig", "engine", String(config.engine ?? "opencode")));

  return (
    <>
      <Field label="DeepSeek API key">
        <p className="text-xs text-muted-foreground leading-relaxed">
          在下方「环境变量 / Environment variables」中添加一条：键名{" "}
          <code>DEEPSEEK_API_KEY</code>，值为你的 DeepSeek 密钥（<code>sk-...</code>）。
          <br />
          如果实例开启了严格密钥模式，请把该行的来源切换为 <strong>Secret</strong> 并点{" "}
          <strong>Seal / New</strong> 存为密钥引用（明文会被拒绝）。
        </p>
      </Field>

      {isCreate ? (
        <p className="text-xs text-muted-foreground">
          DeepSeek 默认通过 OpenCode 引擎运行。创建 Agent 后可在配置中切换引擎或覆盖 API base URL。
        </p>
      ) : (
        <>
          <Field label="Execution engine" hint={engineHint}>
            <select
              className={inputClass}
              value={engine === "codex" ? "codex" : "opencode"}
              onChange={(e) => mark("adapterConfig", "engine", e.target.value)}
            >
              <option value="opencode">OpenCode</option>
              <option value="codex">Codex</option>
            </select>
          </Field>
          <Field label="API base URL" hint={baseUrlHint}>
            <DraftInput
              value={eff(
                "adapterConfig",
                "apiBaseUrl",
                String(config.apiBaseUrl ?? DEFAULT_API_BASE_URL)
              )}
              onCommit={(v) =>
                mark("adapterConfig", "apiBaseUrl", v.trim() || DEFAULT_API_BASE_URL)
              }
              immediate
              className={inputClass}
              placeholder={DEFAULT_API_BASE_URL}
            />
          </Field>
        </>
      )}
    </>
  );
}
