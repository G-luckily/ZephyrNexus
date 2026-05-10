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
      <div className={cn("panel-floating relative flex flex-col overflow-hidden p-4 lg:p-4", className)}>

        {/* Header */}
        <div className="relative mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RuntimeStatusBadge state={globalState} size="md" />
            <div>
              <p className={cn("text-[11px] font-semibold leading-none", stateConfig.color)}>
                {stateConfig.label}
              </p>
              <p className="mt-0.5 text-[9px] text-muted-foreground/60">
                {stateConfig.description}
              </p>
            </div>
          </div>
          <button
            onClick={isSimulating ? stopSimulation : startSimulation}
            className={cn(
              "rounded-md border px-2 py-0.5 text-[9px] font-medium transition-all duration-150 active:scale-[0.97]",
              isSimulating
                ? "border-border/50 bg-background/60 text-muted-foreground hover:border-border hover:text-foreground"
                : "border-accent/30 bg-accent/8 text-accent hover:bg-accent/12"
            )}
          >
            {isSimulating ? "暂停" : "启动"}
          </button>
        </div>

        {/* Route Trace — 6-step path, compact nodes */}
        <div className="mb-3">
          <p className="mb-2 text-[8px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/40">
            路由轨迹
          </p>
          <div className="flex items-center">
            {routeSteps.map((step, i) => {
              const isLast = i === routeSteps.length - 1;
              const isActive = step.state === "active";
              const isDone = step.state === "done";
              const isWaiting = step.state === "waiting";
              const isPending = step.state === "pending";

              // Connector color — muted, not bright
              const connColor = isDone
                ? "bg-success/40"
                : isActive
                ? "bg-accent/40"
                : "bg-border/30";

              return (
                <div key={i} className="flex items-center">
                  {/* Node cluster */}
                  <div className="flex flex-col items-center">
                    {/* Outer glow dot for active */}
                    {isActive && (
                      <div className="mb-1 h-2 w-2 rounded-full bg-accent/20 animate-pulse" />
                    )}

                    {/* Node circle — 26px compact */}
                    <div
                      className={cn(
                        "relative flex h-[26px] w-[26px] items-center justify-center rounded-full border-[1.5px] transition-all duration-200",
                        isActive && "border-accent bg-accent/8 ring-1 ring-accent/15",
                        isDone && "border-success/40 bg-success/8",
                        isWaiting && "border-warning/40 bg-warning/8",
                        isPending && "border-border/40 bg-background"
                      )}
                    >
                      {isDone ? (
                        <Check className="h-3 w-3 text-success" strokeWidth={2.5} />
                      ) : isWaiting ? (
                        <Loader className="h-3 w-3 animate-spin text-warning" strokeWidth={2} />
                      ) : isActive ? (
                        <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                      ) : (
                        <span className="text-[8px] font-bold text-muted-foreground/40">{i + 1}</span>
                      )}
                    </div>

                    {/* Step label */}
                    <span
                      className={cn(
                        "mt-1 whitespace-nowrap text-[7px] font-medium leading-none",
                        isActive && "text-accent",
                        isDone && "text-muted-foreground/60",
                        isWaiting && "text-amber-400",
                        isPending && "text-muted-foreground/40"
                      )}
                    >
                      {step.label}
                    </span>

                    {/* Agent name */}
                    <span
                      className={cn(
                        "mt-0.5 text-[6px] leading-none",
                        isActive && "text-zephyr-blue/50",
                        isDone && "text-muted-foreground/35",
                        isWaiting && "text-amber-400/50",
                        isPending && "text-muted-foreground/25"
                      )}
                    >
                      {step.agent}
                    </span>
                  </div>

                  {/* Connector line — state-colored, only between nodes */}
                  {!isLast && (
                    <div className={cn("mx-1 h-px w-5 shrink-0 rounded-full transition-colors duration-300", connColor)} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Metrics Strip */}
        {showMetrics && (
          <div className="mt-auto grid grid-cols-3 gap-3 border-t border-border/30 pt-4">
            <div className="flex flex-col items-center gap-0.5">
              <p className="text-[18px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
                {routeNodeCount}
              </p>
              <p className="text-[8px] font-medium uppercase tracking-widest text-muted-foreground/50">
                路由节点
              </p>
            </div>
            <div className="flex flex-col items-center gap-0.5 border-x border-border/20 px-1">
              <p className="text-[18px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
                {executionEvents}
              </p>
              <p className="text-[8px] font-medium uppercase tracking-widest text-muted-foreground/50">
                执行事件
              </p>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <p className={cn(
                "text-[18px] font-semibold leading-none tracking-tight tabular-nums",
                responseTime > 0 ? "text-foreground" : "text-muted-foreground/40"
              )}>
                {responseTime > 0 ? `${responseTime}ms` : "—"}
              </p>
              <p className="text-[8px] font-medium uppercase tracking-widest text-muted-foreground/50">
                响应耗时
              </p>
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
