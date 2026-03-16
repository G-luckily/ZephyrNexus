# Per-Issue Budget 最小设计

> 方案 B 已按 **doc/patch-plan-phase4-per-issue-budget.md** 最小落地。本文保留设计背景与方案对比；实现细节与验收见 patch plan。

## 1. 背景

- 当前仅有 **per-agent monthly budget**（`agents.budgetMonthlyCents` / `spentMonthlyCents`），超限后该 Agent 所有 run 被阻断。
- 需求：对**单个 issue** 设置预算上限，该 issue 上所有相关 run 的累计成本超限后，不再为该 issue 触发新的 run（燃尽即停）。
- 约束：不大改 schema、不重写 scheduler、兼容现有 guard，并为将来「父 issue 预算向子 issue 切片」留扩展点。

## 2. 设计目标

- **单 issue 预算**：可为 issue 设置 `budgetCents`（或等效），该 issue 维度累计花费达上限后停止唤醒/执行。
- **与 agent 预算共存**：先检查 agent 月预算，再检查 issue 预算（或反之，可配置顺序）。
- **可继承/可覆盖**：支持从 agent 默认或 policy 继承，再被 issue 级配置覆盖。
- **子 issue 预留**：设计上允许后续「父 issue 预算向子 issue 分配/切片」，本期可不实现具体分配逻辑。

## 3. 候选方案对比

| 维度 | 方案 A：直接存在 issue 字段上 | 方案 B：存在 issue metadata / config json | 方案 C：从 agent/default policy 继承，再被 issue 覆盖 | 方案 D：父 issue 预算向子 issue 传播/切片 |
|------|------------------------------|------------------------------------------|------------------------------------------------------|------------------------------------------|
| **存储** | `issues` 表新增 `budget_issue_cents`、`spent_issue_cents`（或仅 budget，spent 从 costEvents 聚合） | `issues` 表已有或新增 jsonb（如 `executionWorkspaceSettings` 或 `metadata`）内存 `budgetCents`；spent 聚合 | 继承链：company/agent 默认 → issue 覆盖；issue 存「覆盖值」或沿用 A/B | 父 issue 存总预算；子 issue 存「分配到的切片」或从父按规则计算 |
| **Migration** | 需加 1～2 列，可 nullable + default 0 | 若用现有 jsonb 则无 schema 变更；若新加 metadata 则 1 列 | 同 A 或 B，取决于 issue 层存法 | 需 parent 关联与分配规则，改动最大 |
| **查询/熔断** | 简单：读 issue 行即可 | 需解析 json + 聚合 spent | 需解析继承链再取最终 budget；spent 聚合 | 需递归父子与切片计算 |
| **与现有 agent 月预算** | 兼容：heartbeat 内先查 agent 预算再查 issue 预算 | 同左 | 兼容，且可「未设 issue 则用 agent 默认」 | 兼容，但逻辑最复杂 |
| **子 issue 扩展** | 后续可加 parent 关联与分配逻辑 | 同左 | 同左；继承链可含「从父继承」 | 直接支持，但本期实现成本高 |

## 4. 推荐方案

- **短期**：**方案 B（issue metadata/config json）**  
  - 在现有 `issues` 的 jsonb（如 `executionWorkspaceSettings` 或单独 `metadata`）中存 `budgetCents`（可选）。  
  - spent 不存 issue 表，由 **costEvents + heartbeatRuns 关联到 issue** 聚合得到（与现有 by-agent 聚合类似）。  
  - 优点：无 schema 变更（若复用现有 jsonb）；实现快；易回滚。  
  - 缺点：json 内数字需约定校验；按 issue 聚合 cost 需确认现有 costEvents 是否带 issueId（或通过 run → wakeup → issue 反查）。

- **若必须显式列**：退而用 **方案 A**，`issues` 表仅加 `budget_issue_cents integer default null`，null 表示「不启用 per-issue 预算」；spent 仍聚合。  

- **方案 C** 作为「行为语义」：熔断时 budget 取值顺序为「issue 覆盖 > agent 默认 > 无限制」；存储仍可用 B 或 A。  

- **方案 D** 本期只做文档预留，不实现父→子切片。

## 5. 需要改动的文件（按方案 B 假设）

- **后端**
  - `server/src/services/heartbeat.ts`：在执行/唤醒前，若 issue 有 `budgetCents`，则聚合该 issue 当前 spent；若 `spent >= budgetCents`，则跳过并写 `skippedRequest`（如 `issue_budget_exceeded`）。
  - `server/src/services/costs.ts`（或新 helper）：按 issue 聚合已花费（从 costEvents 经 run → issue 关联）；可复用现有 cost 查询路径，按 issueId 过滤。
  - `packages/db`：仅当采用新 jsonb 列时增加 `metadata` 或扩展现有 jsonb 类型定义；否则无需改 schema。
- **前端**
  - Issue 编辑/详情：可选展示「Issue 预算」与已用额（只读），编辑入口可后续加。
- **类型/校验**
  - 若用 jsonb：在 shared 或 server 中约定 `issueBudgetCents?: number` 的校验与默认值。

## 6. 风险点

- **costEvents 与 issue 的关联**：当前 costEvents 可能只挂到 agent/run，需确认 run 是否稳定关联 issue（wakeup 上下文）；否则需在写 cost event 时带 issueId 或通过 run 反查。
- **并发**：同一 issue 多 run 同时完成时，spent 聚合可能存在竞态；可接受「略超预算」则用读时聚合，否则需 issue 级锁或乐观扣减。
- **子 issue**：若未来做父→子切片，需约定「子 issue 花费是否从父 budget 扣」「父 budget 用尽是否阻断所有子」等，本期不拍板。

## 7. 待拍板点

- **存储**：最终采用方案 A（显式列）还是 B（jsonb）？若 B，用现有哪一列（如 `executionWorkspaceSettings`）还是新加 `metadata`？
- **spent 来源**：是否在 cost event 写入时即带 `issueId`（需 schema/写入路径改动），还是仅通过 run → wakeup → issue 反查聚合？
- **与 agent 月预算顺序**：先检查 agent 月预算再 issue，还是先 issue 再 agent？建议先 agent 再 issue，与现有逻辑一致。
- **Org 视图高成本过滤**：是否全局默认启用「隐藏高成本」？（本次已实现与 list 一致，默认隐藏；若需全局默认可再调。）

---

## 8. 落地状态（Phase 4）

- **存储**：采用方案 B，`budgetCents` 存在 issue 的 `executionWorkspaceSettings`（jsonb），无 schema 变更。
- **issueId 链路**：run 的 `contextSnapshot.issueId` 在写 cost event 时传入 `cost_events.issue_id`；`costs.getSpentCentsForIssue(companyId, issueId)` 用于按 issue 聚合。
- **Guard**：`executeRun` 内先 agent 月预算再 issue 预算；超限时 `errorCode: "issue_budget_exceeded"`，run event 留痕。
- **未做**：父子 issue 分摊、复杂继承、UI 编辑、统计大屏。详见 **doc/patch-plan-phase4-per-issue-budget.md**。
