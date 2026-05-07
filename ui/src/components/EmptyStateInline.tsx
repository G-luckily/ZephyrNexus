import type { LucideIcon } from "lucide-react";

interface EmptyStateInlineProps {
  icon?: LucideIcon;
  message: string;
  compact?: boolean;
}

export function EmptyStateInline({
  icon: Icon,
  message,
  compact,
}: EmptyStateInlineProps) {
  return (
    <div
      className={
        compact
          ? "flex items-center gap-2 py-2 text-xs text-muted-foreground/60"
          : "flex flex-col items-center justify-center py-8 text-center"
      }
    >
      {Icon && (
        <div className={compact ? "" : "mb-2"}>
          <Icon className={compact ? "h-3.5 w-3.5" : "h-5 w-5 text-muted-foreground/40"} />
        </div>
      )}
      <span className={compact ? "" : "text-sm text-muted-foreground/60"}>
        {message}
      </span>
    </div>
  );
}
