import { cn } from "../lib/utils";
import { statusBadge, statusBadgeDefault } from "../lib/status-colors";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-md px-2 text-[10px] font-semibold tracking-[0.01em] whitespace-nowrap shrink-0 ring-1 ring-inset ring-black/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]",
        statusBadge[status] ?? statusBadgeDefault
      )}
    >
      {(
        {
          idle: "空闲",
          active: "执行中",
          paused: "已暂停",
          live: "实时",
          error: "错误",
          terminated: "已终止",
          pending: "待处理",
          pending_approval: "待审批",
          planned: "计划中",
          in_progress: "进行中",
          in_review: "待审核",
          done: "已完成",
          cancelled: "已取消",
          backlog: "待处理",
          blocked: "已阻塞",
          todo: "待办",
        } as Record<string, string>
      )[status] ?? status.replace("_", " ")}
    </span>
  );
}
