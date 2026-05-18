import { tStatus } from "../lib/i18n";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDialog } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { issuesApi } from "../api/issues";
import { queryKeys } from "../lib/queryKeys";
import { groupBy } from "../lib/groupBy";
import { cleanVisibleAgentName } from "../lib/org-structure";
import { CircleDot, Plus, ChevronRight } from "lucide-react";
import { KanbanBoard } from "./KanbanBoard";
import { EmptyState } from "./EmptyState";
import { PageSkeleton } from "./PageSkeleton";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { IssuesToolbar, IssueRow } from "./issues";
import type { Issue } from "@zephyr-nexus/shared";

/* ── Helpers ── */

const statusOrder = [
  "in_progress",
  "todo",
  "backlog",
  "in_review",
  "blocked",
  "done",
  "cancelled",
];
const priorityOrder = ["critical", "high", "medium", "low"];

/* ── View state ── */

export type IssueViewState = {
  statuses: string[];
  priorities: string[];
  assignees: string[];
  labels: string[];
  sortField: "status" | "priority" | "title" | "created" | "updated";
  sortDir: "asc" | "desc";
  groupBy: "status" | "priority" | "assignee" | "none";
  viewMode: "list" | "board";
  collapsedGroups: string[];
};

const defaultViewState: IssueViewState = {
  statuses: [],
  priorities: [],
  assignees: [],
  labels: [],
  sortField: "updated",
  sortDir: "desc",
  groupBy: "none",
  viewMode: "list",
  collapsedGroups: [],
};

function getViewState(key: string): IssueViewState {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { ...defaultViewState, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...defaultViewState };
}

function saveViewState(key: string, state: IssueViewState) {
  localStorage.setItem(key, JSON.stringify(state));
}

function applyFilters(issues: Issue[], state: IssueViewState): Issue[] {
  let result = issues;
  if (state.statuses.length > 0)
    result = result.filter((i) => state.statuses.includes(i.status));
  if (state.priorities.length > 0)
    result = result.filter((i) => state.priorities.includes(i.priority));
  if (state.assignees.length > 0)
    result = result.filter(
      (i) =>
        i.assigneeAgentId != null && state.assignees.includes(i.assigneeAgentId)
    );
  if (state.labels.length > 0)
    result = result.filter((i) =>
      (i.labelIds ?? []).some((id) => state.labels.includes(id))
    );
  return result;
}

function sortIssues(issues: Issue[], state: IssueViewState): Issue[] {
  const sorted = [...issues];
  const dir = state.sortDir === "asc" ? 1 : -1;
  sorted.sort((a, b) => {
    switch (state.sortField) {
      case "status":
        return (
          dir * (statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status))
        );
      case "priority":
        return (
          dir *
          (priorityOrder.indexOf(a.priority) -
            priorityOrder.indexOf(b.priority))
        );
      case "title":
        return dir * a.title.localeCompare(b.title);
      case "created":
        return (
          dir *
          (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        );
      case "updated":
        return (
          dir *
          (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
        );
      default:
        return 0;
    }
  });
  return sorted;
}

function countActiveFilters(state: IssueViewState): number {
  let count = 0;
  if (state.statuses.length > 0) count++;
  if (state.priorities.length > 0) count++;
  if (state.assignees.length > 0) count++;
  if (state.labels.length > 0) count++;
  return count;
}

/* ── Component ── */

interface Agent {
  id: string;
  name: string;
}

interface IssuesListProps {
  issues: Issue[];
  isLoading?: boolean;
  error?: Error | null;
  agents?: Agent[];
  liveIssueIds?: Set<string>;
  projectId?: string;
  viewStateKey: string;
  initialAssignees?: string[];
  initialStatuses?: string[];
  initialSearch?: string;
  onSearchChange?: (search: string) => void;
  onUpdateIssue: (id: string, data: Record<string, unknown>) => void;
}

export function IssuesList({
  issues,
  isLoading,
  error,
  agents,
  liveIssueIds,
  projectId,
  viewStateKey,
  initialAssignees,
  initialStatuses,
  initialSearch,
  onSearchChange,
  onUpdateIssue,
}: IssuesListProps) {
  const { selectedCompanyId } = useCompany();
  const { openNewIssue } = useDialog();

  // Scope the storage key per company so folding/view state is independent across companies.
  const scopedKey = selectedCompanyId
    ? `${viewStateKey}:${selectedCompanyId}`
    : viewStateKey;

  const [viewState, setViewState] = useState<IssueViewState>(() => {
    if (initialAssignees || initialStatuses) {
      return {
        ...defaultViewState,
        assignees: initialAssignees ?? [],
        statuses: initialStatuses ?? [],
      };
    }
    return getViewState(scopedKey);
  });
  const [assigneePickerIssueId, setAssigneePickerIssueId] = useState<
    string | null
  >(null);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [issueSearch, setIssueSearch] = useState(initialSearch ?? "");
  const [debouncedIssueSearch, setDebouncedIssueSearch] = useState(issueSearch);
  const normalizedIssueSearch = debouncedIssueSearch.trim();

  useEffect(() => {
    setIssueSearch(initialSearch ?? "");
  }, [initialSearch]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedIssueSearch(issueSearch);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [issueSearch]);

  // Reload view state from localStorage when company changes (scopedKey changes).
  const prevScopedKey = useRef(scopedKey);
  useEffect(() => {
    if (prevScopedKey.current !== scopedKey) {
      prevScopedKey.current = scopedKey;
      setViewState(
        initialAssignees || initialStatuses
          ? {
              ...defaultViewState,
              assignees: initialAssignees ?? [],
              statuses: initialStatuses ?? [],
            }
          : getViewState(scopedKey)
      );
    }
  }, [scopedKey, initialAssignees, initialStatuses]);

  const updateView = useCallback(
    (patch: Partial<IssueViewState>) => {
      setViewState((prev) => {
        const next = { ...prev, ...patch };
        saveViewState(scopedKey, next);
        return next;
      });
    },
    [scopedKey]
  );

  const { data: searchedIssues = [] } = useQuery({
    queryKey: queryKeys.issues.search(
      selectedCompanyId!,
      normalizedIssueSearch,
      projectId
    ),
    queryFn: () =>
      issuesApi.list(selectedCompanyId!, {
        q: normalizedIssueSearch,
        projectId,
      }),
    enabled: !!selectedCompanyId && normalizedIssueSearch.length > 0,
  });

  const agentName = useCallback(
    (id: string | null) => {
      if (!id || !agents) return null;
      const raw = agents.find((a) => a.id === id)?.name;
      return raw ? cleanVisibleAgentName(raw) : null;
    },
    [agents]
  );

  const filtered = useMemo(() => {
    const sourceIssues =
      normalizedIssueSearch.length > 0 ? searchedIssues : issues;
    const filteredByControls = applyFilters(sourceIssues, viewState);
    return sortIssues(filteredByControls, viewState);
  }, [issues, searchedIssues, viewState, normalizedIssueSearch]);

  const { data: labels } = useQuery({
    queryKey: queryKeys.issues.labels(selectedCompanyId!),
    queryFn: () => issuesApi.listLabels(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const activeFilterCount = countActiveFilters(viewState);
  const blockedCount = filtered.filter(
    (issue) => issue.status === "blocked"
  ).length;
  const liveCount = filtered.filter((issue) =>
    liveIssueIds?.has(issue.id)
  ).length;

  const groupedContent = useMemo(() => {
    if (viewState.groupBy === "none") {
      return [{ key: "__all", label: null as string | null, items: filtered }];
    }
    if (viewState.groupBy === "status") {
      const groups = groupBy(filtered, (i) => i.status);
      return statusOrder
        .filter((s) => groups[s]?.length)
        .map((s) => ({ key: s, label: tStatus(s), items: groups[s]! }));
    }
    if (viewState.groupBy === "priority") {
      const groups = groupBy(filtered, (i) => i.priority);
      return priorityOrder
        .filter((p) => groups[p]?.length)
        .map((p) => ({ key: p, label: tStatus(p), items: groups[p]! }));
    }
    // assignee
    const groups = groupBy(
      filtered,
      (i) => i.assigneeAgentId ?? "__unassigned"
    );
    return Object.keys(groups).map((key) => ({
      key,
      label:
        key === "__unassigned"
          ? "未分配"
          : agentName(key) ?? key.slice(0, 8),
      items: groups[key]!,
    }));
  }, [filtered, viewState.groupBy, agents]); // eslint-disable-line react-hooks/exhaustive-deps

  const newIssueDefaults = (groupKey?: string) => {
    const defaults: Record<string, string> = {};
    if (projectId) defaults.projectId = projectId;
    if (groupKey) {
      if (viewState.groupBy === "status") defaults.status = groupKey;
      else if (viewState.groupBy === "priority") defaults.priority = groupKey;
      else if (viewState.groupBy === "assignee" && groupKey !== "__unassigned")
        defaults.assigneeAgentId = groupKey;
    }
    return defaults;
  };

  return (
    <div className="space-y-4">
      <IssuesToolbar
        viewState={viewState}
        updateView={updateView}
        issueSearch={issueSearch}
        setIssueSearch={setIssueSearch}
        onSearchChange={onSearchChange}
        agents={agents}
        labels={labels}
        projectId={projectId}
        filteredLength={filtered.length}
        liveCount={liveCount}
        blockedCount={blockedCount}
        activeFilterCount={activeFilterCount}
        newIssueDefaults={newIssueDefaults}
      />

      {isLoading && <PageSkeleton variant="issues-list" />}
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {!isLoading && filtered.length === 0 && viewState.viewMode === "list" && (
        <EmptyState
          icon={CircleDot}
          message="No issues match the current filters or search."
          action="Create Issue"
          onAction={() => openNewIssue(newIssueDefaults())}
        />
      )}

      {viewState.viewMode === "board" ? (
        <KanbanBoard
          issues={filtered}
          agents={agents}
          liveIssueIds={liveIssueIds}
          onUpdateIssue={onUpdateIssue}
        />
      ) : (
        groupedContent.map((group) => (
          <Collapsible
            key={group.key}
            open={!viewState.collapsedGroups.includes(group.key)}
            onOpenChange={(open) => {
              updateView({
                collapsedGroups: open
                  ? viewState.collapsedGroups.filter((k) => k !== group.key)
                  : [...viewState.collapsedGroups, group.key],
              });
            }}
          >
            {group.label && (
              <div className="flex items-center py-1.5 pl-1 pr-3">
                <CollapsibleTrigger className="flex items-center gap-1.5">
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-90" />
                  <span className="text-sm font-semibold uppercase tracking-wide">
                    {group.label}
                  </span>
                </CollapsibleTrigger>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="ml-auto text-muted-foreground"
                  onClick={() => openNewIssue(newIssueDefaults(group.key))}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            )}
            <CollapsibleContent>
              {group.items.map((issue) => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  agents={agents}
                  liveIssueIds={liveIssueIds}
                  assigneePickerIssueId={assigneePickerIssueId}
                  setAssigneePickerIssueId={setAssigneePickerIssueId}
                  assigneeSearch={assigneeSearch}
                  setAssigneeSearch={setAssigneeSearch}
                  onUpdateIssue={onUpdateIssue}
                  agentName={agentName}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        ))
      )}
    </div>
  );
}
