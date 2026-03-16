import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { AdapterConfigFieldsProps } from "../types";
import {
  Field,
  DraftInput,
  help,
} from "../../components/agent-config-primitives";
import {
  PayloadTemplateJsonField,
  RuntimeServicesJsonField,
} from "../runtime-json-fields";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

function SecretField({
  label,
  value,
  onCommit,
  placeholder,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          {visible ? (
            <Eye className="h-3.5 w-3.5" />
          ) : (
            <EyeOff className="h-3.5 w-3.5" />
          )}
        </button>
        <DraftInput
          value={value}
          onCommit={onCommit}
          immediate
          type={visible ? "text" : "password"}
          className={inputClass + " pl-8"}
          placeholder={placeholder}
        />
      </div>
    </Field>
  );
}

function parseScopes(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .join(", ");
  }
  return typeof value === "string" ? value : "";
}

export function OpenClawGatewayConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  const configuredHeaders =
    config.headers &&
    typeof config.headers === "object" &&
    !Array.isArray(config.headers)
      ? (config.headers as Record<string, unknown>)
      : {};
  const effectiveHeaders =
    (eff("adapterConfig", "headers", configuredHeaders) as Record<
      string,
      unknown
    >) ?? {};

  const effectiveGatewayToken =
    typeof effectiveHeaders["x-openclaw-token"] === "string"
      ? String(effectiveHeaders["x-openclaw-token"])
      : typeof effectiveHeaders["x-openclaw-auth"] === "string"
      ? String(effectiveHeaders["x-openclaw-auth"])
      : "";

  const commitGatewayToken = (rawValue: string) => {
    const nextValue = rawValue.trim();
    const nextHeaders: Record<string, unknown> = { ...effectiveHeaders };
    if (nextValue) {
      nextHeaders["x-openclaw-token"] = nextValue;
      delete nextHeaders["x-openclaw-auth"];
    } else {
      delete nextHeaders["x-openclaw-token"];
      delete nextHeaders["x-openclaw-auth"];
    }
    mark(
      "adapterConfig",
      "headers",
      Object.keys(nextHeaders).length > 0 ? nextHeaders : undefined
    );
  };

  const sessionStrategy = eff(
    "adapterConfig",
    "sessionKeyStrategy",
    String(config.sessionKeyStrategy ?? "fixed")
  );

  return (
    <>
      <Field label="Gateway URL" hint={help.webhookUrl}>
        <DraftInput
          value={
            isCreate
              ? values!.url
              : eff("adapterConfig", "url", String(config.url ?? ""))
          }
          onCommit={(v) =>
            isCreate
              ? set!({ url: v })
              : mark("adapterConfig", "url", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="ws://127.0.0.1:18789"
        />
      </Field>

      <PayloadTemplateJsonField
        isCreate={isCreate}
        values={values}
        set={set}
        config={config}
        mark={mark}
      />

      <RuntimeServicesJsonField
        isCreate={isCreate}
        values={values}
        set={set}
        config={config}
        mark={mark}
      />

      {!isCreate && (
        <>
          <Field
            label="Office dispatch (high cost)"
            hint="默认关闭。开启后会调用本地 office_dispatch.sh 进行多阶段多角色流水线，容易产生高 token/高费用；仅建议在少数高阶架构/协同任务中手动开启。"
          >
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={Boolean(
                  eff("adapterConfig", "officeDispatchEnabled", Boolean(config.officeDispatchEnabled ?? false))
                )}
                onChange={(e) =>
                  mark("adapterConfig", "officeDispatchEnabled", e.target.checked || undefined)
                }
              />
              <span
                className={cn(
                  "leading-relaxed",
                  Boolean(
                    eff("adapterConfig", "officeDispatchEnabled", Boolean(config.officeDispatchEnabled ?? false))
                  )
                    ? "text-amber-300"
                    : "text-muted-foreground"
                )}
              >
                启用 office_dispatch.sh（高成本，谨慎）
              </span>
            </label>
          </Field>

          <Field
            label="Office dispatch script path (optional)"
            hint="仅在启用 office dispatch 时需要。留空则尝试读取 OPENCLAW_OFFICE_DISPATCH_SCRIPT 或默认路径 ~/projects/openclaw-workspace/scripts/office_dispatch.sh"
          >
            <DraftInput
              value={eff(
                "adapterConfig",
                "officeDispatchScriptPath",
                String(config.officeDispatchScriptPath ?? "")
              )}
              onCommit={(v) =>
                mark("adapterConfig", "officeDispatchScriptPath", v || undefined)
              }
              immediate
              className={inputClass}
              placeholder="~/projects/openclaw-workspace/scripts/office_dispatch.sh"
            />
          </Field>

          <Field label="Paperclip API URL override">
            <DraftInput
              value={eff(
                "adapterConfig",
                "paperclipApiUrl",
                String(config.paperclipApiUrl ?? "")
              )}
              onCommit={(v) =>
                mark("adapterConfig", "paperclipApiUrl", v || undefined)
              }
              immediate
              className={inputClass}
              placeholder="https://paperclip.example"
            />
          </Field>

          <Field label="Session strategy">
            <select
              value={sessionStrategy}
              onChange={(e) =>
                mark("adapterConfig", "sessionKeyStrategy", e.target.value)
              }
              className={inputClass}
            >
              <option value="fixed">Fixed</option>
              <option value="issue">Per issue</option>
              <option value="run">Per run</option>
            </select>
          </Field>

          {sessionStrategy === "fixed" && (
            <Field label="Session key">
              <DraftInput
                value={eff(
                  "adapterConfig",
                  "sessionKey",
                  String(config.sessionKey ?? "paperclip")
                )}
                onCommit={(v) =>
                  mark("adapterConfig", "sessionKey", v || undefined)
                }
                immediate
                className={inputClass}
                placeholder="paperclip"
              />
            </Field>
          )}

          <SecretField
            label="Gateway auth token (x-openclaw-token)"
            value={effectiveGatewayToken}
            onCommit={commitGatewayToken}
            placeholder="OpenClaw gateway token"
          />

          <Field label="Role">
            <DraftInput
              value={eff(
                "adapterConfig",
                "role",
                String(config.role ?? "operator")
              )}
              onCommit={(v) => mark("adapterConfig", "role", v || undefined)}
              immediate
              className={inputClass}
              placeholder="operator"
            />
          </Field>

          <Field label="Scopes (comma-separated)">
            <DraftInput
              value={eff(
                "adapterConfig",
                "scopes",
                parseScopes(config.scopes ?? ["operator.admin"])
              )}
              onCommit={(v) => {
                const parsed = v
                  .split(",")
                  .map((entry) => entry.trim())
                  .filter(Boolean);
                mark(
                  "adapterConfig",
                  "scopes",
                  parsed.length > 0 ? parsed : undefined
                );
              }}
              immediate
              className={inputClass}
              placeholder="operator.admin"
            />
          </Field>

          <Field label="Wait timeout (ms)">
            <DraftInput
              value={eff(
                "adapterConfig",
                "waitTimeoutMs",
                String(config.waitTimeoutMs ?? "120000")
              )}
              onCommit={(v) => {
                const parsed = Number.parseInt(v.trim(), 10);
                mark(
                  "adapterConfig",
                  "waitTimeoutMs",
                  Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
                );
              }}
              immediate
              className={inputClass}
              placeholder="120000"
            />
          </Field>

          <Field label="Device auth">
            <div className="text-xs text-muted-foreground leading-relaxed">
              Always enabled for gateway agents. Paperclip persists a device key
              during onboarding so pairing approvals remain stable across runs.
            </div>
          </Field>
        </>
      )}
    </>
  );
}
