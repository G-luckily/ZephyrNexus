import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { costsApi, type CostByProject } from "../api/costs";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { formatCents, formatTokens, cn } from "../lib/utils";
import { Identity } from "../components/Identity";
import { StatusBadge } from "../components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, AlertTriangle, ArrowRight } from "lucide-react";
import { Link } from "@/lib/router";
import { Badge } from "@/components/ui/badge";
import { type IssueBudgetSummary, type CostByAgent, type BlockedRunSummary } from "@zephyr-nexus/shared";

type DatePreset = "mtd" | "7d" | "30d" | "ytd" | "all" | "custom";

const PRESET_LABELS: Record<DatePreset, string> = {
  mtd: "Month to Date",
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  ytd: "Year to Date",
  all: "All Time",
  custom: "Custom",
};

function computeRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  switch (preset) {
    case "mtd": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: d.toISOString(), to };
    }
    case "7d": {
      const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { from: d.toISOString(), to };
    }
    case "30d": {
      const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { from: d.toISOString(), to };
    }
    case "ytd": {
      const d = new Date(now.getFullYear(), 0, 1);
      return { from: d.toISOString(), to };
    }
    case "all":
      return { from: "", to: "" };
    case "custom":
      return { from: "", to: "" };
  }
}

export function Costs() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  const [preset, setPreset] = useState<DatePreset>("mtd");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  useEffect(() => {
    setBreadcrumbs([{ label: "成本" }]);
  }, [setBreadcrumbs]);

  const { from, to } = useMemo(() => {
    if (preset === "custom") {
      return {
        from: customFrom ? new Date(customFrom).toISOString() : "",
        to: customTo ? new Date(customTo + "T23:59:59.999Z").toISOString() : "",
      };
    }
    return computeRange(preset);
  }, [preset, customFrom, customTo]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.costs(
      selectedCompanyId!,
      from || undefined,
      to || undefined
    ),
    queryFn: async () => {
      const [summary, byAgent, byProject, overshooting] = await Promise.all([
        costsApi.summary(
          selectedCompanyId!,
          from || undefined,
          to || undefined
        ),
        costsApi.byAgent(
          selectedCompanyId!,
          from || undefined,
          to || undefined
        ),
        costsApi.byProject(
          selectedCompanyId!,
          from || undefined,
          to || undefined
        ),
        issuesApi.overshootingIssues(selectedCompanyId!),
      ]);
      return { summary, byAgent, byProject, overshooting };
    },
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) {
    return (
      <EmptyState icon={DollarSign} message="Select a company to view costs." />
    );
  }

  if (isLoading) {
    return <PageSkeleton variant="costs" />;
  }

  const presetKeys: DatePreset[] = ["mtd", "7d", "30d", "ytd", "all", "custom"];

  return (
    <div className="space-y-6">
      {/* Date range selector */}
      <div className="flex flex-wrap items-center gap-2">
        {presetKeys.map((p) => (
          <Button
            key={p}
            variant={preset === p ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPreset(p)}
          >
            {PRESET_LABELS[p]}
          </Button>
        ))}
        {preset === "custom" && (
          <div className="flex items-center gap-2 ml-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            />
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {data && (
        <>
          {/* Summary card */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {PRESET_LABELS[preset]}
                </p>
                {data.summary.budgetCents > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {data.summary.utilizationPercent}% utilized
                  </p>
                )}
              </div>
              <p className="text-2xl font-bold">
                {formatCents(data.summary.spendCents)}{" "}
                <span className="text-base font-normal text-muted-foreground">
                  {data.summary.budgetCents > 0
                    ? `/ ${formatCents(data.summary.budgetCents)}`
                    : "Unlimited budget"}
                </span>
              </p>
              {data.summary.budgetCents > 0 && (
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-[width,background-color] duration-150 ${
                      data.summary.utilizationPercent > 90
                        ? "bg-red-400"
                        : data.summary.utilizationPercent > 70
                        ? "bg-yellow-400"
                        : "bg-green-400"
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        data.summary.utilizationPercent
                      )}%`,
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Overshooting Issues */}
          {data.overshooting && data.overshooting.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <h3 className="text-sm font-semibold">预算超支最显著任务 (Top Overshooting Issues)</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.overshooting.map((issue: IssueBudgetSummary) => {
                  const exceededCents = issue.spentCents - issue.budgetCents;
                  const percent = issue.budgetCents > 0 ? Math.round((issue.spentCents / issue.budgetCents) * 100) : 0;
                  return (
                    <Card key={issue.issueId} className="border-destructive/20 bg-destructive/5 overflow-hidden">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0 flex-1">
                            <Link 
                              to={`/issues/${issue.issueIdentifier ?? issue.issueId}`}
                              className="text-xs font-bold truncate hover:underline block text-destructive"
                            >
                              {issue.issueIdentifier ? `[${issue.issueIdentifier}] ` : ""}{issue.issueTitle}
                            </Link>
                          </div>
                          <Badge variant="outline" className="text-[10px] h-4 border-destructive/30 text-destructive shrink-0">
                            {percent}%
                          </Badge>
                        </div>
                        <div className="flex items-end justify-between">
                          <div className="space-y-0.5">
                            <p className="text-[10px] text-destructive/70 uppercase font-mono">Cost Exceeded</p>
                            <p className="text-lg font-bold text-destructive leading-tight">
                              +{formatCents(exceededCents)}
                            </p>
                          </div>
                          <Link 
                            to={`/issues/${issue.issueIdentifier ?? issue.issueId}`}
                            className="text-[10px] flex items-center gap-0.5 text-destructive/80 hover:text-destructive no-underline"
                          >
                            Details <ArrowRight className="h-2.5 w-2.5" />
                          </Link>
                        </div>
                        <div className="w-full h-1 bg-destructive/20 rounded-full overflow-hidden">
                          <div className="h-full bg-destructive w-full" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}


          {/* By Agent / By Project */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">By Agent</h3>
                {data.byAgent.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No cost events yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.byAgent.map((row: CostByAgent) => (
                      <div
                        key={row.agentId}
                        className="flex items-start justify-between text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Identity
                            name={row.agentName ?? row.agentId}
                            size="sm"
                          />
                          {row.agentStatus === "terminated" && (
                            <StatusBadge status="terminated" />
                          )}
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className="font-medium block">
                            {formatCents(row.costCents)}
                          </span>
                          <span className="text-xs text-muted-foreground block">
                            in {formatTokens(row.inputTokens)} / out{" "}
                            {formatTokens(row.outputTokens)} tok
                          </span>
                          {(row.apiRunCount > 0 ||
                            row.subscriptionRunCount > 0) && (
                            <span className="text-xs text-muted-foreground block">
                              {row.apiRunCount > 0
                                ? `api runs: ${row.apiRunCount}`
                                : null}
                              {row.apiRunCount > 0 &&
                              row.subscriptionRunCount > 0
                                ? " | "
                                : null}
                              {row.subscriptionRunCount > 0
                                ? `subscription runs: ${
                                    row.subscriptionRunCount
                                  } (${formatTokens(
                                    row.subscriptionInputTokens
                                  )} in / ${formatTokens(
                                    row.subscriptionOutputTokens
                                  )} out tok)`
                                : null}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">By Project</h3>
                {data.byProject.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No project-attributed run costs yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.byProject.map((row: CostByProject) => (
                      <div
                        key={row.projectId ?? "na"}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="truncate">
                          {row.projectName ?? row.projectId ?? "Unattributed"}
                        </span>
                        <span className="font-medium">
                          {formatCents(row.costCents)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
