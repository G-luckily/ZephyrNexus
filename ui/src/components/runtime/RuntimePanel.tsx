import { cn } from "../../lib/utils";
import { useRuntime, useRuntimeState } from "../../context/RuntimeContext";
import { RUNTIME_STATE_CONFIGS } from "../../lib/runtime";
import { RuntimeStatusBadge } from "./RuntimeStatusBadge";
import { RuntimeMetricsPanel } from "./RuntimeMetricsPanel";
import { RuntimeEventStream } from "./RuntimeEventStream";
import { ExecutionFlowVisual, ExecutionIndicator } from "./ExecutionFlowVisual";

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
  const { isSimulating, startSimulation, stopSimulation } = useRuntime();
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
    return (
      <div className={cn("panel-floating relative flex flex-col overflow-hidden p-4", className)}>
        {/* Atmospheric glow */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-20 opacity-40"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${stateConfig.glowColor} 0%, transparent 70%)`,
          }}
        />

        {/* Header */}
        <div className="relative mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RuntimeStatusBadge state={globalState} size="md" />
            <div>
              <p className={cn("text-xs font-semibold", stateConfig.color)}>
                {stateConfig.label}
              </p>
              <p className="text-[10px] text-muted-foreground">
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

        {/* Route Execution Trail - Real-time routing visualization */}
        <div className="mb-3 flex items-center gap-2">
          <ExecutionFlowVisual compact />
        </div>

        {/* Metrics Strip */}
        {showMetrics && (
          <div className="mt-auto grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3">
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground tabular-nums" style={{ fontFeatureSettings: '"tnum" 1' }}>
                {Math.floor(Math.random() * 5) + 3}
              </p>
              <p className="text-[9px] text-muted-foreground">活跃智能体</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground tabular-nums" style={{ fontFeatureSettings: '"tnum" 1' }}>
                {Math.floor(Math.random() * 20) + 5}
              </p>
              <p className="text-[9px] text-muted-foreground">执行中</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground tabular-nums" style={{ fontFeatureSettings: '"tnum" 1' }}>
                {(Math.random() * 500 + 200).toFixed(0)}ms
              </p>
              <p className="text-[9px] text-muted-foreground">响应</p>
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
      {/* Atmospheric glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-50"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${stateConfig.glowColor} 0%, transparent 70%)`,
        }}
      />

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
