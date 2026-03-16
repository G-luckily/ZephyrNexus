import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { agentsApi, type OrgNode } from "../api/agents";
import { issuesApi } from "../api/issues";
import { heartbeatsApi } from "../api/heartbeats";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { agentUrl, relativeTime, cn } from "../lib/utils";
import { EmptyState } from "../components/EmptyState";
import { Link } from "@/lib/router";
import { tStatus } from "../lib/i18n";
import { PageSkeleton } from "../components/PageSkeleton";
import { AgentIcon } from "../components/AgentIconPicker";
import { Network } from "lucide-react";
import { AGENT_ROLE_LABELS, type Agent } from "@paperclipai/shared";

const CARD_W = 220;
const CARD_H = 110;
const GAP_X = 36;
const GAP_Y = 88;
const PADDING = 60;

interface LayoutNode {
  id: string;
  name: string;
  role: string;
  status: string;
  x: number;
  y: number;
  depth: number;
  children: LayoutNode[];
}

type OrgFilter = "all" | "active" | "failed" | "idle";

function toFilterStatus(status: string): OrgFilter {
  if (status === "running" || status === "active") return "active";
  if (status === "error" || status === "terminated") return "failed";
  if (status === "idle") return "idle";
  return "all";
}

/** Determine whether a node should be shown for the given sidebar unit filter.
 *  unit=ceo means "show the whole company" (CEO is the root of everything). */
function nodeMatchesUnit(node: OrgNode, unit: string): boolean {
  if (unit === "all" || unit === "ceo") return true;
  const name = node.name.toLowerCase();
  if (unit === "cho") return name.includes("人力") || name.includes("cho");
  if (unit === "cto") return name.includes("技术") || name.includes("cto") || name.includes("工程");
  if (unit === "executive-assistant")
    return name.includes("助理") || name.includes("assistant") || name.includes("汇总");
  if (unit === "research") return name.includes("研究") || name.includes("文献");
  if (unit === "media")
    return name.includes("媒体") || name.includes("宣传") || name.includes("市场") || name.includes("选题");
  if (unit === "public-affairs")
    return name.includes("公共") || name.includes("责任");
  return false;
}

function subtreeWidth(node: OrgNode): number {
  if (node.reports.length === 0) return CARD_W;
  const childrenW = node.reports.reduce((sum, c) => sum + subtreeWidth(c), 0);
  const gaps = (node.reports.length - 1) * GAP_X;
  return Math.max(CARD_W, childrenW + gaps);
}

function layoutTree(
  node: OrgNode,
  x: number,
  y: number,
  depth: number
): LayoutNode {
  const totalW = subtreeWidth(node);
  const layoutChildren: LayoutNode[] = [];

  if (node.reports.length > 0) {
    const childrenW = node.reports.reduce((sum, c) => sum + subtreeWidth(c), 0);
    const gaps = (node.reports.length - 1) * GAP_X;
    let cx = x + (totalW - childrenW - gaps) / 2;

    for (const child of node.reports) {
      const cw = subtreeWidth(child);
      layoutChildren.push(layoutTree(child, cx, y + CARD_H + GAP_Y, depth + 1));
      cx += cw + GAP_X;
    }
  }

  return {
    id: node.id,
    name: node.name,
    role: node.role,
    status: node.status,
    x: x + (totalW - CARD_W) / 2,
    y,
    depth,
    children: layoutChildren,
  };
}

/** Max roots to lay out per row before wrapping to the next row */
const MAX_ROOT_COLS = 4;

function subtreeHeight(node: OrgNode): number {
  if (node.reports.length === 0) return CARD_H;
  return CARD_H + GAP_Y + Math.max(...node.reports.map(subtreeHeight));
}

function layoutForest(roots: OrgNode[]): LayoutNode[] {
  if (roots.length === 0) return [];

  const result: LayoutNode[] = [];
  let rowY = PADDING;

  for (let i = 0; i < roots.length; i += MAX_ROOT_COLS) {
    const rowRoots = roots.slice(i, i + MAX_ROOT_COLS);
    let x = PADDING;
    let maxRowH = 0;

    for (const root of rowRoots) {
      const w = subtreeWidth(root);
      const h = subtreeHeight(root);
      result.push(layoutTree(root, x, rowY, 0));
      x += w + GAP_X;
      maxRowH = Math.max(maxRowH, h);
    }

    rowY += maxRowH + GAP_Y * 2;
  }

  return result;
}


function flattenLayout(nodes: LayoutNode[]): LayoutNode[] {
  const result: LayoutNode[] = [];
  function walk(n: LayoutNode) {
    result.push(n);
    n.children.forEach(walk);
  }
  nodes.forEach(walk);
  return result;
}

function collectEdges(
  nodes: LayoutNode[]
): Array<{ parent: LayoutNode; child: LayoutNode }> {
  const edges: Array<{ parent: LayoutNode; child: LayoutNode }> = [];
  function walk(n: LayoutNode) {
    for (const c of n.children) {
      edges.push({ parent: n, child: c });
      walk(c);
    }
  }
  nodes.forEach(walk);
  return edges;
}

const adapterLabels: Record<string, string> = {
  claude_local: "Claude",
  codex_local: "Codex",
  opencode_local: "OpenCode",
  cursor: "Cursor",
  openclaw_gateway: "OpenClaw Gateway",
  process: "Process",
  http: "HTTP",
};

const statusDotColor: Record<string, string> = {
  running: "#22c55e",
  active: "#22c55e",
  paused: "#f59e0b",
  pending_approval: "#f59e0b",
  idle: "#94a3b8",
  error: "#ef4444",
  terminated: "#ef4444",
};

const roleLabels = AGENT_ROLE_LABELS as Record<string, string>;
function roleLabel(role: string): string {
  return roleLabels[role] ?? role;
}

function stripPrefix(name: string): string {
  return name.replace(/^\[[^\]]+\]\s*/, "").trim() || name;
}

export function OrgChart() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const unitFilter = searchParams.get("unit") ?? "all";

  const [filter, setFilter] = useState<OrgFilter>("all");
  const [coreOnly, setCoreOnly] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const { data: orgTree, isLoading } = useQuery({
    queryKey: queryKeys.org(selectedCompanyId!),
    queryFn: () => agentsApi.org(selectedCompanyId!),
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

  const { data: runs } = useQuery({
    queryKey: queryKeys.heartbeats(selectedCompanyId!),
    queryFn: () => heartbeatsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentMap = useMemo(() => {
    const m = new Map<string, Agent>();
    for (const a of agents ?? []) m.set(a.id, a);
    return m;
  }, [agents]);

  useEffect(() => {
    setBreadcrumbs([{ label: "组织" }]);
  }, [setBreadcrumbs]);

  const filteredTree = useMemo(() => {
    const shouldKeep = (node: OrgNode): boolean => {
      if (filter === "all") return true;
      return toFilterStatus(node.status) === filter;
    };

    const shouldKeepByUnit = (node: OrgNode): boolean =>
      nodeMatchesUnit(node, unitFilter);

    const mapNode = (node: OrgNode): OrgNode | null => {
      const children = node.reports
        .map(mapNode)
        .filter((n): n is OrgNode => n !== null);

      const selfPass = shouldKeep(node) && shouldKeepByUnit(node);

      if (selfPass || children.length > 0) {
        return { ...node, reports: children };
      }
      return null;
    };

    const mapped = (orgTree ?? [])
      .map(mapNode)
      .filter((n): n is OrgNode => n !== null)
      // Remove orphan root nodes that are [V1-PROJECT] bots with no reportsTo.
      // These are standalone project runners, not part of the org hierarchy.
      .filter((n) => !n.name.startsWith("[V1-PROJECT]"));

    if (!coreOnly) return mapped;

    return mapped.map((root) => ({
      ...root,
      reports: root.reports.map((child) => ({ ...child, reports: [] })),
    }));
  }, [orgTree, filter, coreOnly, unitFilter]);

  const layout = useMemo(() => layoutForest(filteredTree), [filteredTree]);
  const allNodes = useMemo(() => flattenLayout(layout), [layout]);
  const edges = useMemo(() => collectEdges(layout), [layout]);

  const bounds = useMemo(() => {
    if (allNodes.length === 0) return { width: 800, height: 600 };
    let maxX = 0;
    let maxY = 0;
    for (const n of allNodes) {
      maxX = Math.max(maxX, n.x + CARD_W);
      maxY = Math.max(maxY, n.y + CARD_H);
    }
    return { width: maxX + PADDING, height: maxY + PADDING };
  }, [allNodes]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Re-fit whenever the tree layout changes (filter switch, data update, etc.)
  const layoutKey = useMemo(() => allNodes.map((n) => n.id).join(","), [allNodes]);
  useEffect(() => {
    if (allNodes.length === 0 || !containerRef.current) return;
    const container = containerRef.current;
    const cW = container.clientWidth;
    const cH = container.clientHeight;
    const scaleX = (cW - 80) / bounds.width;
    const scaleY = (cH - 80) / bounds.height;
    const fitZoom = Math.min(scaleX, scaleY, 1);
    const chartW = bounds.width * fitZoom;
    const chartH = bounds.height * fitZoom;
    setZoom(fitZoom);
    setPan({ x: (cW - chartW) / 2, y: (cH - chartH) / 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-org-card]")) return;
      setDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    },
    [pan]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
    },
    [dragging]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(Math.max(zoom * factor, 0.2), 2);
      const scale = newZoom / zoom;
      setPan({ x: mouseX - scale * (mouseX - pan.x), y: mouseY - scale * (mouseY - pan.y) });
      setZoom(newZoom);
    },
    [zoom, pan]
  );

  const selectedAgent = selectedNodeId ? agentMap.get(selectedNodeId) ?? null : null;

  const selectedIssues = useMemo(
    () =>
      (issues ?? [])
        .filter(
          (i) =>
            i.assigneeAgentId === selectedNodeId &&
            i.status !== "done" &&
            i.status !== "cancelled"
        )
        .slice(0, 5),
    [issues, selectedNodeId]
  );

  const selectedFailedRuns = useMemo(
    () =>
      (runs ?? []).filter(
        (r) =>
          r.agentId === selectedNodeId &&
          (r.status === "failed" || r.status === "timed_out")
      ).length,
    [runs, selectedNodeId]
  );

  function fitView() {
    if (!containerRef.current) return;
    const cW = containerRef.current.clientWidth;
    const cH = containerRef.current.clientHeight;
    const scaleX = (cW - 80) / bounds.width;
    const scaleY = (cH - 80) / bounds.height;
    const fitZoom = Math.min(scaleX, scaleY, 1);
    const chartW = bounds.width * fitZoom;
    const chartH = bounds.height * fitZoom;
    setZoom(fitZoom);
    setPan({ x: (cW - chartW) / 2, y: (cH - chartH) / 2 });
  }

  if (!selectedCompanyId) {
    return <EmptyState icon={Network} message="请先选择公司后查看组织架构。" />;
  }

  if (isLoading) {
    return <PageSkeleton variant="org-chart" />;
  }

  if (filteredTree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <EmptyState icon={Network} message="当前筛选条件下没有匹配的组织节点。" />
        <button
          onClick={() => {
            setFilter("all");
            setCoreOnly(false);
          }}
          className="mt-4 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors"
        >
          查看全部
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" style={{ height: "calc(100vh - 6rem)" }}>
      {/* Header toolbar */}
      <section className="flex-none rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-foreground">组织全景图</h2>
            <p className="text-sm text-muted-foreground">
              缩放、拖拽并筛选部门节点，点击节点可查看详情。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "active", "failed", "idle"] as OrgFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  filter === f
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:bg-accent/40"
                )}
              >
                {f === "all" ? "全部" : f === "active" ? "执行中" : f === "failed" ? "异常" : "空闲"}
              </button>
            ))}
            <button
              onClick={() => setCoreOnly((v) => !v)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                coreOnly
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:bg-accent/40"
              )}
            >
              {coreOnly ? "核心层级" : "完整层级"}
            </button>
          </div>
        </div>
      </section>

      {/* Full-width chart canvas */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative overflow-hidden rounded-2xl border border-border bg-muted/10"
        style={{ cursor: dragging ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Zoom controls */}
        <div className="absolute right-3 top-3 z-10 flex flex-col gap-1">
          <button
            className="h-7 w-7 rounded border border-border bg-background text-sm transition-colors hover:bg-accent"
            onClick={() => {
              const newZoom = Math.min(zoom * 1.2, 2);
              const container = containerRef.current;
              if (container) {
                const cx = container.clientWidth / 2;
                const cy = container.clientHeight / 2;
                const scale = newZoom / zoom;
                setPan({ x: cx - scale * (cx - pan.x), y: cy - scale * (cy - pan.y) });
              }
              setZoom(newZoom);
            }}
            aria-label="放大"
          >
            +
          </button>
          <button
            className="h-7 w-7 rounded border border-border bg-background text-sm transition-colors hover:bg-accent"
            onClick={() => {
              const newZoom = Math.max(zoom * 0.8, 0.2);
              const container = containerRef.current;
              if (container) {
                const cx = container.clientWidth / 2;
                const cy = container.clientHeight / 2;
                const scale = newZoom / zoom;
                setPan({ x: cx - scale * (cx - pan.x), y: cy - scale * (cy - pan.y) });
              }
              setZoom(newZoom);
            }}
            aria-label="缩小"
          >
            &minus;
          </button>
          <button
            className="h-7 w-7 rounded border border-border bg-background text-[10px] transition-colors hover:bg-accent"
            onClick={fitView}
            title="适配视图"
            aria-label="适配图表"
          >
            Fit
          </button>
        </div>

        {/* Edge connectors (SVG) */}
        <svg
          className="pointer-events-none absolute inset-0"
          style={{ width: "100%", height: "100%" }}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {edges.map(({ parent, child }) => {
              const x1 = parent.x + CARD_W / 2;
              const y1 = parent.y + CARD_H;
              const x2 = child.x + CARD_W / 2;
              const y2 = child.y;
              const midY = (y1 + y2) / 2;
              return (
                <path
                  key={`${parent.id}-${child.id}`}
                  d={`M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`}
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth={1.5}
                />
              );
            })}
          </g>
        </svg>

        {/* Node cards */}
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {allNodes.map((node) => {
            const agent = agentMap.get(node.id);
            const dotColor = statusDotColor[node.status] ?? "#a3a3a3";
            const selected = selectedNodeId === node.id;

            return (
              <div
                key={node.id}
                data-org-card
                className={cn(
                  "absolute cursor-pointer select-none rounded-xl border bg-card shadow-sm transition-[box-shadow,border-color] duration-150 hover:border-foreground/20 hover:shadow-md",
                  selected ? "border-foreground ring-1 ring-foreground/20" : "border-border"
                )}
                style={{ left: node.x, top: node.y, width: CARD_W, minHeight: CARD_H }}
                onClick={() =>
                  setSelectedNodeId((prev) => (prev === node.id ? null : node.id))
                }
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="relative shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <AgentIcon icon={agent?.icon} className="h-5 w-5 text-foreground/70" />
                    </div>
                    <span
                      className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card"
                      style={{ backgroundColor: dotColor }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold leading-tight text-foreground">
                      {stripPrefix(node.name)}
                      {node.name.includes("OpenClaw") && (
                        <span className="ml-2 inline-flex items-center rounded bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-medium text-blue-600 dark:text-blue-400">
                          系统接入
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground">
                      {agent?.title ?? roleLabel(node.role)}
                    </span>
                    {agent && (
                      <span className="mt-1 block truncate font-mono text-[10px] leading-tight text-muted-foreground/70">
                        {adapterLabels[agent.adapterType] ?? agent.adapterType}
                      </span>
                    )}
                  </div>
                </div>
                {/* Inline detail panel expanded on click */}
                {selected && selectedAgent && (
                  <div className="border-t border-border px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>进行中任务</span>
                      <span className="font-medium text-foreground">{selectedIssues.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>异常记录</span>
                      <span className="font-medium text-foreground">{selectedFailedRuns}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>最近同步</span>
                      <span>{relativeTime(selectedAgent.updatedAt)}</span>
                    </div>
                    {selectedIssues.slice(0, 2).map((issue) => (
                      <p key={issue.id} className="truncate text-xs text-foreground border-t border-border/60 pt-1.5">
                        {issue.title} <span className="text-muted-foreground">· {tStatus(issue.status)}</span>
                      </p>
                    ))}
                    <Link
                      to={agentUrl({ id: selectedAgent.id, name: selectedAgent.name, role: selectedAgent.role || "agent" } as any)}
                      className="block w-full rounded-full bg-foreground px-3 py-1.5 text-center text-xs font-medium text-background transition-colors hover:bg-foreground/90"
                    >
                      配置智能参数
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
