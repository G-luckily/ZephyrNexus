import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { agentsApi, type OrgNode } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useSidebar } from "../context/SidebarContext";
import { useWorkspaceScope } from "../context/WorkspaceScopeContext";
import { queryKeys } from "../lib/queryKeys";
import { StatusBadge } from "../components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { agentStatusDot, agentStatusDotDefault } from "../lib/status-colors";
import { EntityRow } from "../components/EntityRow";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { relativeTime, cn, agentRouteRef, agentUrl } from "../lib/utils";
import { PageTabBar } from "../components/PageTabBar";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Bot, Plus, List, GitBranch, SlidersHorizontal } from "lucide-react";
import { AGENT_ROLE_LABELS, type Agent } from "@zephyr-nexus/shared";

const adapterLabels: Record<string, string> = {
  claude_local: "Claude",
  codex_local: "Codex",
  opencode_local: "OpenCode",
  cursor: "Cursor",
  openclaw_gateway: "OpenClaw Gateway",
  process: "Process",
  http: "HTTP",
};

const roleLabels = AGENT_ROLE_LABELS as Record<string, string>;

type FilterTab = "all" | "active" | "paused" | "error";

function matchesFilter(
  status: string,
  tab: FilterTab,
  showTerminated: boolean
): boolean {
  if (status === "terminated") return showTerminated;
  if (tab === "all") return true;
  if (tab === "active")
    return status === "active" || status === "running" || status === "idle";
  if (tab === "paused") return status === "paused";
  if (tab === "error") return status === "error";
  return true;
}

function filterAgents(
  agents: Agent[],
  tab: FilterTab,
  showTerminated: boolean
): Agent[] {
  return agents.filter((a) => matchesFilter(a.status, tab, showTerminated));
}

function filterOrgTree(
  nodes: OrgNode[],
  tab: FilterTab,
  showTerminated: boolean,
  hideHighCostAdapters: boolean
): OrgNode[] {
  return nodes.reduce<OrgNode[]>((acc, node) => {
    const filteredReports = filterOrgTree(
      node.reports,
      tab,
      showTerminated,
      hideHighCostAdapters
    );
    const hideByCost = hideHighCostAdapters && node.costTier === "high";
    const visibleByStatus =
      matchesFilter(node.status, tab, showTerminated) ||
      filteredReports.length > 0;
    if (!hideByCost && visibleByStatus) {
      acc.push({ ...node, reports: filteredReports });
    }
    return acc;
  }, []);
}

export function Agents() {
  const { selectedCompanyId } = useCompany();
  const { openNewAgent } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useSidebar();
  const pathSegment = location.pathname.split("/").pop() ?? "all";
  const tab: FilterTab =
    pathSegment === "all" ||
    pathSegment === "active" ||
    pathSegment === "paused" ||
    pathSegment === "error"
      ? pathSegment
      : "all";
  const [view, setView] = useState<"list" | "org">("org");
  const forceListView = isMobile;
  const effectiveView: "list" | "org" = forceListView ? "list" : view;
  const [showTerminated, setShowTerminated] = useState(false);
  const { showHighCostAgents, setShowHighCostAgents } = useWorkspaceScope();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const {
    data: agents,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: orgTree } = useQuery({
    queryKey: queryKeys.org(selectedCompanyId!),
    queryFn: () => agentsApi.org(selectedCompanyId!),
    enabled: !!selectedCompanyId && effectiveView === "org",
  });

  const { data: runs } = useQuery({
    queryKey: queryKeys.heartbeats(selectedCompanyId!),
    queryFn: () => heartbeatsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 15_000,
  });

  // Map agentId -> first live run + live run count
  const liveRunByAgent = useMemo(() => {
    const map = new Map<string, { runId: string; liveCount: number }>();
    for (const r of runs ?? []) {
      if (r.status !== "running" && r.status !== "queued") continue;
      const existing = map.get(r.agentId);
      if (existing) {
        existing.liveCount += 1;
        continue;
      }
      map.set(r.agentId, { runId: r.id, liveCount: 1 });
    }
    return map;
  }, [runs]);

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const a of agents ?? []) map.set(a.id, a);
    return map;
  }, [agents]);

  useEffect(() => {
    setBreadcrumbs([{ label: "智能体" }]);
  }, [setBreadcrumbs]);

  if (!selectedCompanyId) {
    return <EmptyState icon={Bot} message="Select a company to view agents." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  const filtered = filterAgents(agents ?? [], tab, showTerminated).filter((agent) => {
    if (showHighCostAgents) return true;
    return agent.costTier !== "high";
  });
  const filteredOrg = filterOrgTree(
    orgTree ?? [],
    tab,
    showTerminated,
    !showHighCostAgents
  );
  const totalAgents = (agents ?? []).length;
  const runningCount = (agents ?? []).filter(
    (agent) => agent.status === "running" || agent.status === "active"
  ).length;
  const pausedCount = (agents ?? []).filter(
    (agent) => agent.status === "paused"
  ).length;
  const errorCount = (agents ?? []).filter(
    (agent) => agent.status === "error"
  ).length;

  return (
    <div className="space-y-4">
      <div className="premium-panel rounded-[22px] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="launch-chip launch-chip-cyan">Agents</span>
          <span className="launch-chip">总数 {totalAgents}</span>
          <span className="launch-chip launch-chip-emerald">
            活跃 {runningCount}
          </span>
          <span className="launch-chip launch-chip-amber">
            暂停 {pausedCount}
          </span>
          <span className="launch-chip launch-chip-rose">
            错误 {errorCount}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => navigate(`/agents/${v}`)}>
          <PageTabBar
            items={[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "paused", label: "Paused" },
              { value: "error", label: "Error" },
            ]}
            value={tab}
            onValueChange={(v) => navigate(`/agents/${v}`)}
          />
        </Tabs>
        <div className="flex items-center gap-2">
          {/* Filters */}
          <div className="relative">
            <button
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-150",
                filtersOpen || showTerminated
                  ? "border-cyan-300/22 bg-cyan-400/12 text-cyan-100 shadow-[0_8px_18px_rgba(79,209,255,0.16)]"
                  : "border-white/12 bg-white/[0.05] text-slate-300 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
              )}
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <SlidersHorizontal className="h-3 w-3" />
              Filters
              {showTerminated && (
                <span className="ml-0.5 px-1 bg-foreground/10 rounded text-[10px]">
                  1
                </span>
              )}
            </button>
            {filtersOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-48 border border-border bg-popover shadow-md p-1">
                <button
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-left hover:bg-accent/50 transition-colors"
                  onClick={() => setShowHighCostAgents(!showHighCostAgents)}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center h-3.5 w-3.5 border border-border rounded-sm",
                      showHighCostAgents && "bg-foreground"
                    )}
                  >
                    {showHighCostAgents && (
                      <span className="text-background text-[10px] leading-none">
                        &#10003;
                      </span>
                    )}
                  </span>
                  Show high-cost agents (OpenClaw)
                </button>
                <button
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-left hover:bg-accent/50 transition-colors"
                  onClick={() => setShowTerminated(!showTerminated)}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center h-3.5 w-3.5 border border-border rounded-sm",
                      showTerminated && "bg-foreground"
                    )}
                  >
                    {showTerminated && (
                      <span className="text-background text-[10px] leading-none">
                        &#10003;
                      </span>
                    )}
                  </span>
                  Show terminated
                </button>
              </div>
            )}
          </div>
          {/* View toggle */}
          {!forceListView && (
            <div className="flex items-center rounded-full border border-white/12 bg-white/[0.05] p-0.5">
              <button
                className={cn(
                  "rounded-full p-1.5 transition-all duration-150",
                  effectiveView === "list"
                    ? "bg-white/14 text-white"
                    : "text-slate-400 hover:bg-white/[0.08] hover:text-slate-200"
                )}
                onClick={() => setView("list")}
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                className={cn(
                  "rounded-full p-1.5 transition-all duration-150",
                  effectiveView === "org"
                    ? "bg-white/14 text-white"
                    : "text-slate-400 hover:bg-white/[0.08] hover:text-slate-200"
                )}
                onClick={() => setView("org")}
              >
                <GitBranch className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <Button size="sm" variant="outline" onClick={openNewAgent}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Agent
          </Button>
        </div>
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-slate-400">
          当前视图 {filtered.length} 个智能体
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {agents && agents.length === 0 && (
        <EmptyState
          icon={Bot}
          message="Create your first agent to get started."
          action="New Agent"
          onAction={openNewAgent}
        />
      )}

      {/* List view */}
      {effectiveView === "list" && filtered.length > 0 && (
        <div className="premium-panel rounded-[22px] p-1">
          {filtered.map((agent) => {
            return (
              <EntityRow
                key={agent.id}
                title={agent.name}
                subtitle={`${roleLabels[agent.role] ?? agent.role}${
                  agent.title ? ` - ${agent.title}` : ""
                }`}
                to={agentUrl(agent)}
                leading={
                  <span className="relative flex h-2.5 w-2.5">
                    <span
                      className={`absolute inline-flex h-full w-full rounded-full ${
                        agentStatusDot[agent.status] ?? agentStatusDotDefault
                      }`}
                    />
                  </span>
                }
                trailing={
                  <div className="flex items-center gap-3">
                    <span className="sm:hidden">
                      {liveRunByAgent.has(agent.id) ? (
                        <LiveRunIndicator
                          agentRef={agentRouteRef(agent)}
                          runId={liveRunByAgent.get(agent.id)!.runId}
                          liveCount={liveRunByAgent.get(agent.id)!.liveCount}
                        />
                      ) : (
                        <StatusBadge status={agent.status} />
                      )}
                    </span>
                    <div className="hidden sm:flex items-center gap-3">
                      {liveRunByAgent.has(agent.id) && (
                        <LiveRunIndicator
                          agentRef={agentRouteRef(agent)}
                          runId={liveRunByAgent.get(agent.id)!.runId}
                          liveCount={liveRunByAgent.get(agent.id)!.liveCount}
                        />
                      )}
                      {agent.costTier === "high" && (
                        <Badge variant="outline" className="text-[10px] font-bold text-amber-600 border-amber-500/30 bg-amber-500/5 px-1.5 h-4 uppercase">
                          Costly
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground font-mono w-14 text-right">
                        {adapterLabels[agent.adapterType] ?? agent.adapterType}
                      </span>
                      <span className="text-xs text-muted-foreground w-16 text-right">
                        {agent.lastHeartbeatAt
                          ? relativeTime(agent.lastHeartbeatAt)
                          : "—"}
                      </span>
                      <span className="w-20 flex justify-end">
                        <StatusBadge status={agent.status} />
                      </span>
                    </div>
                  </div>
                }
              />
            );
          })}
        </div>
      )}

      {effectiveView === "list" &&
        agents &&
        agents.length > 0 &&
        filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No agents match the selected filter.
          </p>
        )}

      {/* Org chart view */}
      {effectiveView === "org" && filteredOrg.length > 0 && (
        <div className="premium-panel rounded-[22px] py-1">
          {filteredOrg.map((node) => (
            <OrgTreeNode
              key={node.id}
              node={node}
              depth={0}
              agentMap={agentMap}
              liveRunByAgent={liveRunByAgent}
            />
          ))}
        </div>
      )}

      {effectiveView === "org" &&
        orgTree &&
        orgTree.length > 0 &&
        filteredOrg.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No agents match the selected filter.
          </p>
        )}

      {effectiveView === "org" && orgTree && orgTree.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No organizational hierarchy defined.
        </p>
      )}
    </div>
  );
}

function OrgTreeNode({
  node,
  depth,
  agentMap,
  liveRunByAgent,
}: {
  node: OrgNode;
  depth: number;
  agentMap: Map<string, Agent>;
  liveRunByAgent: Map<string, { runId: string; liveCount: number }>;
}) {
  const agent = agentMap.get(node.id);

  const statusColor = agentStatusDot[node.status] ?? agentStatusDotDefault;

  return (
    <div style={{ paddingLeft: depth * 24 }}>
      <Link
        to={agent ? agentUrl(agent) : `/agents/${node.id}`}
        className="flex items-center gap-3 px-3 py-2 hover:bg-accent/30 transition-colors w-full text-left no-underline text-inherit"
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span
            className={`absolute inline-flex h-full w-full rounded-full ${statusColor}`}
          />
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{node.name}</span>
          <span className="text-xs text-muted-foreground ml-2">
            {roleLabels[node.role] ?? node.role}
            {agent?.title ? ` - ${agent.title}` : ""}
          </span>
          {node.costTier === "high" && (
            <Badge variant="outline" className="text-[10px] font-bold text-amber-600 border-amber-500/30 bg-amber-500/5 px-1.5 h-4 uppercase ml-2">
              Costly
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="sm:hidden">
            {liveRunByAgent.has(node.id) ? (
              <LiveRunIndicator
                agentRef={agent ? agentRouteRef(agent) : node.id}
                runId={liveRunByAgent.get(node.id)!.runId}
                liveCount={liveRunByAgent.get(node.id)!.liveCount}
              />
            ) : (
              <StatusBadge status={node.status} />
            )}
          </span>
          <div className="hidden sm:flex items-center gap-3">
            {liveRunByAgent.has(node.id) && (
              <LiveRunIndicator
                agentRef={agent ? agentRouteRef(agent) : node.id}
                runId={liveRunByAgent.get(node.id)!.runId}
                liveCount={liveRunByAgent.get(node.id)!.liveCount}
              />
            )}
            {agent && (
              <>
                <span className="text-xs text-muted-foreground font-mono w-14 text-right">
                  {adapterLabels[agent.adapterType] ?? agent.adapterType}
                </span>
                <span className="text-xs text-muted-foreground w-16 text-right">
                  {agent.lastHeartbeatAt
                    ? relativeTime(agent.lastHeartbeatAt)
                    : "—"}
                </span>
              </>
            )}
            <span className="w-20 flex justify-end">
              <StatusBadge status={node.status} />
            </span>
          </div>
        </div>
      </Link>
      {node.reports && node.reports.length > 0 && (
        <div className="border-l border-border/50 ml-4">
          {node.reports.map((child) => (
            <OrgTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              agentMap={agentMap}
              liveRunByAgent={liveRunByAgent}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LiveRunIndicator({
  agentRef,
  runId,
  liveCount,
}: {
  agentRef: string;
  runId: string;
  liveCount: number;
}) {
  return (
    <Link
      to={`/agents/${agentRef}/runs/${runId}`}
      className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 transition-colors no-underline"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
      </span>
      <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
        Live{liveCount > 1 ? ` (${liveCount})` : ""}
      </span>
    </Link>
  );
}
