import type { ReactNode } from "react";

interface SidebarSectionProps {
  label: string;
  meta?: string;
  children: ReactNode;
}

export function SidebarSection({ label, meta, children }: SidebarSectionProps) {
  return (
    <section className="mt-1 first:mt-0">
      <div className="mb-1.5 flex items-center gap-2 px-2">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent via-sidebar-border to-sidebar-border" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </span>
        {meta ? (
          <span className="rounded-full border border-sidebar-border bg-sidebar-accent/30 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
            {meta}
          </span>
        ) : null}
      </div>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}
