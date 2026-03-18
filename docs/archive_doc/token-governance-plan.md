# Token / 成本治理落地方案（最小可用 + 迭代路线）

> 本文面向“成本治理工程师/集成改造负责人”的落地说明：先把可观测、可熔断、可路由的基层打起来，再逐步做精细化治理。
>
> 约束：**低风险、最小侵入、可回滚**；避免不可逆的大 schema 变更；优先复用 Paperclip 已有 `costEvents` + `Costs` UI。

## 0. 治理目标（与验收标准）

### 必达目标（今天）

- **可观测**：每次模型调用在 Paperclip 侧能看到：
  - provider / model
  - inputTokens / outputTokens
  - costUsd（可选，但能折算为 cents）
- **可控**：至少对 **per-agent monthly budget** 有硬熔断，预算耗尽后不再继续调用适配器。
- **默认安全**：高成本路径（OpenClaw office pipeline）默认不自动触发，必须显式 opt-in。

### 验收标准（今天）

- `Costs -> By Model` 有数据（来自 `heartbeatRuns.usageJson` 的 provider/model）。
- 预算用尽的 Agent 再次触发 run，会被阻断并在 run log 中明确提示。
- 未显式开启 office dispatch 时，不会 spawn `office_dispatch.sh`。

## 1. 现状盘点（仓库内已有能力）

### 1.1 已有数据结构

- **`costEvents`（表）**：由 `server/src/services/heartbeat.ts:updateRuntimeState()` 写入  
  记录 provider/model/input/output tokens/costCents。
- **`agents`（表）**：
  - `budgetMonthlyCents`
  - `spentMonthlyCents`（在写 cost event 时累加）
- **`heartbeatRuns`（表）**：
  - `usageJson`：用于 UI 聚合与后端 `costs.byModel`（基于 JSON 字段查询）

### 1.2 已有 UI

- `ui/src/pages/Costs.tsx`：公司维度成本汇总 + 按 Agent/项目。
- 后端支持：`GET /companies/:companyId/costs/by-model`（但依赖 `heartbeatRuns.usageJson.provider/model` 字段）。

## 2. 最小治理改造（已落地）

### 2.1 P0：高成本链路默认关闭（可回滚）

- 改动：
  - `packages/adapters/openclaw-gateway/src/server/execute.ts`  
    `officeDispatchEnabled` 默认从 `true` 改为 `false`（opt-in）。
  - `ui/src/adapters/openclaw-gateway/config-fields.tsx`  
    增加开关与警告文案，避免误开。
- 风险：
  - 依赖 office pipeline 的旧 Agent 需要显式配置 `officeDispatchEnabled=true`。
- 回滚：
  - 将默认值改回 `true`（不建议）。

### 2.2 P0：per-agent monthly budget guard（硬熔断）

- 改动：
  - `server/src/services/heartbeat.ts` 在 `executeRun()` 早期检查：
    - `budgetMonthlyCents > 0 && spentMonthlyCents >= budgetMonthlyCents` → 阻断 adapter 调用
    - run 标记 `failed`，errorCode=`budget_exceeded`
    - 记录 run event，便于 UI/日志定位
- 风险：
  - 预算耗尽的 Agent 会“看似可唤醒但不执行”，属于预期的治理效果。
- 回滚：
  - 删除该 guard（不建议）。

### 2.3 P1：provider/model 写入 per-run usageJson（让 By Model 生效）

- 改动：
  - `server/src/services/heartbeat.ts`：在 `usageJson` 中写入 `provider` / `model`。
- 价值：
  - `server/src/services/costs.ts:byModel()` 现在能正确聚合按模型成本。

## 3. 下一步治理路线（按优先级）

## 3.1 Patch plan（可回滚、小步推进）

- **Patch 01（已完成）**：默认关闭 OpenClaw office pipeline（opt-in）
- **Patch 02（已完成）**：per-agent monthly budget guard（超限阻断执行）
- **Patch 03（已完成）**：provider/model 写入 `heartbeatRuns.usageJson`，确保 `Costs -> By Model` 生效
- **Patch 04（已完成）**：Agents 列表默认隐藏高成本 adapter（仅 UI 过滤，可随时打开）
- **Patch 05（已完成 Phase 2）**：openclaw_gateway timer guard — 默认拦截 timer source
- **Patch 06（已完成 Phase 2）**：comment mentions 高成本 adapter 单条评论上限 1 个
- **Patch 07（已完成 Phase 2）**：上下文注入大小上限 + 摘要优先（maxLength=12k, maxSnapshots=8）
- **Patch 08（已完成 Phase 2）**：Org API 返回 adapterType、costTier

### P1：今日可继续做（低风险）

1. **OpenClaw gateway 运行日志降噪（不进 prompt）**
   - 目标：避免 debug/trace 被误塞入上下文。
   - 做法：仅影响 Paperclip 的 run log 展示，不改变执行逻辑。

2. **限制 scheduler 触发高成本 adapter**
   - 目标：避免“定时心跳”让高成本 agent 常驻烧钱。
   - 做法：
     - 在 UI/服务端对 `openclaw_gateway` 类型默认 `runtimeConfig.heartbeat.enabled=false` 或 `intervalSec=0`（需要评估兼容）。

3. **对 `@mentions` 的 fan-out 做软拦截**
   - 目标：避免“一次评论触发多个 agent 并行 run”。
   - 做法：
     - UI 层提示 + 二次确认（仅对 openclaw_gateway 或高成本标签 agent）。
     - 服务端对单次 comment mentions 数量设置上限（超限则只唤醒第一个，其他写 activity warning）。

### P2：你回来后建议拍板再做（可能涉及 schema/规则）

1. **per-issue 预算（燃尽停止）**
   - 需要决定字段放在 `issues` 还是 metadata，如何继承到 child issue。

2. **per-day company budget**
   - 公司维度熔断需要严格规则与告警机制。

3. **上下文压缩/摘要（检索优先）**
   - 为 `.paperclip/context.db` 的注入增加 token 上限、分层与摘要存储，避免全量注入。

## 4. 模型分层路由策略（符合你的原则）

> Paperclip 本身不直接管理“模型选择”，但可以通过 adapterConfig/skill/config 的约定实现“默认路由到便宜模型 / Sonnet / 高阶模型”。

### 建议矩阵

- **路由/分类/摘要/标签提取**：便宜模型  
  - 作用：把长输入压缩成短任务、提取关键文件/模块/风险点。
- **常规编码/改 bug/小重构**：Sonnet 级  
  - 作用：主力编程任务。
- **核心架构评审/跨系统重构规划**：高阶模型（按需）  
  - 入口：仅允许“高成本 Agent”或“显式审批”的 run 使用。
- **长上下文检索整合**：大上下文能力模型（不等于最高价）  
  - 先检索再整合，避免全量塞入。

## 5. 上下文上限可配置（Phase 2 收口）

### 5.0 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PAPERCLIP_MAX_CONTEXT_CHARS` | 12000 | paperclipContextBlock 最大字符数；超限时先由 context-manager 裁剪 recent changes，再对序列化结果做尾部截断。 |
| `PAPERCLIP_MAX_PRIOR_SNAPSHOTS` | 8 | 注入的 prior diff snapshots 条数上限。 |

- **为何先用 chars 而非 token**：避免依赖模型分词器，实现简单；约 4 chars/token 可粗算 ~3k tokens。后续若有需要可再加 token 估算或单独配置。
- **调优**：大仓库、长历史可适当调高（如 16000 / 12）；成本敏感或小任务可调低（如 8000 / 5）。缺失时保持默认，不影响现有行为。
- **读取**：在 `server/src/services/heartbeat.ts` 中按需读取，未引入配置中心。

### 5.1 观测与告警（最小实现）

### 5.2 UI 告警（今天/本周）

- `Costs` 页增加：
  - “Top spend agents”
  - “Top spend models”
  - budget utilization > 80% 高亮

