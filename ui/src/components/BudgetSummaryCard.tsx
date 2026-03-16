import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn, formatCents, relativeTime } from "../lib/utils";
import { Activity, AlertCircle, Ban, History } from "lucide-react";
import type { BudgetStatus, RecentCostEvent, BlockedRunSummary } from "@zephyr-nexus/shared";

interface BudgetSummaryCardProps {
  scope: "issue" | "agent";
  status: BudgetStatus;
  budgetCents?: number | null;
  spentCents?: number | null;
  recentEvents?: RecentCostEvent[];
  blockedRuns?: BlockedRunSummary[];
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

export function BudgetSummaryCard({
  scope,
  status,
  budgetCents,
  spentCents,
  recentEvents,
  blockedRuns,
  isLoading,
  error,
  className,
}: BudgetSummaryCardProps) {
  if (isLoading) {
    return (
      <Card className={cn("animate-pulse border-sidebar-border bg-sidebar-accent/10", className)}>
        <CardHeader className="pb-2">
          <div className="h-4 w-24 bg-muted rounded" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-8 w-32 bg-muted rounded" />
          <div className="h-2 w-full bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("border-destructive/30 bg-destructive/5", className)}>
        <CardContent className="p-4 flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>Error loading budget: {error}</span>
        </CardContent>
      </Card>
    );
  }

  if (status === "UNCONFIGURED") {
    return (
      <Card className={cn("border-dashed border-sidebar-border bg-transparent", className)}>
        <CardContent className="p-6 text-center space-y-2">
          <AlertCircle className="mx-auto h-5 w-5 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">No budget configured</p>
          <p className="text-xs text-muted-foreground/70 leading-relaxed">
            Configure a budget for this {scope === "issue" ? "issue" : "agent"} to track costs and prevent overruns.
          </p>
        </CardContent>
      </Card>
    );
  }

  const budget = budgetCents ?? 0;
  const spent = spentCents ?? 0;
  const hasBudget = budget > 0;
  const percent = hasBudget ? Math.min(100, (spent / budget) * 100) : 0;
  const isOver = status === "OVER_LIMIT";
  const isNear = hasBudget && percent >= 80 && !isOver;

  return (
    <Card className={cn("overflow-hidden border-sidebar-border bg-sidebar-accent/20", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" />
          {scope === "issue" ? "Issue Budget" : "Monthly Agent Budget"}
        </CardTitle>
        <Badge
          variant={isOver ? "destructive" : isNear ? "secondary" : "default"}
          className={cn(
            "text-[10px] uppercase font-bold px-1.5 h-4",
            isNear && "bg-amber-500/20 text-amber-600 border-amber-500/20",
            !isOver && !isNear && "bg-emerald-500/20 text-emerald-600 border-emerald-500/20"
          )}
        >
          {isOver ? "Over Limit" : isNear ? "Near Limit" : "Under Limit"}
        </Badge>
      </CardHeader>
      <CardContent className="pb-4 space-y-4">
        <div>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-2xl font-bold tracking-tight">
              {formatCents(spent)}
            </span>
            {hasBudget && (
              <span className="text-xs text-muted-foreground">
                / {formatCents(budget)}
              </span>
            )}
          </div>

          {hasBudget && (
            <div className="space-y-1.5">
              <Progress 
                value={percent} 
                className="h-1.5 bg-sidebar-accent"
                indicatorClassName={cn(
                  isOver ? "bg-destructive" : isNear ? "bg-amber-500" : "bg-primary"
                )}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                <span>{percent.toFixed(0)}% spent</span>
                <span>{formatCents(Math.max(0, budget - spent))} remaining</span>
              </div>
            </div>
          )}
        </div>

        {recentEvents && recentEvents.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
              <History className="h-3 w-3" />
              Recent Cost Events
            </h4>
            <div className="space-y-1">
              {recentEvents.map((evt) => (
                <div key={evt.id} className="flex items-center justify-between text-[10px] py-1 border-b border-sidebar-border/30 last:border-0">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{evt.model}</span>
                    <span className="opacity-60">{evt.adapter}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatCents(evt.costCents)}</div>
                    <div className="opacity-60">{relativeTime(evt.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {blockedRuns && blockedRuns.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase text-destructive flex items-center gap-1">
              <Ban className="h-3 w-3" />
              Blocked Runs
            </h4>
            <div className="rounded-md border border-destructive/20 bg-destructive/5 divide-y divide-destructive/10">
              {blockedRuns.map((run) => (
                <div key={run.id} className="p-2 text-[10px] flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-medium text-destructive">{run.agentName}</span>
                    <span className="opacity-70">{run.errorCode}</span>
                  </div>
                  <span className="opacity-60">{relativeTime(run.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {isOver && (
          <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-[11px] leading-tight mt-2">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Budget limit exceeded. Further execution is blocked until the budget is increased or reset.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

