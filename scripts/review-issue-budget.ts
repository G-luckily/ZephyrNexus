import { and, desc, eq, sql } from "drizzle-orm";
import {
  createDb,
  type Db,
  issues,
  costEvents,
  heartbeatRuns,
} from "@zephyr-nexus/db";
import { costService } from "../server/src/services/costs.js";

interface ParsedArgs {
  issueId: string | null;
  companyId: string | null;
}

function parseArgs(argv: string[]): ParsedArgs {
  let issueId: string | null = null;
  let companyId: string | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--issue" || arg === "--issueId") {
      issueId = argv[i + 1] ?? null;
    }
    if (arg === "--company" || arg === "--companyId") {
      companyId = argv[i + 1] ?? null;
    }
  }

  return { issueId, companyId };
}

async function resolveIssue(db: Db, issueId: string, companyIdHint: string | null) {
  const rows = await db
    .select()
    .from(issues)
    .where(
      companyIdHint
        ? and(eq(issues.id, issueId), eq(issues.companyId, companyIdHint))
        : eq(issues.id, issueId),
    )
    .limit(1);

  return rows[0] ?? null;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("FAIL: DATABASE_URL is required to run this script.");
    process.exit(1);
  }

  const { issueId, companyId: companyIdFromArgs } = parseArgs(process.argv.slice(2));

  if (!issueId) {
    console.error("Usage: pnpm tsx scripts/review-issue-budget.ts --issue <issueId> [--company <companyId>]");
    process.exit(1);
  }

  const db = createDb(dbUrl);
  const costs = costService(db);

  console.log("=== Per-Issue Budget Review ===");
  console.log("");

  // 1) 基础信息
  const issue = await resolveIssue(db, issueId, companyIdFromArgs);
  if (!issue) {
    console.log("1) 基础信息");
    console.log(`- Issue ID: ${issueId}`);
    if (companyIdFromArgs) {
      console.log(`- Company ID (hint): ${companyIdFromArgs}`);
    }
    console.log("  -> PASS: 查询执行");
    console.log("  -> FAIL: 未找到对应 issue（请确认 issueId 是否正确，或是否属于当前数据库环境）。");
    console.log("");
    console.log("Overall review result: FAIL");
    console.log("Reason: Issue not found in database.");
    process.exit(0);
  }

  const companyId = issue.companyId;
  const rawSettings = (issue.executionWorkspaceSettings ?? null) as Record<string, unknown> | null;
  const budgetValue =
    rawSettings && typeof rawSettings.budgetCents === "number"
      ? Math.max(0, Math.floor(rawSettings.budgetCents))
      : null;

  console.log("1) 基础信息");
  console.log(`- Issue ID: ${issueId}`);
  console.log(`- Company ID: ${companyId}`);
  console.log(`- executionWorkspaceSettings: ${rawSettings ? JSON.stringify(rawSettings) : "null"}`);
  if (budgetValue !== null && budgetValue > 0) {
    console.log(`- budgetCents: ${budgetValue}`);
    console.log("  -> Budget configured: PASS");
  } else {
    console.log("- budgetCents: (not configured or invalid)");
    console.log("  -> Budget configured: FAIL (not configured as positive integer cents)");
  }
  console.log("");

  // 2) 成本归因检查
  console.log("2) 成本归因检查");
  const costRows = await db
    .select({
      id: costEvents.id,
      costCents: costEvents.costCents,
      provider: costEvents.provider,
      model: costEvents.model,
      occurredAt: costEvents.occurredAt,
    })
    .from(costEvents)
    .where(and(eq(costEvents.companyId, companyId), eq(costEvents.issueId, issueId)))
    .orderBy(desc(costEvents.occurredAt))
    .limit(5);

  if (costRows.length > 0) {
    console.log("- Issue cost events found: PASS");
  } else {
    console.log("- Issue cost events found: FAIL (no cost_events rows with this issueId)");
  }

  if (costRows.length > 0) {
    console.log("  Recent cost events (up to 5):");
    for (const row of costRows) {
      console.log(
        `  - id=${row.id} | costCents=${row.costCents} | provider=${row.provider} | model=${row.model} | at=${row.occurredAt?.toISOString?.() ?? row.occurredAt}`,
      );
    }
  }

  let spentCents: number | null = null;
  let spentPass = false;
  try {
    spentCents = await costs.getSpentCentsForIssue(companyId, issueId);
    console.log(`- Issue spent (cents): ${spentCents}`);
    console.log("  -> Issue spent computed: PASS");
    spentPass = true;
  } catch (err) {
    console.log("- Issue spent (cents): <error computing>");
    console.log("  -> Issue spent computed: FAIL (costService.getSpentCentsForIssue threw error)");
  }
  console.log("");

  // 3) 预算状态检查
  console.log("3) 预算状态检查");
  if (budgetValue === null || budgetValue <= 0) {
    console.log("- Budget configured: FAIL (not configured)");
    console.log("- Budget status: N/A");
  } else if (spentCents === null || !spentPass) {
    console.log("- Budget configured: PASS");
    console.log("- Budget status: UNKNOWN (failed to compute spent)");
  } else {
    console.log("- Budget configured: PASS");
    if (spentCents >= budgetValue) {
      console.log(`- Budget status: OVER_LIMIT (${spentCents}/${budgetValue} cents)`);
    } else {
      console.log(`- Budget status: UNDER_LIMIT (${spentCents}/${budgetValue} cents)`);
    }
  }
  console.log("");

  // 4) 最近运行结果检查
  console.log("4) 最近运行结果检查");
  // 按 contextSnapshot.issueId 关联 issue；如果 schema 或数据有限，可能部分 run 查不到。
  const issueIdAsText = sql<string>`${issueId}`;
  const runs = await db
    .select({
      id: heartbeatRuns.id,
      status: heartbeatRuns.status,
      errorCode: heartbeatRuns.errorCode,
      updatedAt: heartbeatRuns.updatedAt,
    })
    .from(heartbeatRuns)
    .where(
      and(
        eq(heartbeatRuns.companyId, companyId),
        sql`${heartbeatRuns.contextSnapshot} ->> 'issueId' = ${issueIdAsText}`,
      ),
    )
    .orderBy(desc(heartbeatRuns.updatedAt))
    .limit(5);

  if (runs.length === 0) {
    console.log("- Related runs found: FAIL (no heartbeat_runs rows linked via contextSnapshot.issueId)");
    console.log("  Note: Issue and run association may be limited for older data or special workflows.");
  } else {
    console.log("- Related runs found: PASS");
    console.log("  Recent runs (up to 5):");
    for (const run of runs) {
      console.log(
        `  - id=${run.id} | status=${run.status} | errorCode=${run.errorCode ?? "null"} | updatedAt=${run.updatedAt?.toISOString?.() ?? run.updatedAt}`,
      );
    }
  }

  const hasBudgetGuardRun = runs.some((run) => run.errorCode === "issue_budget_exceeded");
  if (hasBudgetGuardRun) {
    console.log("- Budget guard triggered before: PASS (found run with errorCode=issue_budget_exceeded)");
  } else {
    console.log("- Budget guard triggered before: FAIL (no run with errorCode=issue_budget_exceeded in recent history)");
  }
  console.log("");

  // 5) 最终结论
  console.log("5) 最终结论");
  let overall: "PASS" | "PARTIAL" | "FAIL" = "FAIL";
  const reasons: string[] = [];

  const hasBudgetConfigured = budgetValue !== null && budgetValue > 0;
  const hasCostEvents = costRows.length > 0;

  if (!hasBudgetConfigured) {
    reasons.push("预算未配置（executionWorkspaceSettings.budgetCents 未设置为正整数）。");
  }
  if (!hasCostEvents) {
    reasons.push("找不到带该 issueId 的 cost_events 记录。");
  }
  if (!spentPass) {
    reasons.push("无法计算该 issue 的累计 spent。");
  }

  if (hasBudgetConfigured && spentPass && hasCostEvents && hasBudgetGuardRun) {
    overall = "PASS";
    reasons.push("预算已配置，成本已归因，可计算 spent，且已有 issue_budget_exceeded 的阻断记录。");
  } else if (hasBudgetConfigured && spentPass && hasCostEvents) {
    overall = "PARTIAL";
    if (!hasBudgetGuardRun) {
      reasons.push("预算已配置且可计算 spent，但尚未观察到带 issue_budget_exceeded 的阻断 run。");
    }
  } else {
    overall = "FAIL";
  }

  console.log(`Overall review result: ${overall}`);
  for (const reason of reasons) {
    console.log(`- ${reason}`);
  }

  // 明确提示这是 review helper，而不是业务逻辑。
  console.log("");
  console.log("Note: This script is a review helper only. It does not change any business logic.");
}

void main();

