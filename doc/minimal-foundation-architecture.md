# 最小基层架构（今天可运行、成本可控、职责清晰）

> 目标：在当前仓库现实基础上，先搭起“少而稳”的底座，避免多 Agent 常驻/重复上下文/无界委派导致的 token 失控。

## 1. 架构分层与职责边界（以现有代码为骨架）

### 1.1 控制平面（Paperclip）

- **职责**
  - 用户任务入口（Issue / Approvals）
  - 任务分发（wakeup / invoke / mentions）
  - 状态面板（Runs / LiveRun / Org / Costs）
  - 成本观测与预算治理（costEvents、budgets、熔断/暂停）
- **落点**
  - 后端：`server/src/services/heartbeat.ts`、`server/src/routes/*`
  - 前端：`ui/src/pages/IssueDetail.tsx`、`ui/src/pages/Costs.tsx`、`ui/src/pages/Agents.tsx`

### 1.2 执行平面（Adapters + OpenClaw）

- **职责**
  - 真正执行任务（编码、检索、浏览器操作、工作流分解）
  - 工具调用与模型调用（在 adapter/CLI/Gateway 内部完成）
  - 结果回传（stdout/log + AdapterExecutionResult 的 usage/cost/summary/resultJson）
- **落点**
  - `packages/adapters/*`
  - `packages/adapters/openclaw-gateway/*`
  - `openclaw-workspace/scripts/office_dispatch.sh`

### 1.3 上下文层（检索化 + 压缩优先）

- **目标约束**
  - 不允许每次全量塞历史/日志/项目说明进 prompt
  - 默认：检索 → 摘要 → 注入
- **现有落点**
  - `.paperclip/context.db` + `@zephyr-nexus/context-manager`
  - `server/src/services/heartbeat.ts` 中 `buildContext()` / `writeDiffSnapshot()`
- **Phase 2 已落地**
  - 上下文上限可配置：`PAPERCLIP_MAX_CONTEXT_CHARS`（默认 12000）、`PAPERCLIP_MAX_PRIOR_SNAPSHOTS`（默认 8）；超限时截断并追加标记
  - Org 视图与 list 一致：同一「隐藏高成本」开关下，按 `costTier === "high"` 默认隐藏

## 2. 最小可运行版本（MVP）应保留/暂停什么

### 2.1 必须保留（核心闭环）

- `Issue -> wakeup -> run -> cost -> UI`
  - 后端：`heartbeatService`、`issuesRoutes`、`agentsRoutes`、`costRoutes`
  - 前端：`IssueDetail`、`LiveRunWidget`、`Costs`

### 2.2 暂停/默认关闭（高风险扩散）

- **OpenClaw office pipeline 默认关闭（opt-in）**
  - 仅允许少量“高成本专用 Agent”开启
- **高成本 Agent timer 默认拦截（Phase 2 已落地）**
  - `source= timer` 时默认不唤醒 openclaw_gateway，opt-in 才允许

## 3. Agent 收敛策略（什么是 Agent，什么不是）

### 3.1 保留为 Agent 的条件（必须同时满足多数）

- 有独立目标
- 需要持续状态
- 需要多步推理
- 与人/系统有清晰职责边界

### 3.2 应降级为 Tool/Skill/Service 的能力

- 单次函数调用（格式化、提取、校验）
- 检索器（search/recall）
- 成本计算器（聚合 costEvents）
- 轻量路由/分类器（intent routing）

## 4. 模型分层路由（原则落地）

### 4.1 路由矩阵（建议）

- **分类/路由/摘要/元信息**：便宜模型
- **常规编码/改 bug**：Sonnet 级（默认）
- **核心架构评审**：高阶模型（需显式审批/开关）

### 4.2 实现方式（最小侵入）

- 在 adapterConfig 里增加约定字段（例如 `costTier`/`taskType`），由各 adapter/skill 自己选择模型。
- 在 Paperclip server 侧只做：
  - 预算 guard
  - 高成本链路默认关闭
  - 观测字段写入（provider/model/tokens/cost）

## 5. 成本治理底座（今天必须有）

### 5.1 必须埋点

- provider / model
- inputTokens / outputTokens / cachedInputTokens
- costUsd（可选）
- runId / agentId / companyId

### 5.2 必须熔断

- per-agent monthly budget：超限阻断执行（本次已落地）
- 高成本 office pipeline 默认关闭（本次已落地）

## 6. 验收清单（你回来可快速验证）

- `openclaw_gateway` Agent 默认不会跑 `office_dispatch.sh`
- `Costs -> By Model` 有数据，并能看到 provider/model
- 预算超限的 Agent 再唤醒会被阻断，并在 run 事件中看到明确原因
- openclaw_gateway 的 timer 触发默认被 skip（reason=`high_cost_adapter.timer_blocked_by_default`）
- 单条评论 @ 多个 openclaw Agent 时，仅第一个被唤醒，日志有 “P0-2: high-cost adapter mentions limited”
- `GET /companies/:id/org` 返回 `adapterType`、`costTier` 字段

