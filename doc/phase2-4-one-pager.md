## Phase 2–4 一页版现状锚点

> 用来在每次开新一轮 patch / 新对话前快速对齐现状，详细版见：`doc/phase2-4-closing-summary.md`。

### 1. 本轮做了什么（极简版）

- **高成本触发治理**
  - 高成本 adapter（如 `openclaw_gateway`）的 **timer 默认拦截**，只有显式 opt-in 才会被 scheduler 唤醒。
  - 评论 @ 高成本 adapter：**单条评论最多 1 个**，超出部分不再 fan-out。
- **前台暴露收敛**
  - Agents 列表和 Org 视图：高成本 Agent 默认隐藏，需显式打开「显示高成本」开关。
- **上下文治理**
  - 注入上下文有硬上限：默认 `12000 chars / 8 snapshots`，超限会被裁剪并加「被截断」标记。
  - 上限可通过环境变量 `PAPERCLIP_MAX_CONTEXT_CHARS` / `PAPERCLIP_MAX_PRIOR_SNAPSHOTS` 调整。
- **成本可观测性 + 预算**
  - cost events 记录到 issue / project 维度。
  - per-agent monthly budget：超限后该 Agent run 会被阻断（`budget_exceeded`）。
  - per-issue budget：在 issue 的 `executionWorkspaceSettings.budgetCents` 上配置，超限 run 会被阻断（`issue_budget_exceeded`）。
- **review support 工具**
  - 脚本 `scripts/review-issue-budget.ts`：输入 issueId，一次性输出预算配置、成本归因、最近 run、guard 是否触发，以及 PASS / PARTIAL / FAIL 结论。

### 2. 当前默认行为（记住这些就够了）

- **高成本 timer**
  - 默认 **不跑**：高成本 adapter 的 timer 唤醒会被拦截，除非在 Agent 上显式允许。
- **评论 @ 高成本 Agent**
  - 单条评论只会真实触发 **1 个**高成本 Agent，其余高成本 mentions 会被忽略。
- **高成本 Agent 在 UI 中的展示**
  - Agents 列表 + Org 视图：默认隐藏高成本 Agent，需要显式打开「显示高成本 Agent」才会看到。
- **上下文注入**
  - 默认注入量：约 `12000` 字符 + `8` 条 diff snapshots，可以通过 env 放宽或收紧。
  - 超出时：上下文会被裁剪并附带清晰的“被截断”尾注。
- **per-issue budget**
  - 只有当 issue 的 `executionWorkspaceSettings.budgetCents` 为正整数时才启用。
  - spent 来自 `cost_events.issue_id` 聚合，是“全生命周期累计”，不是按月重置。

### 3. 目前不要做什么

- 不要在没有新数据的前提下，**重写 scheduler**、大改 Costs / Dashboard、或发起「全面 Agent 架构重构」。
- 不要轻易取消高成本 timer guard 或放松高成本 @mentions 限制，否则前面的护栏等于白做。
- 不要立刻设计复杂的父子 issue 预算继承 / 分摊模型，在没有实际压测和使用反馈前，那会是过度设计。

### 4. 下一轮只看哪 3 件事（优先级从高到低）

1. **给 per-issue budget 一个简单的 UI 视图（只读即可）**
   - 在 Issue 详情页展示：有没有预算、额度是多少、已经花了多少、当前是 UNDER / OVER LIMIT。
2. **在 Costs / Dashboard 做一个“问题 issue 列表”的轻量模块**
   - 列出：花费最多 / 接近预算 / 已触发 guard 的 issue，方便治理，而不必重写整套图表。
3. **在配置流上给 budgetCents 做基础校验 / 提示**
   - 至少避免把 `"100"`、负数当成“静默不生效”，用 warning 或前端校验把问题拦在入口。

