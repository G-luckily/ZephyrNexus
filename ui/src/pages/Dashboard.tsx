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
import { ConstellationWindField } from "../components/dashboard/ConstellationWindField";
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
  const { openOnboarding, openNewIssue, openNewAgent } = useDialog();
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

  const OrgRuntimePanel = () => (
    <section className="premium-panel glass-surface relative flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius-panel)] p-5 lg:p-6">
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
          <h3 className="mt-3 text-[20px] font-semibold tracking-tight text-foreground">
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

  const ActiveAgentsPanel = () => {
    const counts = useMemo(() => {
      const all = selectedDeptAgentRows;
      return {
        active: all.filter((r) => r.status === "执行中").length,
        waiting: all.filter((r) => r.status === "等待中").length,
        failed: all.filter((r) => r.status === "异常").length,
        total: all.length,
      };
    }, [selectedDeptAgentRows]);

    return (
      <section className="premium-panel glass-surface relative flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius-panel)] p-5 lg:p-6">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-28"
          style={{
            background:
              "radial-gradient(circle at 78% 0%, color-mix(in oklab, var(--violet-mist) 75%, transparent) 0%, transparent 68%)",
          }}
        />
        <div className="relative mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-periwinkle-border bg-periwinkle-dim px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-shell-chip-foreground">
              <Bot className="h-3.5 w-3.5 text-zephyr-blue" />
              活跃智能体
            </div>
            <h3 className="mt-3 text-[20px] font-semibold tracking-tight text-foreground">
              智能体群协同面板
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              群体摘要与实时名册同步联动。
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedDept !== "all" && (
              <button
                type="button"
                onClick={() => setSelectedDept("all")}
                className="rounded-full border border-border bg-background/40 px-3.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-all duration-200 hover:bg-zephyr-blue-soft hover:text-foreground"
              >
                重置部门
              </button>
            )}
            <button
              type="button"
              onClick={() => openNewAgent()}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-3.5 py-1.5 text-[11px] font-semibold text-foreground transition-all duration-200 hover:border-zephyr-blue/35 hover:bg-zephyr-blue-soft"
            >
              <Plus className="h-3.5 w-3.5" />
              新建智能体
            </button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-4 gap-2 text-[11px]">
          <div className="rounded-xl border border-zephyr-blue/25 bg-zephyr-blue-soft px-3 py-2 text-center">
            <p className="font-semibold text-zephyr-blue">{counts.active}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              活跃
            </p>
          </div>
          <div className="rounded-xl border border-periwinkle-border bg-background/45 px-3 py-2 text-center">
            <p className="font-semibold text-foreground">{counts.waiting}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              待命
            </p>
          </div>
          <div className="rounded-xl border border-rose-400/20 bg-rose-500/8 px-3 py-2 text-center">
            <p className="font-semibold text-rose-500 dark:text-rose-200">{counts.failed}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              异常
            </p>
          </div>
          <div className="rounded-xl border border-periwinkle-border bg-background/45 px-3 py-2 text-center">
            <p className="font-semibold text-foreground">{counts.total}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              总计
            </p>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col rounded-[22px] border border-periwinkle-border bg-background/35 p-3">
          <div className="mb-3 flex shrink-0 items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              实时名册
            </span>
            <div className="h-px flex-1 bg-periwinkle-dim" />
            <span className="text-[10px] font-medium text-zephyr-blue">
              {selectedDept === "all" ? "全部部门" : selectedDept}
            </span>
          </div>

          {selectedDeptAgentRows.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-periwinkle-border bg-background/35 px-4 py-8 text-center text-sm text-muted-foreground">
              当前筛选下暂无活跃智能体
            </div>
          ) : (
            <div className="scrollbar-auto-hide min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {(Object.keys(agentLayerCounts) as AgentLayer[]).map((layer) => {
                const rows = activeAgentRowsByLayer.get(layer) ?? [];
                if (rows.length === 0) return null;
                const meta = layerMeta(layer);

                return (
                  <div
                    key={layer}
                    className="rounded-2xl border border-periwinkle-border bg-background/45 p-2.5"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {meta.label} · {meta.description}
                      </p>
                      <span className="rounded-full border border-periwinkle-border bg-periwinkle-dim px-2 py-0.5 text-[10px] font-medium text-shell-chip-foreground">
                        {rows.length}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {rows.map((row) => {
                        const statusCls =
                          row.status === "执行中"
                            ? "bg-zephyr-blue-soft text-zephyr-blue ring-zephyr-blue/25"
                            : row.status === "异常"
                            ? "bg-rose-500/12 text-rose-500 dark:text-rose-200 ring-rose-500/22"
                            : row.status === "等待中"
                            ? "bg-periwinkle-dim text-shell-chip-foreground ring-periwinkle-border"
                            : "bg-muted text-muted-foreground ring-border";

                        return (
                          <button
                            key={row.id}
                            type="button"
                            onClick={() => navigate(row.route)}
                            className="group flex w-full items-center justify-between gap-2.5 rounded-xl border border-transparent bg-background/35 px-2.5 py-1.5 text-left transition-all duration-150 hover:border-zephyr-blue/25 hover:bg-background/55"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">
                                {row.displayName}
                              </p>
                              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                {row.subtitle}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold ring-1 ring-inset",
                                  statusCls
                                )}
                              >
                                {row.status}
                              </span>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/80 transition-transform duration-150 group-hover:translate-x-0.5" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-3 flex shrink-0 items-center justify-between border-t border-periwinkle-border pt-2">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              名册密度
            </span>
            <span className="text-[10px] font-medium text-zephyr-blue">
              已纳管 {counts.total} 个智能体
            </span>
          </div>
        </div>
      </section>
    );
  };

  const ZephyrHero = () => {
    return (
      <section className="premium-panel glass-surface relative overflow-hidden rounded-[var(--radius-hero)] border shadow-xl">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(120deg, color-mix(in oklab, var(--shell-surface-bg) 86%, transparent) 0%, color-mix(in oklab, var(--shell-surface-bg) 62%, transparent) 46%, transparent 100%)",
          }}
        />
        <div className="pointer-events-none absolute inset-0 z-[1]">
          <ConstellationWindField className="h-full w-full opacity-[0.95] dark:opacity-[0.98]" />
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-[2] w-[64%]"
          style={{
            background:
              "linear-gradient(90deg, var(--card) 0%, color-mix(in oklab, var(--card) 88%, transparent) 35%, transparent 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 left-[40%] z-[2] w-[30%]"
          style={{
            background:
              "radial-gradient(ellipse at 22% 50%, var(--violet-glow) 0%, transparent 72%)",
          }}
        />

        <div className="relative z-10 flex min-h-[350px] flex-col justify-between p-7 md:p-9 lg:p-11">
          <div className="max-w-[700px] space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-periwinkle-border bg-background/55 px-3.5 py-1 backdrop-blur-xl">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-zephyr-blue opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-zephyr-blue" />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/80">
                系统在线 · {lastSyncTime}
              </span>
            </div>

            <div className="space-y-1.5">
              <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl lg:text-[3.25rem]">
                风之灵枢
              </h1>
              <h2 className="text-lg font-light tracking-[0.22em] text-muted-foreground md:text-xl lg:text-2xl">
                AI 编排系统
              </h2>
            </div>

            <div className="rounded-[20px] border border-periwinkle-border bg-background/48 px-4 py-3 backdrop-blur-sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                <div>
                  <p className="text-2xl font-semibold leading-none text-foreground">
                    {departments.length}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    部门
                  </p>
                </div>
                <div className="sm:border-l sm:border-periwinkle-border sm:pl-4">
                  <p className="text-2xl font-semibold leading-none text-foreground">
                    {companyAgents.length}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    智能体
                  </p>
                </div>
                <div className="sm:border-l sm:border-periwinkle-border sm:pl-4">
                  <p className="text-2xl font-semibold leading-none text-foreground">
                    96%
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    健康度
                  </p>
                </div>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => openNewIssue()}
                className="inline-flex items-center gap-2 rounded-xl border border-zephyr-blue bg-zephyr-blue px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_22px_-14px_var(--zephyr-blue-glow)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_28px_-14px_var(--zephyr-blue-glow)]"
              >
                <Plus className="h-4 w-4" />
                新建任务
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
            <span>风灵群体｜智能体群</span>
            <span className="h-[3px] w-[3px] rounded-full bg-current opacity-40" />
            <span>风脉路径｜任务流</span>
            <span className="h-[3px] w-[3px] rounded-full bg-current opacity-40" />
            <span>风灵协同｜协同网络</span>
            <span className="h-[3px] w-[3px] rounded-full bg-current opacity-40" />
            <span>风擎引擎｜执行引擎</span>
          </div>
        </div>
      </section>
    );
  };

  const SystemMetricsPanel = () => {
    const metrics = [
      {
        label: "活跃任务",
        value: activeIssues.length,
        sub: "执行负载",
        icon: <Activity className="h-4 w-4" />,
        tone: "blue",
      },
      {
        label: "人工升级",
        value: blockedIssues,
        sub: "人工介入",
        icon: <AlertTriangle className="h-4 w-4" />,
        tone: "warm",
      },
      {
        label: "系统成功率",
        value: `${successRate}%`,
        sub: "运行质量",
        icon: <ShieldCheck className="h-4 w-4" />,
        tone: "periwinkle",
      },
      {
        label: "通信机器人",
        value: "活跃",
        sub: "同步中",
        icon: <Bot className="h-4 w-4" />,
        tone: "violet",
      },
      {
        label: "安全监测",
        value: failedRuns > 0 ? "告警中" : "安全",
        sub: "实时守护",
        icon: <ShieldAlert className="h-4 w-4" />,
        tone: "silver",
      },
    ] as const;

    const toneClass: Record<(typeof metrics)[number]["tone"], string> = {
      blue: "border-zephyr-blue/25 bg-zephyr-blue-soft/55 text-zephyr-blue",
      warm: "border-warning/35 bg-warning/10 text-warning",
      periwinkle:
        "border-periwinkle-border bg-periwinkle-dim text-shell-chip-foreground",
      violet: "border-violet-soft/30 bg-violet-mist text-violet-soft",
      silver:
        "border-periwinkle-border bg-background/45 text-shell-chip-foreground",
    };

    return (
      <section className="premium-panel glass-surface relative flex h-full min-h-[260px] flex-col overflow-hidden rounded-[var(--radius-panel)] p-5 lg:p-6">
        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            系统指标
          </p>
          <h3 className="mt-2 text-[20px] font-semibold tracking-tight text-foreground">
            执行监控面板
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            任务执行与系统健康同步观察。
          </p>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-2.5 sm:grid-cols-2">
          {metrics.map((metric, index) => (
            <div
              key={metric.label}
              className={cn(
                "flex items-center justify-between rounded-2xl border bg-background/40 px-3.5 py-3 transition-colors duration-150 hover:bg-background/60",
                index === metrics.length - 1 && "sm:col-span-2"
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-foreground">
                  {metric.label}
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {metric.sub}
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-xl border",
                    toneClass[metric.tone]
                  )}
                >
                  {metric.icon}
                </span>
                <p className="text-right text-base font-semibold text-foreground">
                  {metric.value}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  const OrchestrationLane = () => {
    const status = liveTask?.status ?? "todo";
    const blocked = status === "blocked";
    const stages = [
      {
        id: "start",
        label: "启动",
        state: status === "todo" ? "active" : "done",
      },
      {
        id: "schedule",
        label: "任务调度",
        state:
          status === "todo"
            ? "pending"
            : blocked
            ? "failed"
            : status === "in_progress"
            ? "active"
            : "done",
      },
      {
        id: "query",
        label: "指标查询",
        state:
          status === "in_review" || status === "done"
            ? status === "done"
              ? "done"
              : "active"
            : "pending",
      },
      {
        id: "review",
        label: "人工复核",
        state:
          status === "done"
            ? "done"
            : status === "in_review"
            ? "active"
            : "pending",
      },
    ] as const;

    const terminalIndex = stages.reduce((acc, stage, index) => {
      if (
        stage.state === "done" ||
        stage.state === "active" ||
        stage.state === "failed"
      ) {
        return index;
      }
      return acc;
    }, 0);
    const progress = Math.max(
      8,
      Math.round((terminalIndex / (stages.length - 1)) * 100)
    );
    const progressBar = stages.some((stage) => stage.state === "failed")
      ? "linear-gradient(90deg, color-mix(in oklab, var(--zephyr-blue) 35%, var(--warning)) 0%, var(--error) 100%)"
      : "linear-gradient(90deg, var(--zephyr-blue) 0%, var(--periwinkle) 100%)";

    return (
      <div className="relative px-2 py-1.5">
        <div className="absolute left-4 right-4 top-[22px] h-[2px] rounded-full bg-periwinkle-dim" />
        <div
          className="absolute left-4 top-[22px] h-[2px] rounded-full transition-[width] duration-500"
          style={{
            width: `calc((100% - 2rem) * ${progress / 100})`,
            background: progressBar,
          }}
        />

        <div className="relative grid grid-cols-4 gap-2">
          {stages.map((stage) => {
            const isActive = stage.state === "active";
            const isDone = stage.state === "done";
            const isFailed = stage.state === "failed";

            return (
              <div
                key={stage.id}
                className={cn(
                  "rounded-2xl border bg-background/55 px-2.5 py-2.5 transition-colors duration-150",
                  isActive
                    ? "border-zephyr-blue/40 bg-zephyr-blue-soft/70"
                    : isDone
                    ? "border-success/35 bg-success/10"
                    : isFailed
                    ? "border-error/35 bg-error/10"
                    : "border-periwinkle-border bg-background/40"
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex h-5 w-5 items-center justify-center rounded-full border",
                      isActive
                        ? "border-zephyr-blue bg-zephyr-blue-soft"
                        : isDone
                        ? "border-success/45 bg-success/12"
                        : isFailed
                        ? "border-error/45 bg-error/12"
                        : "border-periwinkle-border bg-background/70"
                    )}
                  >
                    {isDone ? (
                      <Check className="h-3.5 w-3.5 text-success" />
                    ) : isFailed ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-error" />
                    ) : (
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          isActive ? "animate-pulse bg-zephyr-blue" : "bg-muted-foreground/45"
                        )}
                      />
                    )}
                  </span>
                  <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground">
                    {stage.label}
                  </p>
                </div>
                <p
                  className={cn(
                    "mt-1.5 text-[10px] font-medium uppercase tracking-[0.1em]",
                    isActive
                      ? "text-zephyr-blue"
                      : isDone
                      ? "text-success"
                      : isFailed
                      ? "text-error"
                      : "text-muted-foreground"
                  )}
                >
                  {isActive
                    ? "运行中"
                    : isDone
                    ? "已完成"
                    : isFailed
                    ? "失败"
                    : "待处理"}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const MissionControl = () => {
    return (
      <section className="premium-panel glass-surface relative flex h-full min-h-[260px] flex-col overflow-hidden rounded-[var(--radius-panel)] p-5 lg:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              任务流程
            </p>
            <h3 className="mt-2 text-[20px] font-semibold tracking-tight text-foreground">
              任务执行链
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              执行与人工校核的首页编排摘要。
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-periwinkle-border bg-periwinkle-dim px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-shell-chip-foreground">
            <Workflow className="h-3.5 w-3.5 text-zephyr-blue" />
            编排通道
          </div>
        </div>

        <div className="rounded-[22px] border border-periwinkle-border bg-background/36 p-2">
          <OrchestrationLane />
        </div>
      </section>
    );
  };

  const EventTimeline = () => (
    <section className="premium-panel glass-surface hover-lift relative overflow-hidden rounded-[var(--radius-panel)] p-6 lg:p-8 shadow-2xl">
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
          <h3 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-foreground">
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
        <p className="text-sm text-muted-foreground">
          当前筛选下暂无事件。
        </p>
      ) : (
        <div
          ref={logsContainerRef}
          className="relative max-h-[420px] overflow-auto rounded-[24px] border border-periwinkle-border"
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
      className="relative mr-auto w-full max-w-[1760px] space-y-5 pb-20 pt-8 text-foreground"
    >
      <style>{`
        @keyframes panelRiseIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <section style={{ animation: "panelRiseIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) both" }}>
        <ZephyrHero />
      </section>

      <section
        className="grid items-stretch gap-5 lg:grid-cols-2"
        style={{
          animation: "panelRiseIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) both",
          animationDelay: "0.1s",
        }}
      >
        <MissionControl />
        <SystemMetricsPanel />
      </section>

      <section
        className="grid items-stretch gap-5 lg:h-[620px] lg:grid-cols-2"
        style={{
          animation: "panelRiseIn 0.85s cubic-bezier(0.16, 1, 0.3, 1) both",
          animationDelay: "0.14s",
        }}
      >
        <OrgRuntimePanel />
        <ActiveAgentsPanel />
      </section>

      <section
        style={{
        animation: "panelRiseIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) both",
        animationDelay: "0.2s",
      }}>
        <EventTimeline />
      </section>

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
