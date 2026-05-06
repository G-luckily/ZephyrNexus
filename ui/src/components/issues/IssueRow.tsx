import { useState } from "react";
import { Link } from "@/lib/router";
import { User } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { StatusIcon } from "@/components/StatusIcon";
import { PriorityIcon } from "@/components/PriorityIcon";
import { Identity } from "@/components/Identity";
import { cn, formatDate } from "@/lib/utils";
import { timeAgo } from "@/lib/timeAgo";
import { cleanVisibleAgentName } from "@/lib/org-structure";
import type { Issue } from "@zephyr-nexus/shared";

interface Agent {
  id: string;
  name: string;
}

interface IssueRowProps {
  issue: Issue;
  agents?: Agent[];
  liveIssueIds?: Set<string>;
  assigneePickerIssueId: string | null;
  setAssigneePickerIssueId: (id: string | null) => void;
  assigneeSearch: string;
  setAssigneeSearch: (value: string) => void;
  onUpdateIssue: (id: string, data: Record<string, unknown>) => void;
  agentName: (id: string | null) => string | null;
}

export function IssueRow({
  issue,
  agents,
  liveIssueIds,
  assigneePickerIssueId,
  setAssigneePickerIssueId,
  assigneeSearch,
  setAssigneeSearch,
  onUpdateIssue,
  agentName,
}: IssueRowProps) {
  const assignIssue = (issueId: string, assigneeAgentId: string | null) => {
    onUpdateIssue(issueId, { assigneeAgentId, assigneeUserId: null });
    setAssigneePickerIssueId(null);
    setAssigneeSearch("");
  };

  return (
    <Link
      to={`/issues/${issue.identifier ?? issue.id}`}
      className="flex items-start gap-2 py-2.5 pl-2 pr-3 text-sm border-b border-border last:border-b-0 cursor-pointer hover:bg-accent/50 transition-colors no-underline text-inherit sm:items-center sm:py-2 sm:pl-1"
    >
      {/* Status icon - left column on mobile, inline on desktop */}
      <span
        className="shrink-0 pt-px sm:hidden"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <StatusIcon status={issue.status} onChange={(s) => onUpdateIssue(issue.id, { status: s })} />
      </span>

      {/* Right column on mobile: title + metadata stacked */}
      <span className="flex min-w-0 flex-1 flex-col gap-1 sm:contents">
        {/* Title line */}
        <span className="line-clamp-2 text-sm sm:order-2 sm:flex-1 sm:min-w-0 sm:line-clamp-none sm:truncate">
          {issue.title}
        </span>

        {/* Metadata line */}
        <span className="flex items-center gap-2 sm:order-1 sm:shrink-0">
          {/* Spacer matching caret width so status icon aligns with group title (hidden on mobile) */}
          <span className="w-3.5 shrink-0 hidden sm:block" />
          <span className="hidden sm:inline-flex">
            <PriorityIcon priority={issue.priority} />
          </span>
          <span
            className="hidden shrink-0 sm:inline-flex"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <StatusIcon status={issue.status} onChange={(s) => onUpdateIssue(issue.id, { status: s })} />
          </span>
          <span className="text-xs text-muted-foreground font-mono shrink-0">
            {issue.identifier ?? issue.id.slice(0, 8)}
          </span>
          {liveIssueIds?.has(issue.id) && (
            <span className="inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 rounded-full bg-blue-500/10">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hidden sm:inline">Live</span>
            </span>
          )}
          <span className="text-xs text-muted-foreground sm:hidden">&middot;</span>
          <span className="text-xs text-muted-foreground sm:hidden">{timeAgo(issue.updatedAt)}</span>
        </span>
      </span>

      {/* Desktop-only trailing content */}
      <span className="hidden sm:flex sm:order-3 items-center gap-2 sm:gap-3 shrink-0 ml-auto">
        {(issue.labels ?? []).length > 0 && (
          <span className="hidden md:flex items-center gap-1 max-w-[240px] overflow-hidden">
            {(issue.labels ?? []).slice(0, 3).map((label) => (
              <span
                key={label.id}
                className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium"
                style={{
                  borderColor: label.color,
                  color: label.color,
                  backgroundColor: `${label.color}1f`,
                }}
              >
                {label.name}
              </span>
            ))}
            {(issue.labels ?? []).length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{(issue.labels ?? []).length - 3}</span>
            )}
          </span>
        )}
        <Popover
          open={assigneePickerIssueId === issue.id}
          onOpenChange={(open) => {
            setAssigneePickerIssueId(open ? issue.id : null);
            if (!open) setAssigneeSearch("");
          }}
        >
          <PopoverTrigger asChild>
            <button
              className="flex w-[180px] shrink-0 items-center rounded-md px-2 py-1 hover:bg-accent/50 transition-colors"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              {issue.assigneeAgentId && agentName(issue.assigneeAgentId) ? (
                <Identity name={agentName(issue.assigneeAgentId)!} size="sm" />
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/35 bg-muted/30">
                    <User className="h-3 w-3" />
                  </span>
                  负责人
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1" align="end" onClick={(e) => e.stopPropagation()} onPointerDownOutside={() => setAssigneeSearch("")}>
            <input
              className="w-full px-2 py-1.5 text-xs bg-transparent outline-none border-b border-border mb-1 placeholder:text-muted-foreground/50"
              placeholder="搜索智能体..."
              value={assigneeSearch}
              onChange={(e) => setAssigneeSearch(e.target.value)}
              autoFocus
            />
            <div className="max-h-48 overflow-y-auto overscroll-contain">
              <button
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                  !issue.assigneeAgentId && "bg-accent"
                )}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  assignIssue(issue.id, null);
                }}
              >
                未分配
              </button>
              {(agents ?? [])
                .filter((agent) => {
                  if (!assigneeSearch.trim()) return true;
                  const visibleName = cleanVisibleAgentName(agent.name);
                  return visibleName.toLowerCase().includes(assigneeSearch.toLowerCase());
                })
                .map((agent) => (
                  <button
                    key={agent.id}
                    className={cn(
                      "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 text-left",
                      issue.assigneeAgentId === agent.id && "bg-accent"
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      assignIssue(issue.id, agent.id);
                    }}
                  >
                    <Identity name={cleanVisibleAgentName(agent.name)} size="sm" className="min-w-0" />
                  </button>
                ))}
            </div>
          </PopoverContent>
        </Popover>
        <span className="text-xs text-muted-foreground">{formatDate(issue.createdAt)}</span>
      </span>
    </Link>
  );
}
