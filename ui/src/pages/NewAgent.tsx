import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "@/lib/router";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { AGENT_ROLES, type AgentRole } from "@zephyr-nexus/shared";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Building2, Layers3, Shield, User } from "lucide-react";
import { cn, agentUrl } from "../lib/utils";
import { roleLabels } from "../components/agent-config-primitives";
import {
  AgentConfigForm,
  type CreateConfigValues,
} from "../components/AgentConfigForm";
import { defaultCreateValues } from "../components/agent-config-defaults";
import { getUIAdapter } from "../adapters";
import { AgentIcon } from "../components/AgentIconPicker";
import {
  DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX,
  DEFAULT_CODEX_LOCAL_MODEL,
} from "@zephyr-nexus/adapter-codex-local";
import { DEFAULT_CURSOR_LOCAL_MODEL } from "@zephyr-nexus/adapter-cursor-local";
import {
  departmentLabelFromKey,
  deriveOrgDepartmentOptions,
  roleFallbackDepartmentKey,
} from "../lib/org-structure";

const SUPPORTED_ADVANCED_ADAPTER_TYPES = new Set<
  CreateConfigValues["adapterType"]
>([
  "claude_local",
  "codex_local",
  "opencode_local",
  "pi_local",
  "cursor",
  "openclaw_gateway",
]);

const ORG_LAYER_OPTIONS = [
  { key: "director", label: "总监层" },
  { key: "specialist", label: "专员层" },
] as const;

type OrgLayerKey = (typeof ORG_LAYER_OPTIONS)[number]["key"];

function createValuesForAdapterType(
  adapterType: CreateConfigValues["adapterType"]
): CreateConfigValues {
  const { adapterType: _discard, ...defaults } = defaultCreateValues;
  const nextValues: CreateConfigValues = { ...defaults, adapterType };
  if (adapterType === "codex_local") {
    nextValues.model = DEFAULT_CODEX_LOCAL_MODEL;
    nextValues.dangerouslyBypassSandbox =
      DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX;
  } else if (adapterType === "cursor") {
    nextValues.model = DEFAULT_CURSOR_LOCAL_MODEL;
  } else if (adapterType === "opencode_local") {
    nextValues.model = "";
  }
  return nextValues;
}

export function NewAgent() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetAdapterType = searchParams.get("adapterType");
  const presetDepartmentKey = searchParams.get("departmentKey");

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState<AgentRole>("general");
  const [reportsTo, setReportsTo] = useState("");
  const [orgLayer, setOrgLayer] = useState<OrgLayerKey>("specialist");
  const [departmentKey, setDepartmentKey] = useState("");
  const [isDirectToBoss, setIsDirectToBoss] = useState(false);
  const [capabilities, setCapabilities] = useState("");
  const [configValues, setConfigValues] =
    useState<CreateConfigValues>(defaultCreateValues);
  const [roleOpen, setRoleOpen] = useState(false);
  const [reportsToOpen, setReportsToOpen] = useState(false);
  const [layerOpen, setLayerOpen] = useState(false);
  const [departmentOpen, setDepartmentOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const {
    data: adapterModels,
    error: adapterModelsError,
    isLoading: adapterModelsLoading,
    isFetching: adapterModelsFetching,
  } = useQuery({
    queryKey: selectedCompanyId
      ? queryKeys.agents.adapterModels(
          selectedCompanyId,
          configValues.adapterType
        )
      : ["agents", "none", "adapter-models", configValues.adapterType],
    queryFn: () =>
      agentsApi.adapterModels(selectedCompanyId!, configValues.adapterType),
    enabled: Boolean(selectedCompanyId),
  });

  const isFirstAgent = !agents || agents.length === 0;
  const effectiveRole = isFirstAgent ? "ceo" : role;
  const ceoAgent = useMemo(
    () => (agents ?? []).find((agent) => agent.role === "ceo") ?? null,
    [agents]
  );
  const departmentOptions = useMemo(
    () => deriveOrgDepartmentOptions(agents ?? []),
    [agents]
  );
  const selectedDepartmentLabel = useMemo(
    () =>
      departmentKey
        ? departmentLabelFromKey(departmentKey, departmentOptions)
        : "未分配",
    [departmentKey, departmentOptions]
  );

  useEffect(() => {
    setBreadcrumbs([
      { label: "智能体", href: "/agents" },
      { label: "新增智能体" },
    ]);
  }, [setBreadcrumbs]);

  useEffect(() => {
    if (isFirstAgent) {
      if (!name) setName("CEO");
      if (!title) setTitle("CEO");
    }
  }, [isFirstAgent]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const requested = presetAdapterType;
    if (!requested) return;
    if (
      !SUPPORTED_ADVANCED_ADAPTER_TYPES.has(
        requested as CreateConfigValues["adapterType"]
      )
    ) {
      return;
    }
    setConfigValues((prev) => {
      if (prev.adapterType === requested) return prev;
      return createValuesForAdapterType(
        requested as CreateConfigValues["adapterType"]
      );
    });
  }, [presetAdapterType]);

  useEffect(() => {
    if (departmentOptions.length === 0) return;
    const fallbackKey = roleFallbackDepartmentKey(effectiveRole);
    if (!departmentKey) {
      const next =
        departmentOptions.find((item) => item.key === fallbackKey)?.key ??
        departmentOptions[0]?.key ??
        "";
      if (next) setDepartmentKey(next);
      return;
    }
    if (!departmentOptions.some((item) => item.key === departmentKey)) {
      const next =
        departmentOptions.find((item) => item.key === fallbackKey)?.key ??
        departmentOptions[0]?.key ??
        "";
      if (next) setDepartmentKey(next);
    }
  }, [departmentOptions, departmentKey, effectiveRole]);

  useEffect(() => {
    if (!presetDepartmentKey || departmentOptions.length === 0) return;
    if (!departmentOptions.some((item) => item.key === presetDepartmentKey)) {
      return;
    }
    setDepartmentKey(presetDepartmentKey);
  }, [presetDepartmentKey, departmentOptions]);

  useEffect(() => {
    if (!isDirectToBoss || isFirstAgent) return;
    if (ceoAgent?.id) {
      setReportsTo(ceoAgent.id);
    }
  }, [isDirectToBoss, isFirstAgent, ceoAgent]);

  const createAgent = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      agentsApi.hire(selectedCompanyId!, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.agents.list(selectedCompanyId!),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.org(selectedCompanyId!),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.approvals.list(selectedCompanyId!),
      });
      navigate(agentUrl(result.agent));
    },
    onError: (error) => {
      setFormError(
        error instanceof Error ? error.message : "创建智能体失败"
      );
    },
  });

  function buildAdapterConfig() {
    const adapter = getUIAdapter(configValues.adapterType);
    return adapter.buildAdapterConfig(configValues);
  }

  function handleSubmit() {
    if (!selectedCompanyId || !name.trim()) return;
    setFormError(null);
    if (configValues.adapterType === "opencode_local") {
      const selectedModel = configValues.model.trim();
      if (!selectedModel) {
        setFormError(
          "OpenCode 需要显式模型，格式为 provider/model。"
        );
        return;
      }
      if (adapterModelsError) {
        setFormError(
          adapterModelsError instanceof Error
            ? adapterModelsError.message
            : "加载 OpenCode 模型失败。"
        );
        return;
      }
      if (adapterModelsLoading || adapterModelsFetching) {
        setFormError(
          "OpenCode 模型仍在加载，请稍后重试。"
        );
        return;
      }
      const discovered = adapterModels ?? [];
      if (!discovered.some((entry) => entry.id === selectedModel)) {
        setFormError(
          discovered.length === 0
            ? "未发现 OpenCode 模型，请先执行 `opencode models` 并完成提供方认证。"
            : `当前配置的 OpenCode 模型不可用：${selectedModel}`
        );
        return;
      }
    }
    const managerId =
      isFirstAgent
        ? ""
        : isDirectToBoss
        ? (ceoAgent?.id ?? "")
        : reportsTo;
    const layerLabel =
      ORG_LAYER_OPTIONS.find((item) => item.key === orgLayer)?.label ??
      "专员层";
    const metadata: Record<string, unknown> = {
      orgLayer: layerLabel,
      departmentKey: departmentKey || null,
      departmentLabel: selectedDepartmentLabel,
      directToBoss: isDirectToBoss,
    };

    createAgent.mutate({
      name: name.trim(),
      role: effectiveRole,
      ...(title.trim() ? { title: title.trim() } : {}),
      ...(capabilities.trim() ? { capabilities: capabilities.trim() } : {}),
      ...(managerId ? { reportsTo: managerId } : {}),
      metadata,
      adapterType: configValues.adapterType,
      adapterConfig: buildAdapterConfig(),
      runtimeConfig: {
        heartbeat: {
          enabled: configValues.heartbeatEnabled,
          intervalSec: configValues.intervalSec,
          wakeOnDemand: true,
          cooldownSec: 10,
          maxConcurrentRuns: 1,
        },
      },
      budgetMonthlyCents: 0,
    });
  }

  const currentReportsTo = isDirectToBoss
    ? ceoAgent
    : (agents ?? []).find((a) => a.id === reportsTo);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold">新增智能体</h1>
        <p className="text-sm text-muted-foreground mt-1">
          组织扩编与运行配置
        </p>
      </div>

      <div className="border border-border">
        {/* Name */}
        <div className="px-4 pt-4 pb-2">
          <input
            className="w-full text-lg font-semibold bg-transparent outline-none placeholder:text-muted-foreground/50"
            placeholder="智能体名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        {/* Title */}
        <div className="px-4 pb-2">
          <input
            className="w-full bg-transparent outline-none text-sm text-muted-foreground placeholder:text-muted-foreground/40"
            placeholder="岗位角色（例如：岗位分析专员）"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Property chips: Role + Layer + Department + Reports To */}
        <div className="flex items-center gap-1.5 border-t border-border px-4 py-2.5 flex-wrap">
          <Popover open={roleOpen} onOpenChange={setRoleOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors",
                  isFirstAgent && "opacity-60 cursor-not-allowed"
                )}
                disabled={isFirstAgent}
              >
                <Shield className="h-3 w-3 text-muted-foreground" />
                岗位角色 · {roleLabels[effectiveRole] ?? effectiveRole}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-36 p-1" align="start">
              {AGENT_ROLES.map((r) => (
                <button
                  key={r}
                  className={cn(
                    "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                    r === role && "bg-accent"
                  )}
                  onClick={() => {
                    setRole(r);
                    setRoleOpen(false);
                  }}
                >
                  {roleLabels[r] ?? r}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <Popover open={layerOpen} onOpenChange={setLayerOpen}>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors">
                <Layers3 className="h-3 w-3 text-muted-foreground" />
                所属层级 ·{" "}
                {ORG_LAYER_OPTIONS.find((item) => item.key === orgLayer)?.label}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-36 p-1" align="start">
              {ORG_LAYER_OPTIONS.map((item) => (
                <button
                  key={item.key}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent/50",
                    item.key === orgLayer && "bg-accent"
                  )}
                  onClick={() => {
                    setOrgLayer(item.key);
                    setLayerOpen(false);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <Popover open={departmentOpen} onOpenChange={setDepartmentOpen}>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors">
                <Building2 className="h-3 w-3 text-muted-foreground" />
                所属部门 · {selectedDepartmentLabel}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="start">
              {departmentOptions.map((item) => (
                <button
                  key={item.key}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent/50",
                    item.key === departmentKey && "bg-accent"
                  )}
                  onClick={() => {
                    setDepartmentKey(item.key);
                    setDepartmentOpen(false);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <Popover open={reportsToOpen} onOpenChange={setReportsToOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors",
                  (isFirstAgent || isDirectToBoss) &&
                    "opacity-60 cursor-not-allowed"
                )}
                disabled={isFirstAgent || isDirectToBoss}
              >
                {currentReportsTo ? (
                  <>
                    <AgentIcon
                      icon={currentReportsTo.icon}
                      className="h-3 w-3 text-muted-foreground"
                    />
                    直属上级 · {currentReportsTo.name}
                  </>
                ) : (
                  <>
                    <User className="h-3 w-3 text-muted-foreground" />
                    {isFirstAgent ? "直属上级 · N/A (CEO)" : "直属上级 · 请选择"}
                  </>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="start">
              <button
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                  !reportsTo && "bg-accent"
                )}
                onClick={() => {
                  setIsDirectToBoss(false);
                  setReportsTo("");
                  setReportsToOpen(false);
                }}
              >
                无直属上级
              </button>
              {(agents ?? []).map((a) => (
                <button
                  key={a.id}
                  className={cn(
                    "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 truncate",
                    a.id === reportsTo && "bg-accent"
                  )}
                  onClick={() => {
                    setIsDirectToBoss(false);
                    setReportsTo(a.id);
                    setReportsToOpen(false);
                  }}
                >
                  <AgentIcon
                    icon={a.icon}
                    className="shrink-0 h-3 w-3 text-muted-foreground"
                  />
                  {a.name}
                  <span className="text-muted-foreground ml-auto">
                    {roleLabels[a.role] ?? a.role}
                  </span>
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <button
            type="button"
            disabled={isFirstAgent || !ceoAgent}
            onClick={() => {
              setIsDirectToBoss((prev) => !prev);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
              isDirectToBoss
                ? "border-primary/35 bg-primary/10 text-foreground"
                : "border-border hover:bg-accent/50",
              (isFirstAgent || !ceoAgent) && "cursor-not-allowed opacity-60"
            )}
          >
            是否直属老板智能体 · {isDirectToBoss ? "是" : "否"}
          </button>
        </div>

        <div className="border-t border-border px-4 py-3">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            工作职责
          </label>
          <textarea
            value={capabilities}
            onChange={(e) => setCapabilities(e.target.value)}
            placeholder="例如：负责岗位分析、候选人初筛与数据汇总。"
            className="h-24 w-full resize-none rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/45 focus-visible:border-primary/40"
          />
        </div>

        {/* Shared config form */}
        <AgentConfigForm
          mode="create"
          values={configValues}
          onChange={(patch) =>
            setConfigValues((prev) => ({ ...prev, ...patch }))
          }
          adapterModels={adapterModels}
        />

        {/* Footer */}
        <div className="border-t border-border px-4 py-3">
          {isFirstAgent && (
            <p className="text-xs text-muted-foreground mb-2">
              首个智能体将自动设为 CEO
            </p>
          )}
          {formError && (
            <p className="text-xs text-destructive mb-2">{formError}</p>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/agents")}
            >
              取消
            </Button>
            <Button
              size="sm"
              disabled={!name.trim() || createAgent.isPending}
              onClick={handleSubmit}
            >
              {createAgent.isPending ? "创建中…" : "创建智能体"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
