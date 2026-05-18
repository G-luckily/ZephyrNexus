import { Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type TaskStatus = "backlog" | "todo" | "in_progress" | "blocked" | "in_review" | "done" | "cancelled";

interface OrchestrationLaneProps {
  liveTaskStatus?: TaskStatus | null;
}

export function OrchestrationLane({ liveTaskStatus }: OrchestrationLaneProps) {
  const status = liveTaskStatus ?? "todo";
  const blocked = status === "blocked";
  const stages = [
    {
      id: "start",
      label: "启动",
      state: status === "todo" ? "active" : "done",
    },
    {
      id: "schedule",
      label: "任务调度",
      state:
        status === "todo"
          ? "pending"
          : blocked
          ? "failed"
          : status === "in_progress"
          ? "active"
          : "done",
    },
    {
      id: "query",
      label: "指标查询",
      state:
        status === "in_review" || status === "done"
          ? status === "done"
            ? "done"
            : "active"
          : "pending",
    },
    {
      id: "review",
      label: "人工复核",
      state:
        status === "done"
          ? "done"
          : status === "in_review"
          ? "active"
          : "pending",
    },
  ] as const;

  const terminalIndex = stages.reduce((acc, stage, index) => {
    if (
      stage.state === "done" ||
      stage.state === "active" ||
      stage.state === "failed"
    ) {
      return index;
    }
    return acc;
  }, 0);
  const progress = Math.max(
    8,
    Math.round((terminalIndex / (stages.length - 1)) * 100)
  );
  const progressBar = stages.some((stage) => stage.state === "failed")
    ? "linear-gradient(90deg, color-mix(in oklab, var(--zephyr-blue) 35%, var(--warning)) 0%, var(--error) 100%)"
    : "linear-gradient(90deg, var(--zephyr-blue) 0%, var(--periwinkle) 100%)";

  return (
    <div className="relative px-2 py-1.5">
      <div className="absolute left-4 right-4 top-[22px] h-[2px] rounded-full bg-periwinkle-dim" />
      <div
        className="absolute left-4 top-[22px] h-[2px] rounded-full transition-[width] duration-500"
        style={{
          width: `calc((100% - 2rem) * ${progress / 100})`,
          background: progressBar,
        }}
      />

      <div className="relative grid grid-cols-4 gap-2">
        {stages.map((stage) => {
          const isActive = stage.state === "active";
          const isDone = stage.state === "done";
          const isFailed = stage.state === "failed";

          return (
            <div
              key={stage.id}
              className={cn(
                "rounded-2xl border bg-background/55 px-2.5 py-2.5 transition-colors duration-150",
                isActive
                  ? "border-zephyr-blue/40 bg-zephyr-blue-soft/70"
                  : isDone
                  ? "border-success/35 bg-success/10"
                  : isFailed
                  ? "border-error/35 bg-error/10"
                  : "border-periwinkle-border bg-background/40"
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex h-5 w-5 items-center justify-center rounded-full border",
                    isActive
                      ? "border-zephyr-blue bg-zephyr-blue-soft"
                      : isDone
                      ? "border-success/45 bg-success/12"
                      : isFailed
                      ? "border-error/45 bg-error/12"
                      : "border-periwinkle-border bg-background/70"
                  )}
                >
                  {isDone ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : isFailed ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-error" />
                  ) : (
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        isActive ? "animate-pulse bg-zephyr-blue" : "bg-muted-foreground/45"
                      )}
                    />
                  )}
                </span>
                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground">
                  {stage.label}
                </p>
              </div>
              <p
                className={cn(
                  "mt-1.5 text-[10px] font-medium uppercase tracking-[0.1em]",
                  isActive
                    ? "text-zephyr-blue"
                    : isDone
                    ? "text-success"
                    : isFailed
                    ? "text-error"
                    : "text-muted-foreground"
                )}
              >
                {isActive
                  ? "运行中"
                  : isDone
                  ? "已完成"
                  : isFailed
                  ? "失败"
                  : "待处理"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
