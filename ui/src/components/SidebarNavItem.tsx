import { NavLink } from "@/lib/router";
import { cn } from "../lib/utils";
import { useSidebar } from "../context/SidebarContext";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";

interface SidebarNavItemProps {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  className?: string;
  badge?: number;
  badgeTone?: "default" | "danger";
  alert?: boolean;
  liveCount?: number;
  onClick?: () => void;
}

export function SidebarNavItem({
  to,
  label,
  icon: Icon,
  end,
  className,
  badge,
  badgeTone = "default",
  alert = false,
  liveCount,
  onClick,
}: SidebarNavItemProps) {
  const { isMobile, setSidebarOpen } = useSidebar();

  return (
    <NavLink
      to={to}
      end={end}
      onClick={() => {
        onClick?.();
        if (isMobile) setSidebarOpen(false);
      }}
    >
      {({ isActive }) => (
        <div
          className={cn(
            "group relative flex items-center gap-2 rounded-[16px] border px-2.5 py-2.5 text-[13px] leading-5 font-medium transition-all duration-150",
            isActive
              ? "border-sidebar-ring bg-sidebar text-sidebar-foreground shadow-sm bg-sidebar-accent/50"
              : "border-transparent text-muted-foreground hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-sm",
            className
          )}
        >
          <span
            className={cn(
              "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary transition-all duration-150",
              isActive
                ? "opacity-100 scale-y-100"
                : "opacity-0 scale-y-75 group-hover:opacity-65 group-hover:scale-y-100"
            )}
          />

          <span
            className={cn(
              "relative shrink-0 rounded-md p-1 transition-all duration-150",
              isActive
                ? "bg-primary/10 text-primary"
                : "bg-sidebar-accent/50 text-muted-foreground group-hover:bg-sidebar-accent group-hover:text-sidebar-accent-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {alert && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 shadow-[0_0_0_2px_hsl(var(--background))]" />
            )}
          </span>

          <span className="flex flex-1 items-center gap-2 truncate">
            <span
              className={cn(
                "inline-block h-1.5 w-1.5 rounded-full transition-colors duration-200",
                isActive
                  ? "bg-accent shadow-[0_0_8px_var(--ring)]"
                  : "bg-muted-foreground/40 group-hover:bg-muted-foreground/80"
              )}
            />
            <span className="truncate">{label}</span>
          </span>

          {liveCount != null && liveCount > 0 && (
            <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-cyan-200">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
              </span>
              执行中
            </span>
          )}

          {badge != null && badge > 0 && (
            <span
              className={cn(
                "ml-auto inline-flex h-5 items-center rounded-md px-1.5 text-[10px] font-semibold leading-none ring-1 ring-inset",
                badgeTone === "danger"
                  ? "bg-rose-500/12 text-rose-600 dark:text-rose-200 ring-rose-300/30 dark:ring-rose-300/15"
                  : "bg-blue-500/10 text-blue-600 dark:text-cyan-200 ring-blue-300/35 dark:ring-cyan-300/15"
              )}
            >
              {badge}
            </span>
          )}

          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-all duration-200",
              isActive
                ? "opacity-70 text-sidebar-foreground"
                : "opacity-0 -translate-x-1 group-hover:translate-x-0 group-hover:opacity-60"
            )}
          />
        </div>
      )}
    </NavLink>
  );
}
