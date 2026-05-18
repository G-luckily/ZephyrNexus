import { useRef } from "react";
import { cn } from "@/lib/utils";
import { cleanVisibleAgentName } from "@/lib/org-structure";
import type { ActivityEvent } from "@zephyr-nexus/shared";

type EventLevel = "信息" | "警告" | "错误";
type FeedFilter = "all" | "errors" | "tasks";
type LogWindow = "15m" | "1h" | "24h";

interface EventTimelineProps {
  feedFilter: FeedFilter;
  setFeedFilter: (filter: FeedFilter) => void;
  logWindow: LogWindow;
  setLogWindow: (window: LogWindow) => void;
  filteredEvents: ActivityEvent[];
  agents: { id: string; name: string }[] | undefined;
}

function toLevel(event: ActivityEvent): EventLevel {
  const action = event.action.toLowerCase();
  if (
    action.includes("failed") ||
    action.includes("error") ||
    action.includes("terminated") ||
    action.includes("rejected")
  ) {
    return "错误";
  }
  if (
    action.includes("blocked") ||
    action.includes("waiting") ||
    action.includes("pending")
  ) {
    return "警告";
  }
  return "信息";
}

function EventRow({
  event,
  level,
  agentName,
  index = 0,
}: {
  event: ActivityEvent;
  level: EventLevel;
  agentName: string;
  index?: number;
}) {
  const levelClass =
    level === "错误"
      ? "text-[#ff8c82]"
      : level === "警告"
      ? "text-[#f6bd60]"
      : "text-[#81ddff]";
  const dotColor =
    level === "错误" ? "#ff5d73" : level === "警告" ? "#ffb347" : "#4fd1ff";
  const outerAnim =
    level === "错误"
      ? "eventDotBreathStrong"
      : level === "警告"
      ? "eventDotBreathSoft"
      : "eventDotBreathSoft";
  const innerShadow =
    level === "错误"
      ? "0 0 0 3px rgba(255,93,115,0.35)"
      : level === "警告"
      ? "0 0 0 3px rgba(255,179,71,0.3)"
      : "0 0 0 2px rgba(79,209,255,0.28)";

  return (
    <div
      className="relative flex items-start gap-3 border-b border-border/50 px-3 py-3 text-sm last:border-b-0"
      style={{
        animation: "eventRowIn 0.25s ease both",
        animationDelay: `${index * 55}ms`,
      }}
    >
      <div className="mt-1.5 flex w-[74px] shrink-0 flex-col items-start gap-1">
        <span className="relative inline-flex h-3 w-3">
          <span
            className="absolute inline-flex h-full w-full rounded-full"
            style={{
              backgroundColor: dotColor,
              opacity: level === "信息" ? 0.35 : 0.55,
              animation: `${outerAnim} ${
                level === "错误" ? 2.1 : level === "警告" ? 2.4 : 2.9
              }s ease-in-out infinite`,
            }}
          />
          <span
            className="absolute inline-flex h-full w-full rounded-full"
            style={{
              backgroundColor: dotColor,
              boxShadow: innerShadow,
            }}
          />
        </span>
        <span
          className={cn(
            "w-full truncate text-[10px] font-medium uppercase tracking-wider",
            levelClass
          )}
        >
          {level}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">
          <span className="font-medium">{agentName}</span>
          <span className="mx-1.5 text-muted-foreground/60">·</span>
          <span className="text-muted-foreground">{event.action}</span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground/70">
          {new Date(event.createdAt).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

export function EventTimeline({
  feedFilter,
  setFeedFilter,
  logWindow,
  setLogWindow,
  filteredEvents,
  agents,
}: EventTimelineProps) {
  const logsContainerRef = useRef<HTMLDivElement>(null);

  return (
    <section className="premium-panel glass-surface hover-lift relative overflow-hidden rounded-[var(--radius-panel)] p-6 lg:p-8 shadow-2xl">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-32"
        style={{
          background:
            "radial-gradient(circle at top right, color-mix(in oklab, var(--zephyr-blue-soft) 65%, transparent) 0%, transparent 52%)",
        }}
      />
      <div className="relative mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            系统动态流
          </p>
          <h3 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-foreground">
            系统事件
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full border border-periwinkle-border bg-background/45 p-0.5 text-xs">
            {(["all", "errors", "tasks"] as FeedFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFeedFilter(f)}
                className={cn(
                  "rounded-full px-3 py-1 font-medium transition-colors duration-150",
                  feedFilter === f
                    ? "bg-zephyr-blue-soft text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f === "all" ? "全部" : f === "errors" ? "错误" : "任务"}
              </button>
            ))}
          </div>

          <select
            className="rounded-full border border-periwinkle-border bg-background/45 px-4 py-1.5 text-xs text-foreground transition-all duration-200 hover:border-zephyr-blue/35 focus:ring-2 focus:ring-zephyr-blue/20 focus:outline-none"
            value={logWindow}
            onChange={(e) => setLogWindow(e.target.value as LogWindow)}
          >
            <option value="1h">最近 1 小时</option>
            <option value="24h">最近 24 小时</option>
          </select>
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          当前筛选下暂无事件。
        </p>
      ) : (
        <div
          ref={logsContainerRef}
          className="relative max-h-[420px] overflow-auto rounded-[24px] border border-periwinkle-border"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in oklab, var(--shell-surface-bg) 85%, transparent) 0%, color-mix(in oklab, var(--card) 72%, var(--shell-surface-bg)) 100%)",
          }}
        >
          <div className="pointer-events-none absolute left-[39px] top-0 h-full w-px bg-periwinkle-dim" />
          {filteredEvents.map((event, idx) => {
            const level = toLevel(event);
            const rawName =
              (event.agentId &&
                agents?.find((a) => a.id === event.agentId)?.name) ||
              (event.actorType === "agent" &&
                agents?.find((a) => a.id === event.actorId)?.name) ||
              "系统";
            const agentName =
              rawName === "系统" ? rawName : cleanVisibleAgentName(rawName);

            return (
              <EventRow
                key={event.id}
                event={event}
                level={level}
                agentName={agentName}
                index={idx}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
