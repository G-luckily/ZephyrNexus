import { useMemo, useState } from "react";
import { cn } from "../../lib/utils";
import ReactFlow, {
  Background,
  MarkerType,
  type Edge,
  type Node,
} from "reactflow";
import type { Issue } from "@zephyr-nexus/shared";

interface TaskFlowBoardProps {
  task: Issue | null;
  interactive?: boolean;
  showSummary?: boolean;
  onNodeSelect?: (node: FlowNodeDetail) => void;
}

type NodeState = "done" | "active" | "pending" | "failed";

export interface FlowNodeDetail {
  id: string;
  title: string;
  state: NodeState;
  desc: string;
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

function elapsedMinutes(task: Issue): number {
  const start = task.startedAt
    ? new Date(task.startedAt).getTime()
    : new Date(task.createdAt).getTime();
  const end = new Date(task.updatedAt).getTime();
  return Math.max(1, Math.round((end - start) / 60000));
}

function issueHealth(issue: Issue | null): string {
  if (!issue) return "待命";
  if (issue.status === "blocked") return "风险";
  if (issue.status === "in_progress" || issue.status === "in_review")
    return "稳定";
  if (issue.status === "done") return "完成";
  return "进行中";
}

function stateStyle(state: NodeState): {
  border: string;
  bg: string;
  text: string;
  line: string;
  glow: string;
  dash?: string;
} {
  if (state === "done") {
    return {
      border: "hsl(var(--success))",
      bg: "hsl(var(--background))",
      text: "hsl(var(--success))",
      line: "hsl(var(--success))",
      glow: "0 0 0 1px rgba(34,197,94,0.22)",
    };
  }
  if (state === "active") {
    return {
      border: "hsl(var(--primary))",
      bg: "hsl(var(--background))",
      text: "hsl(var(--primary))",
      line: "hsl(var(--primary))",
      glow: "0 0 0 1px rgba(59,130,246,0.34)",
    };
  }
  if (state === "failed") {
    return {
      border: "hsl(var(--destructive))",
      bg: "hsl(var(--background))",
      text: "hsl(var(--destructive))",
      line: "hsl(var(--destructive))",
      glow: "0 0 0 1px rgba(239,68,68,0.20)",
      dash: "6 4",
    };
  }
  return {
    border: "hsl(var(--border))",
    bg: "hsl(var(--background))",
    text: "hsl(var(--muted-foreground))",
    line: "hsl(var(--muted-foreground))",
    glow: "0 1px 3px rgba(15,23,42,0.08)",
    dash: "4 4",
  };
}

function canvasHeightByNodeCount(nodeCount: number): number {
  if (nodeCount <= 2) return nodeCount === 1 ? 340 : 360;
  if (nodeCount <= 4) return nodeCount === 3 ? 420 : 480;
  if (nodeCount === 5) return 560;
  return 620;
}

function buildVisibleSteps(steps: FlowNodeDetail[]): FlowNodeDetail[] {
  const activeOrDone = steps.filter((s) => s.state !== "pending");
  const firstPending = steps.find((s) => s.state === "pending");
  const withNext = firstPending
    ? [...activeOrDone, firstPending]
    : activeOrDone;
  const dedup = new Map<string, FlowNodeDetail>();
  for (const step of withNext) dedup.set(step.id, step);
  const ordered = steps.filter((s) => dedup.has(s.id));
  return ordered.length > 0 ? ordered : [steps[0]!];
}

export function TaskFlowBoard({
  task,
  interactive = false,
  showSummary = true,
  onNodeSelect,
}: TaskFlowBoardProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  if (!task) {
    return (
      <p className="text-sm text-muted-foreground">暂无可展示的任务流程。</p>
    );
  }

  const progress = issueProgress(task);
  const elapsed = elapsedMinutes(task);

  const {
    nodes,
    edges,
    canvasHeight,
    visibleCount,
    compactNode,
    isPartialChain,
  } = useMemo(() => {
    const taskFailed = task.status === "blocked";
    const steps: Array<FlowNodeDetail> = [
      {
        id: "ceo",
        title: "总裁",
        state: task.status === "todo" ? "active" : "done",
        desc: "任务拆解与责任路径确认",
      },
      {
        id: "research",
        title: "社会研究院",
        state:
          task.status === "todo" ? "pending" : taskFailed ? "failed" : "active",
        desc: "文献综述与研究统筹",
      },
      {
        id: "public",
        title: "公共责任部",
        state:
          task.status === "in_review" || task.status === "done"
            ? "active"
            : "pending",
        desc: "策略校核与外部协同",
      },
      {
        id: "report",
        title: "报告生成",
        state:
          task.status === "done"
            ? "done"
            : task.status === "in_review"
            ? "active"
            : "pending",
        desc: "结构化生成与结果归档",
      },
      {
        id: "archive",
        title: "发布归档",
        state: task.status === "done" ? "done" : "pending",
        desc: "交付发布与审计追踪",
      },
    ];

    const renderSteps = buildVisibleSteps(steps);
    const visibleCount = renderSteps.length;
    const canvasHeight = canvasHeightByNodeCount(visibleCount);

    const nodeWidth = 356;
    const nodeMinHeight = 132;
    const paddingY = 56;
    const chainGap = 34;
    const nodeGap = visibleCount <= 1 ? 0 : nodeMinHeight + chainGap;
    const chainHeight = nodeMinHeight + Math.max(0, visibleCount - 1) * nodeGap;
    const layoutHeight = Math.max(canvasHeight, chainHeight + paddingY * 2);
    const startY = (layoutHeight - chainHeight) / 2;

    const builtNodes: Node[] = renderSteps.map((step, idx) => {
      const style = stateStyle(step.state);
      const isHovered = hoveredNodeId === step.id;
      return {
        id: step.id,
        position: { x: 132, y: startY + idx * nodeGap },
        className: "mission-flow-node",
        data: {
          detail: step,
          label: (
            <div className="min-w-[320px]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[18px] font-semibold text-foreground">
                  {step.title}
                </p>
                <span
                  className={cn(
                    "inline-flex h-5 items-center rounded-md px-2 text-[10px] font-semibold tracking-widest ring-1 ring-inset",
                    step.state === "done"
                      ? "ring-success/30 bg-success/10"
                      : step.state === "active"
                      ? "ring-primary/30 bg-primary/10"
                      : step.state === "failed"
                      ? "ring-destructive/30 bg-destructive/10"
                      : "ring-border bg-muted/50"
                  )}
                  style={{ color: style.text }}
                >
                  {step.state === "done"
                    ? "completed"
                    : step.state === "active"
                    ? "running"
                    : step.state === "failed"
                    ? "failed"
                    : "pending"}
                </span>
              </div>
              <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
                {step.desc}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground/80">
                状态：
                {step.state === "active"
                  ? "执行中"
                  : step.state === "done"
                  ? "已完成"
                  : step.state === "failed"
                  ? "异常中断"
                  : "等待调度"}
              </p>
            </div>
          ),
        },
        style: {
          width: nodeWidth,
          minHeight: nodeMinHeight,
          borderRadius: 20,
          border: `1.5px solid ${style.border}`,
          background: style.bg,
          padding: 18,
          boxShadow: isHovered
            ? `${style.glow}, 0 16px 34px rgba(15,23,42,0.14)`
            : style.glow,
          cursor: onNodeSelect ? "pointer" : "default",
          transition:
            "transform 220ms cubic-bezier(.22,.61,.36,1), box-shadow 220ms cubic-bezier(.22,.61,.36,1), border-color 220ms ease, filter 220ms ease",
          animation:
            step.state === "active" && !isHovered
              ? "activeNodePulse 2.8s ease-in-out infinite"
              : undefined,
          transform: isHovered
            ? "translateY(-2px) scale(1.01)"
            : "translateY(0) scale(1)",
          filter: isHovered ? "saturate(1.04)" : "none",
        },
      };
    });

    const builtEdges: Edge[] = renderSteps.slice(0, -1).map((step, idx) => {
      const style = stateStyle(step.state);
      return {
        id: `${step.id}-${renderSteps[idx + 1]!.id}`,
        source: step.id,
        target: renderSteps[idx + 1]!.id,
        type: "smoothstep",
        animated: step.state === "active",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: style.line,
        },
        style: {
          stroke: style.line,
          strokeWidth:
            step.state === "active" ? 3.8 : step.state === "done" ? 3.1 : 2.2,
          strokeDasharray: step.state === "active" ? "8 6" : style.dash,
          opacity:
            step.state === "active" || step.state === "done" ? 0.95 : 0.55,
        },
      };
    });

    const glowEdges: Edge[] = renderSteps.slice(0, -1).flatMap((step, idx) => {
      if (step.state !== "active") return [];
      const style = stateStyle(step.state);
      return [
        {
          id: `glow-${step.id}-${renderSteps[idx + 1]!.id}`,
          source: step.id,
          target: renderSteps[idx + 1]!.id,
          type: "smoothstep",
          selectable: false,
          focusable: false,
          style: {
            stroke: style.line,
            strokeWidth: 14,
            opacity: 0.12,
            pointerEvents: "none",
          },
        },
      ];
    });

    return {
      nodes: builtNodes,
      edges: [...glowEdges, ...builtEdges],
      canvasHeight,
      visibleCount,
      compactNode: renderSteps[0] ?? steps[0],
      isPartialChain: renderSteps.length < steps.length,
    };
  }, [task.status, hoveredNodeId, onNodeSelect]);

  const useCompactMode = (visibleCount <= 1 || isPartialChain) && compactNode;

  return (
    <div className="space-y-3">
      <style>{`
        @keyframes activeNodePulse {
          0%, 100% { box-shadow: 0 0 0 1px rgba(99,102,241,.35), 0 0 24px rgba(79,70,229,.16); }
          50% { box-shadow: 0 0 0 5px rgba(99,102,241,.12), 0 0 40px rgba(79,70,229,.26); }
        }
      `}</style>

      {showSummary && (
        <div className="rounded-[14px] border border-border bg-white p-4">
          <p className="text-xs text-muted-foreground">主任务：{task.title}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>进度 {progress}%</span>
            <span>已耗时 {elapsed} 分钟</span>
            <span>健康状态 {issueHealth(task)}</span>
          </div>
        </div>
      )}

      {useCompactMode ? (
        <div className="premium-panel hover-lift grid min-h-[336px] w-full items-center gap-4 rounded-[20px] p-5 lg:grid-cols-[1fr_300px]">
          <div className="flex items-center justify-center">
            <div className="w-full max-w-[420px] rounded-[18px] border border-border bg-background p-5 shadow-sm">
              <p className="text-[11px] uppercase tracking-widest text-primary">
                Mission Node
              </p>
              <h4 className="mt-1 text-[20px] font-semibold text-foreground">
                {compactNode.title}
              </h4>
              <p className="mt-2 text-sm text-muted-foreground">
                {compactNode.desc}
              </p>
            </div>
          </div>
          <div className="space-y-2 rounded-xl border border-border bg-background/50 p-4 text-[12px] text-muted-foreground">
            <p className="font-medium text-foreground">状态说明</p>
            <p>
              健康：<span className="font-semibold">{issueHealth(task)}</span>
            </p>
            <p>
              进度：<span className="font-semibold">{progress}%</span>
            </p>
            <p>
              已耗时：<span className="font-semibold">{elapsed} 分钟</span>
            </p>
            <p className="pt-1 text-[12px] text-muted-foreground/80">
              当前仅获取到部分流程节点，正在等待其余链路同步
            </p>
          </div>
        </div>
      ) : (
        <div
          className="premium-panel hover-lift w-full overflow-hidden rounded-[20px]"
          style={{
            height: `${canvasHeight}px`,
            minHeight: 320,
            maxHeight: 620,
          }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            fitViewOptions={{ padding: 0.3, minZoom: 0.68, maxZoom: 1 }}
            proOptions={{ hideAttribution: true }}
            panOnDrag={interactive}
            zoomOnScroll={interactive}
            zoomOnPinch={interactive}
            zoomOnDoubleClick={interactive}
            preventScrolling={!interactive}
            draggable={false}
            elementsSelectable={false}
            nodesDraggable={false}
            nodesConnectable={false}
            onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
            onNodeMouseLeave={() => setHoveredNodeId(null)}
            onNodeClick={(_, node) => {
              if (!onNodeSelect) return;
              const detail = (
                node.data as { detail?: FlowNodeDetail } | undefined
              )?.detail;
              if (detail) onNodeSelect(detail);
            }}
          >
            <Background gap={28} size={1} color="#CBD5E1" />
          </ReactFlow>
        </div>
      )}
    </div>
  );
}
