import {
  Activity,
  AlertTriangle,
  ShieldCheck,
  Bot,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SystemMetricsPanelProps {
  activeIssuesCount: number;
  blockedIssuesCount: number;
  successRate: number;
  failedRunsCount: number;
}

export function SystemMetricsPanel({
  activeIssuesCount,
  blockedIssuesCount,
  successRate,
  failedRunsCount,
}: SystemMetricsPanelProps) {
  const metrics = [
    {
      label: "活跃任务",
      value: activeIssuesCount,
      sub: "执行负载",
      icon: <Activity className="h-4 w-4" />,
      tone: "blue" as const,
    },
    {
      label: "人工升级",
      value: blockedIssuesCount,
      sub: "人工介入",
      icon: <AlertTriangle className="h-4 w-4" />,
      tone: "warm" as const,
    },
    {
      label: "系统成功率",
      value: `${successRate}%`,
      sub: "运行质量",
      icon: <ShieldCheck className="h-4 w-4" />,
      tone: "periwinkle" as const,
    },
    {
      label: "通信机器人",
      value: "活跃",
      sub: "同步中",
      icon: <Bot className="h-4 w-4" />,
      tone: "violet" as const,
    },
    {
      label: "安全监测",
      value: failedRunsCount > 0 ? "告警中" : "安全",
      sub: "实时守护",
      icon: <ShieldAlert className="h-4 w-4" />,
      tone: "silver" as const,
    },
  ] as const;

  const toneClass: Record<(typeof metrics)[number]["tone"], string> = {
    blue: "border-zephyr-blue/25 bg-zephyr-blue-soft/55 text-zephyr-blue",
    warm: "border-warning/35 bg-warning/10 text-warning",
    periwinkle:
      "border-periwinkle-border bg-periwinkle-dim text-shell-chip-foreground",
    violet: "border-violet-soft/30 bg-violet-mist text-violet-soft",
    silver:
      "border-periwinkle-border bg-background/45 text-shell-chip-foreground",
  };

  return (
    <section className="premium-panel glass-surface relative flex h-full min-h-[260px] flex-col overflow-hidden rounded-[var(--radius-panel)] p-5 lg:p-6">
      <div className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          系统指标
        </p>
        <h3 className="mt-2 text-[20px] font-semibold tracking-tight text-foreground">
          执行监控面板
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          任务执行与系统健康同步观察。
        </p>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-2.5 sm:grid-cols-2">
        {metrics.map((metric, index) => (
          <div
            key={metric.label}
            className={cn(
              "flex items-center justify-between rounded-2xl border bg-background/40 px-3.5 py-3 transition-colors duration-150 hover:bg-background/60",
              index === metrics.length - 1 && "sm:col-span-2"
            )}
          >
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold text-foreground">
                {metric.label}
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {metric.sub}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-xl border",
                  toneClass[metric.tone]
                )}
              >
                {metric.icon}
              </span>
              <p className="text-right text-base font-semibold text-foreground">
                {metric.value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
