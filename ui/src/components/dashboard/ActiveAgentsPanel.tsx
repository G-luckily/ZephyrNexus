import { useMemo } from "react";
import { useNavigate } from "@/lib/router";
import { Bot, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDialog } from "@/context/DialogContext";

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

interface ActiveAgentsPanelProps {
  selectedDept: string;
  setSelectedDept: (dept: string) => void;
  selectedDeptAgentRows: ActiveAgentRow[];
  agentLayerCounts: Record<AgentLayer, number>;
  activeAgentRowsByLayer: Map<AgentLayer, ActiveAgentRow[]>;
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
      cardClass: "border-border bg-card",
    };
  }
  if (layer === "V1-PROJECT") {
    return {
      label: "项目层",
      description: "项目执行",
      chipClass:
        "border-violet-400/20 bg-violet-400/10 text-violet-500 dark:text-violet-200 ring-violet-400/20",
      cardClass: "border-border bg-card",
    };
  }
  if (layer === "V2-PIPELINE") {
    return {
      label: "流水线层",
      description: "通用流水线",
      chipClass:
        "border-emerald-400/20 bg-emerald-400/10 text-emerald-500 dark:text-emerald-200 ring-emerald-400/20",
      cardClass: "border-border bg-card",
    };
  }
  return {
    label: "基础层",
    description: "基础设施",
    chipClass:
      "border-border bg-muted/50 text-muted-foreground ring-border",
    cardClass: "border-border bg-card",
  };
}

export function ActiveAgentsPanel({
  selectedDept,
  setSelectedDept,
  selectedDeptAgentRows,
  agentLayerCounts,
  activeAgentRowsByLayer,
}: ActiveAgentsPanelProps) {
  const navigate = useNavigate();
  const { openNewAgent } = useDialog();

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
}
