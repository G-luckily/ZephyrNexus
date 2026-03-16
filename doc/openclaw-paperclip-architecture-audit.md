# OpenClaw × Paperclip 架构深度审计（代码证据版）

> 目标：基于**真实仓库代码与配置**，复盘 Paperclip（控制平面）与 OpenClaw（执行平面）当前协同方式，找出高 token/高费用风险链路，并给出“少而稳、可回滚”的最小基层架构与改造建议。
>
> 审计时间：2026-03-14

## 结论先行（最重要的 6 句话）

- **Paperclip 是控制平面**：负责任务/Issue/审批/Agent 管理、心跳调度、运行日志与成本统计展示。
- **OpenClaw 是执行平面**：通过 `openclaw_gateway` 适配器被 Paperclip 调用；同时 OpenClaw 的 office pipeline 也会反向调用 Paperclip API 进行“真实 Issue 委派”。
- 两者目前不是“名义接入”，而是**双向深度协同**（适配器 + WS 事件流 + office_dispatch 脚本回写 API）。
- **高成本风险的中心**在 `openclaw_gateway` 默认启用的 **office_dispatch 多阶段流水线**（多角色、多次上下文、多次产物串接）。
- Paperclip 已经具备成本事件表（`costEvents`）与 UI 成本页面（`ui/src/pages/Costs.tsx`），但**per-run 的 provider/model 之前未写入 `heartbeatRuns.usageJson`**，导致 “按模型统计” 不完整（已在本次最小改造中修复）。
- 缺口最大的部分是：**硬预算熔断**与**高成本链路默认关闭**（本次最小改造已补上基础版本：budget guard + officeDispatch opt-in）。

## 1. 仓库结构与真实架构（以代码为准）

### 1.1 控制平面：Paperclip（`/home/guo/paperclip`）

- **后端入口**
  - `server/src/index.ts`：启动 HTTP + Live Events WS + heartbeat scheduler
  - `server/src/app.ts`：注册 `/api/*` 路由
- **调度与运行时核心**
  - `server/src/services/heartbeat.ts`：`wakeup()` → `executeRun()` → `getServerAdapter().execute()` → 写 run 状态/日志/成本
- **适配器注册**
  - `server/src/adapters/registry.ts`：注册所有执行适配器（包括 `openclaw_gateway`）
- **成本服务与 API**
  - `server/src/routes/costs.ts`、`server/src/services/costs.ts`：公司汇总、按 Agent、按项目、按模型统计
- **UI**
  - `ui/src/pages/Agents.tsx`：Agent 视图
  - `ui/src/pages/IssueDetail.tsx`：任务详情 + per-issue cost summary（聚合 runs）
  - `ui/src/pages/Costs.tsx`：成本看板（公司维度汇总、按 Agent、按项目）
  - `ui/src/components/LiveRunWidget.tsx`：实时 run 日志显示

### 1.2 执行平面：OpenClaw（`/home/guo/openclaw-workspace`）

- **Office 多角色流水线**
  - `scripts/office_dispatch.sh`：多阶段 role pipeline（prompt/webops/research/design/code/paperclip 等），产物落地在 `reports/`
- **角色规范**
  - `agents/*/AGENT_SPEC.md`、`OUTPUT_SCHEMA.json`

## 2. Paperclip 与 OpenClaw 当前到底是什么关系？

### 2.1 关系类型判定

- **适配器关系（主）**：Paperclip 将 OpenClaw 接入为 `openclaw_gateway` 适配器，通过统一的 `ServerAdapterModule.execute()` 调用。
- **事件桥接（次）**：openclaw gateway 通过 WebSocket event stream 输出 assistant/lifecycle/error，Paperclip 通过 heartbeat run log 与 Live Events 统一展示。
- **API 双向调用（深度耦合点）**：office pipeline（`office_dispatch.sh`）会直接调用 Paperclip API 创建/更新 Issue，实现真实委派与回写。

### 2.2 关键耦合点（文件级证据）

- Paperclip → OpenClaw：
  - `server/src/services/heartbeat.ts` 调用 `adapter.execute(...)`
  - `packages/adapters/openclaw-gateway/src/server/execute.ts` 实现 openclaw adapter，支持：
    - **office_dispatch.sh 本地流水线**
    - **OpenClaw Gateway WebSocket 协议**
- OpenClaw → Paperclip：
  - `openclaw-workspace/scripts/office_dispatch.sh` 内的 `run_paperclip_manager_executor` / `run_paperclip_worker_executor`（通过 HTTP 回写）

## 3. 哪些入口会触发模型调用（链路图，逐层落点）

> 说明：Paperclip 本身多数情况下不直接调用云模型 API，而是通过适配器执行本地 CLI/远端 Gateway；但 token/cost 由适配器返回并进入 Paperclip 的 run/cost 体系。

### 3.1 链路 A：Issue 评论 / @mentions → 多 Agent wakeup → 适配器 → 模型

- **前端**：`ui/src/pages/IssueDetail.tsx` 提交评论/提及 Agent
- **后端**：`server/src/routes/issues.ts` 解析 mentions → `heartbeatService.wakeup(...)`
- **调度**：`server/src/services/heartbeat.ts`
  - `enqueueWakeup()` 写入 `agentWakeupRequests` / `heartbeatRuns`
  - `executeRun()` 构建 workspace/context → `adapter.execute()`
- **执行**：
  - 对 `openclaw_gateway`：
    - （默认应关闭）office pipeline：`office_dispatch.sh`
    - 或 Gateway WS：`WebSocket` connect → `agent` / `agent.wait`
- **成本写入**：
  - `updateRuntimeState()` 写入 `costEvents` + 更新 `agents.spentMonthlyCents`
  - `heartbeatRuns.usageJson`（本次补齐 provider/model 字段）

### 3.2 链路 B：手动 invoke/wakeup → 单 Agent 执行 → 模型

- **前端**：`ui` 调用 `agentsApi.invoke/wakeup`
- **后端**：`server/src/routes/agents.ts` → `heartbeatService.invoke/wakeup`
- 其余同 A

### 3.3 链路 C：heartbeat 定时器 → 自动唤醒 → 模型

- **后端定时**：`heartbeatService.tickTimers()` 遍历所有 Agent，根据 `runtimeConfig.heartbeat.intervalSec` 自动 `enqueueWakeup(source="timer")`
- 风险：若有大量 Agent 设置了 interval，可能形成后台“常驻烧钱”。

## 4. Agent 体系是否失控（代码级观察）

### 4.1 Paperclip 的 Agent 注册/暴露机制

- Agent 属于 DB 实体（`agents` 表），UI 通过 `/companies/:companyId/agents` 全量展示。
- Org 视图由 `/companies/:companyId/org` 提供（`OrgNode` 不含 adapterType）。
- wakeup 的触发入口包括：任务分配、评论提及、手动 invoke、定时 heartbeat。

### 4.2 OpenClaw 的“多 Agent”风险

- `office_dispatch.sh` 具备“多角色 pipeline”的结构性放大效应：同一输入可被多角色重复处理。
- 其中 `paperclip` 角色还可能创建子 Issue，再触发更多 wakeup。

## 5. token / 成本治理现状

### 5.1 已具备的基础能力（Paperclip 内）

- `costEvents` 表：记录 provider/model/inputTokens/outputTokens/costCents（由 `updateRuntimeState()` 写入）。
- `ui/src/pages/Costs.tsx`：成本页面已存在，可查看公司汇总、按 Agent、按项目；后端还支持按模型。

### 5.2 关键缺口（本次已部分补齐）

- **缺口**：`costs.byModel` 使用 `heartbeatRuns.usageJson` 的 `provider/model` 字段聚合，但之前 `usageJson` 只写 tokens/cost/billingType。
- **本次修复**：在 `server/src/services/heartbeat.ts` 里将 `adapterResult.provider/model` 写入 `usageJson`，使 “按模型统计” 可用。

### 5.3 仍待补齐（后续）

- per-trigger-source（issue_comment / scheduler / manual）的成本维度：目前需要通过 run 事件或未来 schema 扩展补齐。
- 硬 token 上限与 context 注入大小限制：目前主要依赖适配器与上下文管理器自身策略。

## 6. P0/P1/P2 风险清单（带触发条件与修复方向）

### P0（立即止血）

- **P0-1：office_dispatch 默认开启导致高成本**
  - 触发：任意 `openclaw_gateway` run
  - 修复：默认关闭，改为 opt-in（本次已改：适配器默认 false + UI 增加开关与警告）
- **P0-2：预算耗尽仍继续调用模型**
  - 触发：Agent 月预算用尽后仍可被 wakeup
  - 修复：在 `executeRun()` 前加入预算 guard（本次已改）

### P1（今天必须搭起来）

- **P1-1：provider/model 未写入 usageJson 导致按模型统计不准**
  - 修复：已改（见上）
- **P1-2：定时 heartbeat 可能唤醒大量 Agent**
  - 修复：Phase 2 已落地 P0-1：openclaw_gateway 默认拦截 timer source，opt-in 才允许。

### P2（能做再做）

- 将多数 “一次性能力” 从 Agent 降级为 Tool/Skill/Service，避免前台暴露过多角色。
- 建立更细预算熔断（per-issue、per-day、per-trigger）。

## 7. 本次最小改造（已落地）与验收方式

### 7.1 改动清单

- `packages/adapters/openclaw-gateway/src/server/execute.ts`
  - 将 `officeDispatchEnabled` 默认值从 `true` 改为 `false`（opt-in）。
- `ui/src/adapters/openclaw-gateway/config-fields.tsx`
  - 增加 “Office dispatch (high cost)” 开关与 warning 文案
  - 增加 `officeDispatchScriptPath` 可配置字段
- `ui/src/pages/Agents.tsx`
  - 增加过滤器：默认隐藏 `openclaw_gateway`（高成本适配器），避免前台“看起来很热闹”的误触发
- `server/src/services/heartbeat.ts`
  - 增加预算 guard：`spentMonthlyCents >= budgetMonthlyCents` 时阻止 adapter 调用并标记 run 失败（errorCode=`budget_exceeded`）
  - 将 `adapterResult.provider/model` 写入 `heartbeatRuns.usageJson`

### 7.2 验收步骤

- **验收 1：office dispatch 默认不再触发**
  - 新建/编辑 `openclaw_gateway` Agent，不勾选 office dispatch，触发一次 run
  - 预期：run log 不出现 `[openclaw-gateway] office dispatch enabled`，而走 WS gateway 路径（或按配置失败但不会 spawn 脚本）
- **验收 2：预算熔断生效**
  - 将某 Agent 的 `budgetMonthlyCents` 设为极小（例如 1）
  - 触发 run
  - 预期：run 直接失败，run event 包含 “run blocked by budget guard”
- **验收 3：Costs 页面按模型统计不为空**
  - 执行几次带 model/provider 的 run（例如 openclaw gateway）
  - 打开 `Costs` 页面（按模型），应出现对应 provider/model 聚合行

## 8. Phase 2 深化治理（2026-03-14 已完成）

- **P0-1**：openclaw_gateway timer guard — 默认拦截 `source= timer`，opt-in 才允许。
- **P0-2**：comment @mentions 限制 — 单条评论对高成本 adapter 最多唤醒 1 个。
- **P1-1**：上下文注入大小上限 — `MAX_CONTEXT_BLOCK_CHARS=12000`，`maxSnapshots=8`。
- **P1-2**：Org API 增加 `adapterType`、`costTier` 字段。

详见 `doc/patch-plan-phase2-guardrails.md`。

## 9. 待你回来 review 的点（需要拍板）

- timer 对高成本 adapter：保留「默认拦截 + opt-in」还是改为「默认允许、仅记录」。
- comment mention：维持「硬限制 1 个」还是改为「软限制 + UI 二次确认」。
- 是否要在 Org 视图中使用 `costTier` 做默认隐藏（后端已返回）。
- 是否要引入 per-issue 预算字段与熔断（需要 schema/业务规则设计）。

