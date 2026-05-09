import { cn } from "../../lib/utils";
import { useRuntime, useRuntimeState } from "../../context/RuntimeContext";
import { RUNTIME_STATE_CONFIGS } from "../../lib/runtime";
import { RuntimeStatusBadge } from "./RuntimeStatusBadge";
import { RuntimeMetricsPanel } from "./RuntimeMetricsPanel";
import { RuntimeEventStream } from "./RuntimeEventStream";
import { ExecutionFlowVisual, ExecutionIndicator } from "./ExecutionFlowVisual";
import { Check, Loader } from "lucide-react";

interface RuntimePanelProps {
  variant?: "full" | "compact" | "minimal";
  showMetrics?: boolean;
  showEvents?: boolean;
  showFlow?: boolean;
  className?: string;
}

export function RuntimePanel({
  variant = "full",
  showMetrics = true,
  showEvents = true,
  showFlow = true,
  className,
}: RuntimePanelProps) {
  const { isSimulating, startSimulation, stopSimulation, agents } = useRuntime();
  const globalState = useRuntimeState();
  const stateConfig = RUNTIME_STATE_CONFIGS[globalState];

  if (variant === "minimal") {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <RuntimeStatusBadge state={globalState} size="md" />
        <ExecutionIndicator />
      </div>
    );
  }

  if (variant === "compact") {
    // Route trace steps - simulate a routing path
    const routeSteps = [
      { label: "任务输入", agent: "系统", state: globalState === "completed" ? "done" : globalState === "idle" ? "pending" : "done" },
      { label: "CEO 拆解", agent: "CEO 智能体", state: globalState === "routing" ? "active" : globalState === "idle" ? "pending" : "done" },
      { label: "研究分派", agent: "研究智能体", state: globalState === "executing" ? "active" : globalState === "preparing" ? "active" : globalState === "idle" ? "pending" : globalState === "routing" || globalState === "completed" ? "done" : "pending" },
      { label: "数据查询", agent: "数据智能体", state: globalState === "syncing" ? "active" : globalState === "executing" ? "done" : globalState === "idle" ? "pending" : "pending" },
      { label: "流水线", agent: "流水线智能体", state: globalState === "blocked" ? "waiting" : globalState === "idle" ? "pending" : "pending" },
      { label: "结果输出", agent: "系统", state: globalState === "completed" ? "done" : "pending" },
    ];

    // Determine actual metrics from simulation state
    const routeNodeCount = agents?.length ?? 5;
    const executionEvents = Math.floor(Math.random() * 20) + 8;
    const responseTime = globalState === "idle" ? 0 : Math.floor(Math.random() * 400) + 300;

    return (
      <div className={cn("panel-floating relative flex flex-col overflow-hidden p-4", className)}>

        {/* Header */}
        <div className="relative mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RuntimeStatusBadge state={globalState} size="md" />
            <div>
              <p className={cn("text-xs font-semibold", stateConfig.color)}>
                {stateConfig.label}
              </p>
              <p className="text-[10px] text-muted-foreground/70">
                {stateConfig.description}
              </p>
            </div>
          </div>
          <button
            onClick={isSimulating ? stopSimulation : startSimulation}
            className={cn(
              "rounded-lg px-2 py-1 text-[10px] font-medium transition-all",
              isSimulating
                ? "bg-surface-overlay text-muted-foreground hover:bg-surface-floating"
                : "bg-zephyr-blue/10 text-zephyr-blue hover:bg-zephyr-blue/20"
            )}
          >
            {isSimulating ? "暂停" : "启动"}
          </button>
        </div>

        {/* Route Trace - 6-step pipeline with directional flow */}
        <div className="mb-3">
          <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            路由轨迹
          </p>
          <div className="flex items-center gap-0.5">
            {routeSteps.map((step, i) => {
              const isLast = i === routeSteps.length - 1;
              const isActive = step.state === "active";
              const isDone = step.state === "done";
              const isWaiting = step.state === "waiting";
              const isPending = step.state === "pending";

              return (
                <div key={i} className="flex items-center">
                  <div className="flex flex-col items-center">
                    {/* Step indicator with directional flow */}
                    <div className="relative">
                      {/* Directional leading edge for active */}
                      {isActive && (
                        <div className="absolute -left-1 top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-zephyr-blue opacity-60" />
                      )}
                      <div
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-lg border text-[9px] font-bold transition-all",
                          isActive && "border-zephyr-blue/50 bg-zephyr-blue/15 text-zephyr-blue shadow-[0_0_10px_1px_rgba(59,130,246,0.35)] route-step-active",
                          isDone && "border-emerald-400/40 bg-emerald-400/10 text-emerald-400",
                          isWaiting && "border-amber-400/40 bg-amber-400/10 text-amber-400",
                          isPending && "border-white/15 bg-white/5 text-muted-foreground/50"
                        )}
                      >
                        {isDone ? (
                          <Check className="h-3 w-3" />
                        ) : isWaiting ? (
                          <Loader className="h-3 w-3 animate-spin" />
                        ) : isActive ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                        ) : (
                          <span>{i + 1}</span>
                        )}
                      </div>
                    </div>
                    {/* Step label */}
                    <span
                      className={cn(
                        "mt-1 whitespace-nowrap text-[8px] font-medium",
                        isActive && "text-zephyr-blue",
                        isDone && "text-emerald-400/70",
                        isWaiting && "text-amber-400",
                        isPending && "text-muted-foreground/40"
                      )}
                    >
                      {step.label}
                    </span>
                    {/* Agent name beneath label */}
                    <span
                      className={cn(
                        "text-[6px]",
                        isActive && "text-zephyr-blue/50",
                        isDone && "text-emerald-400/40",
                        isWaiting && "text-amber-400/50",
                        isPending && "text-muted-foreground/25"
                      )}
                    >
                      {step.agent}
                    </span>
                  </div>
                  {/* Connector arrow with directional flow */}
                  {!isLast && (
                    <div className={cn("relative mx-0.5 flex h-4 w-3 items-center", isDone ? "text-emerald-400/40" : isActive ? "text-zephyr-blue/40" : "text-white/10")}>
                      {/* Flowing dot in connector when done */}
                      {isDone && (
                        <div
                          className="absolute inset-0 flex items-center justify-center"
                          style={{ pointerEvents: "none" }}
                        >
                          <div
                            className="h-0.5 w-1.5 rounded-full bg-emerald-400 opacity-70"
                            style={{ animation: "flowDot 1.5s ease-out infinite" }}
                          />
                        </div>
                      )}
                      <svg viewBox="0 0 12 8" className="h-2 w-3">
                        <path d="M0 4h10M7 1l3 3-3 3" stroke="currentColor" strokeWidth="1" fill="none" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Metrics Strip */}
        {showMetrics && (
          <div className="mt-auto grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3">
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground tabular-nums" style={{ fontFeatureSettings: '"tnum" 1' }}>
                {routeNodeCount}
              </p>
              <p className="text-[9px] text-muted-foreground/60">路由节点</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground tabular-nums" style={{ fontFeatureSettings: '"tnum" 1' }}>
                {executionEvents}
              </p>
              <p className="text-[9px] text-muted-foreground/60">执行事件</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground tabular-nums" style={{ fontFeatureSettings: '"tnum" 1' }}>
                {responseTime > 0 ? `${responseTime}ms` : "—"}
              </p>
              <p className="text-[9px] text-muted-foreground/60">响应耗时</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <div
      className={cn(
        "panel-floating relative flex flex-col overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="relative mb-4 flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-3">
          <RuntimeStatusBadge state={globalState} size="lg" />
          <div>
            <p className="text-[13px] font-semibold text-foreground">
              {stateConfig.description}
            </p>
            <p className="text-[10px] text-muted-foreground">
              全局运行时状态
            </p>
          </div>
        </div>
        <button
          onClick={isSimulating ? stopSimulation : startSimulation}
          className={cn(
            "rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all",
            isSimulating
              ? "bg-surface-overlay text-muted-foreground hover:bg-surface-floating hover:text-foreground"
              : "bg-zephyr-blue/10 text-zephyr-blue hover:bg-zephyr-blue/20"
          )}
        >
          {isSimulating ? "暂停模拟" : "开始模拟"}
        </button>
      </div>

      {/* Execution Flow */}
      {showFlow && (
        <div className="mb-4 px-5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            执行流程
          </p>
          <ExecutionFlowVisual compact />
        </div>
      )}

      {/* Metrics */}
      {showMetrics && (
        <div className="mb-4 px-5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            实时指标
          </p>
          <RuntimeMetricsPanel />
        </div>
      )}

      {/* Events */}
      {showEvents && (
        <div className="flex-1 px-5 pb-5">
          <RuntimeEventStream maxItems={10} />
        </div>
      )}
    </div>
  );
}

// Header-integrated runtime status
export function RuntimeStatusHeader({
  className,
}: {
  className?: string;
}) {
  const globalState = useRuntimeState();
  const { isSimulating } = useRuntime();
  const stateConfig = RUNTIME_STATE_CONFIGS[globalState];

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-1.5",
        stateConfig.bgColor,
        stateConfig.borderColor,
        className
      )}
    >
      <RuntimeStatusBadge state={globalState} size="sm" />
      <span className={cn("text-[11px] font-medium", stateConfig.color)}>
        {stateConfig.label}
      </span>
      {isSimulating && (
        <span className="ml-1 h-1 w-1 rounded-full bg-emerald-400" />
      )}
    </div>
  );
}
