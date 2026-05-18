import type { AdapterConfigFieldsProps } from "../types";
import { Field, DraftInput } from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

const DEFAULT_API_BASE_URL = "https://api.deepseek.com";
const API_KEY_ENV = "DEEPSEEK_API_KEY";

const apiKeyHint =
  "DeepSeek 服务商密钥（sk-...）。填在这里会自动写入 DEEPSEEK_API_KEY 环境变量，无需再去下方环境变量栏手动添加。";
const engineHint =
  "运行 DeepSeek 的本地执行引擎。OpenCode 通过其 deepseek provider 路由模型；Codex 使用自定义 OpenAI 兼容 provider。";
const baseUrlHint =
  "OpenAI 兼容 API 端点。保留 DeepSeek 默认值，或指向其它兼容的第三方服务商。";

type EnvMap = Record<string, unknown>;

/** Extract a plaintext value from an EnvBinding (string | {type:"plain",value}). */
function plainValueOf(binding: unknown): string {
  if (typeof binding === "string") return binding;
  if (binding && typeof binding === "object" && !Array.isArray(binding)) {
    const rec = binding as Record<string, unknown>;
    if (rec.type === "plain" && typeof rec.value === "string") return rec.value;
  }
  return "";
}

/** True when the binding is a company-secret reference rather than a plain value. */
function isSecretRef(binding: unknown): boolean {
  return (
    !!binding &&
    typeof binding === "object" &&
    !Array.isArray(binding) &&
    (binding as Record<string, unknown>).type === "secret_ref"
  );
}

export function DeepSeekLocalConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  // Current env bindings: create mode reads draft form values, edit mode reads adapterConfig.
  const env: EnvMap = isCreate
    ? ((values?.envBindings ?? {}) as EnvMap)
    : (eff("adapterConfig", "env", (config.env ?? {}) as EnvMap) as EnvMap);

  const apiKeyBinding = env[API_KEY_ENV];
  const apiKeyIsSecretRef = isSecretRef(apiKeyBinding);
  const apiKeyValue = plainValueOf(apiKeyBinding);

  const commitApiKey = (raw: string) => {
    const value = raw.trim();
    const next: EnvMap = { ...env };
    if (value) next[API_KEY_ENV] = { type: "plain", value };
    else delete next[API_KEY_ENV];
    if (isCreate) set?.({ envBindings: next });
    else mark("adapterConfig", "env", next);
  };

  const engine = isCreate
    ? "opencode"
    : String(eff("adapterConfig", "engine", String(config.engine ?? "opencode")));

  return (
    <>
      <Field label="DeepSeek API key" hint={apiKeyHint}>
        {apiKeyIsSecretRef ? (
          <p className="text-xs text-muted-foreground">
            <code>{API_KEY_ENV}</code>{" "}
            已绑定为公司密钥引用，请在下方「环境变量」编辑器中管理。
          </p>
        ) : (
          <DraftInput
            value={apiKeyValue}
            onCommit={commitApiKey}
            immediate
            className={inputClass}
            placeholder="sk-..."
            autoComplete="off"
            spellCheck={false}
          />
        )}
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
