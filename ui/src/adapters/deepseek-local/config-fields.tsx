import type { AdapterConfigFieldsProps } from "../types";
import { Field, DraftInput } from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

const DEFAULT_API_BASE_URL = "https://api.deepseek.com";

const apiKeyHint =
  "Add DEEPSEEK_API_KEY under \"Environment variables\" below — as a plaintext value or a company secret reference.";
const engineHint =
  "Local execution engine that runs DeepSeek. OpenCode routes the model via its deepseek provider; Codex uses a custom OpenAI-compatible provider.";
const baseUrlHint =
  "OpenAI-compatible API endpoint. Keep the DeepSeek default, or point it at another compatible third-party provider.";

export function DeepSeekLocalConfigFields({
  isCreate,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  if (isCreate) {
    return (
      <Field label="DeepSeek API key" hint={apiKeyHint}>
        <p className="text-xs text-muted-foreground">
          DeepSeek runs via the OpenCode engine by default. After creating the
          agent, you can switch the engine or override the API base URL in its
          configuration.
        </p>
      </Field>
    );
  }

  const engine = String(eff("adapterConfig", "engine", String(config.engine ?? "opencode")));

  return (
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
      <Field label="DeepSeek API key" hint={apiKeyHint}>
        <p className="text-xs text-muted-foreground">
          Set <code>DEEPSEEK_API_KEY</code> under &quot;Environment
          variables&quot; below.
        </p>
      </Field>
    </>
  );
}
