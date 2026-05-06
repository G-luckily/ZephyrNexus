import { Plus } from "lucide-react";
import { ConstellationWindField } from "./ConstellationWindField";
import { useDialog } from "@/context/DialogContext";

interface ZephyrHeroProps {
  lastSyncTime: string;
  departmentCount: number;
  agentCount: number;
}

export function ZephyrHero({
  lastSyncTime,
  departmentCount,
  agentCount,
}: ZephyrHeroProps) {
  const { openNewIssue } = useDialog();

  return (
    <section className="premium-panel glass-surface relative overflow-hidden rounded-[var(--radius-hero)] border shadow-xl">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(120deg, color-mix(in oklab, var(--shell-surface-bg) 86%, transparent) 0%, color-mix(in oklab, var(--shell-surface-bg) 62%, transparent) 46%, transparent 100%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 z-[1]">
        <ConstellationWindField className="h-full w-full opacity-[0.95] dark:opacity-[0.98]" />
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-[2] w-[64%]"
        style={{
          background:
            "linear-gradient(90deg, var(--card) 0%, color-mix(in oklab, var(--card) 88%, transparent) 35%, transparent 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 left-[40%] z-[2] w-[30%]"
        style={{
          background:
            "radial-gradient(ellipse at 22% 50%, var(--violet-glow) 0%, transparent 72%)",
        }}
      />

      <div className="relative z-10 flex min-h-[350px] flex-col justify-between p-7 md:p-9 lg:p-11">
        <div className="max-w-[700px] space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-periwinkle-border bg-background/55 px-3.5 py-1 backdrop-blur-xl">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-zephyr-blue opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-zephyr-blue" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/80">
              系统在线 · {lastSyncTime}
            </span>
          </div>

          <div className="space-y-1.5">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl lg:text-[3.25rem]">
              风之灵枢
            </h1>
            <h2 className="text-lg font-light tracking-[0.22em] text-muted-foreground md:text-xl lg:text-2xl">
              AI 编排系统
            </h2>
          </div>

          <div className="rounded-[20px] border border-periwinkle-border bg-background/48 px-4 py-3 backdrop-blur-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              <div>
                <p className="text-2xl font-semibold leading-none text-foreground">
                  {departmentCount}
                </p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  部门
                </p>
              </div>
              <div className="sm:border-l sm:border-periwinkle-border sm:pl-4">
                <p className="text-2xl font-semibold leading-none text-foreground">
                  {agentCount}
                </p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  智能体
                </p>
              </div>
              <div className="sm:border-l sm:border-periwinkle-border sm:pl-4">
                <p className="text-2xl font-semibold leading-none text-foreground">
                  96%
                </p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  健康度
                </p>
              </div>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => openNewIssue()}
              className="inline-flex items-center gap-2 rounded-xl border border-zephyr-blue bg-zephyr-blue px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_22px_-14px_var(--zephyr-blue-glow)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_28px_-14px_var(--zephyr-blue-glow)]"
            >
              <Plus className="h-4 w-4" />
              新建任务
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
          <span>风灵群体｜智能体群</span>
          <span className="h-[3px] w-[3px] rounded-full bg-current opacity-40" />
          <span>风脉路径｜任务流</span>
          <span className="h-[3px] w-[3px] rounded-full bg-current opacity-40" />
          <span>风灵协同｜协同网络</span>
          <span className="h-[3px] w-[3px] rounded-full bg-current opacity-40" />
          <span>风擎引擎｜执行引擎</span>
        </div>
      </div>
    </section>
  );
}
