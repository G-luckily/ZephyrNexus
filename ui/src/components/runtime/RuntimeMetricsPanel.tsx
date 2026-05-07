import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "../../lib/utils";
import { useRuntimeMetrics } from "../../context/RuntimeContext";

interface MetricCardProps {
  label: string;
  value: number | string;
  unit?: string;
  trend?: "up" | "down" | "stable";
  accentColor?: string;
  isLive?: boolean;
  sparkline?: number[];
  className?: string;
}

export function MetricCard({
  label,
  value,
  unit,
  trend,
  accentColor = "var(--zephyr-blue)",
  isLive = false,
  sparkline = [],
  className,
}: MetricCardProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const [prevValue, setPrevValue] = useState(value);

  // Animate on value change
  useEffect(() => {
    if (value !== prevValue) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 300);
      setPrevValue(value);
      setDisplayValue(value);
      return () => clearTimeout(timer);
    }
  }, [value, prevValue]);

  const trendIcon = {
    up: "↑",
    down: "↓",
    stable: "→",
  }[trend || "stable"];

  // Generate mini sparkline path
  const sparklinePath = useCallback(() => {
    if (sparkline.length < 2) return "";

    const width = 48;
    const height = 20;
    const min = Math.min(...sparkline);
    const max = Math.max(...sparkline);
    const range = max - min || 1;

    const points = sparkline.map((v, i) => {
      const x = (i / (sparkline.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    });

    return `M ${points.join(" L ")}`;
  }, [sparkline]);

  return (
    <div
      className={cn(
        "group panel-floating relative flex flex-col gap-2 p-4 transition-all duration-200",
        isAnimating && "runtime-metric-update",
        className
      )}
    >
      {/* Ambient glow on hover */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${accentColor}15 0%, transparent 70%)`,
        }}
      />

      <div className="relative flex items-start justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {isLive && (
          <span className="relative flex h-1.5 w-1.5">
            <span
              className="absolute inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400"
              style={{ animation: "status-breathe 2s ease-in-out infinite" }}
            />
            <span className="absolute inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping opacity-50" />
          </span>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div className="flex items-baseline gap-1">
          <span
            className={cn(
              "text-2xl font-bold tabular-nums transition-all duration-300",
              isAnimating && "scale-105"
            )}
            style={{
              fontFeatureSettings: '"tnum" 1',
              color: isAnimating ? accentColor : undefined,
            }}
          >
            {typeof displayValue === "number" ? displayValue.toFixed(1) : displayValue}
          </span>
          {unit && (
            <span className="text-xs text-muted-foreground">{unit}</span>
          )}
          {trend && (
            <span
              className={cn(
                "ml-1 text-xs font-medium transition-colors duration-300",
                trend === "up" && "text-emerald-400",
                trend === "down" && "text-rose-400",
                trend === "stable" && "text-muted-foreground"
              )}
            >
              {trendIcon}
            </span>
          )}
        </div>

        {/* Mini sparkline */}
        {sparkline.length > 1 && (
          <svg
            viewBox="0 0 48 20"
            className="h-5 w-12 overflow-visible"
            style={{ overflow: "visible" }}
          >
            {/* Gradient fill */}
            <defs>
              <linearGradient id={`sparkGrad-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accentColor} stopOpacity="0.3" />
                <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Fill area */}
            <path
              d={`${sparklinePath()} L 48,20 L 0,20 Z`}
              fill={`url(#sparkGrad-${label})`}
              className="transition-all duration-300"
            />

            {/* Line */}
            <path
              d={sparklinePath()}
              fill="none"
              stroke={accentColor}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300"
              style={{
                filter: `drop-shadow(0 0 3px ${accentColor})`,
              }}
            />

            {/* End dot */}
            <circle
              cx={48}
              cy={
                20 -
                ((sparkline[sparkline.length - 1] - Math.min(...sparkline)) /
                  (Math.max(...sparkline) - Math.min(...sparkline) || 1)) *
                  20
              }
              r="2"
              fill={accentColor}
              className="transition-all duration-300"
            />
          </svg>
        )}
      </div>
    </div>
  );
}

interface RuntimeMetricsPanelProps {
  className?: string;
  historyLength?: number;
}

export function RuntimeMetricsPanel({
  className,
  historyLength = 12,
}: RuntimeMetricsPanelProps) {
  const metrics = useRuntimeMetrics();

  // Track history for sparklines
  const [agentHistory, setAgentHistory] = useState<number[]>([]);
  const [taskHistory, setTaskHistory] = useState<number[]>([]);
  const [responseHistory, setResponseHistory] = useState<number[]>([]);

  useEffect(() => {
    setAgentHistory((prev) => {
      const next = [...prev, metrics.activeAgents].slice(-historyLength);
      return next;
    });
    setTaskHistory((prev) => {
      const next = [...prev, metrics.tasksInFlight].slice(-historyLength);
      return next;
    });
    setResponseHistory((prev) => {
      const next = [...prev, metrics.avgResponseTime].slice(-historyLength);
      return next;
    });
  }, [metrics.activeAgents, metrics.tasksInFlight, metrics.avgResponseTime, historyLength]);

  // Calculate trends
  const agentTrend =
    agentHistory.length > 1
      ? agentHistory[agentHistory.length - 1] > agentHistory[agentHistory.length - 2]
        ? "up"
        : agentHistory[agentHistory.length - 1] < agentHistory[agentHistory.length - 2]
        ? "down"
        : "stable"
      : undefined;

  return (
    <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>
      <MetricCard
        label="活跃智能体"
        value={metrics.activeAgents}
        unit={`/ ${metrics.totalAgents}`}
        isLive
        trend={agentTrend}
        accentColor="var(--zephyr-blue)"
        sparkline={agentHistory}
      />
      <MetricCard
        label="任务完成"
        value={metrics.tasksCompleted}
        trend="up"
        accentColor="var(--emerald-400)"
        sparkline={taskHistory}
      />
      <MetricCard
        label="执行中"
        value={metrics.tasksInFlight}
        accentColor="var(--violet-400)"
        sparkline={taskHistory}
      />
      <MetricCard
        label="平均响应"
        value={metrics.avgResponseTime}
        unit="ms"
        trend="stable"
        accentColor="var(--amber-400)"
        sparkline={responseHistory}
      />
    </div>
  );
}

// Compact version for embedding in other panels
export function RuntimeMetricsStrip({ className }: { className?: string }) {
  const metrics = useRuntimeMetrics();

  return (
    <div className={cn("flex items-center gap-4 text-xs", className)}>
      <div className="flex items-center gap-1.5">
        <span
          className="relative flex h-1.5 w-1.5"
        >
          <span
            className="absolute inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400"
            style={{ animation: "status-breathe 2s ease-in-out infinite" }}
          />
          <span className="absolute inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping opacity-50" />
        </span>
        <span className="text-muted-foreground">活跃</span>
        <span className="font-medium text-foreground tabular-nums" style={{ fontFeatureSettings: '"tnum" 1' }}>
          {metrics.activeAgents}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">完成</span>
        <span className="font-medium text-foreground tabular-nums" style={{ fontFeatureSettings: '"tnum" 1' }}>
          {metrics.tasksCompleted}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">响应</span>
        <span className="font-medium text-foreground tabular-nums" style={{ fontFeatureSettings: '"tnum" 1' }}>
          {metrics.avgResponseTime}ms
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">错误率</span>
        <span
          className={cn(
            "font-medium tabular-nums tabular-nums",
            metrics.errorRate > 3 ? "text-rose-400" : "text-emerald-400",
            metrics.errorRate > 5 && "text-rose-400"
          )}
          style={{ fontFeatureSettings: '"tnum" 1' }}
        >
          {metrics.errorRate.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
