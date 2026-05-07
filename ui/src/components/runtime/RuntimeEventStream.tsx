import { useMemo } from "react";
import { cn } from "../../lib/utils";
import { useRuntimeEvents } from "../../context/RuntimeContext";
import { RUNTIME_STATE_CONFIGS, type RuntimeEvent, type RuntimeState } from "../../lib/runtime";
import { relativeTime } from "../../lib/utils";

interface EventItemProps {
  event: RuntimeEvent;
  index: number;
}

function EventItem({ event, index }: EventItemProps) {
  const stateConfig = event.state ? RUNTIME_STATE_CONFIGS[event.state] : null;

  const eventIcon = useMemo(() => {
    switch (event.type) {
      case "task_start":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        );
      case "task_complete":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        );
      case "task_fail":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        );
      case "agent_register":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
            <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
        );
      case "agent_unregister":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
            <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
          </svg>
        );
      case "escalation":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        );
      case "recovery":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
            <path d="M21 2v6h-6M3 12a9 9 0 019-9 9 9 0 016.36 2.64M3 22v-6h6M21 12a9 9 0 01-9 9 9 9 0 01-6.36-2.64" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
            <circle cx="12" cy="12" r="10" />
          </svg>
        );
    }
  }, [event.type]);

  return (
    <div
      className="runtime-event-enter group relative flex items-start gap-3 border-b border-white/[0.04] px-3 py-2.5 last:border-b-0"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Icon */}
      <div
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          event.type === "task_fail" && "bg-rose-400/10 text-rose-400",
          event.type === "task_complete" && "bg-emerald-400/10 text-emerald-400",
          event.type === "task_start" && "bg-zephyr-blue/10 text-zephyr-blue",
          event.type === "escalation" && "bg-amber-400/10 text-amber-400",
          event.type === "recovery" && "bg-cyan-400/10 text-cyan-400",
          ["agent_register", "agent_unregister"].includes(event.type) && "bg-violet-400/10 text-violet-400",
          !["task_fail", "task_complete", "task_start", "escalation", "recovery", "agent_register", "agent_unregister"].includes(event.type) && "bg-muted/20 text-muted-foreground"
        )}
      >
        {eventIcon}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-medium text-foreground">
            {event.source}
          </span>
          {stateConfig && (
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium",
                stateConfig.bgColor,
                stateConfig.color
              )}
            >
              {stateConfig.label}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {event.message}
        </p>
      </div>

      {/* Timestamp */}
      <span className="shrink-0 text-[10px] text-muted-foreground/60">
        {relativeTime(event.timestamp)}
      </span>
    </div>
  );
}

interface RuntimeEventStreamProps {
  maxItems?: number;
  showHeader?: boolean;
  className?: string;
}

export function RuntimeEventStream({
  maxItems = 15,
  showHeader = true,
  className,
}: RuntimeEventStreamProps) {
  const events = useRuntimeEvents();
  const displayEvents = events.slice(0, maxItems);

  return (
    <div className={cn("flex flex-col", className)}>
      {showHeader && (
        <div className="mb-3 flex items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              实时事件流
            </span>
            <span className="relative flex h-1.5 w-1.5">
              <span
                className="absolute inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 opacity-75"
                style={{ animation: "status-breathe 2s ease-in-out infinite" }}
              />
              <span className="absolute inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping opacity-50" />
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {events.length} 事件
          </span>
        </div>
      )}

      <div className="flex-1 overflow-hidden rounded-xl border border-white/[0.06] bg-surface-floating/50 backdrop-blur-sm">
        <div className="max-h-[280px] overflow-y-auto scrollbar-none">
          {displayEvents.map((event, index) => (
            <EventItem key={event.id} event={event} index={index} />
          ))}
          {displayEvents.length === 0 && (
            <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
              暂无事件
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Compact inline version
export function RuntimeEventDot({
  event,
}: {
  event: RuntimeEvent;
}) {
  const stateConfig = event.state ? RUNTIME_STATE_CONFIGS[event.state] : null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        stateConfig?.bgColor || "bg-muted/20",
        stateConfig?.color || "text-muted-foreground"
      )}
    >
      <span
        className="h-1 w-1 rounded-full bg-current"
        style={{
          animation: stateConfig?.animation === "pulse"
            ? "status-breathe 2s ease-in-out infinite"
            : undefined,
        }}
      />
      {event.message}
    </span>
  );
}
