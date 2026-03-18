import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router";
import { useDialog } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Bot,
  Code,
  MousePointer2,
  Sparkles,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OpenCodeLogoIcon } from "./OpenCodeLogoIcon";
import {
  departmentLabelFromKey,
  deriveOrgDepartmentOptions,
} from "../lib/org-structure";

type AdvancedAdapterType =
  | "claude_local"
  | "codex_local"
  | "opencode_local"
  | "pi_local"
  | "cursor"
  | "openclaw_gateway";

const ADVANCED_ADAPTER_OPTIONS: Array<{
  value: AdvancedAdapterType;
  label: string;
  desc: string;
  icon: ComponentType<{ className?: string }>;
  recommended?: boolean;
}> = [
  {
    value: "claude_local",
    label: "Claude Code",
    icon: Sparkles,
    desc: "Local Claude agent",
    recommended: true,
  },
  {
    value: "codex_local",
    label: "Codex",
    icon: Code,
    desc: "Local Codex agent",
    recommended: true,
  },
  {
    value: "opencode_local",
    label: "OpenCode",
    icon: OpenCodeLogoIcon,
    desc: "Local multi-provider agent",
  },
  {
    value: "pi_local",
    label: "Pi",
    icon: Terminal,
    desc: "Local Pi agent",
  },
  {
    value: "cursor",
    label: "Cursor",
    icon: MousePointer2,
    desc: "Local Cursor agent",
  },
  {
    value: "openclaw_gateway",
    label: "OpenClaw Gateway",
    icon: Bot,
    desc: "Invoke OpenClaw via gateway protocol",
  },
];

export function NewAgentDialog() {
  const { newAgentOpen, closeNewAgent, openNewIssue } = useDialog();
  const { selectedCompanyId } = useCompany();
  const navigate = useNavigate();
  const [showAdvancedCards, setShowAdvancedCards] = useState(false);
  const [requestedDepartmentKey, setRequestedDepartmentKey] = useState("");

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && newAgentOpen,
  });

  const ceoAgent = (agents ?? []).find((a) => a.role === "ceo");
  const departmentOptions = useMemo(
    () => deriveOrgDepartmentOptions(agents ?? []),
    [agents]
  );
  const selectedDepartmentLabel = useMemo(
    () =>
      requestedDepartmentKey
        ? departmentLabelFromKey(requestedDepartmentKey, departmentOptions)
        : "公共责任部",
    [requestedDepartmentKey, departmentOptions]
  );

  useEffect(() => {
    if (!newAgentOpen) return;
    if (requestedDepartmentKey) return;
    if (departmentOptions.length === 0) return;
    setRequestedDepartmentKey(departmentOptions[0]?.key ?? "");
  }, [newAgentOpen, requestedDepartmentKey, departmentOptions]);

  function ensureRequestedDepartmentKey() {
    if (requestedDepartmentKey) return requestedDepartmentKey;
    const fallback = departmentOptions[0]?.key ?? "public-affairs";
    setRequestedDepartmentKey(fallback);
    return fallback;
  }

  function handleAskCeo() {
    const departmentKey = ensureRequestedDepartmentKey();
    const departmentLabel = departmentLabelFromKey(
      departmentKey,
      departmentOptions
    );
    closeNewAgent();
    openNewIssue({
      assigneeAgentId: ceoAgent?.id,
      title: `新增智能体 · ${departmentLabel}`,
      description: `请新增一个智能体并归属到 ${departmentLabel}。\n\n请补全以下字段：\n- 智能体名称：\n- 所属层级（总监层/专员层）：\n- 所属部门：${departmentLabel}\n- 岗位角色：\n- 工作职责：\n- 是否直属老板智能体：\n- 接入方式 / 网关类型：`,
    });
  }

  function handleAdvancedConfig() {
    setShowAdvancedCards(true);
  }

  function handleAdvancedAdapterPick(adapterType: AdvancedAdapterType) {
    const departmentKey = ensureRequestedDepartmentKey();
    closeNewAgent();
    setShowAdvancedCards(false);
    navigate(
      `/agents/new?adapterType=${encodeURIComponent(adapterType)}&departmentKey=${encodeURIComponent(departmentKey)}`
    );
  }

  return (
    <Dialog
      open={newAgentOpen}
      onOpenChange={(open) => {
        if (!open) {
          setShowAdvancedCards(false);
          closeNewAgent();
          return;
        }
        if (!requestedDepartmentKey && departmentOptions.length > 0) {
          setRequestedDepartmentKey(departmentOptions[0]?.key ?? "");
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="glass-panel sm:max-w-md p-0 gap-0 border-border/80 shadow-[0_24px_48px_rgba(0,0,0,0.12)] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <span className="text-sm text-muted-foreground">新增智能体</span>
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            onClick={() => {
              setShowAdvancedCards(false);
              closeNewAgent();
            }}
          >
            <span className="text-lg leading-none">&times;</span>
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {!showAdvancedCards ? (
            <>
              {/* Recommendation */}
              <div className="text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent">
                  <Sparkles className="h-6 w-6 text-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  建议由老板智能体发起组织扩编，它会结合组织架构自动处理汇报关系、权限与接入配置。
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  目标部门
                </p>
                <select
                  value={requestedDepartmentKey || departmentOptions[0]?.key || ""}
                  onChange={(event) =>
                    setRequestedDepartmentKey(event.target.value)
                  }
                  className="h-9 w-full rounded-md border border-border bg-transparent px-2 text-sm outline-none transition-colors focus-visible:border-primary/40"
                >
                  {departmentOptions.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  当前分配：{selectedDepartmentLabel}
                </p>
              </div>

              <Button className="w-full" size="lg" onClick={handleAskCeo}>
                <Bot className="h-4 w-4 mr-2" />
                让老板智能体新增智能体
              </Button>

              {/* Advanced link */}
              <div className="text-center">
                <button
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                  onClick={handleAdvancedConfig}
                >
                  我自己进行高级配置
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <button
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowAdvancedCards(false)}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  返回
                </button>
                <p className="text-sm text-muted-foreground">
                  选择接入方式并继续完成高级配置。
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {ADVANCED_ADAPTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-md border border-border p-3 text-xs transition-colors hover:bg-accent/50 relative"
                    )}
                    onClick={() => handleAdvancedAdapterPick(opt.value)}
                  >
                    {opt.recommended && (
                      <span className="absolute -top-1.5 right-1.5 bg-green-500 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
                        推荐
                      </span>
                    )}
                    <opt.icon className="h-4 w-4" />
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-muted-foreground text-[10px]">
                      {opt.desc}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
