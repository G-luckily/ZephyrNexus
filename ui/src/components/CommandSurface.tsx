import { useState, type ReactNode } from "react";
import { cn } from "../lib/utils";
import { useSidebar } from "../context/SidebarContext";

interface TabDef {
  id: string;
  label: string;
  badge?: string | number;
  content: ReactNode;
}

interface CommandSurfaceProps {
  tabs: TabDef[];
  defaultTab?: string;
}

export function CommandSurface({ tabs, defaultTab }: CommandSurfaceProps) {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id ?? "");
  const active = tabs.find((t) => t.id === activeTab);

  return (
    <section className="panel-floating relative flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-0.5 border-b border-border/40 px-3 pt-2.5 lg:px-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-150",
              activeTab === tab.id
                ? "bg-white/[0.07] text-foreground shadow-sm"
                : "text-muted-foreground/50 hover:bg-white/[0.03] hover:text-muted-foreground"
            )}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span
                className={cn(
                  "inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-1 text-[8px] font-semibold leading-none",
                  activeTab === tab.id
                    ? "bg-zephyr-blue/15 text-zephyr-blue"
                    : "bg-white/[0.06] text-muted-foreground/50"
                )}
              >
                {tab.badge}
              </span>
            )}
            {activeTab === tab.id && (
              <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-zephyr-blue/60" />
            )}
          </button>
        ))}
        <div className="flex-1" />
      </div>

      {/* Active tab content */}
      <div className="min-h-0 flex-1">
        {active?.content ?? null}
      </div>
    </section>
  );
}
