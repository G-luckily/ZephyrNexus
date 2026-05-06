import { Link } from "@/lib/router";
import {
  Layers3,
  ArrowUpRight,
  Briefcase,
  Bot,
  ShieldCheck,
  FlaskConical,
  Megaphone,
  Newspaper,
  CircleDot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  departmentLabelFromKey,
  type OrgDepartmentOption,
} from "@/lib/org-structure";

type AgentLayer = "ORG" | "V1-PROJECT" | "V2-PIPELINE" | "INFRA";
type DeptRuntimeStatus = "running" | "failed" | "idle";

type OrgUnit = {
  key: string;
  label: string;
  to: string;
  agent: unknown;
};

type DeptRuntime = {
  total: number;
  running: number;
  waiting: number;
  failed: number;
  status: DeptRuntimeStatus;
  agents: unknown[];
};

interface OrgRuntimePanelProps {
  selectedDept: string;
  setSelectedDept: (dept: string) => void;
  orgUnits: OrgUnit[];
  deptRuntimeMap: Map<string, DeptRuntime>;
  agentLayerCounts: Record<AgentLayer, number>;
  orgDepartmentOptions: OrgDepartmentOption[];
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

export function OrgRuntimePanel({
  selectedDept,
  setSelectedDept,
  orgUnits,
  deptRuntimeMap,
  agentLayerCounts,
  orgDepartmentOptions,
}: OrgRuntimePanelProps) {
  const runtimeTotals = Array.from(deptRuntimeMap.values()).reduce(
    (acc, item) => {
      acc.total += item.total;
      acc.running += item.running;
      acc.waiting += item.waiting;
      acc.failed += item.failed;
      return acc;
    },
    { total: 0, running: 0, waiting: 0, failed: 0 }
  );

  return (
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
}
