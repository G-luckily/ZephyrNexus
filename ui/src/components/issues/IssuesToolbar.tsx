import { Plus, Search, List, Columns3, Filter, ArrowUpDown, Layers, Check, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { tStatus } from "@/lib/i18n";
import { StatusIcon } from "@/components/StatusIcon";
import { PriorityIcon } from "@/components/PriorityIcon";
import { IssuesTemplateMenu } from "@/components/IssuesTemplateMenu";
import { ActionQueueSheet } from "@/components/ActionQueueSheet";
import { useDialog } from "@/context/DialogContext";
import { cleanVisibleAgentName } from "@/lib/org-structure";
import type { IssueViewState } from "../IssuesList";

/* ── Helpers (shared with IssuesList) ── */

const statusOrder = ["in_progress", "todo", "backlog", "in_review", "blocked", "done", "cancelled"];
const priorityOrder = ["critical", "high", "medium", "low"];

const quickFilterPresets = [
  { label: "全部", statuses: [] as string[] },
  { label: "进行中", statuses: ["todo", "in_progress", "in_review", "blocked"] },
  { label: "待处理", statuses: ["backlog"] },
  { label: "已完成", statuses: ["done", "cancelled"] },
];

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

function toggleInArray(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

function countActiveFilters(state: IssueViewState): number {
  let count = 0;
  if (state.statuses.length > 0) count++;
  if (state.priorities.length > 0) count++;
  if (state.assignees.length > 0) count++;
  if (state.labels.length > 0) count++;
  return count;
}

interface Agent {
  id: string;
  name: string;
}

interface Label {
  id: string;
  name: string;
  color: string;
}

interface IssuesToolbarProps {
  viewState: IssueViewState;
  updateView: (patch: Partial<IssueViewState>) => void;
  issueSearch: string;
  setIssueSearch: (value: string) => void;
  onSearchChange?: (search: string) => void;
  agents?: Agent[];
  labels?: Label[];
  projectId?: string;
  filteredLength: number;
  liveCount: number;
  blockedCount: number;
  activeFilterCount: number;
  newIssueDefaults: (groupKey?: string) => Record<string, string>;
}

export function IssuesToolbar({
  viewState,
  updateView,
  issueSearch,
  setIssueSearch,
  onSearchChange,
  agents,
  labels,
  projectId,
  filteredLength,
  liveCount,
  blockedCount,
  activeFilterCount,
  newIssueDefaults,
}: IssuesToolbarProps) {
  const { openNewIssue } = useDialog();

  return (
    <div className="premium-panel rounded-[22px] px-3 py-3">
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button size="sm" variant="outline" onClick={() => openNewIssue(newIssueDefaults())}>
            <Plus className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">新建任务</span>
          </Button>
          <IssuesTemplateMenu projectId={projectId} />
          <div className="relative w-48 sm:w-64 md:w-80">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={issueSearch}
              onChange={(e) => {
                setIssueSearch(e.target.value);
                onSearchChange?.(e.target.value);
              }}
              placeholder="搜索任务..."
              className="pl-7 text-xs sm:text-sm"
              aria-label="搜索任务"
            />
          </div>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          {/* Action Queue */}
          <ActionQueueSheet>
            <Button
              variant="ghost"
              size="sm"
              className="mr-1 rounded-full border border-amber-500/20 bg-amber-500/5 px-3 text-xs text-amber-600 dark:text-amber-500 transition-all duration-150 hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-400 font-medium whitespace-nowrap hidden sm:flex"
            >
              <Zap className="h-3.5 w-3.5 sm:h-3 sm:w-3 sm:mr-1.5 text-amber-500" />
              <span>Action Queue</span>
            </Button>
          </ActionQueueSheet>

          {/* View mode toggle */}
          <div className="mr-1 flex items-center rounded-full border border-border bg-background p-0.5">
            <button
              className={cn(
                "rounded-full p-1.5 transition-all duration-150",
                viewState.viewMode === "list"
                  ? "bg-muted text-foreground ring-1 ring-border shadow-sm"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
              onClick={() => updateView({ viewMode: "list" })}
              title="List view"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              className={cn(
                "rounded-full p-1.5 transition-all duration-150",
                viewState.viewMode === "board"
                  ? "bg-muted text-foreground ring-1 ring-border shadow-sm"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
              onClick={() => updateView({ viewMode: "board" })}
              title="Board view"
            >
              <Columns3 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "rounded-full border border-border bg-background px-3 text-xs text-muted-foreground transition-all duration-150 hover:border-foreground/20 hover:bg-muted hover:text-foreground",
                  activeFilterCount > 0 &&
                    "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400"
                )}
              >
                <Filter className="h-3.5 w-3.5 sm:h-3 sm:w-3 sm:mr-1" />
                <span className="hidden sm:inline">
                  {activeFilterCount > 0 ? `Filters: ${activeFilterCount}` : "Filter"}
                </span>
                {activeFilterCount > 0 && (
                  <span className="sm:hidden ml-0.5 text-[10px] font-medium">{activeFilterCount}</span>
                )}
                {activeFilterCount > 0 && (
                  <X
                    className="ml-1 hidden h-3 w-3 sm:block"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateView({ statuses: [], priorities: [], assignees: [], labels: [] });
                    }}
                  />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(480px,calc(100vw-2rem))] p-0">
              <div className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Filters</span>
                  {activeFilterCount > 0 && (
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => updateView({ statuses: [], priorities: [], assignees: [], labels: [] })}
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Quick filters */}
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Quick filters</span>
                  <div className="flex flex-wrap gap-1.5">
                    {quickFilterPresets.map((preset) => {
                      const isActive = arraysEqual(viewState.statuses, preset.statuses);
                      return (
                        <button
                          key={preset.label}
                          className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                            isActive
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                          }`}
                          onClick={() => updateView({ statuses: isActive ? [] : [...preset.statuses] })}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-border" />

                {/* Multi-column filter sections */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                  {/* Status */}
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Status</span>
                    <div className="space-y-0.5">
                      {statusOrder.map((s) => (
                        <label key={s} className="flex items-center gap-2 px-2 py-1 rounded-sm hover:bg-accent/50 cursor-pointer">
                          <Checkbox
                            checked={viewState.statuses.includes(s)}
                            onCheckedChange={() => updateView({ statuses: toggleInArray(viewState.statuses, s) })}
                          />
                          <StatusIcon status={s} />
                          <span className="text-sm">{tStatus(s)}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Priority + Assignee stacked in right column */}
                  <div className="space-y-3">
                    {/* Priority */}
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Priority</span>
                      <div className="space-y-0.5">
                        {priorityOrder.map((p) => (
                          <label key={p} className="flex items-center gap-2 px-2 py-1 rounded-sm hover:bg-accent/50 cursor-pointer">
                            <Checkbox
                              checked={viewState.priorities.includes(p)}
                              onCheckedChange={() => updateView({ priorities: toggleInArray(viewState.priorities, p) })}
                            />
                            <PriorityIcon priority={p} />
                            <span className="text-sm">{tStatus(p)}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Assignee */}
                    {agents && agents.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Assignee</span>
                        <div className="space-y-0.5 max-h-32 overflow-y-auto">
                          {agents.map((agent) => (
                            <label key={agent.id} className="flex items-center gap-2 px-2 py-1 rounded-sm hover:bg-accent/50 cursor-pointer">
                              <Checkbox
                                checked={viewState.assignees.includes(agent.id)}
                                onCheckedChange={() => updateView({ assignees: toggleInArray(viewState.assignees, agent.id) })}
                              />
                              <span className="text-sm">{cleanVisibleAgentName(agent.name)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {labels && labels.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Labels</span>
                        <div className="space-y-0.5 max-h-32 overflow-y-auto">
                          {labels.map((label) => (
                            <label key={label.id} className="flex items-center gap-2 px-2 py-1 rounded-sm hover:bg-accent/50 cursor-pointer">
                              <Checkbox
                                checked={viewState.labels.includes(label.id)}
                                onCheckedChange={() => updateView({ labels: toggleInArray(viewState.labels, label.id) })}
                              />
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: label.color }} />
                              <span className="text-sm">{label.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Sort (list view only) */}
          {viewState.viewMode === "list" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="rounded-full border border-border bg-background px-3 text-xs text-muted-foreground transition-all duration-150 hover:border-foreground/20 hover:bg-muted hover:text-foreground">
                  <ArrowUpDown className="h-3.5 w-3.5 sm:h-3 sm:w-3 sm:mr-1" />
                  <span className="hidden sm:inline">Sort</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-48 p-0">
                <div className="p-2 space-y-0.5">
                  {(
                    [
                      ["status", "Status"],
                      ["priority", "Priority"],
                      ["title", "Title"],
                      ["created", "Created"],
                      ["updated", "Updated"],
                    ] as [IssueViewState["sortField"], string][]
                  ).map(([field, label]) => (
                    <button
                      key={field}
                      className={`flex items-center justify-between w-full px-2 py-1.5 text-sm rounded-sm ${
                        viewState.sortField === field ? "bg-accent/50 text-foreground" : "hover:bg-accent/50 text-muted-foreground"
                      }`}
                      onClick={() => {
                        if (viewState.sortField === field) {
                          updateView({ sortDir: viewState.sortDir === "asc" ? "desc" : "asc" });
                        } else {
                          updateView({ sortField: field, sortDir: "asc" });
                        }
                      }}
                    >
                      <span>{label}</span>
                      {viewState.sortField === field && (
                        <span className="text-xs text-muted-foreground">{viewState.sortDir === "asc" ? "↑" : "↓"}</span>
                      )}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Group (list view only) */}
          {viewState.viewMode === "list" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="rounded-full border border-border bg-background px-3 text-xs text-muted-foreground transition-all duration-150 hover:border-foreground/20 hover:bg-muted hover:text-foreground">
                  <Layers className="h-3.5 w-3.5 sm:h-3 sm:w-3 sm:mr-1" />
                  <span className="hidden sm:inline">Group</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-44 p-0">
                <div className="p-2 space-y-0.5">
                  {(
                    [
                      ["status", "Status"],
                      ["priority", "Priority"],
                      ["assignee", "Assignee"],
                      ["none", "None"],
                    ] as [IssueViewState["groupBy"], string][]
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      className={`flex items-center justify-between w-full px-2 py-1.5 text-sm rounded-sm ${
                        viewState.groupBy === value ? "bg-accent/50 text-foreground" : "hover:bg-accent/50 text-muted-foreground"
                      }`}
                      onClick={() => updateView({ groupBy: value })}
                    >
                      <span>{label}</span>
                      {viewState.groupBy === value && <Check className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="launch-chip launch-chip-cyan">任务 {filteredLength}</span>
        <span className="launch-chip launch-chip-emerald">Live {liveCount}</span>
        <span className="launch-chip launch-chip-rose">阻塞 {blockedCount}</span>
        <span className="launch-chip">过滤器 {activeFilterCount}</span>
      </div>
    </div>
  );
}
