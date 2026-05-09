import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboard";
import { activityApi } from "../api/activity";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { heartbeatsApi } from "../api/heartbeats";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useWorkspaceScope } from "../context/WorkspaceScopeContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import {
  TaskFlowBoard,
  type FlowNodeDetail,
} from "../components/dashboard/TaskFlowBoard";
import { PageSkeleton } from "../components/PageSkeleton";
import { cn, relativeTime } from "../lib/utils";
import { tStatus } from "../lib/i18n";
import { buildOrgUnits } from "../lib/company-scope";

import {
  cleanVisibleAgentName,
  departmentLabelFromKey,
  deriveOrgDepartmentOptions,
  resolveAgentDepartment,
  resolveVisibleOrgLayer,
} from "../lib/org-structure";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Briefcase,
  Building2,
  CircleDot,
  ChevronRight,
  FlaskConical,
  Layers3,
  Megaphone,
  Network,
  Newspaper,
  Plus,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Workflow,
  AlertCircle,
  Check,
} from "lucide-react";
import { AgentIcon } from "../components/AgentIconPicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import "reactflow/dist/style.css";
import type {
  ActivityEvent,
  Agent,
  HeartbeatRun,
  Issue,
} from "@zephyr-nexus/shared";
import { RuntimePanel, AgentCoordinationPanel } from "../components/runtime";
import { SectionCollapse } from "../components/SectionCollapse";
import { CommandSurface } from "../components/CommandSurface";

type LogWindow = "15m" | "1h" | "24h";
type SuccessWindow = "24h" | "7d" | "30d";
type FeedFilter = "all" | "errors" | "tasks";
type EventLevel = "信息" | "警告" | "错误";
type AgentLayer = "ORG" | "V1-PROJECT" | "V2-PIPELINE" | "INFRA";

type ActiveAgentRow = {
  id: string;
  route: string;
  name: string;
  displayName: string;
  orgLayer: string;
  subtitle: string;
  layer: AgentLayer;
  dept: string;
  status: string;
  task: string;
  updated: string;
};

type DeptRuntimeStatus = "running" | "failed" | "idle";

function statusFromAgents(agents: Agent[]): DeptRuntimeStatus {
  if (agents.some((a) => a.status === "running" || a.status === "active"))
    return "running";
  if (agents.some((a) => a.status === "error" || a.status === "terminated"))
    return "failed";
  return "idle";
}

function statusBadge(status: DeptRuntimeStatus): {
  label: string;
  cls: string;
} {
  if (status === "running")
    return {
      label: "运行中",
      cls: "border-zephyr-blue/30 bg-zephyr-blue-soft text-zephyr-blue ring-zephyr-blue/20",
    };
  if (status === "failed")
    return {
      label: "异常",
      cls: "border-rose-400/25 bg-rose-500/12 text-rose-500 dark:text-rose-200 ring-rose-300/20",
    };
  return {
    label: "空闲",
    cls: "border-periwinkle-border bg-background/45 text-muted-foreground ring-periwinkle-border",
  };
}

function orgUnitIcon(unitKey: string): React.ReactNode {
  if (unitKey === "ceo" || unitKey === "executive-assistant")
    return <Briefcase className="h-3.5 w-3.5" />;
  if (unitKey === "cto") return <Bot className="h-3.5 w-3.5" />;
  if (unitKey === "cho" || unitKey === "pm")
    return <ShieldCheck className="h-3.5 w-3.5" />;
  if (unitKey === "research") return <FlaskConical className="h-3.5 w-3.5" />;
  if (unitKey === "public-affairs")
    return <Megaphone className="h-3.5 w-3.5" />;
  if (unitKey === "media") return <Newspaper className="h-3.5 w-3.5" />;
  return <CircleDot className="h-3.5 w-3.5" />;
}

function getRecentIssues(issues: Issue[]): Issue[] {
  return [...issues].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/**
 * Build role-slot topology data from real agent list.
 * Used by AgentConstellationGraph and Hero to consistently
 * map agents to role slots and compute completeness.
 */
function buildAgentTopologyData(agents: Agent[]) {
  const slotDefs = [
    { role: "ceo",       label: "CEO",       ghostLabel: "CEO",  ghostDesc: "待配置" },
    { role: "researcher",label: "研究",       ghostLabel: "研究", ghostDesc: "待配置" },
    { role: "cto",       label: "CTO",       ghostLabel: "技术", ghostDesc: "待配置" },
    { role: "pm",        label: "PM",        ghostLabel: "管理", ghostDesc: "待配置" },
    { role: "general",   label: "执行",       ghostLabel: "执行", ghostDesc: "待配置" },
    { role: "devops",    label: "运维",       ghostLabel: "运维", ghostDesc: "待配置" },
  ] as const;

  const roleAgentMap = new Map<string, Agent>();
  for (const agent of agents) {
    const key = agent.role || "general";
    if (!roleAgentMap.has(key)) roleAgentMap.set(key, agent);
  }

  const slotAgents: (Agent | null)[] = slotDefs.map((slot) =>
    roleAgentMap.get(slot.role) || null
  );

  const rolesCovered = new Set(
    agents.map((a) => a.role || "general").filter(Boolean)
  );
  const completenessPct = Math.round(
    (rolesCovered.size / slotDefs.length) * 100
  );
  const missingRoles = slotDefs.filter((s) => !roleAgentMap.has(s.role));

  return { slotDefs, slotAgents, rolesCovered, completenessPct, missingRoles, totalSlots: slotDefs.length, filledSlots: rolesCovered.size };
}

function toLevel(event: ActivityEvent): EventLevel {
  const action = event.action.toLowerCase();
  if (
    action.includes("failed") ||
    action.includes("error") ||
    action.includes("terminated") ||
    action.includes("rejected")
  ) {
    return "错误";
  }
  if (
    action.includes("blocked") ||
    action.includes("waiting") ||
    action.includes("pending")
  ) {
    return "警告";
  }
  return "信息";
}

function withinWindow(date: Date, windowType: LogWindow): boolean {
  const now = Date.now();
  const t = new Date(date).getTime();
  const diffMs = now - t;
  if (windowType === "15m") return diffMs <= 15 * 60 * 1000;
  if (windowType === "1h") return diffMs <= 60 * 60 * 1000;
  return diffMs <= 24 * 60 * 60 * 1000;
}

function inferAgentLayer(name: string): AgentLayer {
  if (name.startsWith("[ORG]")) return "ORG";
  if (name.startsWith("[V1-PROJECT]")) return "V1-PROJECT";
  if (name.startsWith("[V2-PIPELINE]")) return "V2-PIPELINE";
  if (name.includes("Smoke Agent") || name.includes("Linked Agent"))
    return "INFRA";
  if (name.includes("ECC")) return "V1-PROJECT";
  return "ORG";
}

function layerMeta(layer: AgentLayer): {
  label: string;
  description: string;
  chipClass: string;
  cardClass: string;
} {
  if (layer === "ORG") {
    return {
      label: "组织层",
      description: "组织协同",
      chipClass:
        "border-cyan-400/20 bg-cyan-400/10 text-cyan-500 dark:text-cyan-200 ring-cyan-400/20",
      cardClass:
        "border-border bg-card",
    };
  }
  if (layer === "V1-PROJECT") {
    return {
      label: "项目层",
      description: "项目执行",
      chipClass:
        "border-violet-400/20 bg-violet-400/10 text-violet-500 dark:text-violet-200 ring-violet-400/20",
      cardClass:
        "border-border bg-card",
    };
  }
  if (layer === "V2-PIPELINE") {
    return {
      label: "流水线层",
      description: "通用流水线",
      chipClass:
        "border-emerald-400/20 bg-emerald-400/10 text-emerald-500 dark:text-emerald-200 ring-emerald-400/20",
      cardClass:
        "border-border bg-card",
    };
  }
  return {
    label: "基础层",
    description: "基础设施",
    chipClass:
      "border-border bg-muted/50 text-muted-foreground ring-border",
    cardClass:
      "border-border bg-card",
  };
}

function agentState(
  status: Agent["status"]
): "执行中" | "等待中" | "空闲" | "异常" {
  if (status === "running" || status === "active") return "执行中";
  if (status === "paused" || status === "pending_approval") return "等待中";
  if (status === "error" || status === "terminated") return "异常";
  return "空闲";
}

function translateAction(action: string): string {
  const MAP: Record<string, string> = {
    "agent.created": "智能体已创建",
    "agent.updated": "智能体信息已更新",
    "agent.paused": "智能体已暂停",
    "agent.resumed": "智能体已恢复运行",
    "agent.terminated": "智能体已终止",
    "agent.deleted": "智能体已删除",
    "agent.hire_created": "智能体雇用申请已提交",
    "agent.budget_updated": "智能体预算已更新",
    "agent.permissions_updated": "智能体权限已更新",
    "agent.key_created": "智能体 API Key 已创建",
    "agent.config_rolled_back": "智能体配置已回滚",
    "agent.runtime_session_reset": "运行时会话已重置",
    "agent.instructions_path_updated": "指令路径已更新",
    "agent.updated_from_join_replay": "智能体信息已同步",
    "agent_api_key.claimed": "API Key 已认领",
    "issue.created": "任务已创建",
    "issue.updated": "任务已更新",
    "issue.deleted": "任务已删除",
    "issue.checked_out": "任务已被认领",
    "issue.released": "任务已释放",
    "issue.checkout_lock_adopted": "任务锁定已接管",
    "issue.comment_added": "任务新增评论",
    "issue.approval_linked": "审批流程已关联",
    "issue.approval_unlinked": "审批流程已解除",
    "issue.synthesis_requested": "任务综合分析已请求",
    "issue.read_marked": "任务已标记为已读",
    "issue.attachment_added": "附件已上传",
    "issue.attachment_removed": "附件已删除",
    "approval.created": "审批单已创建",
    "approval.approved": "审批已通过",
    "approval.rejected": "审批已拒绝",
    "approval.revision_requested": "审批请求修订",
    "approval.resubmitted": "审批已重新提交",
    "approval.comment_added": "审批新增评论",
    "approval.requester_wakeup_queued": "审批唤醒已排队",
    "approval.requester_wakeup_failed": "审批唤醒失败",
    "heartbeat.invoked": "心跳任务已触发",
    "heartbeat.cancelled": "心跳任务已取消",
    "company.created": "公司已创建",
    "company.updated": "公司信息已更新",
    "company.archived": "公司已归档",
    "company.imported": "公司数据已导入",
    "company.budget_updated": "公司预算已更新",
    "project.created": "项目已创建",
    "project.updated": "项目已更新",
    "project.deleted": "项目已删除",
    "project.workspace_created": "项目工作区已创建",
    "project.workspace_updated": "项目工作区已更新",
    "project.workspace_deleted": "项目工作区已删除",
    "goal.created": "目标已创建",
    "goal.updated": "目标已更新",
    "goal.deleted": "目标已删除",
    "invite.created": "邀请已发送",
    "invite.revoked": "邀请已撤销",
    "invite.openclaw_prompt_created": "OpenClaw 邀请已创建",
    "join.approved": "加入申请已批准",
    "join.rejected": "加入申请已拒绝",
    "label.created": "标签已创建",
    "label.deleted": "标签已删除",
    "secret.created": "密钥已创建",
    "secret.updated": "密钥已更新",
    "secret.deleted": "密钥已删除",
    "secret.rotated": "密钥已轮换",
    "asset.created": "资产已创建",
    "cost.reported": "费用已上报",
    "hire_hook.succeeded": "雇用钩子成功",
    "hire_hook.failed": "雇用钩子失败",
    "hire_hook.error": "雇用钩子错误",
  };
  return MAP[action] ?? action;
}

function EventRow({
  event,
  level,
  agentName,
  index = 0,
}: {
  event: ActivityEvent;
  level: EventLevel;
  agentName: string;
  index?: number;
}) {
  const levelClass =
    level === "错误"
      ? "text-[#ff8c82]"
      : level === "警告"
      ? "text-[#f6bd60]"
      : "text-[#81ddff]";
  const dotColor =
    level === "错误" ? "#ff5d73" : level === "警告" ? "#ffb347" : "#4fd1ff";
  const outerAnim =
    level === "错误"
      ? "eventDotBreathStrong"
      : level === "警告"
      ? "eventDotBreathSoft"
      : "eventDotBreathSoft";
  const innerShadow =
    level === "错误"
      ? "0 0 0 3px rgba(255,93,115,0.35)"
      : level === "警告"
      ? "0 0 0 3px rgba(255,179,71,0.3)"
      : "0 0 0 2px rgba(79,209,255,0.28)";

  return (
    <div
      className="relative flex items-start gap-3 border-b border-border/50 px-3 py-3 text-sm last:border-b-0 event-row-enter transition-colors duration-150 hover:bg-white/[0.03] dark:hover:bg-white/[0.02]"
      style={{
        animationDelay: `${index * 55}ms`,
      }}
    >
      <div className="mt-1.5 flex w-[74px] shrink-0 flex-col items-start gap-1">
        <span className="relative inline-flex h-3 w-3">
          <span
            className="absolute inline-flex h-full w-full rounded-full"
            style={{
              backgroundColor: dotColor,
              opacity: level === "信息" ? 0.35 : 0.55,
              animation: `${outerAnim} ${
                level === "错误" ? 2.1 : level === "警告" ? 2.4 : 2.9
              }s ease-in-out infinite`,
            }}
          />
          <span
            className="relative h-2.5 w-2.5 rounded-full"
            style={{
              backgroundColor: dotColor,
              boxShadow: innerShadow,
            }}
          />
        </span>
        <span className="text-[11px] text-muted-foreground">
          {new Date(event.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("text-xs font-semibold", levelClass)}>
          {level} · {agentName}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {translateAction(event.action)}
        </p>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  kind = "primary",
  onClick,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  kind?: "primary" | "accent" | "warning";
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="panel group relative h-[140px] overflow-hidden px-6 py-6 text-left transition-all duration-200"
    >
      <div className="relative flex h-full flex-col justify-between z-10">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium text-muted-foreground group-hover:text-foreground transition-colors mix-blend-plus-lighter">
            {title}
          </p>
          <div
            className={cn(
              "transition-colors duration-300",
              kind === "warning"
                ? "text-warning/80 group-hover:text-warning"
                : "text-muted-foreground group-hover:text-accent"
            )}
          >
            {icon}
          </div>
        </div>
        <div>
          <p className="text-4xl font-semibold text-foreground tracking-tight">
            {value}
          </p>
          <p className="mt-2 text-[12px] font-medium text-muted-foreground">
            {subtitle}
          </p>
        </div>
      </div>
    </button>
  );
}

function SuccessRateCard({
  rate,
  trendTotal,
  avgMinutes,
  window,
  onWindowChange,
  bars,
  onClick,
}: {
  rate: number;
  trendTotal: number;
  avgMinutes: number;
  window: SuccessWindow;
  onWindowChange: (w: SuccessWindow) => void;
  bars: Array<{ total: number; ok: number }>;
  onClick?: () => void;
}) {
  const maxTotal = Math.max(...bars.map((b) => b.total), 1);
  const windowLabels: Record<SuccessWindow, string> = {
    "24h": "24h",
    "7d": "7d",
    "30d": "30d",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="panel group relative h-[140px] overflow-hidden px-6 py-6 text-left transition-all duration-200"
    >
      <div className="relative flex h-full flex-col justify-between z-10">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium text-muted-foreground group-hover:text-foreground transition-colors mix-blend-plus-lighter">
            成功率
          </p>
          <div className="text-muted-foreground group-hover:text-accent transition-colors duration-300">
            <ShieldCheck className="h-4 w-4" />
          </div>
        </div>
        <div className="flex items-end gap-2">
          <p className="text-4xl font-semibold text-foreground tracking-tight">
            {rate}%
          </p>
          <div className="mb-1 flex items-end gap-0.5 pb-px">
            {bars.map((b, i) => {
              const h =
                b.total === 0
                  ? 2
                  : Math.max(4, Math.round((b.total / maxTotal) * 26));
              const successFrac = b.total === 0 ? 1 : b.ok / b.total;
              const barColor =
                b.total === 0
                  ? "var(--border)"
                  : successFrac >= 0.8
                  ? "var(--success)"
                  : successFrac >= 0.5
                  ? "var(--warning)"
                  : "var(--destructive)";
              return (
                <span
                  key={i}
                  title={b.total === 0 ? "无数据" : `${b.ok}/${b.total}`}
                  className="inline-block w-[5px] rounded-sm"
                  style={{ height: `${h}px`, backgroundColor: barColor }}
                />
              );
            })}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-medium text-muted-foreground">
            {trendTotal} 次执行 · 均 {avgMinutes} 分钟
          </p>
          <div className="inline-flex rounded-full border border-border bg-sidebar-accent/50 p-px">
            {(["24h", "7d", "30d"] as SuccessWindow[]).map((w) => (
              <button
                key={w}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onWindowChange(w);
                }}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none cursor-pointer",
                  window === w
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {windowLabels[w]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}
export function Dashboard() {
  const { selectedCompanyId, selectedCompany, companies } = useCompany();
  const { openOnboarding, openNewIssue, openNewAgent } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();

  // Reveal refs for scroll-triggered entrance
  const [revealKeys, setRevealKeys] = useState<Set<string>>(new Set());
  const revealTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  function useRevealRef(key: string) {
    return (el: HTMLElement | null) => {
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            const delay = revealKeys.has(key) ? 0 : revealKeys.size * 50;
            const timer = setTimeout(() => {
              setRevealKeys((prev) => new Set([...prev, key]));
              observer.disconnect();
            }, delay);
            revealTimers.current.set(key, timer);
          }
        },
        { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
      );
      observer.observe(el);
    };
  }

  const [logWindow, setLogWindow] = useState<LogWindow>("1h");
  const [blockedModalOpen, setBlockedModalOpen] = useState(false);
  const [selectedFlowNode, setSelectedFlowNode] =
    useState<FlowNodeDetail | null>(null);
  const [selectedAgentPanel, setSelectedAgentPanel] =
    useState<ActiveAgentRow | null>(null);
  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");
  const [successWindow, setSuccessWindow] = useState<SuccessWindow>("7d");
  const {
    scopeView,
    setScopeView,
    projectFilter,
    setProjectFilter,
    departmentFilter,
    setDepartmentFilter,
  } = useWorkspaceScope();
  const logsContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "总览" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!),
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: activity } = useQuery({
    queryKey: queryKeys.activity(selectedCompanyId!),
    queryFn: () => activityApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: runs } = useQuery({
    queryKey: queryKeys.heartbeats(selectedCompanyId!),
    queryFn: () => heartbeatsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const availableProjects = useMemo(
    () => (projects ?? []).filter((project) => !project.archivedAt),
    [projects]
  );
  const companyAgents = useMemo(() => agents ?? [], [agents]);
  const orgDepartmentOptions = useMemo(
    () => deriveOrgDepartmentOptions(companyAgents),
    [companyAgents]
  );
  const agentDepartmentMap = useMemo(() => {
    return new Map(
      companyAgents.map((agent) => [
        agent.id,
        resolveAgentDepartment(agent, orgDepartmentOptions).label,
      ])
    );
  }, [companyAgents, orgDepartmentOptions]);

  useEffect(() => {
    if (scopeView !== "project") return;
    if (
      projectFilter !== "all" &&
      !availableProjects.find((project) => project.id === projectFilter)
    ) {
      setProjectFilter("all");
    }
  }, [availableProjects, projectFilter, scopeView]);

  useEffect(() => {
    if (scopeView !== "department" || departmentFilter === "all") return;
    const validDepartmentLabels = new Set(
      orgDepartmentOptions.map((option) => option.label)
    );
    if (!validDepartmentLabels.has(departmentFilter)) {
      setDepartmentFilter("all");
    }
  }, [scopeView, departmentFilter, orgDepartmentOptions, setDepartmentFilter]);

  const recentIssues = issues ? getRecentIssues(issues) : [];
  const scopeAgents = useMemo(() => {
    const alive = (agents ?? []).filter((a) => a.status !== "terminated");
    if (scopeView !== "department" || departmentFilter === "all") return alive;
    return alive.filter(
      (a) => (agentDepartmentMap.get(a.id) ?? "公共责任部") === departmentFilter
    );
  }, [agents, scopeView, departmentFilter, agentDepartmentMap]);

  const scopeAgentIds = useMemo(
    () => new Set(scopeAgents.map((agent) => agent.id)),
    [scopeAgents]
  );

  const scopeIssues = useMemo(() => {
    let list = [...recentIssues];
    if (scopeView === "project" && projectFilter !== "all") {
      list = list.filter((issue) => issue.projectId === projectFilter);
    }
    if (scopeView === "department" && departmentFilter !== "all") {
      list = list.filter((issue) => {
        if (!issue.assigneeAgentId) return false;
        return scopeAgentIds.has(issue.assigneeAgentId);
      });
    }
    return list;
  }, [recentIssues, scopeView, projectFilter, departmentFilter, scopeAgentIds]);

  const activeIssues = useMemo(
    () =>
      scopeIssues.filter(
        (issue) => issue.status !== "done" && issue.status !== "cancelled"
      ),
    [scopeIssues]
  );

  const issueByAssignee = useMemo(() => {
    const map = new Map<string, Issue>();
    for (const issue of activeIssues) {
      if (!issue.assigneeAgentId) continue;
      if (!map.has(issue.assigneeAgentId))
        map.set(issue.assigneeAgentId, issue);
    }
    return map;
  }, [activeIssues]);

  const liveTask = activeIssues[0] ?? scopeIssues[0] ?? null;
  const liveProjectName = useMemo(() => {
    if (scopeView === "project" && projectFilter !== "all") {
      return (
        availableProjects.find((project) => project.id === projectFilter)
          ?.name ?? "未命名项目"
      );
    }
    if (!liveTask?.projectId) return selectedCompany?.name ?? "默认工作区";
    return (
      availableProjects.find((p) => p.id === liveTask.projectId)?.name ??
      selectedCompany?.name ??
      "默认工作区"
    );
  }, [scopeView, projectFilter, availableProjects, liveTask, selectedCompany]);

  const runningAgents = useMemo(
    () =>
      scopeAgents.filter(
        (a) => a.status === "running" || a.status === "active"
      ),
    [scopeAgents]
  );

  const directorRoles: Agent["role"][] = ["ceo", "cto", "pm", "researcher"];
  const directorActive = runningAgents.filter((a) =>
    directorRoles.includes(a.role)
  ).length;
  const workerActive = Math.max(runningAgents.length - directorActive, 0);

  const criticalIssues = activeIssues.filter(
    (i) => i.priority === "critical"
  ).length;
  const blockedIssues = activeIssues.filter(
    (i) => i.status === "blocked"
  ).length;
  const blockedIssueList = activeIssues.filter((i) => i.status === "blocked");

  const scopeIssueIds = useMemo(
    () => new Set(scopeIssues.map((issue) => issue.id)),
    [scopeIssues]
  );

  const scopedRuns = useMemo(() => {
    const allRuns = runs ?? [];
    if (scopeView === "company") return allRuns;
    return allRuns.filter((run) => {
      const issueId = (run as { issueId?: string }).issueId;
      if (scopeView === "project") {
        if (projectFilter === "all") return true;
        return !!issueId && scopeIssueIds.has(issueId);
      }
      if (scopeView === "department") {
        return scopeAgentIds.has(run.agentId);
      }
      return true;
    });
  }, [runs, scopeView, projectFilter, scopeIssueIds, scopeAgentIds]);

  const failedRuns = useMemo(
    () =>
      scopedRuns.filter(
        (run) => run.status === "failed" || run.status === "timed_out"
      ).length,
    [scopedRuns]
  );

  const successRate = useMemo(() => {
    if (scopedRuns.length === 0) return 0;
    const succeeded = scopedRuns.filter(
      (run) => run.status === "succeeded"
    ).length;
    return Math.round((succeeded / scopedRuns.length) * 100);
  }, [scopedRuns]);

  const avgRunMinutes = useMemo(() => {
    const completed = scopedRuns.filter((run) => run.finishedAt);
    if (completed.length === 0) return 0;
    const totalMinutes = completed.reduce((sum, run) => {
      const start = new Date(run.createdAt).getTime();
      const end = run.finishedAt ? new Date(run.finishedAt).getTime() : start;
      return sum + Math.max(0, end - start) / (1000 * 60);
    }, 0);
    return Math.round((totalMinutes / completed.length) * 10) / 10;
  }, [scopedRuns]);

  const trendBars = useMemo(() => {
    const now = Date.now();
    const msPerHour = 3_600_000;
    const msPerDay = 86_400_000;
    let buckets: number;
    let bucketSize: number;
    if (successWindow === "24h") {
      buckets = 12;
      bucketSize = 2 * msPerHour;
    } else if (successWindow === "7d") {
      buckets = 7;
      bucketSize = msPerDay;
    } else {
      buckets = 10;
      bucketSize = 3 * msPerDay;
    }
    const windowStart = now - buckets * bucketSize;
    const windowRuns = scopedRuns.filter(
      (run) => new Date(run.createdAt).getTime() >= windowStart
    );
    const data = Array.from({ length: buckets }, (_, i) => {
      const bStart = windowStart + i * bucketSize;
      const bEnd = bStart + bucketSize;
      const inBucket = windowRuns.filter((run) => {
        const t = new Date(run.createdAt).getTime();
        return t >= bStart && t < bEnd;
      });
      const ok = inBucket.filter((r) => r.status === "succeeded").length;
      return { total: inBucket.length, ok };
    });
    const trendTotal = windowRuns.length;
    const trendRate =
      trendTotal === 0
        ? 0
        : Math.round(
            (windowRuns.filter((r) => r.status === "succeeded").length /
              trendTotal) *
              100
          );
    return { data, trendRate, trendTotal };
  }, [scopedRuns, successWindow]);

  const scopedActivity = useMemo(() => {
    const all = activity ?? [];
    if (scopeView === "company") return all;
    return all.filter((event) => {
      const issueId = (event as { issueId?: string }).issueId;
      if (scopeView === "project") {
        if (projectFilter === "all") return true;
        return !!issueId && scopeIssueIds.has(issueId);
      }
      if (scopeView === "department") {
        return (
          (event.agentId ? scopeAgentIds.has(event.agentId) : false) ||
          (event.actorId ? scopeAgentIds.has(event.actorId) : false)
        );
      }
      return true;
    });
  }, [activity, scopeView, projectFilter, scopeIssueIds, scopeAgentIds]);

  const recentActivity = useMemo(
    () => scopedActivity.slice(0, 160),
    [scopedActivity]
  );

  const filteredEvents = useMemo(() => {
    return recentActivity
      .filter((event) => withinWindow(event.createdAt, logWindow))
      .filter((event) => {
        if (feedFilter === "all") return true;
        if (feedFilter === "errors") return toLevel(event) === "错误";
        return (
          event.entityType.toLowerCase().includes("issue") ||
          event.entityType.toLowerCase().includes("task")
        );
      })
      .slice(0, 12);
  }, [recentActivity, feedFilter, logWindow]);

  useEffect(() => {
    if (!logsContainerRef.current) return;
    logsContainerRef.current.scrollTop = 0;
  }, [filteredEvents]);

  const alertCount =
    filteredEvents.filter((event) => toLevel(event) === "错误").length +
    blockedIssues +
    (failedRuns > 0 ? 1 : 0);

  const lastSyncTime = useMemo(() => {
    const latest =
      recentActivity[0]?.createdAt ?? scopedRuns[0]?.updatedAt ?? null;
    return latest ? relativeTime(latest) : "刚刚";
  }, [recentActivity, scopedRuns]);

  const activeAgentRows = useMemo<ActiveAgentRow[]>(() => {
    const list = scopeAgents.map((agent) => {
      const issue = issueByAssignee.get(agent.id);
      const dept =
        agentDepartmentMap.get(agent.id) ??
        resolveAgentDepartment(agent, orgDepartmentOptions).label;
      const displayName = cleanVisibleAgentName(agent.name);
      const orgLayer = resolveVisibleOrgLayer(agent);
      return {
        id: agent.id,
        route: `/agents/${agent.urlKey || agent.id}`,
        name: agent.name,
        displayName,
        orgLayer,
        subtitle: `${orgLayer} · ${issue?.title ?? "暂无任务"}`,
        layer: inferAgentLayer(agent.name),
        dept,
        status: agentState(agent.status),
        task: issue?.title ?? "暂无任务",
        updated: relativeTime(agent.updatedAt),
      };
    });
    
    return list.sort((a, b) => {
      const statusOrder = { "执行中": 0, "等待中": 1, "空闲": 2, "异常": 3 };
      return (
        statusOrder[a.status] - statusOrder[b.status] ||
        a.displayName.localeCompare(b.displayName, "zh-CN")
      );
    });
  }, [scopeAgents, issueByAssignee, agentDepartmentMap, orgDepartmentOptions]);

  const selectedDeptAgentRows = useMemo(() => {
    if (selectedDept === "all") return activeAgentRows;
    return activeAgentRows.filter((row) => row.dept === selectedDept);
  }, [activeAgentRows, selectedDept]);

  const agentLayerCounts = useMemo(() => {
    return (scopeAgents ?? []).reduce<Record<AgentLayer, number>>(
      (acc, agent) => {
        acc[inferAgentLayer(agent.name)] += 1;
        return acc;
      },
      { ORG: 0, "V1-PROJECT": 0, "V2-PIPELINE": 0, INFRA: 0 }
    );
  }, [scopeAgents]);

  const activeAgentRowsByLayer = useMemo(() => {
    const groups = new Map<AgentLayer, ActiveAgentRow[]>();
    for (const row of selectedDeptAgentRows) {
      const existing = groups.get(row.layer) ?? [];
      existing.push(row);
      groups.set(row.layer, existing);
    }
    return groups;
  }, [selectedDeptAgentRows]);

  const orgUnits = useMemo(() => {
    const built = buildOrgUnits(agents ?? []);
    if (built.length > 0) return built;
    return [
      { key: "ceo", label: "总裁 / CEO", to: "/org?unit=ceo", agent: null },
      { key: "cto", label: "技术总监", to: "/org?unit=cto", agent: null },
      { key: "cho", label: "人力总监", to: "/org?unit=cho", agent: null },
      {
        key: "research",
        label: "社会研究院",
        to: "/org?unit=research",
        agent: null,
      },
      {
        key: "public-affairs",
        label: "公共责任部",
        to: "/org?unit=public-affairs",
        agent: null,
      },
      { key: "media", label: "新媒体中心", to: "/org?unit=media", agent: null },
    ];
  }, [agents]);

  const deptRuntimeMap = useMemo(() => {
    return new Map(
      orgUnits.map((unit) => {
        const dept = departmentLabelFromKey(unit.key, orgDepartmentOptions);

        const deptAgents = scopeAgents.filter(
          (agent) =>
            (agentDepartmentMap.get(agent.id) ??
              resolveAgentDepartment(agent, orgDepartmentOptions).label) === dept
        );
        const running = deptAgents.filter(
          (a) => a.status === "running" || a.status === "active"
        ).length;
        const waiting = deptAgents.filter(
          (a) => a.status === "paused" || a.status === "pending_approval"
        ).length;
        const failed = deptAgents.filter(
          (a) => a.status === "error" || a.status === "terminated"
        ).length;
        return [
          unit.key,
          {
            total: deptAgents.length,
            running,
            waiting,
            failed,
            status: statusFromAgents(deptAgents),
            agents: deptAgents,
          },
        ] as [
          string,
          {
            total: number;
            running: number;
            waiting: number;
            failed: number;
            status: DeptRuntimeStatus;
            agents: typeof deptAgents;
          }
        ];
      })
    );
  }, [orgUnits, scopeAgents, orgDepartmentOptions, agentDepartmentMap]);

  const nodeLogs = useMemo(() => {
    if (!selectedFlowNode) return [] as ActivityEvent[];
    const hits = recentActivity.filter((event) => {
      const action = event.action.toLowerCase();
      return (
        action.includes(selectedFlowNode.title.toLowerCase()) ||
        action.includes("issue") ||
        action.includes("task")
      );
    });
    return hits.slice(0, 5);
  }, [recentActivity, selectedFlowNode]);

  const departments = useMemo(() => {
    const uniqueDepartments = new Set<string>();
    companyAgents.forEach((agent) =>
      uniqueDepartments.add(
        agentDepartmentMap.get(agent.id) ??
          resolveAgentDepartment(agent, orgDepartmentOptions).label
      )
    );
    return Array.from(uniqueDepartments);
  }, [companyAgents, agentDepartmentMap, orgDepartmentOptions]);
  const runtimeTotals = useMemo(() => {
    const values = Array.from(deptRuntimeMap.values());
    return values.reduce(
      (acc, item) => {
        acc.total += item.total;
        acc.running += item.running;
        acc.waiting += item.waiting;
        acc.failed += item.failed;
        return acc;
      },
      { total: 0, running: 0, waiting: 0, failed: 0 }
    );
  }, [deptRuntimeMap]);

  const hasErrors = runtimeTotals.failed > 0 || blockedIssues > 0 || criticalIssues > 0;
  const healthPercent = hasErrors ? 94 : 99;
  const runningCount = runtimeTotals.running;
  const topology = buildAgentTopologyData(companyAgents);
  const completenessPct = topology.completenessPct;

  const OrgRuntimePanel = () => (
    <section className="panel-floating relative flex h-full min-h-0 flex-col overflow-hidden p-5 lg:p-6 max-h-[460px]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-28"
        style={{
          background:
            "radial-gradient(circle at 12% 0%, color-mix(in oklab, var(--zephyr-blue-soft) 75%, transparent) 0%, transparent 66%)",
        }}
      />
      <div className="relative mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-periwinkle-border bg-periwinkle-dim px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-shell-chip-foreground">
            <Layers3 className="h-3.5 w-3.5 text-zephyr-blue" />
            组织运行态
          </div>
          <h3 className="mt-3 text-[20px] type-heading text-foreground">
            组织运行拓扑
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            指挥链与执行单元同步密度。
          </p>
        </div>
        <Link
          to="/org"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-3.5 py-1.5 text-[11px] font-semibold text-foreground no-underline transition-all duration-200 hover:border-zephyr-blue/35 hover:bg-zephyr-blue-soft"
        >
          进入组织页
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-2 text-[11px]">
        <div className="rounded-xl border border-periwinkle-border bg-background/45 px-3 py-2 text-center">
          <p className="font-semibold text-zephyr-blue">{runtimeTotals.running}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            运行中
          </p>
        </div>
        <div className="rounded-xl border border-periwinkle-border bg-background/45 px-3 py-2 text-center">
          <p className="font-semibold text-foreground">{runtimeTotals.waiting}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            待命
          </p>
        </div>
        <div className="rounded-xl border border-rose-400/20 bg-rose-500/8 px-3 py-2 text-center">
          <p className="font-semibold text-rose-500 dark:text-rose-200">{runtimeTotals.failed}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            异常
          </p>
        </div>
        <div className="rounded-xl border border-periwinkle-border bg-background/45 px-3 py-2 text-center">
          <p className="font-semibold text-foreground">{runtimeTotals.total}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            智能体
          </p>
        </div>
      </div>

      {/* Agent Constellation — compact embed */}
      {topology.slotAgents.some(Boolean) && (
        <div className="mb-3 rounded-xl border border-periwinkle-border bg-background/25 p-1.5" style={{ height: "170px" }}>
          <div className="h-full w-full opacity-80">
            <AgentConstellationGraph
              slotDefs={topology.slotDefs}
              slotAgents={topology.slotAgents}
              runningIds={new Set(runningAgents.map((a) => a.id))}
            />
          </div>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col rounded-[22px] border border-periwinkle-border bg-background/35 p-3">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            指挥链
          </span>
          <div className="h-px flex-1 bg-periwinkle-dim" />
          <span className="text-[10px] font-medium text-zephyr-blue">
            {selectedDept === "all" ? "全组织" : selectedDept}
          </span>
        </div>

        <div className="scrollbar-auto-hide min-h-0 flex-1 space-y-2 overflow-auto pr-1">
          {orgUnits.map((unit) => {
            const dept = departmentLabelFromKey(unit.key, orgDepartmentOptions);
            const runtime = deptRuntimeMap.get(unit.key) ?? {
              total: 0,
              running: 0,
              waiting: 0,
              failed: 0,
              status: "idle" as DeptRuntimeStatus,
              agents: [],
            };
            const badge = statusBadge(runtime.status);
            const selected = selectedDept === dept;

            return (
              <button
                key={unit.key}
                type="button"
                onClick={() => setSelectedDept(selected ? "all" : dept)}
                className={cn(
                  "group w-full rounded-2xl border px-3 py-2 text-left transition-all duration-200",
                  selected
                    ? "border-zephyr-blue/35 bg-zephyr-blue-soft"
                    : "border-periwinkle-border bg-background/45 hover:border-zephyr-blue/30 hover:bg-background/60"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {unit.label}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      运行 {runtime.running} · 等待 {runtime.waiting} · 异常{" "}
                      {runtime.failed}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl border border-periwinkle-border bg-background/50 text-zephyr-blue">
                      {orgUnitIcon(unit.key)}
                    </span>
                    <span
                      className={cn(
                        "inline-flex h-5 items-center rounded-full border px-2 text-[9px] font-semibold uppercase tracking-[0.1em]",
                        badge.cls
                      )}
                    >
                      {badge.label}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-3 border-t border-periwinkle-border pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            拓扑密度
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(agentLayerCounts) as AgentLayer[]).map((layer) => {
              const meta = layerMeta(layer);
              return (
                <div
                  key={layer}
                  className="rounded-xl border border-periwinkle-border bg-background/45 px-2.5 py-2"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {meta.label}
                  </p>
                  <p className="mt-1 text-base font-semibold text-foreground">
                    {agentLayerCounts[layer]}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );


  /* ── Agent Constellation Graph ── */
  function AgentConstellationGraph({
    slotDefs,
    slotAgents,
    runningIds,
  }: {
    slotDefs: readonly { role: string; label: string; ghostLabel: string; ghostDesc: string }[];
    slotAgents: (Agent | null)[];
    runningIds: Set<string>;
  }) {

    // Constellation positions: star/hex pattern
    const positions = [
      { x: 200, y: 35 },   // 0: top center (CEO)
      { x: 70, y: 100 },   // 1: upper left
      { x: 330, y: 100 },  // 2: upper right
      { x: 55, y: 220 },   // 3: bottom left
      { x: 200, y: 260 },  // 4: bottom center
      { x: 345, y: 220 },  // 5: bottom right
    ];

    // Star + cross topology
    const connections = [
      [0, 1], [0, 2], [0, 3], [0, 4], [0, 5],
      [1, 2], [3, 4], [4, 5], [1, 3], [2, 5],
    ];

    return (
      <svg viewBox="0 0 400 300" className="h-full w-full" style={{ filter: "drop-shadow(0 0 24px rgba(59,130,246,0.12))" }}>
        <defs>
          <filter id="constellation-glow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="constellation-glow-soft">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {connections.map(([fi, ti], i) => {
          const from = positions[fi];
          const to = positions[ti];
          if (!from || !to) return null;
          const fromAgent = slotAgents[fi];
          const toAgent = slotAgents[ti];
          const fromActive = fromAgent ? runningIds.has(fromAgent.id) : false;
          const toActive = toAgent ? runningIds.has(toAgent.id) : false;
          const bothActive = fromActive && toActive;
          const bothReal = !!(fromAgent && toAgent);
          const cpY = (from.y + to.y) / 2;
          const d = `M${from.x} ${from.y} C${from.x} ${cpY}, ${to.x} ${cpY}, ${to.x} ${to.y}`;

          return (
            <g key={`conn-${i}`}>
              <path d={d} strokeWidth={bothActive ? 1.5 : bothReal ? 1 : 0.5} fill="none"
                className={bothActive ? "constellation-path-active" : ""}
                style={{ stroke: bothActive ? "var(--graph-line)" : bothReal ? "var(--graph-line)" : "var(--graph-line-faint)" }}
              />
              {bothActive && (
                <circle r="2.5" filter="url(#constellation-glow-soft)" style={{ fill: "var(--graph-node-active-inner)" }}>
                  <animateMotion dur="2.5s" repeatCount="indefinite" path={d} />
                </circle>
              )}
            </g>
          );
        })}

        {slotAgents.map((agent, idx) => {
          const pos = positions[idx];
          if (!pos) return null;
          const slot = slotDefs[idx];
          const isGhost = !agent;
          const isRunning = agent ? runningIds.has(agent.id) : false;

          if (isGhost) {
            // Ghost/placeholder node for unfilled role slot
            return (
              <g key={`ghost-${idx}`} className="constellation-node" style={{ transformOrigin: `${pos.x}px ${pos.y}px` }}>
                <circle cx={pos.x} cy={pos.y} r="8" style={{ fill: "var(--graph-ghost-node)", stroke: "var(--graph-ghost-stroke)" }} strokeWidth="1" strokeDasharray="3 2" />
                <circle cx={pos.x} cy={pos.y} r="2" style={{ fill: "var(--graph-ghost-stroke)" }} />
                <text x={pos.x} y={pos.y + 24} textAnchor="middle" style={{ fill: "var(--graph-text-ghost)" }} fontSize="7" fontWeight="500" fontFamily="system-ui" fontStyle="italic">
                  {slot.ghostLabel}
                </text>
                <text x={pos.x} y={pos.y + 32} textAnchor="middle" style={{ fill: "var(--graph-text-ghost)" }} fontSize="5.5" fontWeight="400" fontFamily="system-ui">
                  {slot.ghostDesc}
                </text>
              </g>
            );
          }

          // Real agent node
          return (
            <g key={agent.id} className="constellation-node" style={{ transformOrigin: `${pos.x}px ${pos.y}px` }}>
              {isRunning && (
                <circle cx={pos.x} cy={pos.y} r="16" fill="none" strokeWidth="1.5" className="constellation-glow-ring" style={{ stroke: "var(--graph-line)" }} />
              )}
              <circle cx={pos.x} cy={pos.y} r={isRunning ? 11 : 8} strokeWidth={isRunning ? 2 : 1}
                style={{
                  fill: isRunning ? "var(--graph-node-active-bg)" : "var(--graph-node-bg)",
                  stroke: isRunning ? "var(--graph-node-active-stroke)" : "var(--graph-ghost-stroke)",
                }}
              />
              {isRunning ? (
                <>
                  <circle cx={pos.x} cy={pos.y} r="3.5" filter="url(#constellation-glow)" style={{ fill: "var(--graph-node-active-inner)" }}>
                    <animate attributeName="opacity" values="0.4;1;0.4" dur="2.2s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={pos.x} cy={pos.y} r="6" fill="none" strokeWidth="1" style={{ stroke: "var(--graph-line)" }}>
                    <animate attributeName="r" values="6;10;6" dur="2.2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.5;0;0.5" dur="2.2s" repeatCount="indefinite" />
                  </circle>
                </>
              ) : (
                <circle cx={pos.x} cy={pos.y} r="2" style={{ fill: "var(--graph-ghost-stroke)" }} />
              )}
              <text x={pos.x} y={pos.y + 24} textAnchor="middle" fontSize="7.5" fontWeight="600" fontFamily="system-ui"
                style={{ fill: isRunning ? "var(--graph-node-active-inner)" : "var(--graph-text)" }}>
                {agent.name.length > 7 ? agent.name.slice(0, 6) + "…" : agent.name}
              </text>
              <text x={pos.x} y={pos.y + 33} textAnchor="middle" fontSize="6" fontWeight="500" fontFamily="system-ui"
                style={{ fill: isRunning ? "var(--graph-line)" : "var(--graph-text)" }}>
                {slot.label}
              </text>
            </g>
          );
        })}

        {slotAgents.length === 0 && (
          <text x="200" y="150" textAnchor="middle" fontSize="12" fontWeight="500" style={{ fill: "var(--graph-text-ghost)" }}>
            暂无智能体数据
          </text>
        )}
      </svg>
    );
  }

  // ZephyrHero removed in Round 2 IA restructure.
  // Brand identity → PageHeader, Health/metrics → StatsBar, ConstellationGraph → OrgRuntimePanel
  // Computations (healthPercent, topology, completenessPct) moved to Dashboard body.

  const MissionSnapshot = () => {
    const missionMetrics = [
      {
        label: "活跃任务",
        value: activeIssues.length,
        emptyMsg: "系统处于待命状态",
      },
      {
        label: "待处理",
        value: blockedIssues,
        emptyMsg: "无待处理事项",
      },
      {
        label: "异常",
        value: runtimeTotals.failed,
        emptyMsg: "无异常",
      },
      {
        label: "平均响应",
        value: avgRunMinutes > 0 ? `${avgRunMinutes}min` : "—",
        emptyMsg: "暂无执行数据",
      },
      {
        label: "同步状态",
        value: lastSyncTime,
        emptyMsg: "同步中",
      },
      {
        label: "运行中",
        value: runningCount,
        emptyMsg: "空闲",
      },
      {
        label: "系统健康",
        value: `${healthPercent}%`,
        emptyMsg: "—",
      },
      {
        label: "编队完整",
        value: `${completenessPct}%`,
        emptyMsg: "—",
      },
    ];
    return (
      <div className="flex flex-wrap items-stretch gap-px overflow-hidden rounded-xl border border-border/40 bg-border/20">
        {missionMetrics.map((m) => (
          <div
            key={m.label}
            className="flex flex-1 flex-col justify-center gap-0.5 bg-shell-surface-bg px-3.5 py-2.5 min-w-[90px]"
          >
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
              {m.label}
            </span>
            {typeof m.value === "number" && m.value === 0 ? (
              <span className="text-[11px] font-medium text-muted-foreground/60">
                {m.emptyMsg}
              </span>
            ) : (
              <span className="text-sm font-semibold text-foreground tabular-nums">
                {m.value}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  };

  const SystemMetricsPanel = () => {
    const metrics = [
      {
        label: "活跃任务",
        value: activeIssues.length,
        sub: "执行负载",
        icon: <Activity className="h-4 w-4" />,
        accent: activeIssues.length > 0
          ? "border-zephyr-blue/25 bg-zephyr-blue-soft/40"
          : "border-border/40 bg-transparent",
      },
      {
        label: "人工升级",
        value: blockedIssues,
        sub: "人工介入",
        icon: <AlertTriangle className="h-4 w-4" />,
        accent: blockedIssues > 0
          ? "border-amber-400/20 bg-amber-400/8"
          : "border-border/40 bg-transparent",
      },
      {
        label: "系统成功率",
        value: successRate > 0 ? `${successRate}%` : "—",
        sub: "运行质量",
        icon: <ShieldCheck className="h-4 w-4" />,
        accent: successRate > 0
          ? "border-emerald-400/20 bg-emerald-400/8"
          : "border-border/40 bg-transparent",
      },
      {
        label: "通信机器人",
        value: "活跃",
        sub: "同步中",
        icon: <Bot className="h-4 w-4" />,
        accent: "border-violet-400/20 bg-violet-400/8",
      },
    ];

    return (
      <section className="panel-floating relative flex h-full min-h-[260px] flex-col overflow-hidden p-5 lg:p-6">
        <div className="relative mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/60">
            实时监控
          </p>
          <h3 className="mt-2 text-[20px] type-heading text-foreground">
            执行监控
          </h3>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-2.5">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className={cn(
                "card relative flex flex-col justify-between rounded-xl p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-white/[0.08]",
                metric.accent
              )}
            >
              <div className="relative">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60">
                    {metric.sub}
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03]">
                    <span className="text-muted-foreground/50">{metric.icon}</span>
                  </div>
                </div>
                <p className="text-xl font-semibold text-foreground tabular-nums">
                  {metric.value}
                </p>
                <p className="mt-0.5 text-[10px] font-medium text-muted-foreground/60">
                  {metric.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  const PipelineRail = () => {
    const [expanded, setExpanded] = useState(false);
    const status = liveTask?.status ?? "todo";
    const blocked = status === "blocked";

    const stages = [
      {
        id: "input", label: "任务输入", agent: "发起人",
        desc: "接收原始任务请求，解析任务类型与优先级",
        state: status === "todo" ? "active" : "done",
      },
      {
        id: "decompose", label: "任务拆解", agent: "CEO 智能体",
        desc: "将任务拆解为可执行的子任务单元",
        state: status === "todo" ? "pending" : blocked ? "failed" : status === "in_progress" ? "active" : "done",
      },
      {
        id: "dispatch", label: "Agent 分派", agent: "调度器",
        desc: "匹配最优资源，分派给对应 Agent",
        state: status === "in_progress" ? "active" : status === "in_review" || status === "done" ? "done" : "pending",
      },
      {
        id: "execute", label: "工具调用", agent: "执行引擎",
        desc: "执行具体工具调用和数据操作",
        state: status === "in_review" ? "active" : status === "done" ? "done" : "pending",
      },
      {
        id: "aggregate", label: "结果汇总", agent: "CEO 智能体",
        desc: "汇总各 Agent 执行结果，生成综合报告",
        state: status === "done" ? "active" : status === "in_review" ? "done" : "pending",
      },
      {
        id: "confirm", label: "人工确认", agent: "人工",
        desc: "最终结果通过人工审核确认",
        state: status === "done" ? "done" : status === "in_review" ? "active" : "pending",
      },
    ] as const;

    const doneCount = stages.filter((s) => s.state === "done").length;
    const progress = Math.round((doneCount / stages.length) * 100);

    const stageColor = (state: string) => {
      if (state === "active") return "var(--zephyr-blue)";
      if (state === "done") return "var(--success)";
      if (state === "failed") return "var(--error)";
      return "rgba(255,255,255,0.1)";
    };
    const stageBg = (state: string) => {
      if (state === "active") return "rgba(59,130,246,0.15)";
      if (state === "done") return "rgba(52,211,153,0.12)";
      if (state === "failed") return "rgba(239,68,68,0.12)";
      return "rgba(255,255,255,0.03)";
    };

    return (
      <section className="panel-floating relative flex flex-col overflow-hidden p-5 lg:p-6">
        <div className="relative mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              作业流水线
            </p>
            <h3 className="mt-2 text-lg type-heading text-foreground">
              标准作业流程
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-400 to-zephyr-blue transition-all duration-700"
                  style={{ width: `${Math.max(4, progress)}%` }}
                />
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground">{progress}%</span>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="ml-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[9px] font-semibold text-muted-foreground/70 transition-all hover:border-zephyr-blue/30 hover:text-zephyr-blue"
            >
              {expanded ? "收起详情" : "展开详情"}
            </button>
          </div>
        </div>

        {/* Compact horizontal stepped rail (default) */}
        {!expanded && (
          <div className="flex items-center gap-2 pb-1">
            {stages.map((stage, i) => {
              const isLast = i === stages.length - 1;
              const isActive = stage.state === "active";
              const isDone = stage.state === "done";
              const isFailed = stage.state === "failed";

              return (
                <div key={stage.id} className="flex items-center">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full border text-[9px] font-bold transition-all"
                      style={{
                        borderColor: stageColor(stage.state),
                        background: stageBg(stage.state),
                        boxShadow: isActive ? "0 0 10px 1px rgba(59,130,246,0.3)" : undefined,
                      }}
                    >
                      {isDone ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : isActive ? (
                        <div className="h-1.5 w-1.5 rounded-full bg-zephyr-blue animate-pulse" />
                      ) : isFailed ? (
                        <AlertTriangle className="h-3 w-3 text-error" />
                      ) : (
                        <span className="text-muted-foreground/40">{i + 1}</span>
                      )}
                    </div>
                    <span className="whitespace-nowrap text-[8px] font-medium text-muted-foreground/60">
                      {stage.label}
                    </span>
                    <span className="text-[6px] text-muted-foreground/35">{stage.agent}</span>
                  </div>
                  {!isLast && (
                    <div className="mx-1 mt-[-16px] h-px w-3 bg-white/[0.06]" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Expanded vertical timeline */}
        {expanded && (
          <div className="relative flex flex-1 flex-col gap-0">
            <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-violet-400/20 via-zephyr-blue/10 to-transparent" />

            {stages.map((stage, i) => {
              const isActive = stage.state === "active";
              const isDone = stage.state === "done";
              const isFailed = stage.state === "failed";
              const isPending = stage.state === "pending";

              return (
                <div key={stage.id} className="relative flex items-start gap-4 pb-4 last:pb-0">
                  <div
                    className="relative z-10 flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300"
                    style={{
                      borderColor: isActive ? "var(--zephyr-blue)" : isDone ? "rgba(52,211,153,0.5)" : isFailed ? "var(--error)" : "rgba(255,255,255,0.12)",
                      background: isActive ? "rgba(59,130,246,0.15)" : isDone ? "rgba(52,211,153,0.1)" : isFailed ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.04)",
                      boxShadow: isActive ? "0 0 16px 2px rgba(59,130,246,0.3)" : undefined,
                    }}
                  >
                    {isDone ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : isFailed ? (
                      <AlertTriangle className="h-4 w-4 text-error" />
                    ) : isActive ? (
                      <div className="h-2.5 w-2.5 rounded-full bg-zephyr-blue" style={{ animation: "status-breathe 1.6s ease-in-out infinite" }} />
                    ) : (
                      <span className="text-[11px] font-bold text-muted-foreground/40">{i + 1}</span>
                    )}
                    {isActive && (
                      <div className="absolute inset-0 rounded-full border border-zephyr-blue/30" style={{ animation: "node-active-ring 2s ease-in-out infinite" }} />
                    )}
                  </div>

                  <div
                    className="min-w-0 flex-1 rounded-xl border px-3.5 py-2.5 transition-all duration-200"
                    style={{
                      borderColor: isActive ? "rgba(59,130,246,0.2)" : isDone ? "rgba(52,211,153,0.1)" : isPending ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.06)",
                      background: isActive ? "rgba(59,130,246,0.04)" : "rgba(255,255,255,0.02)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("text-sm font-semibold",
                        isActive && "text-zephyr-blue",
                        isDone && "text-emerald-400/80",
                        isFailed && "text-error",
                        isPending && "text-muted-foreground/50"
                      )}>
                        {stage.label}
                      </span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[8px] font-semibold",
                        isActive && "bg-zephyr-blue/15 text-zephyr-blue",
                        isDone && "bg-emerald-400/10 text-emerald-400/70",
                        isFailed && "bg-error/10 text-error",
                        isPending && "bg-white/5 text-muted-foreground/40"
                      )}>
                        {isActive ? "运行中" : isDone ? "已完成" : isFailed ? "异常" : "待处理"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground/70">{stage.desc}</p>
                    <p className="mt-1 text-[9px] font-medium text-muted-foreground/50">执行: {stage.agent}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  };
  const EventTimeline = () => (
    <section className="panel-floating relative overflow-hidden p-6 lg:p-8 shadow-xl">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-32"
        style={{
          background:
            "radial-gradient(circle at top right, color-mix(in oklab, var(--zephyr-blue-soft) 65%, transparent) 0%, transparent 52%)",
        }}
      />
      <div className="relative mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            系统动态流
          </p>
          <h3 className="mt-2 text-[22px] type-heading text-foreground">
            系统事件
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full border border-periwinkle-border bg-background/45 p-0.5 text-xs">
            {(["all", "errors", "tasks"] as FeedFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFeedFilter(f)}
                className={cn(
                  "rounded-full px-3 py-1 font-medium transition-colors duration-150",
                  feedFilter === f
                    ? "bg-zephyr-blue-soft text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f === "all" ? "全部" : f === "errors" ? "错误" : "任务"}
              </button>
            ))}
          </div>

          <select
            className="rounded-full border border-periwinkle-border bg-background/45 px-4 py-1.5 text-xs text-foreground transition-all duration-200 hover:border-zephyr-blue/35 focus:ring-2 focus:ring-zephyr-blue/20 focus:outline-none"
            value={logWindow}
            onChange={(e) => setLogWindow(e.target.value as LogWindow)}
          >
            <option value="1h">最近 1 小时</option>
            <option value="24h">最近 24 小时</option>
          </select>
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10">
          <div className="events-empty-icon">
            <Radar className="h-8 w-8 text-muted-foreground/20" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground/50">
              当前没有新的系统事件
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground/30">
              编排系统正在监听任务、Agent 与组织状态变化
            </p>
          </div>
        </div>
      ) : (
        <div
          ref={logsContainerRef}
          className="scrollbar-auto-hide relative max-h-[420px] overflow-auto rounded-[24px] border border-periwinkle-border"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in oklab, var(--shell-surface-bg) 85%, transparent) 0%, color-mix(in oklab, var(--card) 72%, var(--shell-surface-bg)) 100%)",
          }}
        >
          <div className="pointer-events-none absolute left-[39px] top-0 h-full w-px bg-periwinkle-dim" />
          {filteredEvents.map((event, idx) => {
            const level = toLevel(event);
            const rawName =
              (event.agentId &&
                agents?.find((a) => a.id === event.agentId)?.name) ||
              (event.actorType === "agent" &&
                agents?.find((a) => a.id === event.actorId)?.name) ||
              "系统";
            const agentName =
              rawName === "系统" ? rawName : cleanVisibleAgentName(rawName);

            return (
              <EventRow
                key={event.id}
                event={event}
                level={level}
                agentName={agentName}
                index={idx}
              />
            );
          })}
        </div>
      )}
    </section>
  );

  const PageHeader = () => (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">总览</h1>
          {runningCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-2 py-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[10px] font-medium text-emerald-400">Route Live</span>
            </div>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground/60 tracking-wide">
          风之灵枢 · AI 编排系统 · Control Plane
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => openNewIssue()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zephyr-blue bg-zephyr-blue px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:shadow-md"
        >
          <Plus className="h-3.5 w-3.5" />
          新建任务
        </button>
        <button
          type="button"
          onClick={() => navigate("/org")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/40 px-3.5 py-1.5 text-xs font-semibold text-foreground/80 transition-all duration-200 hover:border-zephyr-blue/30 hover:bg-zephyr-blue-soft"
        >
          进入组织
        </button>
      </div>
    </div>
  );

  if (!selectedCompanyId) {
    if (companies.length === 0) {
      return (
        <EmptyState
          icon={Workflow}
          message="欢迎使用风之灵枢，请先创建公司与智能体。"
          action="立即开始"
          onAction={openOnboarding}
        />
      );
    }
    return (
      <EmptyState icon={Workflow} message="请先选择一个公司再查看运营台。" />
    );
  }

  if (isLoading) return <PageSkeleton variant="dashboard" />;

  return (
    <div
      className="relative mr-auto w-full pb-20 text-foreground"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        maxWidth: "var(--content-max-width)",
      }}
    >
      <style>{`
        @keyframes panelRiseIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="panelRiseIn"] {
            animation: none !important;
          }
        }
      `}</style>

      {/* ═══ PAGE HEADER — compact title + identity + actions ═══ */}
      <div ref={useRevealRef("page-header")} className={cn("reveal-item", revealKeys.has("page-header") && "is-visible")}>
        <PageHeader />
      </div>

      {/* ═══ STATS BAR — enhanced with health/completeness ═══ */}
      <div ref={useRevealRef("mission-snapshot")} className={cn("reveal-item", revealKeys.has("mission-snapshot") && "is-visible")} style={{ transitionDelay: revealKeys.has("page-header") ? "0ms" : "50ms" }}>
        <MissionSnapshot />
      </div>

      {/* ═══ CORE WORKSPACE — balanced 2-column cards ═══ */}
      <div ref={useRevealRef("core-workspace")} className={cn("reveal-item", revealKeys.has("core-workspace") && "is-visible")} style={{ transitionDelay: "80ms" }}>
        <section className="grid grid-cols-12 gap-5">
          <div className="col-span-7" style={{ minHeight: "320px" }}>
            <RuntimePanel variant="compact" showMetrics={true} showEvents={false} showFlow={true} />
          </div>
          <div className="col-span-5" style={{ minHeight: "320px" }}>
            <SystemMetricsPanel />
          </div>
        </section>
      </div>

      {/* ═══ TIER 2 — Command Surface (consolidated detail modules) ═══ */}
      <div ref={useRevealRef("command-surface")} className={cn("reveal-item", revealKeys.has("command-surface") && "is-visible")} style={{ transitionDelay: "130ms" }}>
        <CommandSurface
          tabs={[
            {
              id: "pipeline",
              label: "作业流程",
              badge: activeIssues.length,
              content: <PipelineRail />,
            },
            {
              id: "org",
              label: "组织拓扑",
              content: <OrgRuntimePanel />,
            },
            {
              id: "agents",
              label: "Agent 检查",
              badge: activeAgentRows.length,
              content: <AgentCoordinationPanel />,
            },
            {
              id: "events",
              label: "系统事件",
              badge: alertCount,
              content: <EventTimeline />,
            },
          ]}
        />
      </div>

      {/* Overlays & Modals */}
      <Dialog open={blockedModalOpen} onOpenChange={setBlockedModalOpen}>
        <DialogContent className="max-w-2xl glass-surface rounded-[var(--radius-panel)] p-8 shadow-3xl border-none">
          <DialogHeader>
            <DialogTitle>阻塞任务列表</DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              点击任务可直接进入详情处理依赖阻塞。
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
            {blockedIssueList.length === 0 ? (
              <p className="rounded-[20px] border border-dashed border-slate-200 dark:border-white/10 px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                当前没有阻塞任务
              </p>
            ) : (
              blockedIssueList.map((issue) => (
                <Link
                  key={issue.id}
                  to={`/issues/${issue.identifier ?? issue.id}`}
                  onClick={() => setBlockedModalOpen(false)}
                  className="block rounded-[20px] border border-slate-200 dark:border-white/10 bg-white/[0.03] px-3 py-3 text-sm no-underline transition hover:border-rose-300/24 hover:bg-rose-500/10"
                >
                  <p className="font-medium text-slate-800 dark:text-white">
                    {issue.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {issue.identifier ?? issue.id.slice(0, 8)} · 优先级{" "}
                    {issue.priority}
                  </p>
                </Link>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {selectedFlowNode && (
        <>
          <button
            type="button"
            aria-label="关闭节点详情"
            className="fixed inset-0 z-[80] bg-black/20 backdrop-blur-md"
            onClick={() => setSelectedFlowNode(null)}
          />
          <aside className="fixed right-0 top-0 z-[90] flex h-full w-full max-w-md flex-col overflow-hidden border-l border-border glass-surface shadow-2xl">
            <div
              className="h-1.5 w-full flex-none"
              style={{
                background:
                  selectedFlowNode.state === "active"
                    ? "linear-gradient(90deg,#3B82F6,#6366F1)"
                    : selectedFlowNode.state === "done"
                    ? "#22C55E"
                    : selectedFlowNode.state === "failed"
                    ? "#EF4444"
                    : "#94A3B8",
              }}
            />
            <div
              key={selectedFlowNode.id}
              className="flex-1 overflow-auto p-5"
              style={{ animation: "drawerFadeIn 0.22s ease both" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    节点详情
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-800 dark:text-white">
                    {selectedFlowNode.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {selectedFlowNode.desc}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 dark:border-white/10 px-3 py-1 text-xs text-slate-600 dark:text-slate-300 transition-all duration-150 hover:border-white/20 hover:bg-white/[0.06] hover:text-slate-800 dark:text-white active:bg-white dark:bg-white/[0.04]"
                  onClick={() => setSelectedFlowNode(null)}
                >
                  关闭
                </button>
              </div>

              <div className="mt-5 space-y-3 rounded-[20px] border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] p-4 text-sm text-slate-600 dark:text-slate-300">
                <p>
                  节点状态：
                  <span className="font-medium">
                    {selectedFlowNode.state === "active"
                      ? "执行中"
                      : selectedFlowNode.state === "done"
                      ? "已完成"
                      : selectedFlowNode.state === "failed"
                      ? "异常"
                      : "待处理"}
                  </span>
                </p>
                <p>
                  关联任务：
                  <span className="font-medium">
                    {liveTask?.title ?? "暂无任务"}
                  </span>
                </p>
                <p>
                  最近同步：<span className="font-medium">{lastSyncTime}</span>
                </p>
              </div>

              <div className="mt-4 rounded-[20px] border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] p-3">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  节点日志
                </p>
                <div className="mt-2 space-y-2">
                  {nodeLogs.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      暂无可用日志
                    </p>
                  ) : (
                    nodeLogs.map((event) => (
                      <p
                        key={event.id}
                        className="truncate text-xs text-slate-500 dark:text-slate-400"
                      >
                        {relativeTime(event.createdAt)} ·{" "}
                        {translateAction(event.action)}
                      </p>
                    ))
                  )}
                </div>
              </div>

              {liveTask && (
                <div className="mt-4">
                  <Link
                    to={`/issues/${liveTask.identifier ?? liveTask.id}`}
                    onClick={() => setSelectedFlowNode(null)}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background/50 px-5 py-2 text-sm font-semibold text-foreground no-underline transition-all duration-200 hover:bg-muted hover-lift shadow-sm"
                  >
                    查看任务详情
                  </Link>
                </div>
              )}
            </div>
          </aside>
        </>
      )}

      <Dialog
        open={!!selectedAgentPanel}
        onOpenChange={(open) => !open && setSelectedAgentPanel(null)}
      >
        <DialogContent className="glass-surface rounded-[var(--radius-panel)] p-8 shadow-3xl border-none">
          <DialogHeader>
            <DialogTitle>
              {selectedAgentPanel?.displayName ?? "智能体详情"}
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              {selectedAgentPanel?.dept ?? ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <p>
              状态：
              <span className="font-medium">{selectedAgentPanel?.status}</span>
            </p>
            <p>
              当前任务：
              <span className="font-medium">{selectedAgentPanel?.task}</span>
            </p>
            <p>
              最近更新：
              <span className="font-medium">{selectedAgentPanel?.updated}</span>
            </p>
          </div>
          {selectedAgentPanel && (
            <div className="pt-2">
              <Link
                to={selectedAgentPanel.route}
                onClick={() => setSelectedAgentPanel(null)}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background/50 px-5 py-2 text-sm font-semibold text-foreground no-underline transition-all duration-200 hover:bg-muted hover-lift shadow-sm"
              >
                打开智能体面板
              </Link>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
