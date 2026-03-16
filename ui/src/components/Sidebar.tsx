import {
  Inbox,
  CircleDot,
  Target,
  LayoutDashboard,
  Search,
  SquarePen,
  Settings,
  BookOpen,
  Building2,
  Briefcase,
  Network,
  Bot,
  CircleDollarSign,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SidebarSection } from "./SidebarSection";
import { SidebarNavItem } from "./SidebarNavItem";
import { useDialog } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { sidebarBadgesApi } from "../api/sidebarBadges";
import { heartbeatsApi } from "../api/heartbeats";
import { projectsApi } from "../api/projects";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import {
  buildAgentTiers,
  buildOrgUnits,
  buildProjectNav,
} from "../lib/company-scope";
import { useWorkspaceScope } from "../context/WorkspaceScopeContext";
import { Button } from "@/components/ui/button";

function orgUnitToDept(unitKey: string): string {
  switch (unitKey) {
    case "ceo":
    case "executive-assistant":
      return "总裁办公室";
    case "cto":
      return "技术线";
    case "pm":
      return "人力与协调";
    case "research":
    case "public-affairs":
      return "社会研究院";
    default:
      return "执行单元";
  }
}

import { useInboxSettings } from "../lib/inbox-settings";

export function Sidebar() {
  const { openNewIssue } = useDialog();
  const { selectedCompanyId, selectedCompany } = useCompany();

  const { data: sidebarBadges } = useQuery({
    queryKey: queryKeys.sidebarBadges(selectedCompanyId!),
    queryFn: () => sidebarBadgesApi.get(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { settings, lastDismissedCount } = useInboxSettings(selectedCompanyId);

  const inboxBadgeCount = useMemo(() => {
    if (!sidebarBadges) return 0;
    let total = 0;
    if (settings.showApprovals) total += sidebarBadges.approvals;
    if (settings.showFailedRuns) total += sidebarBadges.failedRuns;
    if (settings.showJoinRequests) total += sidebarBadges.joinRequests;
    if (settings.showStaleIssues) total += sidebarBadges.staleIssues || 0;
    if (settings.showAlerts) total += sidebarBadges.alerts || 0;

    return Math.max(0, total - lastDismissedCount);
  }, [sidebarBadges, settings, lastDismissedCount]);

  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
  });
  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const liveRunCount = liveRuns?.length ?? 0;
  const { setScopeView, setDepartmentFilter } = useWorkspaceScope();

  const projectItems = useMemo(
    () => buildProjectNav(projects ?? []),
    [projects]
  );
  const orgUnits = useMemo(() => buildOrgUnits(agents ?? []), [agents]);
  const agentTiers = useMemo(() => buildAgentTiers(agents ?? []), [agents]);
  const totalAgentCount =
    agentTiers.boss.length + agentTiers.directors.length + agentTiers.executors.length;

  // Strip bracket-style prefixes from agent names e.g. [ORG], [V1-PROJECT]
  function stripAgentPrefix(name: string): string {
    return name.replace(/^\[[^\]]+\]\s*/, "").trim() || name;
  }

  const EXEC_INIT = 5;
  const [executorsExpanded, setExecutorsExpanded] = useState(false);
  const engExpanded = executorsExpanded; // share expanded state for now, or just show all engineers since there are typically few
  const visibleExecutors = executorsExpanded
    ? agentTiers.executors
    : agentTiers.executors.slice(0, EXEC_INIT);
  const hiddenCount = agentTiers.executors.length - EXEC_INIT;

  function openSearch() {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true })
    );
  }

  return (
    <aside className="flex h-full min-h-0 w-72 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="shrink-0 border-b border-sidebar-border bg-sidebar px-3.5 py-3 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-sidebar via-sidebar to-transparent opacity-50 pointer-events-none" />
        <div className="glass-panel glow-effect relative rounded-[22px] px-3 py-3 hover:border-sidebar-ring transition-colors duration-200">
          <div className="flex items-center gap-2">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-primary text-[11px] font-bold text-primary-foreground shadow-sm dark:bg-slate-800 dark:text-slate-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_4px_rgba(0,0,0,0.4)] transition-colors">
              <span className="absolute inset-[1px] rounded-[16px] border border-white/10 dark:border-white/5" />
              <span className="relative">AI</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-sidebar-foreground">
                {selectedCompany?.name ?? "请选择公司"}
              </p>
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground font-mono">
                Zephyr Nexus
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={openSearch}
              aria-label="打开搜索"
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <nav className="scrollbar-auto-hide flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2.5 py-3">
        <button
          onClick={() => openNewIssue()}
          className="flex items-center gap-2 rounded-[16px] border border-sidebar-border bg-sidebar px-3 py-2.5 text-[13px] font-semibold text-sidebar-foreground shadow-sm transition-all duration-150 hover:border-sidebar-ring hover:bg-sidebar-accent"
        >
          <SquarePen className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">分配任务</span>
        </button>

        <SidebarSection label="公司" meta={`${liveRunCount} 运行中`}>
          <SidebarNavItem
            to="/dashboard"
            label="总览指挥台"
            icon={LayoutDashboard}
            liveCount={liveRunCount}
          />
          <SidebarNavItem
            to="/inbox"
            label="消息中心"
            icon={Inbox}
            badge={inboxBadgeCount}
            badgeTone={sidebarBadges?.failedRuns && settings.showFailedRuns ? "danger" : "default"}
            alert={(sidebarBadges?.failedRuns ?? 0) > 0 && settings.showFailedRuns}
          />
        </SidebarSection>

        <SidebarSection label="运营" meta="核心">
          <SidebarNavItem to="/issues" label="任务" icon={CircleDot} />
          <SidebarNavItem to="/goals" label="目标" icon={Target} />
          <SidebarNavItem to="/costs" label="成本" icon={CircleDollarSign} />
        </SidebarSection>

        <SidebarSection label="项目" meta={`${projectItems.length}`}>
          <SidebarNavItem to="/projects" label="全部项目" icon={Briefcase} />
          {projectItems.slice(0, 8).map((item) => (
            <SidebarNavItem
              key={item.key}
              to={item.to}
              label={item.label}
              icon={Briefcase}
            />
          ))}
        </SidebarSection>

        <SidebarSection label="组织" meta={`${orgUnits.length}`}>
          {orgUnits.map((item) => (
            <SidebarNavItem
              key={item.key}
              to={item.to}
              label={item.label}
              icon={Network}
              onClick={() => {
                setScopeView("department");
                setDepartmentFilter(orgUnitToDept(item.key));
              }}
            />
          ))}
          {orgUnits.length === 0 && (
            <SidebarNavItem to="/org" label="组织架构" icon={Network} />
          )}
        </SidebarSection>

        <SidebarSection label="智能体" meta={`${totalAgentCount}`}>
          {agentTiers.boss.length > 0 && (
            <>
              <p className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">老板级</p>
              {agentTiers.boss.map((item) => (
                <SidebarNavItem key={item.id} to={item.to} label={stripAgentPrefix(item.name)} icon={Bot} />
              ))}
            </>
          )}
          {agentTiers.directors.length > 0 && (
            <>
              {agentTiers.boss.length > 0 && <div className="my-1.5 h-px bg-sidebar-border/60" />}
              <p className="px-2 pt-0.5 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">总监级</p>
              {agentTiers.directors.map((item) => (
                <SidebarNavItem key={item.id} to={item.to} label={stripAgentPrefix(item.name)} icon={Bot} />
              ))}
            </>
          )}
          {agentTiers.executors.length > 0 && (
            <>
              {(agentTiers.boss.length > 0 || agentTiers.directors.length > 0) && (
                <div className="my-1.5 h-px bg-sidebar-border/60" />
              )}
              <p className="px-2 pt-0.5 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">执行专员</p>
              {visibleExecutors.map((item) => (
                <SidebarNavItem key={item.id} to={item.to} label={stripAgentPrefix(item.name)} icon={Bot} />
              ))}
              {hiddenCount > 0 && (
                <button
                  onClick={() => setExecutorsExpanded((v) => !v)}
                  className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  {executorsExpanded ? "收起" : `展开 +${hiddenCount} 个`}
                </button>
              )}
            </>
          )}
          {agentTiers.engineers && agentTiers.engineers.length > 0 && (
            <>
              {(agentTiers.boss.length > 0 || agentTiers.directors.length > 0 || agentTiers.executors.length > 0) && (
                <div className="my-1.5 h-px bg-sidebar-border/60" />
              )}
              <p className="px-2 pt-0.5 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">工程专员</p>
              {agentTiers.engineers.map((item) => (
                <SidebarNavItem key={item.id} to={item.to} label={stripAgentPrefix(item.name)} icon={Bot} />
              ))}
            </>
          )}
          {totalAgentCount === 0 && (
            <SidebarNavItem to="/agents/all" label="全部智能体" icon={Bot} />
          )}
        </SidebarSection>

        <SidebarSection label="系统" meta="维护">
          <SidebarNavItem to="/company/settings" label="设置" icon={Settings} />
          <SidebarNavItem to="/docs" label="文档" icon={BookOpen} />
          <SidebarNavItem to="/companies" label="公司管理" icon={Building2} />
        </SidebarSection>
      </nav>
    </aside>
  );
}
