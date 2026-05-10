import type { ReactNode } from "react";
import { useSidebar } from "../context/SidebarContext";

interface SidebarSectionProps {
  label: string;
  meta?: string;
  children: ReactNode;
}

export function SidebarSection({ label, meta, children }: SidebarSectionProps) {
  const { sidebarCollapsed } = useSidebar();

  if (sidebarCollapsed) {
    return <section className="mt-1 first:mt-0">{children}</section>;
  }

  return (
    <section className="mt-1 first:mt-0">
      <div className="mb-1.5 flex items-center gap-2 px-2">
        <span className="h-px flex-1 bg-border/20" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
          {label}
        </span>
        {meta ? (
          <span className="rounded-full border border-border/30 bg-muted/50 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.10em] text-muted-foreground/70">
            {meta}
          </span>
        ) : null}
      </div>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}
