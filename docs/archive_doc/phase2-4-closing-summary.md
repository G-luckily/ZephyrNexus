## 1. 本轮目标回顾

- **我们最初想解决什么问题**
  - 高成本 Agent（尤其是 OpenClaw gateway）在没有清晰护栏的前提下，容易被 timer、评论 @、Org 视图扩散，造成不可控的成本和噪音。
  - 上下文注入容易“无限膨胀”，既烧 token 又拖垮模型效果。
  - 成本数据虽然已经有事件和 UI，但在「per-issue」这一层缺乏明确的预算和观测能力。
- **为什么先做 guardrails 而不是继续扩功能**
  - 在多 Agent、多上下文的系统里，功能越多、风险越大，如果没有基础护栏，任何新功能都会放大成本和混乱。
  - 这一轮的主线就是：**先把护栏立住，再考虑扩能**，优先确保：
    - 高成本路径默认安全（“不开门不会自己烧钱”）。
    - 入口收敛（UI 上不鼓励误触高成本 Agent）。
    - 上下文、预算、成本都有最小可观测和熔断能力。

---

## 2. 已完成项总表

### 2.1 高成本触发治理

- **高成本 adapter 的 timer 默认拦截**
  - 对标：`openclaw_gateway` 这类高成本 adapter。
  - 行为：当 `source = "timer"` 且 adapter 为高成本、且未显式 opt-in 时，直接跳过，不发起调用，并写入 “timer 被默认拦截” 的 skipped 记录。
  - 目的：防止高成本 Agent 被 scheduler 当成“心跳任务”长期开火。
- **高成本 comment mentions fan-out 限制**
  - 行为：单条评论中，高成本 adapter 的 @mention 上限为 **1 个**；超出部分不再触发 run，并在日志中留下说明。
  - 目的：避免“一条评论点燃一片高成本 Agent”。

### 2.2 前台暴露收敛

- **Agents 列表默认隐藏高成本 Agent**
  - 行为：列表视图中，高成本 adapter 默认不展示；用户需要显式打开「显示高成本 Agent」开关才会看到。
- **Org 视图与 list 视图一致**
  - 行为：Org 树中，同样根据 `costTier === "high"`，在默认状态下隐藏高成本节点，与列表视图共用同一隐藏开关。
  - 目的：避免 Org 结构把所有高成本 Agent “一览无遗” 暴露出来，降低误触概率。

### 2.3 上下文治理

- **上下文注入上限（chars + snapshots）**
  - 行为：对注入模型的 `paperclipContextBlock` 设置：
    - 最大字符数：默认 `12000` chars。
    - 历史快照上限：默认 `8` 条 prior snapshots。
  - 逻辑：
    - 先由 context-manager 根据上限裁剪 recent changes / snapshots。
    - 序列化后如仍超限，再做尾部截断并追加明确标记（`[... context truncated by size limit ...]`），同时写 debug 日志。
- **上下文上限可配置**
  - 环境变量：
    - `PAPERCLIP_MAX_CONTEXT_CHARS`（默认 12000，设为正整数，有最大安全上限）。
    - `PAPERCLIP_MAX_PRIOR_SNAPSHOTS`（默认 8，同样有安全上限）。
  - 缺失时自动回退到默认值，保持原有行为不变。

### 2.4 成本可观测性

- **cost events 与 run usage 对齐**
  - 每次 adapter 调用完成后，会写入 `cost_events`，记录：
    - company / agent /（本轮补齐）issue / project
    - provider / model
    - inputTokens / outputTokens / costCents
  - 成本页面已有「按 Agent」「按 Model」「按 Project」的汇总视图，本轮在后端确保 provider / model / usageJson 的写入稳定。
- **per-agent monthly budget guard**
  - 行为：当 agent 的 `spentMonthlyCents >= budgetMonthlyCents` 时，后续 run 会被直接阻断，run 标记为 failed，errorCode 为 `budget_exceeded`，并写入 run event。
  - 目的：为每个 Agent 提供一条硬成本上限。

### 2.5 per-issue budget

- **预算配置存放位置**
  - 使用 issue 的 `executionWorkspaceSettings`（jsonb）中的 `budgetCents` 字段，表示该 issue 级别的预算上限（单位为 cents）。
  - 不改 schema：不新增 issues 表列，直接复用现有可扩展结构。
- **issue 级成本归因与聚合**
  - 在写 `cost_events` 时，从 run 的 contextSnapshot 中读取 `issueId` / `projectId`，填入 `cost_events.issue_id` / `project_id`。
  - 新增服务接口 `getSpentCentsForIssue(companyId, issueId)`，按 `cost_events.company_id + issue_id` 聚合 sum(costCents)。
- **per-issue budget guard**
  - 行为：
    - 在 `executeRun` 内，先检查 agent 月预算（已存在逻辑），再检查 issue 预算。
    - 若该 issue 的 `executionWorkspaceSettings.budgetCents` 为正整数，且按 cost events 计算的 issue spent ≥ budgetCents，则：
      - 本次 run 直接标记 failed，`errorCode = "issue_budget_exceeded"`。
      - wakeup 也标记 failed，并带相同 error。
      - 写 run event，message 为「run blocked by issue budget guard」，payload 中带 `budgetCents / spent / issueId`。
      - 释放 issue 执行锁，继续调度后续 run。

### 2.6 review support 工具

- **临时验收脚本：`scripts/review-issue-budget.ts`**
  - 用途：在不翻 SQL、不理解 schema 的前提下，通过一条命令完成对单个 issue 的 per-issue budget 路径验收。
  - 输入：`issueId`（可选 companyId）。
  - 输出：
    - 基础信息：issueId / companyId / executionWorkspaceSettings / budgetCents。
    - 成本归因：是否有 cost_events 记录、最近 5 条事件摘要、累计 spent（复用 `getSpentCentsForIssue`）。
    - 预算状态：UNDER_LIMIT / OVER_LIMIT / 未配置 / 不可计算。
    - 最近 run：最近 5 条与该 issue 关联的 run 摘要，是否出现 `issue_budget_exceeded`。
    - 综合结论：Overall review result = PASS / PARTIAL / FAIL，附中文原因说明。

---

## 3. 当前默认行为（非常重要）

### 3.1 高成本 adapter 的 timer 默认处理方式

- 针对高成本 adapter（如 `openclaw_gateway`）：
  - 当 wakeup 的 `source = "timer"` 时：
    - 默认：**直接拦截，不触发 run**。
    - 只有在 Agent 配置中显式开启 opt-in（`allowTimerForHighCostAdapter = true`）时，才允许 timer 唤醒。
  - 目的：防止 scheduler 把高成本 Agent 当成心跳守护进程，长期自动消耗。

### 3.2 comment mention 对高成本 adapter 的限制

- 单条评论中：
  - 高成本 adapter 的 @mention 上限为 **1 个**。
  - 超过的高成本 @mention 将被静默忽略（不触发 run），但在日志中会留有“高成本 mentions 被限制”的记录。
- 普通成本的 adapter 不受此限制。

### 3.3 Org / list 对高成本 Agent 的默认显示策略

- **列表视图**
  - 默认行为：不展示高成本 Agent。
  - 用户可以在 Filters 中显式打开「显示高成本 Agent」开关。
- **Org 视图**
  - 默认行为：同样根据 `costTier === "high"` 隐藏高成本节点。
  - 与列表视图共用同一开关，即：打开或关闭“高成本显示”时，两个视图表现一致。
- 效果：高成本 Agent 不会在 UI 中“无脑暴露”，需要有意识地打开才能看到和使用。

### 3.4 context 上限的默认值与环境变量

- 默认值：
  - `PAPERCLIP_MAX_CONTEXT_CHARS` 默认 `12000`。
  - `PAPERCLIP_MAX_PRIOR_SNAPSHOTS` 默认 `8`。
- 行为：
  - 首先由 context-manager 在构造 context block 时，按 `maxLength` / `maxSnapshots` 裁剪。
  - 若最终序列化后的文本仍超出 `maxLength`，则再做二次截断，并追加明确说明文本：
    - `[..., context truncated by size limit ...]`
  - 同时写 debug 日志，便于后续调优。
- 不配置环境变量时，自动回退默认值，不改变当前行为。

### 3.5 per-issue budget 的当前规则

- 预算配置：
  - 存在 issue 的 `executionWorkspaceSettings` 中，以 `budgetCents` 字段表示。
  - 仅当 `budgetCents` 为**正整数**时，才视为“启用 per-issue budget guard”。
- 成本统计：
  - 通过 `cost_events` 中的 `issue_id` 聚合 `costCents`，得到该 issue 的累计 spent（单位 cents）。
  - 使用 `getSpentCentsForIssue(companyId, issueId)` 封装查询。
- Guard 顺序：
  - 先检查 per-agent monthly budget。
  - 若通过，再检查 per-issue budget：
    - 若 `spent >= budgetCents`，则本次 run 直接失败，`errorCode = "issue_budget_exceeded"`。
    - 若 `spent < budgetCents`，则照常执行。

### 3.6 review 脚本的用途

- 脚本：`scripts/review-issue-budget.ts`
- 目的：
  - 面向「产品 / PM / 审查者」而不是 DB 工程师。
  - 通过命令行一次性给出 PASS / PARTIAL / FAIL 的可读总结，不要求操作者理解 SQL 或 schema。
- 适用场景：
  - 对单个关键 issue 做 per-issue budget 路径体检。
  - 在调参之前，快速确认：预算是否配置、成本是否归因、guard 是否曾触发。

---

## 4. 本轮明确没做的事

- **没有做父子 issue 预算继承/分摊**
  - 父 issue 与子 issue 之间的预算关系尚未建模；当前 per-issue budget 仅在单个 issue 维度起作用。
- **没有做严格并发扣减**
  - 基于“读时聚合”，未引入 issue 级别的锁或乐观扣减机制；在高并发极端情况下，可能略微超过预算。
- **没有做复杂 UI**
  - 未在 UI 中新增复杂的预算编辑器、图表或 dashboard。
  - per-issue budget 的配置目前主要通过 JSON / 配置层完成。
- **没有做大 schema 改造**
  - 未新增 issues 表上的预算字段，仅使用现有 jsonb。
  - 未为 per-issue 引入新表结构或大范围迁移。
- **没有扩展 OpenClaw office roles**
  - 未新增角色、未大幅调整 OpenClaw 的权限结构。
- **没有重写 scheduler**
  - scheduler 仍按原有机制工作，只在高成本路径上增加了 timer guard。

---

## 5. 当前已知边界与风险

- **issue budget 是全生命周期还是按月**
  - 当前 per-issue budget 的实现是“全生命周期累积”：
    - `getSpentCentsForIssue` 只按 `companyId` + `issueId` 聚合 `costCents`，不区分月份或时间窗口。
  - 这意味着：一旦 issue 的累计成本超过 budgetCents，后续 run 都会被视为超限，直到 budget 调整或清理。

- **高并发下是否可能略超预算**
  - 是的，存在这种可能：
    - 多个 run 同时针对同一 issue 启动，各自在检查时看到的 spent 可能仍 < budget。
    - 当这些 run 先后完成并写 cost events 时，累计 spent 会略高于 `budgetCents`。
  - 当前设计选择：接受这种“轻微超限”的风险，换取实现简单和低侵入。

- **历史 cost 是否全部可计入**
  - 只有在本轮之后产生的 cost events 才会带上 `issue_id`。
  - 之前的历史数据如果没有 issueId，将不会被 per-issue 聚合计算；这意味着：
    - per-issue spent 代表的是“从启用 issue 归因之后”的累计成本。
    - 若需要把旧成本也纳入，需要额外的离线修复或迁移，这一轮刻意没有做。

- **budgetCents 的数据质量约束**
  - 当前约束比较宽松：
    - 仅在运行时检查 `typeof budgetCents === "number" && budgetCents > 0`。
    - 字符串 `"100"` 或非法值会被视为“未配置”，而不会报错。
  - 这保证了兼容性和容错，但也意味着：**错误配置更可能导致“guard 没生效”，而不是“系统直接报警”**，需在上层配置流程中补充校验。

- **issueId 归因依赖什么**
  - 成本归因依赖：
    - wakeup / run 的 contextSnapshot 中必须带有 `issueId`。
    - 写 cost events 时，脚本会从 run.contextSnapshot 中读取 `issueId` 并填入 `cost_events.issue_id`。
  - 若某些触发路径没有正确带上 issueId（比如手工触发、特殊入口），这些 run 的成本不会被记入 per-issue spent。

---

## 6. 回滚与停用方式

> 本节只说明“如何停用或放松护栏”，以便在紧急情况下快速回退，而不需要直接修改代码。

### 6.1 如何关闭/绕过 per-issue budget

- 最简单方式：**不给 issue 配置 `budgetCents`** 或将其设为非正整数：
  - 不设置 `executionWorkspaceSettings.budgetCents`。
  - 或误配为字符串 / 0 / 负数（不推荐，但在当前实现下相当于未启用）。
- 一旦 budgetCents 不被视为有效正整数：
  - per-issue budget guard 不会生效，该 issue 的 run 仅受 per-agent monthly budget 控制。

### 6.2 如何关闭高成本 timer 拦截

- 每个 Agent 的运行配置中，存在一个 opt-in 开关（通过 runtimeConfig / policy）：
  - 将 `allowTimerForHighCostAdapter` 显式设置为 `true`。
- 一旦开启：
  - 即使 adapter 为高成本，timer source 的 wakeup 也会被正常执行。
- 注意：建议仅对极少数确有需求的 Agent 打开，并配合 per-agent / per-issue budget 使用。

### 6.3 如何查看/启用高成本 Agent

- 在 Agents 列表与 Org 视图中：
  - 通过 Filters 中的「显示高成本 Agent」开关，显式开启后：
    - 列表会显示所有高成本 Agent。
    - Org 视图树也会展示 `costTier === "high"` 的节点。
- 若需要“启用”某个高成本 Agent：
  - 在该 Agent 上单独设置预算、配置；高成本只是 costTier 标签，不会阻止其本身被使用。

### 6.4 如何调整 context 上限

- 环境变量：
  - `PAPERCLIP_MAX_CONTEXT_CHARS`：
    - 调大：适合复杂问题、长上下文，但会增加 token 消耗。
    - 调小：适合成本敏感、短任务场景。
  - `PAPERCLIP_MAX_PRIOR_SNAPSHOTS`：
    - 调大：更多历史 diff，有助于长链路变更理解。
    - 调小：减少上下文长度，降低成本。
- 不配置时：
  - 继续使用默认值 `12000 chars / 8 snapshots`。

---

## 7. 下一阶段建议（只给 3 条）

> 不发散，只列出最值得做的 3 条，并按优先级排序。

1. **优先：在 UI 中补充 per-issue budget 的只读可视化**
   - 原因：现在 budget 主要通过 JSON 配置，非工程角色难以看清“这条 issue 有没有预算、剩余空间是多少”；在 Issue 详情里加一块简单的只读 summary（预算 / 已用 / 状态），能显著提升治理透明度，而不需要复杂交互。

2. **次优：在 Costs 或 Dashboard 中增加“Top overshooting issues”的轻量视图**
   - 原因：当 per-issue budget 被大量启用时，单个 issue 的脚本检查已经足够，但缺少全局视角；一个简化版的「哪些 issue 花得最多 / 接近预算 / 已经触发过 guard」列表，有利于 PM / 运维快速决策，而不必重做整个 dashboard。

3. **再下一步：补充 budget 配置流的校验（客户端或服务端）**
   - 原因：当前对 `budgetCents` 的容错较宽松，容易出现「配错但静默不生效」的情况；增加轻量校验（例如仅允许正整数、给出明显 warning）可以减少误配置导致的“护栏没立起来”问题，且实现成本不高。

---

## 8. 给未来自己的结论

- **这一轮是否达到了“先把护栏立住”的目标？**
  - 从高成本触发、上下文上限、成本归因、per-agent / per-issue 预算，到 UI 收敛与 review 工具，这一轮已经把“最容易失控的几个入口和路径”都用最小可回滚的方式加上了护栏，目标基本达成。

- **现在最不该做的事情是什么？**
  - 不该在没有新证据的情况下，立刻启动大规模重构（重写 scheduler、重做 Costs / Dashboard、全面 Agent 架构重构）。
  - 不该贸然把高成本路径再次开放为“默认安全”，例如取消 timer guard 或放松 mentions 限制。

- **下一轮应该从哪里开始，而不是从哪里乱改？**
  - 从「实际使用数据和 review 结果」开始：用当前的成本事件、budget guard 日志和 review 脚本，先看清哪些 Agent / Issue 真正触发了护栏、在哪里经常“打满预算”，再决定是否需要更精细的控件（例如父子 issue 分摊、月度窗口、UI 编辑器）。
  - 也就是说：**下一轮应该从“观察和调优”开始，而不是从“重新设计一切”开始**。***
