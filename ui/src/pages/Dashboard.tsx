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
import { cn, relativeTime, agentUrl } from "../lib/utils";
import { tStatus } from "../lib/i18n";
import { buildOrgUnits } from "../lib/company-scope";
import { OrchestrationVisual } from "../components/dashboard/OrchestrationVisual";
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

type LogWindow = "15m" | "1h" | "24h";
type SuccessWindow = "24h" | "7d" | "30d";
type FeedFilter = "all" | "errors" | "tasks";
type EventLevel = "信息" | "警告" | "错误";
type AgentLayer = "ORG" | "V1-PROJECT" | "V2-PIPELINE" | "INFRA";

type ActiveAgentRow = {
  id: string;
  route: string;
  name: string;
  layer: AgentLayer;
  dept: string;
  status: string;
  task: string;
  updated: string;
};

const DEPARTMENTS = [
  "总裁办公室",
  "技术线",
  "人力与协调",
  "社会研究院",
  "执行单元",
] as const;
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
      cls: "border-emerald-400/25 bg-emerald-500/12 text-emerald-200 ring-emerald-300/20",
    };
  if (status === "failed")
    return {
      label: "异常",
      cls: "border-rose-400/25 bg-rose-500/12 text-rose-200 ring-rose-300/20",
    };
  return {
    label: "空闲",
    cls: "border-slate-200 dark:border-white/10 bg-white/[0.06] text-slate-600 dark:text-slate-300 ring-white/10",
  };
}

function orgUnitIcon(unitKey: string): React.ReactNode {
  if (unitKey === "ceo" || unitKey === "executive-assistant")
    return <Briefcase className="h-3.5 w-3.5" />;
  if (unitKey === "cto") return <Bot className="h-3.5 w-3.5" />;
  if (unitKey === "pm") return <ShieldCheck className="h-3.5 w-3.5" />;
  if (unitKey === "research") return <FlaskConical className="h-3.5 w-3.5" />;
  if (unitKey === "public-affairs")
    return <Megaphone className="h-3.5 w-3.5" />;
  if (unitKey === "media") return <Newspaper className="h-3.5 w-3.5" />;
  return <CircleDot className="h-3.5 w-3.5" />;
}

function orgUnitDepartment(unitKey: string): string {
  if (unitKey === "ceo" || unitKey === "executive-assistant")
    return "总裁办公室";
  if (unitKey === "cto") return "技术线";
  if (unitKey === "pm") return "人力与协调";
  if (
    unitKey === "research" ||
    unitKey === "public-affairs" ||
    unitKey === "media"
  )
    return "社会研究院";
  return "执行单元";
}

function getRecentIssues(issues: Issue[]): Issue[] {
  return [...issues].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

function issueProgress(issue: Issue | null): number {
  if (!issue) return 0;
  switch (issue.status) {
    case "todo":
      return 20;
    case "in_progress":
      return 68;
    case "in_review":
      return 82;
    case "blocked":
      return 52;
    case "done":
    case "cancelled":
      return 100;
    default:
      return 10;
  }
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

function roleDepartment(role: Agent["role"]): string {
  switch (role) {
    case "ceo":
      return "总裁办公室";
    case "cto":
      return "技术线";
    case "pm":
      return "人力与协调";
    case "researcher":
      return "社会研究院";
    default:
      return "执行单元";
  }
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
      label: "[ORG]",
      description: "组织层",
      chipClass:
        "border-cyan-400/20 bg-cyan-400/10 text-cyan-500 dark:text-cyan-200 ring-cyan-400/20",
      cardClass:
        "border-border bg-card",
    };
  }
  if (layer === "V1-PROJECT") {
    return {
      label: "[V1-PROJECT]",
      description: "项目专用执行",
      chipClass:
        "border-violet-400/20 bg-violet-400/10 text-violet-500 dark:text-violet-200 ring-violet-400/20",
      cardClass:
        "border-border bg-card",
    };
  }
  if (layer === "V2-PIPELINE") {
    return {
      label: "[V2-PIPELINE]",
      description: "通用流水线",
      chipClass:
        "border-emerald-400/20 bg-emerald-400/10 text-emerald-500 dark:text-emerald-200 ring-emerald-400/20",
      cardClass:
        "border-border bg-card",
    };
  }
  return {
    label: "[INFRA]",
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

function estimateMinutes(progress: number): number {
  if (progress >= 85) return 6;
  if (progress >= 65) return 12;
  if (progress >= 45) return 18;
  return 24;
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
      className="relative flex items-start gap-3 border-b border-border/50 px-3 py-3 text-sm last:border-b-0"
      style={{
        animation: "eventRowIn 0.25s ease both",
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
      className={cn(
        "premium-panel glass-surface hover-lift group relative h-[140px] overflow-hidden rounded-[var(--radius-card)] px-6 py-6 text-left transition-all duration-300",
        kind === "accent" && "border-primary/20",
        kind === "warning" && "border-warning/30"
      )}
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
      className="premium-panel glass-surface hover-lift group relative h-[140px] overflow-hidden rounded-[var(--radius-card)] px-6 py-6 text-left transition-all duration-300"
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
  const { openOnboarding, openNewIssue } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();

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

  useEffect(() => {
    if (scopeView !== "project") return;
    if (
      projectFilter !== "all" &&
      !availableProjects.find((project) => project.id === projectFilter)
    ) {
      setProjectFilter("all");
    }
  }, [availableProjects, projectFilter, scopeView]);

  const recentIssues = issues ? getRecentIssues(issues) : [];
  const scopeAgents = useMemo(() => {
    const alive = (agents ?? []).filter((a) => a.status !== "terminated");
    if (scopeView !== "department" || departmentFilter === "all") return alive;
    return alive.filter((a) => roleDepartment(a.role) === departmentFilter);
  }, [agents, scopeView, departmentFilter]);

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
      return {
        id: agent.id,
        route: `/agents/${agent.urlKey || agent.id}`,
        name: agent.name,
        layer: inferAgentLayer(agent.name),
        dept: roleDepartment(agent.role),
        status: agentState(agent.status),
        task: issue?.title ?? "暂无任务",
        updated: relativeTime(agent.updatedAt),
      };
    });
    
    return list.sort((a, b) => {
      const statusOrder = { "执行中": 0, "等待中": 1, "空闲": 2, "异常": 3 };
      return statusOrder[a.status] - statusOrder[b.status] || a.name.localeCompare(b.name, "zh-CN");
    });
  }, [scopeAgents, issueByAssignee]);

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
      { key: "ceo", label: "总裁办公室", to: "/org?unit=ceo", agent: null },
      { key: "cto", label: "技术部", to: "/org?unit=cto", agent: null },
      { key: "pm", label: "人力部", to: "/org?unit=pm", agent: null },
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
        const dept = orgUnitDepartment(unit.key);

        const deptAgents = scopeAgents.filter(
          (agent) => roleDepartment(agent.role) === dept
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
  }, [orgUnits, scopeAgents]);

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

  const progress = issueProgress(liveTask);
  const eta = estimateMinutes(progress);
  const health = blockedIssues > 0 ? "警惕" : "稳定";
  const healthTone =
    blockedIssues > 0
      ? "text-amber-200 border-amber-400/25 bg-amber-500/12"
      : "text-emerald-200 border-emerald-400/25 bg-emerald-500/12";

  const missionStages = useMemo(() => {
    const status = liveTask?.status ?? "todo";
    const blocked = status === "blocked";
    const stageState = (index: number): { label: string; tone: string } => {
      if (blocked && index === 1)
        return {
          label: "受阻",
          tone: "border-rose-400/25 bg-rose-500/12 text-rose-200",
        };
      if (
        status === "done" ||
        (status === "in_review" && index <= 2) ||
        (status === "in_progress" && index <= 1) ||
        (status === "todo" && index === 0)
      ) {
        if (status === "todo" && index === 0) {
          return {
            label: "执行中",
            tone: "border-cyan-400/25 bg-cyan-500/12 text-cyan-200",
          };
        }
        if (status === "in_progress" && index === 1) {
          return {
            label: "执行中",
            tone: "border-cyan-400/25 bg-cyan-500/12 text-cyan-200",
          };
        }
        if (status === "in_review" && index === 2) {
          return {
            label: "校核中",
            tone: "border-violet-400/25 bg-violet-500/12 text-violet-200",
          };
        }
        return {
          label: "完成",
          tone: "border-emerald-400/25 bg-emerald-500/12 text-emerald-200",
        };
      }
      return {
        label: "待命",
        tone: "border-slate-200 dark:border-white/10 bg-white/[0.06] text-slate-600 dark:text-slate-300",
      };
    };

    return [
      {
        name: "意图解析与拆解",
        desc: "任务拆解与责任路径确认",
        ...stageState(0),
      },
      {
        name: "信息检索与同步",
        desc: "组织执行与跨部门协调",
        ...stageState(1),
      },
      { name: "风险审查与控制", desc: "审核与风险校核", ...stageState(2) },
      {
        name: "发布与自动归档",
        desc: "发布、归档与审计回写",
        ...stageState(3),
      },
    ];
  }, [liveTask]);

  const hasNoAgents = agents !== undefined && agents.length === 0;

  const companyAgents = useMemo(() => agents ?? [], [agents]);
  const departments = useMemo(() => {
    const uniqueDepartments = new Set<string>();
    companyAgents.forEach((agent) =>
      uniqueDepartments.add(roleDepartment(agent.role))
    );
    return Array.from(uniqueDepartments);
  }, [companyAgents]);
  const recentProjects = useMemo(
    () => (projects ?? []).filter((p) => !p.archivedAt).slice(0, 3),
    [projects]
  );
  const recentEvents = useMemo(() => (activity ?? []).slice(0, 5), [activity]);

  const OrgRuntimePanel = () => (
    <div className="premium-panel glass-surface hover-lift relative overflow-hidden rounded-[var(--radius-panel)] p-6 lg:p-8 shadow-2xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top_left,rgba(79,209,255,0.18),transparent_55%)]" />
      <div className="relative mb-4 flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">
            <Layers3 className="h-3.5 w-3.5" />
            [ORG] 组织控制层
          </div>
          <h3 className="mt-3 text-[22px] font-semibold tracking-[-0.03em] text-slate-800 dark:text-white">
            组织拓扑
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            从高层治理到执行单元，按部门查看当前运行密度与异常点。
          </p>
        </div>
        <Link
          to="/org"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/50 px-4 py-1.5 text-[11px] font-semibold text-foreground no-underline transition-all duration-200 hover:bg-muted hover:border-accent/30 hover-lift shadow-sm"
        >
          进入组织页
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="relative rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(9,18,31,0.96)_0%,rgba(7,13,22,0.98)_100%)] p-3.5">
        <div className="mb-4 flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
            <Briefcase className="h-3.5 w-3.5" />
            指挥链路
          </span>
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            {orgUnits.length} 个节点
          </span>
        </div>

        <div className="space-y-2.5">
          {orgUnits.map((unit) => {
            const dept = orgUnitDepartment(unit.key);
            const runtime = deptRuntimeMap.get(unit.key) ?? {
              total: 0,
              running: 0,
              waiting: 0,
              failed: 0,
              status: "idle" as DeptRuntimeStatus,
              agents: [],
            };
            const badge = statusBadge(runtime.status);

            return (
              <div
                key={unit.key}
                onClick={() => setSelectedDept(dept)}
                className="rounded-[22px] border border-white/8 bg-white/[0.03] p-2.5 shadow-[0_18px_32px_rgba(0,0,0,0.18)] transition-all duration-200 hover:-translate-y-[2px] hover:border-cyan-300/18 hover:bg-cyan-400/[0.04] hover:shadow-[0_24px_40px_rgba(0,0,0,0.24)]"
              >
                <button
                  type="button"
                  onClick={() => setSelectedDept(dept)}
                  className="group block w-full rounded-[18px] border border-transparent px-2 py-2 text-left transition-all duration-200 hover:border-cyan-300/12 hover:bg-white/[0.03]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-2xl border border-slate-200 dark:border-white/10 bg-white/[0.05] text-cyan-200">
                          {orgUnitIcon(unit.key)}
                        </span>
                        <div>
                          <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">
                            {unit.label}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Agent {runtime.total} · 运行 {runtime.running}
                          </p>
                        </div>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "inline-flex h-6 items-center rounded-full border px-2.5 text-[10px] font-semibold tracking-[0.08em] uppercase ring-1 ring-inset",
                        badge.cls
                      )}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="rounded-full border border-cyan-400/18 bg-cyan-400/10 px-2 py-0.5 font-medium text-cyan-200">
                        运行 {runtime.running}
                      </span>
                      <span className="rounded-full border border-slate-200 dark:border-white/10 bg-white/[0.05] px-2 py-0.5 text-slate-600 dark:text-slate-300">
                        等待 {runtime.waiting}
                      </span>
                      <span className="rounded-full border border-rose-400/18 bg-rose-500/10 px-2 py-0.5 text-rose-200">
                        异常 {runtime.failed}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-2 text-[10px] font-mono tracking-[0.12em] text-slate-500 dark:text-slate-400">
                      A:{runtime.total} R:{runtime.running}
                      <ChevronRight className="h-3.5 w-3.5 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
                    </span>
                  </div>
                </button>

                {runtime.agents.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {runtime.agents.slice(0, 3).map((agent) => {
                      const issue = issueByAssignee.get(agent.id);
                      const aState = agentState(agent.status);
                      const aStateCls =
                        aState === "执行中"
                          ? "text-cyan-200 bg-cyan-500/12 ring-cyan-300/15"
                          : aState === "异常"
                          ? "text-rose-200 bg-rose-500/12 ring-rose-300/15"
                          : "text-slate-600 dark:text-slate-300 bg-white/[0.06] ring-white/10";
                      return (
                        <button
                          key={agent.id}
                          type="button"
                          onClick={() =>
                            setSelectedAgentPanel({
                              id: agent.id,
                              route: `/agents/${agent.urlKey || agent.id}`,
                              name: agent.name,
                              dept: roleDepartment(agent.role),
                              status: aState,
                              task: issue?.title ?? "暂无任务",
                              updated: relativeTime(agent.updatedAt),
                              layer: inferAgentLayer(agent.name),
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-white/10 bg-white/[0.05] px-2 py-1 text-[10px] text-slate-600 dark:text-slate-300 transition-all duration-150 hover:-translate-y-[1px] hover:border-cyan-300/20 hover:bg-cyan-400/10 hover:shadow-[0_10px_16px_rgba(0,0,0,0.16)] active:translate-y-0 active:shadow-[0_4px_10px_rgba(0,0,0,0.12)]"
                        >
                          <span className="truncate max-w-[88px]">
                            {agent.name}
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center rounded px-1 py-0.5 text-[9px] font-semibold ring-1 ring-inset",
                              aStateCls
                            )}
                          >
                            {aState}
                          </span>
                        </button>
                      );
                    })}
                    {runtime.agents.length > 3 && (
                      <span className="inline-flex items-center rounded-full border border-slate-200 dark:border-white/10 bg-white/[0.05] px-2 py-1 text-[10px] text-slate-500 dark:text-slate-400">
                        +{runtime.agents.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const ActiveAgentsPanel = () => (
    <div className="premium-panel glass-surface hover-lift relative overflow-hidden rounded-[var(--radius-panel)] p-6 lg:p-8 shadow-2xl">
      <div className="relative mb-4 flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-200">
            <Bot className="h-3.5 w-3.5" />
            智能体矩阵
          </div>
          <h3 className="mt-3 text-[22px] font-semibold tracking-[-0.03em] text-foreground">
            全部智能体 ({selectedDeptAgentRows.length})
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            当前部门：{selectedDept === "all" ? "全部" : selectedDept}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedDept !== "all" && (
            <button
              type="button"
              onClick={() => setSelectedDept("all")}
              className="rounded-full border border-border bg-background/50 px-4 py-1.5 text-xs font-semibold text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground hover-lift shadow-sm"
            >
              重置部门
            </button>
          )}
          <Link
            to="/agents"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/50 px-4 py-1.5 text-xs font-semibold text-foreground no-underline transition-all duration-200 hover:bg-muted hover-lift shadow-sm"
          >
            管理全部
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="space-y-3 max-h-[600px] overflow-y-auto scrollbar-auto-hide pr-2">
        {selectedDeptAgentRows.length === 0 ? (
          <p className="rounded-[22px] border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
            当前部门下暂无活跃智能体
          </p>
        ) : (
          selectedDeptAgentRows.map((row) => {
            const statusCls =
              row.status === "执行中"
                ? "bg-cyan-500/12 text-cyan-500 dark:text-cyan-200 ring-cyan-500/20"
                : row.status === "异常"
                ? "bg-rose-500/12 text-rose-500 dark:text-rose-200 ring-rose-500/20"
                : row.status === "等待中"
                ? "bg-amber-500/12 text-amber-500 dark:text-amber-200 ring-amber-500/20"
                : "bg-muted text-muted-foreground ring-border";

            return (
              <button
                key={row.id}
                type="button"
                onClick={() => navigate(agentUrl({ id: row.id, name: row.name, role: "agent" } as any))}
                className="group w-full rounded-[20px] border border-border bg-background px-4 py-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-[2px] hover:border-foreground/20 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{
                          backgroundColor:
                            row.status === "执行中"
                              ? "var(--cyan-500, #06b6d4)"
                              : row.status === "异常"
                              ? "var(--rose-500, #f43f5e)"
                              : "var(--slate-400, #94a3b8)",
                        }}
                      />
                      <p className="truncate text-base font-semibold text-foreground">
                        {row.name}
                      </p>
                      <span className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {row.dept}
                      </span>
                      <span className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground uppercase">
                        {row.layer}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className={cn(
                          "inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold ring-1 ring-inset",
                          statusCls
                        )}
                      >
                        {row.status}
                      </span>
                      <span>最近更新 {row.updated}</span>
                    </div>
                    {row.task && row.task !== "无" && (
                      <p className="mt-2 truncate text-sm text-foreground/80">
                        当前任务：{row.task}
                      </p>
                    )}
                  </div>

                  <span className="inline-flex items-center rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm transition-all duration-150 group-hover:bg-muted group-hover:text-foreground">
                    详情 <ChevronRight className="ml-1 h-3.5 w-3.5" />
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  const ZephyrHero = () => {
    return (
      <section className="premium-panel glass-surface relative h-[520px] overflow-hidden rounded-[var(--radius-hero)] border-none shadow-2xl">
        <div className="absolute inset-0 z-0">
          <OrchestrationVisual className="scale-110 opacity-60 dark:opacity-40 translate-x-[25%] lg:translate-x-[30%]" />
        </div>
        
        <div className="relative z-10 flex h-full flex-col justify-between p-10 lg:p-12">
          <div className="max-w-xl">
            {/* 1. System Status Badge */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-1.5 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-widest text-foreground/70">
                System Active · {lastSyncTime}
              </span>
            </div>

            {/* 2 & 3. Zephyr Nexus + Chinese Name */}
            <div className="space-y-1">
              <h1 className="text-6xl lg:text-7xl font-bold tracking-tighter text-foreground">
                Zephyr Nexus
              </h1>
              <h2 className="text-3xl lg:text-4xl font-light tracking-[.25em] text-foreground/60">
                风之灵枢
              </h2>
            </div>

            {/* 4. Product Description */}
            <p className="mt-6 text-lg font-medium text-muted-foreground/80">
              多智能体协同与任务调度中枢
            </p>

            {/* 5. Integrated Metrics Row */}
            <div className="mt-10 flex items-center gap-12">
              <div className="space-y-1">
                <p className="text-3xl font-bold text-foreground tracking-tight">{departments.length}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">部门 / Departments</p>
              </div>
              <div className="h-8 w-px bg-border/40" />
              <div className="space-y-1">
                <p className="text-3xl font-bold text-foreground tracking-tight">{companyAgents.length}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">智能体 / Spirits</p>
              </div>
              <div className="h-8 w-px bg-border/40" />
              <div className="space-y-1">
                <p className="text-3xl font-bold text-foreground tracking-tight">{successRate}%</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">成功率 / Success</p>
              </div>
            </div>

            {/* 6. Primary CTA */}
            <div className="mt-10">
              <button
                type="button"
                onClick={() => openNewIssue()}
                className="inline-flex items-center gap-3 rounded-2xl bg-foreground px-8 py-4 text-base font-bold text-background shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 active:scale-95 group"
              >
                <Plus className="h-5 w-5 transition-transform group-hover:rotate-90" />
                新建任务
              </button>
            </div>
          </div>

          {/* 7. Capability Signature Line */}
          <div className="mt-auto flex flex-wrap items-center gap-6 text-[11px] font-bold uppercase tracking-[.2em] text-muted-foreground/40">
            <span className="hover:text-foreground transition-colors cursor-default">Zephyr Spirits｜智能体群</span>
            <span className="h-1 w-1 rounded-full bg-current" />
            <span className="hover:text-foreground transition-colors cursor-default">Wind Paths｜任务流</span>
            <span className="h-1 w-1 rounded-full bg-current" />
            <span className="hover:text-foreground transition-colors cursor-default">Zephyr Swarm｜协同网络</span>
            <span className="h-1 w-1 rounded-full bg-current" />
            <span className="hover:text-foreground transition-colors cursor-default">Wind Engine｜执行引擎</span>
          </div>
        </div>
      </section>
    );
  };
  const MissionControl = () => {
    return (
      <section className="premium-panel glass-surface hover-lift relative overflow-hidden rounded-[var(--radius-panel)] shadow-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.07),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.07),transparent_28%)]" />
        <div className="relative grid gap-6 p-6 xl:grid-cols-[minmax(0,1.18fr)_340px] xl:p-8">
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200">
                  任务执行流
                </p>
                <h3 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-800 dark:text-white">
                  主任务执行中心
                </h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                  主任务：{liveTask?.title ?? "等待主任务"} · 责任链：总裁 →
                  社会研究院 → 公共责任部 → 报告生成。
                </p>
              </div>
              <Link
                to="/flow"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/50 px-4 py-1.5 text-xs font-semibold text-foreground no-underline transition-all duration-200 hover:bg-muted hover-lift shadow-sm"
              >
                查看完整流程
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="launch-chip">进度 {progress}%</span>
              <span className="launch-chip">预计 {eta} 分钟</span>
              <span className={cn("launch-chip", healthTone)}>
                状态 {health}
              </span>
              <span className="launch-chip launch-chip-violet">
                项目 {liveProjectName}
              </span>
            </div>
            <div className="h-px w-full overflow-hidden rounded-full bg-white/10">
              <div className="animate-data-flow h-full w-full" />
            </div>

            <div className="premium-panel glass-surface hover-lift rounded-[var(--radius-card)] p-6 shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    执行流图
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    点击节点查看当前阶段上下文与日志。
                  </p>
                </div>
                <div className="rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-1 text-[11px] text-slate-600 dark:text-slate-300">
                  {liveTask?.identifier ?? "实时任务"}
                </div>
              </div>
              <div className="rounded-[var(--radius-card)] border border-border/40 bg-background/20 backdrop-blur-sm p-4 shadow-inner">
                <TaskFlowBoard
                  task={liveTask}
                  showSummary={false}
                  onNodeSelect={setSelectedFlowNode}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="premium-panel glass-surface hover-lift rounded-[var(--radius-card)] p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  任务简报
                </p>
                <CircleDot className="h-4 w-4 text-cyan-200" />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="launch-chip launch-chip-cyan px-2.5 py-1 text-[10px]">
                  运行中 {runningAgents.length}
                </span>
                <span className="launch-chip launch-chip-rose px-2.5 py-1 text-[10px]">
                  阻塞 {blockedIssues}
                </span>
                <span className="launch-chip px-2.5 py-1 text-[10px]">
                  失败 {failedRuns}
                </span>
              </div>
              <p className="mt-4 text-[22px] font-semibold tracking-[-0.03em] text-slate-800 dark:text-white">
                {progress}%
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                执行进度已进入{" "}
                {liveTask?.status === "in_review"
                  ? "review"
                  : liveTask?.status === "done"
                  ? "done"
                  : liveTask?.status === "blocked"
                  ? "blocked"
                  : "active"}{" "}
                阶段。
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
                <div
                  className="animate-data-flow h-full rounded-full bg-[linear-gradient(90deg,#4fd1ff,#818cf8)] shadow-[0_0_20px_rgba(79,209,255,0.35)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="premium-panel glass-surface hover-lift rounded-[var(--radius-card)] p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  执行流图
                </p>
                <Workflow className="h-4 w-4 text-violet-200" />
              </div>
              <div className="mt-4 space-y-2.5">
                {missionStages.map((stage, idx) => (
                  <div
                    key={stage.name}
                    className="hover-lift relative rounded-[20px] border border-white/8 bg-slate-100/70 dark:bg-black/20 p-3.5"
                  >
                    {idx < missionStages.length - 1 && (
                      <span className="pointer-events-none absolute left-[18px] top-[34px] h-5 w-px bg-white/12" />
                    )}
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                          执行阶段 {idx + 1}
                        </p>
                        <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">
                          {stage.name}
                        </p>
                        <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
                          {stage.desc}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold",
                          stage.tone
                        )}
                      >
                        {stage.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="premium-panel glass-surface hover-lift rounded-[var(--radius-card)] p-6 shadow-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                运行信号
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-[20px] border border-white/8 bg-slate-100/70 dark:bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    风险堆栈
                  </p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    阻塞 {blockedIssues} · 失败 {failedRuns} · 告警 {alertCount}
                  </p>
                </div>
                <div className="rounded-[20px] border border-white/8 bg-slate-100/70 dark:bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    关键节点
                  </p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {runningAgents[0]?.name ?? "暂无活跃执行者"}
                  </p>
                </div>
                <div className="rounded-[20px] border border-white/8 bg-slate-100/70 dark:bg-black/20 p-4 sm:col-span-2 xl:col-span-1">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    同步视角
                  </p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    同步 {lastSyncTime} · 视角{" "}
                    {scopeView === "company"
                      ? "公司"
                      : scopeView === "project"
                      ? "项目"
                      : "部门"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  };

  const ExecutionDeck = () => (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            分布式大盘
          </p>
          <h3 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-slate-800 dark:text-white">
            组织与执行层联动视图
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            左侧聚焦组织运行密度，右侧呈现分层智能体执行状态。
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(79,209,255,0.5)]" />
          实时矩阵
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[0.96fr_1.04fr]">
        <OrgRuntimePanel />
        <ActiveAgentsPanel />
      </div>
    </section>
  );

  const EventTimeline = () => (
    <section className="premium-panel glass-surface hover-lift relative overflow-hidden rounded-[var(--radius-panel)] p-6 lg:p-8 shadow-2xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top_right,rgba(79,209,255,0.16),transparent_50%)]" />
      <div className="relative mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            系统动态流
          </p>
          <h3 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-slate-800 dark:text-white">
            系统事件
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full border border-slate-200 dark:border-white/10 bg-slate-100/70 dark:bg-black/20 p-0.5 text-xs">
            {(["all", "errors", "tasks"] as FeedFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFeedFilter(f)}
                className={cn(
                  "rounded-full px-3 py-1 font-medium transition-colors duration-150",
                  feedFilter === f
                    ? "bg-white/12 text-slate-800 dark:text-white shadow-[0_8px_16px_rgba(0,0,0,0.18)]"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:text-slate-300"
                )}
              >
                {f === "all" ? "全部" : f === "errors" ? "错误" : "任务"}
              </button>
            ))}
          </div>

          <select
            className="rounded-full border border-border bg-background/50 px-4 py-1.5 text-xs text-foreground transition-all duration-200 hover:border-accent/40 focus:ring-2 focus:ring-accent/20 focus:outline-none"
            value={logWindow}
            onChange={(e) => setLogWindow(e.target.value as LogWindow)}
          >
            <option value="15m">最近 15 分钟</option>
            <option value="1h">最近 1 小时</option>
            <option value="24h">最近 24 小时</option>
          </select>
        </div>
      </div>
      <div className="relative mb-4 flex flex-wrap items-center gap-2">
        <span className="launch-chip launch-chip-cyan">
          事件 {filteredEvents.length}
        </span>
        <span className="launch-chip launch-chip-rose">
          错误{" "}
          {filteredEvents.filter((event) => toLevel(event) === "错误").length}
        </span>
        <span className="launch-chip launch-chip-amber">
          警告{" "}
          {filteredEvents.filter((event) => toLevel(event) === "警告").length}
        </span>
      </div>

      {filteredEvents.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          当前筛选下暂无事件。
        </p>
      ) : (
        <div
          ref={logsContainerRef}
          className="relative max-h-[420px] overflow-auto rounded-[24px] border border-slate-200 dark:border-white/10 bg-[linear-gradient(180deg,rgba(6,12,21,0.75)_0%,rgba(4,9,17,0.82)_100%)]"
        >
          <div className="pointer-events-none absolute left-[39px] top-0 h-full w-px bg-white/10" />
          {filteredEvents.map((event, idx) => {
            const level = toLevel(event);
            const agentName =
              (event.agentId &&
                agents?.find((a) => a.id === event.agentId)?.name) ||
              (event.actorType === "agent" &&
                agents?.find((a) => a.id === event.actorId)?.name) ||
              "系统";

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

  if (!selectedCompanyId) {
    if (companies.length === 0) {
      return (
        <EmptyState
          icon={Workflow}
          message="欢迎使用 Zephyr Nexus (风之灵枢)，请先创建公司与智能体。"
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
      className="relative mx-auto w-full max-w-[2400px] space-y-6 lg:px-6 xl:px-10 px-4 pb-12 pt-4 text-foreground selection:bg-accent selection:text-accent-foreground"
      style={{
        fontFamily:
          '"IBM Plex Sans", "Inter", "HarmonyOS Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
      }}
    >
      {/* Background ambient container - Neutral */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" />
      <style>{`
        @keyframes eventRowIn {
          from { opacity: 0; transform: translateX(-7px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes eventDotBreathSoft {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50%      { transform: scale(1.3); opacity: 0.45; }
        }
        @keyframes eventDotBreathStrong {
          0%, 100% { transform: scale(1); opacity: 0.95; }
          50%      { transform: scale(1.55); opacity: 0.28; }
        }
        @keyframes drawerFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes panelRiseIn {
          from { opacity: 0; transform: translateY(10px) scale(0.99); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
      {error && <p className="text-sm text-rose-300">{error.message}</p>}

      {data && (
        <div className="space-y-6">
          <div className="mx-auto flex w-full flex-col gap-6 pt-4">
            {/* Top Row: Brand Hero & Overview */}
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 lg:col-span-8">
                <ZephyrHero />
              </div>

              <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                <div className="premium-panel glass-surface flex-1 rounded-[var(--radius-panel)] p-6 lg:p-8 relative overflow-hidden flex flex-col justify-between shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-accent/5 pointer-events-none" />

                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                      <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                        执行摘要
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold text-foreground tracking-tight mt-1">
                      平台状态
                    </h3>
                  </div>

                  <div className="relative z-10 mt-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Network className="h-3.5 w-3.5" /> 组织架构
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {departments.length} 部门
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Briefcase className="h-3.5 w-3.5" /> 运行项目
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {recentProjects.length} 活跃
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Activity className="h-3.5 w-3.5" /> 处理事件
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {recentEvents.length} 条 (近期)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div
            style={{
              animation: "panelRiseIn 0.36s ease both",
              animationDelay: "40ms",
            }}
          >
            <div className="premium-panel glass-surface hover-lift rounded-[var(--radius-panel)] overflow-hidden shadow-2xl">
              <div className="px-5 py-5 pb-6 border-b border-border/50 bg-background/50">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-2 w-2 rounded-full border-2 border-primary bg-background" />
                      <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                        MISSION FLOW
                      </span>
                    </div>
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">
                      任务执行流
                    </h2>
                    <p className="text-[14px] font-medium text-muted-foreground">
                      正在处理中...
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Ribbon below content */}
              <div className="flex items-center justify-between bg-sidebar-accent/50 px-5 py-3">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-success" />{" "}
                    安全已校验
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    <Network className="h-3.5 w-3.5" /> 跨节点路由已启用
                  </span>
                </div>
                <Link
                  to="/issues"
                  className="group inline-flex items-center gap-1 rounded-full bg-foreground px-3 py-1 text-[11px] font-semibold text-background transition-colors hover:bg-foreground/90"
                >
                  查看详情
                  <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </div>
          <div
            style={{
              animation: "panelRiseIn 0.4s ease both",
              animationDelay: "80ms",
            }}
          >
            <div
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
              style={{
                animation: "panelRiseIn 0.44s ease both",
                animationDelay: "120ms",
              }}
            >
              <div className="flex flex-col gap-4">
                <h2 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
                  <Network className="h-5 w-5 text-muted-foreground" />
                  组织拓扑
                </h2>
                <div className="premium-panel glass-surface hover-lift overflow-hidden rounded-[var(--radius-panel)] p-6 lg:p-8 h-full shadow-2xl">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                    <MetricCard
                      title="活跃任务"
                      value={activeIssues.length}
                      subtitle="系统执行中"
                      icon={<Activity className="h-5 w-5" />}
                    />
                    <MetricCard
                      title="受阻节点"
                      value={blockedIssues}
                      subtitle="人工接入请求"
                      kind={blockedIssues > 0 ? "warning" : "primary"}
                      onClick={() => navigate("/issues")}
                      icon={<AlertCircle className="h-5 w-5" />}
                    />
                    <MetricCard
                      title="系统成功率"
                      value={`${successWindow === "24h" ? 98 : 96}%`}
                      subtitle={`过去 ${successWindow === "24h" ? "24小时" : "7天"}`}
                      icon={<Activity className="h-5 w-5" />}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <h2 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
                  <Bot className="h-5 w-5 text-muted-foreground" />
                  活跃智能体
                </h2>
                <div className="premium-panel glass-surface hover-lift overflow-hidden rounded-[var(--radius-panel)] flex flex-col items-stretch divide-y divide-border/50 h-full max-h-[420px] overflow-y-auto scrollbar-auto-hide shadow-2xl">
                  {companyAgents.slice(0, 5).map((agent) => (
                    <Link
                      key={agent.id}
                      to={agentUrl(agent)}
                      className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-center h-10 w-10 shrink-0 rounded-full border border-border bg-sidebar-accent overflow-hidden">
                        <AgentIcon icon={agent.icon} className="h-full w-full" seed={agent.id} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                          <p className="text-sm font-semibold text-foreground truncate">{agent.name.replace(/\[.*\]\s*/, "")}</p>
                          <span className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border",
                            agent.status === "running" || agent.status === "idle" ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20" :
                            agent.status === "error" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" :
                            "bg-muted text-muted-foreground border-border"
                          )}>
                            {tStatus(agent.status)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{agent.title || agent.role.toUpperCase()}</p>
                      </div>
                    </Link>
                  ))}
                  {companyAgents.length === 0 && (
                    <div className="p-8 flex flex-col items-center justify-center text-center">
                      <Bot className="h-8 w-8 text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">暂无活跃智能体</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div
            style={{
              animation: "panelRiseIn 0.44s ease both",
              animationDelay: "120ms",
            }}
          >
            <EventTimeline />
          </div>
        </div>
      )}

      <Dialog open={blockedModalOpen} onOpenChange={setBlockedModalOpen}>
        {" "}
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
            {/* status-colored top bar */}
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
            {/* content fades in when selected node changes */}
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
              {selectedAgentPanel?.name ?? "智能体详情"}
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
