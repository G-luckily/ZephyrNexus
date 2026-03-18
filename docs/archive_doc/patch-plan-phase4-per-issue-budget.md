# Patch Plan: Phase 4 Per-Issue Budget 最小落地

> 基于 doc/per-issue-budget-design.md 方案 B，最小闭环、可回滚、充分留痕。不做法 D 父子分摊、不做大 schema 改造。

## 1. 本轮最小目标

- **issue 预算配置可读**：从 issue 现有可扩展结构（`executionWorkspaceSettings` jsonb）读取可选 `budgetCents`；未设则不启用 per-issue 预算。
- **issueId 进入成本链路**：run 执行后写 cost event 时带上 `issueId`（来自 run 的 contextSnapshot），使 per-issue spent 可聚合。
- **per-issue budget guard**：在 `executeRun` 调用 adapter 前，若该 run 关联的 issue 设置了 `budgetCents` 且该 issue 已累计花费 ≥ budget，则阻断执行并写入明确事件（errorCode `issue_budget_exceeded`、run event、日志）。
- **与 agent 月预算共存**：先检查 agent 月预算，再检查 issue 预算；顺序固定，不引入配置开关。

## 2. 不做的事情

- 不做父子 issue 预算继承/切片（方案 D）。
- 不做复杂预算继承链（方案 C 的“从 agent 默认继承”本期不实现，仅 issue 级配置）。
- 不做大 schema 改造（不新增表、不新增必填列；`cost_events.issue_id` 已存在）。
- 不做 per-issue 预算的 UI 编辑/统计大屏；不做 Costs 页改版。
- 不重写 scheduler、不做 comment 软确认、不扩展 OpenClaw office roles。

## 3. 数据流

```
Wakeup(w/ issueId) → Run(contextSnapshot.issueId) → executeRun
  → [1] agent 月预算检查
  → [2] issue 预算检查（若 issue 有 budgetCents）
       ← 读 issue.executionWorkspaceSettings.budgetCents
       ← costs.getSpentCentsForIssue(companyId, issueId)
  → [3] 执行 adapter
  → updateRuntimeState(agent, run, result)
       → 写 costEvents（带 issueId 来自 run.contextSnapshot）
       → 更新 agent.spentMonthlyCents
```

- **预算检查阶段**：`executeRun` 内，在 claim run 之后、调用 adapter 之前；与现有 agent 月预算检查同一位置顺序（先 agent 后 issue）。
- **issueId 来源**：run 创建时由 wakeup 上下文写入 `contextSnapshot.issueId`；执行时从 `parseObject(run.contextSnapshot).issueId` 读取；写 cost event 时从同一 run 的 contextSnapshot 取出传入。

## 4. 预算检查发生位置

- **函数**：`server/src/services/heartbeat.ts` 内 `executeRun`。
- **阶段**：在“agent 月预算检查”之后、`ensureRuntimeState` / 解析 workspace / 调用 adapter 之前。
- **逻辑**：若 `context.issueId` 存在，则查 issue 行取 `executionWorkspaceSettings`；若存在且 `budgetCents` 为正数，则调用 `getSpentCentsForIssue(companyId, issueId)`；若 `spent >= budgetCents`，则 `setRunStatus(runId, "failed", { error, errorCode: "issue_budget_exceeded" })`，并写 run event、release issue lock、startNextQueuedRun，与 agent 月预算失败路径一致。

## 5. issueId 进入 cost event / run usage 链路

| 环节 | 当前 | 本轮改动 |
|------|------|----------|
| Run 关联 issue | 已有：`contextSnapshot.issueId` 来自 wakeup | 无变更 |
| 写 cost event | 未传 `issueId` | 在 `updateRuntimeState` 插入 `costEvents` 时从 `run.contextSnapshot` 解析 `issueId`（及可选 `projectId`）写入 |
| 按 issue 聚合 spent | 无 | 新增 `costs.getSpentCentsForIssue(companyId, issueId)`：`sum(costCents)` where `companyId` and `issueId` |

- **heartbeat_runs** 表无 `issue_id` 列，不落库；issue 关联仅通过 `contextSnapshot.issueId` 维持，与现有设计一致。
- **cost_events** 表已有 `issue_id` 列（nullable），仅补齐写入；历史事件 `issue_id` 仍为 null，不影响既有聚合。

## 6. 涉及文件

| 文件 | 修改目的 | 风险 |
|------|----------|------|
| `server/src/services/heartbeat.ts` | ① updateRuntimeState 写 cost event 时带 issueId、projectId（来自 run.contextSnapshot）；② executeRun 中在 agent 预算检查后、解析 workspace 前增加 issue 预算检查，超限则 failed + issue_budget_exceeded + run event | 低 |
| `server/src/services/costs.ts` | 新增 `getSpentCentsForIssue(companyId, issueId)`，按 issueId 聚合 costEvents.costCents | 低 |
| `doc/patch-plan-phase4-per-issue-budget.md` | 本 patch plan | - |
| `doc/per-issue-budget-design.md` | 标注“方案 B 已按本 patch plan 最小落地” | - |

## 7. 风险

- **并发**：同一 issue 多 run 同时完成时，spent 为读时聚合，可能略超 budget（与 agent 月预算类似）；可接受则不做 issue 级锁。
- **历史 cost 无 issueId**：旧事件 `issue_id` 为 null，仅新产生事件带 issueId；per-issue spent 为“自本轮上线后该 issue 的累计”，不包含历史。若需包含历史，需后续一次性用 run→contextSnapshot 反写（本期不做）。
- **executionWorkspaceSettings 约定**：`budgetCents` 为可选数字（整数 cents）；非法值视为未设置，不抛错。

## 8. 回滚方式

- **关闭 guard**：不设 issue 的 `executionWorkspaceSettings.budgetCents` 即可，无需改代码。
- **代码回滚**：移除 executeRun 中 issue 预算检查分支；updateRuntimeState 中 cost 插入去掉 issueId（或保留，仅停用 guard）。不删 cost_events.issue_id 列。

## 9. 验收方式

- 为某 issue 设置 `executionWorkspaceSettings.budgetCents`（如 100），触发该 issue 的 run 直至该 issue 的 costEvents 合计 ≥ 100，下一次 run 应被拒绝并得到 `errorCode: "issue_budget_exceeded"`，run 状态为 failed，run event 可查。
- 新产生的 cost event 行带 `issue_id`；对同一 issue 调用 `getSpentCentsForIssue` 与 sum(costCents) 一致。
- 未设置 budgetCents 的 issue 行为与改动前一致；agent 月预算逻辑不变。
