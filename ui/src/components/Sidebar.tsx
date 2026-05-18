import {
  Inbox,
  CircleDot,
  LayoutDashboard,
  Search,
  SquarePen,
  Settings,
  BookOpen,
  Building2,
  Bot,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SidebarSection } from "./SidebarSection";
import { SidebarNavItem } from "./SidebarNavItem";
import { useDialog } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { sidebarBadgesApi } from "../api/sidebarBadges";
import { heartbeatsApi } from "../api/heartbeats";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { buildAgentTiers } from "../lib/company-scope";
import { useWorkspaceScope } from "../context/WorkspaceScopeContext";
import { Button } from "@/components/ui/button";

import { useInboxSettings } from "../lib/inbox-settings";
import { cn } from "../lib/utils";
import { useSidebar } from "../context/SidebarContext";

export function Sidebar() {
  const { openNewIssue } = useDialog();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { sidebarCollapsed } = useSidebar();

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
  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const liveRunCount = liveRuns?.length ?? 0;
  const { setScopeView, setProjectFilter, setDepartmentFilter } =
    useWorkspaceScope();

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
    <aside className={cn("relative flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground shadow-[var(--sidebar-shadow)]", sidebarCollapsed ? "w-[var(--sidebar-collapsed-width)]" : "w-72")}>
      {/* Subtle atmosphere — top cold light */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% -5%, rgba(122, 139, 168, 0.03) 0%, transparent 40%)",
        }}
      />
      {/* Company header — floating surface */}
      <div className={cn("relative shrink-0", sidebarCollapsed ? "px-2 py-3" : "px-3.5 py-3")}>
        <div className={cn("panel-floating relative", sidebarCollapsed ? "flex justify-center rounded-lg p-2" : "rounded-xl px-3 py-3")}>
          <div className={cn("flex items-center", sidebarCollapsed ? "flex-col gap-1" : "gap-2")}>
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-[11px] font-semibold text-muted-foreground shadow-sm">
              <span className="absolute inset-[1px] rounded-md border border-white/[0.03]" />
              <span className="relative">灵枢</span>
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-sidebar-foreground">
                  {selectedCompany?.name ?? "请选择公司"}
                </p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
                  风之灵枢
                </p>
              </div>
            )}
            {!sidebarCollapsed && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground transition-all duration-150 hover:bg-surface-overlay hover:text-sidebar-foreground"
                onClick={openSearch}
                aria-label="打开搜索"
              >
                <Search className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <nav className="scrollbar-auto-hide flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2.5 py-3">
        {/* New task button — floating accent */}
        <button
          onClick={() => openNewIssue()}
          title={sidebarCollapsed ? "分配任务" : undefined}
          className={cn(
            "flex items-center rounded-lg bg-surface-floating shadow-sm transition-all duration-150 hover:bg-surface-overlay",
            sidebarCollapsed
              ? "justify-center px-0 py-2.5 mx-2"
              : "gap-2 px-3 py-2.5 text-[13px] font-semibold text-sidebar-foreground"
          )}
        >
          <SquarePen className="h-3.5 w-3.5 shrink-0 text-accent" />
          {!sidebarCollapsed && <span className="truncate">分配任务</span>}
        </button>

        <SidebarSection label="公司" meta={`${liveRunCount} 运行中`}>
          <SidebarNavItem
            to="/dashboard"
            label="总览指挥台"
            icon={LayoutDashboard}
            liveCount={liveRunCount}
            onClick={() => {
              setScopeView("company");
              setProjectFilter("all");
              setDepartmentFilter("all");
            }}
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
        </SidebarSection>

        <SidebarSection label="智能体" meta={`${totalAgentCount}`}>
          {agentTiers.boss.length > 0 && (
            <>
              <p className={cn("nav-section-label", sidebarCollapsed && "hidden")}>老板级</p>
              {agentTiers.boss.map((item) => (
                <SidebarNavItem key={item.id} to={item.to} label={stripAgentPrefix(item.name)} icon={Bot} />
              ))}
            </>
          )}
          {agentTiers.directors.length > 0 && (
            <>
              {agentTiers.boss.length > 0 && <div className={cn("my-1.5 h-px bg-white/[0.04]", sidebarCollapsed && "hidden")} />}
              <p className={cn("nav-section-label", sidebarCollapsed && "hidden")}>总监级</p>
              {agentTiers.directors.map((item) => (
                <SidebarNavItem key={item.id} to={item.to} label={stripAgentPrefix(item.name)} icon={Bot} />
              ))}
            </>
          )}
          {agentTiers.executors.length > 0 && (
            <>
              {(agentTiers.boss.length > 0 || agentTiers.directors.length > 0) && (
                <div className={cn("my-1.5 h-px bg-white/[0.04]", sidebarCollapsed && "hidden")} />
              )}
              <p className={cn("nav-section-label", sidebarCollapsed && "hidden")}>执行专员</p>
              {visibleExecutors.map((item) => (
                <SidebarNavItem key={item.id} to={item.to} label={stripAgentPrefix(item.name)} icon={Bot} />
              ))}
              {hiddenCount > 0 && !sidebarCollapsed && (
                <button
                  onClick={() => setExecutorsExpanded((v) => !v)}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-surface-overlay hover:text-sidebar-foreground"
                >
                  {executorsExpanded ? "收起" : `展开 +${hiddenCount} 个`}
                </button>
              )}
            </>
          )}
          {agentTiers.engineers && agentTiers.engineers.length > 0 && (
            <>
              {(agentTiers.boss.length > 0 || agentTiers.directors.length > 0 || agentTiers.executors.length > 0) && (
                <div className={cn("my-1.5 h-px bg-sidebar-border/60", sidebarCollapsed && "hidden")} />
              )}
              <p className={cn("px-2 pt-0.5 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60", sidebarCollapsed && "hidden")}>工程专员</p>
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
