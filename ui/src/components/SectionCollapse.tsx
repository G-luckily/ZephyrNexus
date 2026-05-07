import {
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { useSidebar } from "../context/SidebarContext";

interface SectionCollapseProps {
  storageKey: string;
  title: string;
  summary: string;
  status?: ReactNode;
  defaultExpanded?: boolean;
  children: ReactNode;
  actions?: ReactNode;
}

function getStored(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? v === "true" : fallback;
  } catch {
    return fallback;
  }
}

function setStored(key: string, val: boolean) {
  try {
    localStorage.setItem(key, String(val));
  } catch {
    /* noop */
  }
}

export function SectionCollapse({
  storageKey,
  title,
  summary,
  status,
  defaultExpanded = true,
  children,
  actions,
}: SectionCollapseProps) {
  const { isMobile } = useSidebar();
  const [expanded, setExpanded] = useState(() =>
    getStored(storageKey, defaultExpanded)
  );

  // Mobile defaults to collapsed
  useEffect(() => {
    if (isMobile) setExpanded(false);
  }, [isMobile]);

  const toggle = useCallback(() => {
    setExpanded((v) => {
      const next = !v;
      setStored(storageKey, next);
      return next;
    });
  }, [storageKey]);

  return (
    <section className="panel-floating relative overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.02] lg:px-6"
      >
        <div className="flex items-center gap-3 min-w-0">
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform duration-200",
              expanded && "rotate-90"
            )}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {title}
              </span>
              {status && (
                <span className="shrink-0">{status}</span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground/70 truncate max-w-md">
              {summary}
            </p>
          </div>
        </div>
        {actions && (
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            {actions}
          </div>
        )}
      </button>

      <div
        className={cn(
          "overflow-hidden transition-all duration-200 ease-out",
          expanded ? "max-h-[9999px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="border-t border-border/40 px-5 pb-5 pt-4 lg:px-6 lg:pb-6">
          {children}
        </div>
      </div>
    </section>
  );
}
