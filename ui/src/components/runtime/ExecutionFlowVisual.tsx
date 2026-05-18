import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import { useExecutionFlow } from "../../context/RuntimeContext";
import { RUNTIME_STATE_CONFIGS, type ExecutionNode } from "../../lib/runtime";

// Particle that flows along the connection
function FlowParticle({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="absolute h-1.5 w-1.5 rounded-full bg-zephyr-blue"
      style={{
        left: "10%",
        top: "50%",
        transform: "translateY(-50%)",
        animation: `flowParticle 1.5s ease-in-out ${delay}s infinite`,
        boxShadow: "0 0 6px 1px rgba(59, 130, 246, 0.6)",
      }}
    />
  );
}

interface NodeCardProps {
  node: ExecutionNode;
  isActive?: boolean;
  isSource?: boolean;
  isTarget?: boolean;
}

function NodeCard({ node, isActive, isSource, isTarget }: NodeCardProps) {
  const config = RUNTIME_STATE_CONFIGS[node.state];
  const [justStarted, setJustStarted] = useState(false);

  useEffect(() => {
    if (node.state === "executing" && !isSource) {
      setJustStarted(true);
      const timer = setTimeout(() => setJustStarted(false), 600);
      return () => clearTimeout(timer);
    }
  }, [node.state, isSource]);

  const typeLabels: Record<ExecutionNode["type"], string> = {
    input: "输入",
    output: "输出",
    agent: "智能体",
    task: "任务",
    decision: "决策",
    merge: "合并",
  };

  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-1",
        justStarted && "runtime-state-enter"
      )}
    >
      {/* Ambient glow for active states */}
      {node.state === "executing" && (
        <div
          className="absolute inset-0 opacity-30 blur-xl"
          style={{
            background: `radial-gradient(circle, ${config.glowColor} 0%, transparent 70%)`,
            animation: "breathing-glow 3s ease-in-out infinite",
          }}
        />
      )}

      {/* Node Card - Pipeline Stage Style */}
      <div
        className={cn(
          "relative flex h-14 w-28 flex-col items-center justify-center rounded-xl border transition-all duration-300",
          config.bgColor,
          config.borderColor,
          isActive && "runtime-node-active",
          node.state === "executing" && "runtime-executing",
          node.state === "routing" && "runtime-routing",
          isTarget && "scale-105"
        )}
        style={{
          boxShadow: isActive
            ? `0 0 20px 2px ${config.glowColor}, 0 0 40px 0 ${config.glowColor}40`
            : config.glowColor
            ? `0 0 8px 0 ${config.glowColor}`
            : undefined,
        }}
      >
        {/* Top accent line for active states */}
        {isActive && (
          <div
            className="absolute inset-x-0 top-0 h-0.5 rounded-t-xl"
            style={{
              background: `linear-gradient(90deg, transparent, ${config.color}, transparent)`,
              animation: "flowParticle 2s ease-in-out infinite",
            }}
          />
        )}

        {/* State indicator */}
        <div
          className={cn(
            "absolute -right-1.5 -top-1.5 h-3.5 w-3.5 rounded-full border-2",
            config.bgColor,
            config.borderColor
          )}
          style={{
            boxShadow: config.glowColor ? `0 0 6px 0 ${config.glowColor}` : undefined,
            animation:
              node.state === "executing"
                ? "status-breathe 2s ease-in-out infinite"
                : undefined,
          }}
        />

        {/* Pulse ring for executing */}
        {node.state === "executing" && (
          <div
            className="absolute inset-0 rounded-2xl border-2 border-zephyr-blue/50"
            style={{
              animation: "node-active-ring 2s ease-in-out infinite",
            }}
          />
        )}

        {/* Label */}
        <span
          className={cn(
            "text-[12px] font-bold leading-tight",
            config.color
          )}
        >
          {node.label}
        </span>

        {/* Type badge */}
        <span className="mt-0.5 rounded-full bg-white/5 px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wider text-muted-foreground/80">
          {typeLabels[node.type]}
        </span>

        {/* Progress bar (if applicable) */}
        {node.metadata?.progress !== undefined && node.state === "executing" && (
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-zephyr-blue to-violet-400 transition-all duration-500"
              style={{ width: `${node.metadata.progress}%` }}
            >
              {/* Sweeping highlight */}
              <div
                className="absolute h-full w-8 rounded-full bg-white/30"
                style={{
                  animation: "progressSweep 1.5s ease-in-out infinite",
                  left: `${Math.max(0, node.metadata.progress - 40)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Completion check */}
        {node.state === "completed" && (
          <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="h-2.5 w-2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </div>

      {/* Connector line with animated particle */}
      {node.connections.length > 0 && (
        <div className="absolute left-full top-1/2 w-10 -translate-y-1/2">
          <svg viewBox="0 0 40 12" className="h-full w-full">
            {/* Base line */}
            <path
              d="M0 6 L36 6"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="4 2"
              fill="none"
              className="text-white/10"
            />
            {/* Active flow line */}
            {node.state === "completed" || node.state === "executing" ? (
              <path
                d="M0 6 L36 6"
                stroke="url(#flowGradient)"
                strokeWidth="2"
                strokeDasharray="none"
                fill="none"
                className="absolute"
                style={{
                  filter: "drop-shadow(0 0 3px rgba(59, 130, 246, 0.5))",
                }}
              />
            ) : null}
            {/* Arrow head */}
            <path
              d="M32 3 L36 6 L32 9"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              className={
                node.state === "completed" || node.state === "executing"
                  ? "text-zephyr-blue"
                  : "text-white/20"
              }
            />
            {/* Gradient definition */}
            <defs>
              <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(59, 130, 246, 0)" />
                <stop offset="50%" stopColor="rgba(59, 130, 246, 1)" />
                <stop offset="100%" stopColor="rgba(59, 130, 246, 0)" />
              </linearGradient>
            </defs>
          </svg>

          {/* Flowing particle */}
          {(node.state === "completed" || node.state === "executing") && (
            <FlowParticle delay={0} />
          )}
        </div>
      )}
    </div>
  );
}

interface ExecutionFlowVisualProps {
  className?: string;
  compact?: boolean;
}

export function ExecutionFlowVisual({
  className,
  compact = false,
}: ExecutionFlowVisualProps) {
  const executionFlow = useExecutionFlow();

  // Find the currently executing node and track progression
  const activeNodeId = executionFlow.find(
    (n) => n.state === "executing" || n.state === "routing"
  )?.id;

  const completedCount = executionFlow.filter(
    (n) => n.state === "completed"
  ).length;
  const totalProgress = executionFlow.reduce(
    (acc, node) => acc + (node.metadata?.progress || (node.state === "completed" ? 100 : 0)),
    0
  );
  const avgProgress = Math.round(totalProgress / executionFlow.length);

  if (compact) {
    // Pipeline-style flow visualization
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        {/* Pipeline stages */}
        <div className="flex items-center">
          {executionFlow.slice(0, 6).map((node, index) => {
            const config = RUNTIME_STATE_CONFIGS[node.state];
            const isActive = node.state === "executing";
            const isCompleted = node.state === "completed";
            const isPending = node.state === "idle" || node.state === "preparing";

            return (
              <div key={node.id} className="flex items-center">
                {/* Connector line */}
                {index > 0 && (
                  <div className="relative h-px w-6 overflow-hidden">
                    <div
                      className={cn(
                        "h-full w-full transition-all duration-500",
                        isCompleted
                          ? "bg-gradient-to-r from-zephyr-blue to-violet-400"
                          : isActive
                          ? "bg-zephyr-blue/50"
                          : "bg-white/15"
                      )}
                    />
                    {/* Active flow particle */}
                    {isActive && (
                      <div
                        className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-zephyr-blue"
                        style={{
                          boxShadow: "0 0 6px 1px rgba(59, 130, 246, 0.6)",
                          animation: "flowParticle 1.5s ease-in-out infinite",
                          left: "20%",
                        }}
                      />
                    )}
                  </div>
                )}

                {/* Node stage */}
                <div className="flex flex-col items-center gap-1">
                  {/* Stage card */}
                  <div
                    className={cn(
                      "relative flex h-7 w-12 items-center justify-center rounded-lg border transition-all duration-300",
                      config.borderColor,
                      isActive && "runtime-executing",
                      isCompleted && "bg-emerald-500/10 border-emerald-500/40",
                      isPending && "bg-white/5"
                    )}
                    style={{
                      background: isActive
                        ? `linear-gradient(135deg, ${config.bgColor} 0%, transparent 100%)`
                        : isCompleted
                        ? "rgba(16, 185, 129, 0.08)"
                        : config.bgColor,
                      boxShadow: isActive
                        ? `0 0 12px 2px ${config.glowColor}40`
                        : isCompleted
                        ? "0 0 8px 0 rgba(16, 185, 129, 0.3)"
                        : undefined,
                    }}
                  >
                    {/* State icon */}
                    {isActive && (
                      <div
                        className="absolute inset-0 rounded-lg border border-zephyr-blue/30"
                        style={{ animation: "node-active-ring 2s ease-in-out infinite" }}
                      />
                    )}
                    {isCompleted && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3 text-emerald-400">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    {!isActive && !isCompleted && (
                      <span className={cn("text-[8px] font-semibold", config.color)}>
                        {node.label.slice(0, 4)}
                      </span>
                    )}
                  </div>

                  {/* Stage label */}
                  <span className={cn(
                    "text-[8px] font-medium",
                    isActive ? "text-zephyr-blue" : isCompleted ? "text-emerald-400/70" : "text-muted-foreground/50"
                  )}>
                    {node.label.slice(0, 3)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress bar with gradient */}
        <div className="relative h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-zephyr-blue via-violet-400 to-zephyr-blue transition-all duration-700"
            style={{ width: `${avgProgress}%` }}
          />
          {/* Sweeping highlight */}
          <div
            className="absolute h-full w-8 rounded-full bg-white/20"
            style={{
              animation: "progressSweep 2s ease-in-out infinite",
              left: `max(0%, ${avgProgress - 40}%)`,
            }}
          />
        </div>

        {/* Progress label */}
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-muted-foreground">执行进度</span>
          <span className="text-[9px] font-semibold text-zephyr-blue">{avgProgress}%</span>
        </div>
      </div>
    );
  }

  // Full visualization with nodes
  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Background atmosphere */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(59, 130, 246, 0.03) 0%, transparent 70%)",
        }}
      />

      {/* Subtle grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)
          `,
          backgroundSize: "16px 16px",
        }}
      />

      {/* Flow visualization */}
      <div className="relative flex items-center justify-center px-12 py-8">
        <div className="flex items-center">
          {executionFlow.map((node, index) => {
            const isActive = node.id === activeNodeId;
            const prevNode = index > 0 ? executionFlow[index - 1] : null;
            const isSource = prevNode?.state === "completed" || prevNode?.state === "executing";

            return (
              <div key={node.id} className="flex items-center">
                <NodeCard
                  node={node}
                  isActive={isActive}
                  isSource={isSource}
                  isTarget={isActive}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Flow summary bar */}
      <div className="relative border-t border-white/[0.06] bg-white/[0.02] px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Progress */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">流程进度</span>
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-zephyr-blue to-violet-400 transition-all duration-700"
                  style={{ width: `${avgProgress}%` }}
                />
              </div>
              <span className="text-[10px] font-medium text-zephyr-blue">
                {avgProgress}%
              </span>
            </div>

            <div className="h-3 w-px bg-white/10" />

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">节点</span>
              <span className="text-[10px] font-medium text-foreground">
                {completedCount}/{executionFlow.length}
              </span>
              <span className="text-[10px] text-muted-foreground">完成</span>
            </div>
          </div>

          {/* Active node info */}
          {activeNodeId && (
            <div className="flex items-center gap-2">
              <div
                className="h-1.5 w-1.5 rounded-full bg-zephyr-blue"
                style={{ animation: "status-breathe 2s ease-in-out infinite" }}
              />
              <span className="text-[10px] text-muted-foreground">执行中:</span>
              <span className="text-[10px] font-medium text-zephyr-blue">
                {executionFlow.find((n) => n.id === activeNodeId)?.label}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Minimal execution indicator (for embedding)
export function ExecutionIndicator({
  className,
}: {
  className?: string;
}) {
  const executionFlow = useExecutionFlow();
  const activeNode = executionFlow.find(
    (n) => n.state === "executing" || n.state === "routing" || n.state === "preparing"
  );

  if (!activeNode) {
    // Show idle state
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="h-2 w-2 rounded-full bg-white/20" />
        <span className="text-[10px] text-muted-foreground">空闲</span>
      </div>
    );
  }

  const config = RUNTIME_STATE_CONFIGS[activeNode.state];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn("relative h-2.5 w-2.5 rounded-full", config.bgColor)}
        style={{
          boxShadow: config.glowColor ? `0 0 6px 0 ${config.glowColor}` : undefined,
        }}
      >
        {/* Outer pulse ring */}
        <div
          className="absolute inset-0 rounded-full border"
          style={{
            borderColor: config.color,
            animation: "node-active-ring 2s ease-in-out infinite",
          }}
        />
      </div>
      <span className={cn("text-[10px] font-medium", config.color)}>
        {activeNode.label}
      </span>
      {activeNode.metadata?.progress !== undefined && (
        <div className="h-1 w-16 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-zephyr-blue to-violet-400 transition-all duration-300"
            style={{ width: `${activeNode.metadata.progress}%` }}
          />
        </div>
      )}
      <span className="text-[10px] text-muted-foreground">
        {activeNode.metadata?.progress || 0}%
      </span>
    </div>
  );
}
