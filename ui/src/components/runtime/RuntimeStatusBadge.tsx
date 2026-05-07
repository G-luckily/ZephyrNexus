import { cn } from "../../lib/utils";
import {
  RUNTIME_STATE_CONFIGS,
  RUNTIME_MOTION,
  type RuntimeState,
} from "../../lib/runtime";

interface RuntimeStatusBadgeProps {
  state: RuntimeState;
  showLabel?: boolean;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
  className?: string;
}

export function RuntimeStatusBadge({
  state,
  showLabel = true,
  showIcon = true,
  size = "md",
  pulse = true,
  className,
}: RuntimeStatusBadgeProps) {
  const config = RUNTIME_STATE_CONFIGS[state];

  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const labelSizes = {
    sm: "text-[10px]",
    md: "text-[11px]",
    lg: "text-xs",
  };

  const getAnimationClass = () => {
    if (!pulse) return "";

    switch (state) {
      case "executing":
        return "runtime-executing";
      case "routing":
        return "runtime-routing";
      case "syncing":
        return "runtime-syncing relative";
      case "escalating":
      case "waiting_human":
      case "preparing":
        return "runtime-glow-pulse";
      case "degraded":
      case "idle":
      default:
        return "";
    }
  };

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <div
        className={cn(
          "relative rounded-full border",
          sizeClasses[size],
          config.bgColor,
          config.borderColor,
          getAnimationClass()
        )}
        style={{
          boxShadow: config.glowColor
            ? `0 0 8px 0 ${config.glowColor}`
            : undefined,
        }}
      >
        {showIcon && (
          <RuntimeIcon
            state={state}
            className={cn("h-full w-full", config.color)}
          />
        )}
      </div>
      {showLabel && (
        <span className={cn("font-medium", labelSizes[size], config.color)}>
          {config.label}
        </span>
      )}
    </div>
  );
}

function RuntimeIcon({
  state,
  className,
}: {
  state: RuntimeState;
  className?: string;
}) {
  const icons: Record<RuntimeState, React.ReactNode> = {
    idle: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
    preparing: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    ),
    routing: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <polyline points="16 3 21 3 21 8" />
        <line x1="4" y1="20" x2="21" y2="3" />
        <polyline points="21 16 21 21 16 21" />
        <line x1="15" y1="15" x2="21" y2="21" />
      </svg>
    ),
    executing: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    ),
    syncing: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="M21 12a9 9 0 01-9 9m0 0a9 9 0 01-9-9m9 9V3m0 0l4 4m-4-4l-4 4" />
      </svg>
    ),
    escalating: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    ),
    retrying: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="M21 2v6h-6M3 12a9 9 0 019-9 9 9 0 016.36 2.64M3 22v-6h6M21 12a9 9 0 01-9 9 9 9 0 01-6.36-2.64" />
      </svg>
    ),
    degraded: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
      </svg>
    ),
    blocked: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
    ),
    waiting_human: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
        <path d="M12 14l-1-1 1-1M12 14l1-1-1-1" />
      </svg>
    ),
    completed: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  };

  return icons[state] || icons.idle;
}

// Inline version for compact displays
export function RuntimeStatusDot({
  state,
  className,
}: {
  state: RuntimeState;
  className?: string;
}) {
  const config = RUNTIME_STATE_CONFIGS[state];

  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        config.bgColor,
        "border",
        config.borderColor,
        className
      )}
      style={{
        boxShadow: config.glowColor ? `0 0 4px 0 ${config.glowColor}` : undefined,
      }}
    />
  );
}
