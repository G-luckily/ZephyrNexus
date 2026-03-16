import { tStatus } from "../lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { TaskFlowBoard } from "../components/dashboard/TaskFlowBoard";
import { Workflow } from "lucide-react";
import type { Issue } from "@zephyr-nexus/shared";

type FlowFilter = "all" | "active" | "blocked" | "review";

function getRecentIssues(issues: Issue[]): Issue[] {
  return [...issues].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function FlowPage() {
  const { selectedCompanyId, companies } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [filter, setFilter] = useState<FlowFilter>("all");
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "总览", href: "/dashboard" }, { label: "Flow" }]);
  }, [setBreadcrumbs]);

  const { data: issues, isLoading } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const recentIssues = useMemo(() => getRecentIssues(issues ?? []), [issues]);

  const flowIssues = useMemo(() => {
    return recentIssues
      .filter(
        (issue) => issue.status !== "done" && issue.status !== "cancelled"
      )
      .filter((issue) => {
        if (filter === "all") return true;
        if (filter === "active")
          return issue.status === "in_progress" || issue.status === "todo";
        if (filter === "blocked") return issue.status === "blocked";
        return issue.status === "in_review";
      })
      .slice(0, 24);
  }, [recentIssues, filter]);

  useEffect(() => {
    if (flowIssues.length === 0) {
      setSelectedIssueId(null);
      return;
    }
    if (!selectedIssueId || !flowIssues.find((i) => i.id === selectedIssueId)) {
      setSelectedIssueId(flowIssues[0].id);
    }
  }, [flowIssues, selectedIssueId]);

  const selectedIssue =
    flowIssues.find((i) => i.id === selectedIssueId) ?? null;
  const owner = selectedIssue?.assigneeAgentId
    ? agents?.find((a) => a.id === selectedIssue.assigneeAgentId)?.name ??
      "Unassigned"
    : "Unassigned";

  if (!selectedCompanyId) {
    if (companies.length === 0) {
      return (
        <EmptyState
          icon={Workflow}
          message="Welcome to Paperclip. Set up your first company and agent to get started."
        />
      );
    }
    return (
      <EmptyState
        icon={Workflow}
        message="Create or select a company to view flow details."
      />
    );
  }

  if (isLoading) return <PageSkeleton variant="dashboard" />;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Flow Details
            </h2>
            <p className="text-sm text-muted-foreground">
              Inspect active mission chains with zoom and selection.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground no-underline hover:bg-accent/50 hover:text-foreground"
          >
            返回总览
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["all", "active", "blocked", "review"] as FlowFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                filter === f
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:bg-accent/40"
              }`}
            >
              {f === "all"
                ? "全部"
                : f === "active"
                ? "活跃"
                : f === "blocked"
                ? "阻塞"
                : "审核中"}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-12">
        <section className="xl:col-span-8 rounded-2xl border border-border bg-white p-4 shadow-sm">
          <TaskFlowBoard task={selectedIssue} interactive showSummary />
        </section>

        <aside className="xl:col-span-4 rounded-2xl border border-border bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">
            Mission Queue
          </h3>
          <div className="mt-3 max-h-[460px] space-y-2 overflow-auto pr-1">
            {flowIssues.map((issue) => {
              const selected = issue.id === selectedIssueId;
              return (
                <button
                  key={issue.id}
                  onClick={() => setSelectedIssueId(issue.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selected
                      ? "border-foreground bg-accent/40"
                      : "border-border bg-slate-50/40 hover:bg-accent/30"
                  }`}
                >
                  <p className="truncate text-xs text-muted-foreground">
                    #{issue.identifier ?? issue.id.slice(0, 8)}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm font-medium text-foreground">
                    {issue.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    状态：{tStatus(issue.status)}
                  </p>
                </button>
              );
            })}

            {flowIssues.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
                当前筛选下暂无流程任务。
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
