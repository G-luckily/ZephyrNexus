import { useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useWorkspaceScope } from "../context/WorkspaceScopeContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { IssuesList } from "../components/IssuesList";
import { CircleDot } from "lucide-react";
import type { Agent } from "@zephyr-nexus/shared";

function roleDepartment(role: Agent["role"]): string {
  switch (role) {
    case "ceo":
      return "总裁办公室";
    case "cto":
      return "技术线";
    case "pm":
      return "人力与协调";
    case "researcher":
      return "社会研究院";
    default:
      return "执行单元";
  }
}

function presetStatuses(preset: string | null): string[] | undefined {
  if (preset === "active")
    return ["todo", "in_progress", "in_review", "blocked"];
  if (preset === "blocked") return ["blocked"];
  if (preset === "done") return ["done", "cancelled"];
  return undefined;
}

export function Issues() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { scopeView, projectFilter, departmentFilter } = useWorkspaceScope();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const initialSearch = searchParams.get("q") ?? "";
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleSearchChange = useCallback((search: string) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const trimmedSearch = search.trim();
      const currentSearch =
        new URLSearchParams(window.location.search).get("q") ?? "";
      if (currentSearch === trimmedSearch) return;

      const url = new URL(window.location.href);
      if (trimmedSearch) {
        url.searchParams.set("q", trimmedSearch);
      } else {
        url.searchParams.delete("q");
      }

      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState(window.history.state, "", nextUrl);
    }, 300);
  }, []);

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 5000,
  });

  const liveIssueIds = useMemo(() => {
    const ids = new Set<string>();
    for (const run of liveRuns ?? []) {
      if (run.issueId) ids.add(run.issueId);
    }
    return ids;
  }, [liveRuns]);

  useEffect(() => {
    setBreadcrumbs([{ label: "任务" }]);
  }, [setBreadcrumbs]);

  const {
    data: issues,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const updateIssue = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      issuesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.issues.list(selectedCompanyId!),
      });
    },
  });

  const scopedProjectId =
    scopeView === "project" && projectFilter !== "all"
      ? projectFilter
      : undefined;
  const urlAssignee = searchParams.get("assignee");
  const scopedAssignees = useMemo(() => {
    if (scopeView !== "department" || departmentFilter === "all")
      return undefined;
    return (agents ?? [])
      .filter((agent) => roleDepartment(agent.role) === departmentFilter)
      .map((agent) => agent.id);
  }, [agents, scopeView, departmentFilter]);
  const initialAssignees = urlAssignee ? [urlAssignee] : scopedAssignees;
  const initialStatuses = presetStatuses(searchParams.get("preset"));

  if (!selectedCompanyId) {
    return <EmptyState icon={CircleDot} message="请先选择公司后查看任务。" />;
  }

  return (
    <IssuesList
      issues={issues ?? []}
      isLoading={isLoading}
      error={error as Error | null}
      agents={agents}
      liveIssueIds={liveIssueIds}
      projectId={scopedProjectId}
      viewStateKey="paperclip:issues-view"
      initialAssignees={initialAssignees}
      initialStatuses={initialStatuses}
      initialSearch={initialSearch}
      onSearchChange={handleSearchChange}
      onUpdateIssue={(id, data) => updateIssue.mutate({ id, data })}
    />
  );
}
