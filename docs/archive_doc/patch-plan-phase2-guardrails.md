# Phase 2 深化治理 — Guard 与裁剪落地方案

> 2026-03-14 第二阶段，在 Phase 1 基础上继续止血、压扩散、控上下文，全部为低风险、可回滚改造。
>
> **前提**：Phase 1 已完成（officeDispatch 默认关闭、预算 guard、usageJson provider/model、前台默认隐藏高成本 Agent、UI 暴露 officeDispatch 开关）。

## 1. 本轮完成项概览

| 编号 | 目标 | 状态 | 涉及文件 |
|------|------|------|----------|
| P0-1 | openclaw_gateway timer/scheduler guard | ✅ | heartbeat.ts |
| P0-2 | 限制 comment @mentions 扩散 | ✅ | issues.ts, issueService |
| P1-1 | 上下文注入大小上限 + 摘要优先 | ✅ | heartbeat.ts, context-manager |
| P1-2 | 后端高成本 Agent 标识（Org API） | ✅ | agents routes, OrgNode type |

## 2. P0-1：openclaw_gateway Timer/Scheduler Guard

### 2.1 目标

- 默认不允许高成本 `openclaw_gateway` Agent 被 `source= timer` 自动唤醒。
- 手动触发、评论触发均保持可用。

### 2.2 实现

- **位置**：`server/src/services/heartbeat.ts`
- **逻辑**：
  - 在 `enqueueWakeup` 中，在 policy 检查之后新增 guard：
  - 当 `source === "timer"` 且 `agent.adapterType === "openclaw_gateway"` 且 `!policy.allowTimerForHighCostAdapter` 时：
    - 调用 `writeSkippedRequest("high_cost_adapter.timer_blocked_by_default")`
    - 返回 `null`，不创建 run。
- **opt-in**：`runtimeConfig.heartbeat.allowTimerForHighCostAdapter = true` 可重新启用 timer。

### 2.3 拦截 / 放行一览

| source | openclaw_gateway | 是否放行 |
|--------|------------------|----------|
| timer | 否 opt-in | ❌ 拦截 |
| timer | 是 opt-in | ✅ 放行 |
| on_demand, assignment, automation | 任意 | ✅ 放行 |

### 2.4 风险与回滚

- **风险**：依赖 timer 的 openclaw Agent 需显式 opt-in。
- **回滚**：移除该 guard 或把 `allowTimerForHighCostAdapter` 默认改为 `true`。

### 2.5 验收

- 创建 openclaw_gateway Agent，设置 `intervalSec > 0`，不设置 opt-in。
- 等待 timer 触发或手动触发 tickTimers。
- 预期：wakeup 被 skip，`agentWakeupRequests` 中 reason 为 `high_cost_adapter.timer_blocked_by_default`。
- 设置 `allowTimerForHighCostAdapter: true` 后，timer 触发应正常创建 run。

---

## 3. P0-2：Comment @mentions 扩散限制

### 3.1 目标

- 单条评论中，对高成本 adapter 的 mention 数量有上限，避免一次评论触发多 Agent 并行 run。

### 3.2 实现

- **位置**：
  - `server/src/services/issues.ts`：新增 `filterMentionedAgentsForHighCostLimit(companyId, mentionedIds)`
  - `server/src/routes/issues.ts`：在 `POST /issues/:id/comments` 与 `PATCH /issues/:id`（含 comment）两处，在构建 wakeups 前调用该 filter。
- **逻辑**：
  - `MAX_HIGH_COST_MENTIONS_PER_COMMENT = 1`
  - 批量查询 mentioned agent 的 `adapterType`，按高成本 / 普通分离。
  - 高成本只保留前 1 个，其余记入 `skipped`。
  - 使用 `allowed` 作为实际 wakeup 列表，`skipped.length > 0` 时写日志。

### 3.3 限制类型

- **硬限制**：高成本 adapter 单条评论最多唤醒 1 个。
- **软处理**：被跳过的 Agent 仅记录 info 日志，不返回错误，用户评论仍成功提交。

### 3.4 风险与回滚

- **风险**：多条高成本 mention 时，仅第一个被唤醒，可能不符合用户预期。
- **回滚**：不再调用 `filterMentionedAgentsForHighCostLimit`，直接使用 `mentionedIds`。

### 3.5 验收

- 在评论中 @ 多个 openclaw_gateway Agent。
- 预期：只有第一个被 wakeup，其余在日志中可见 “P0-2: high-cost adapter mentions limited per comment”。

---

## 4. P1-1：上下文注入大小上限 + 摘要优先

### 4.1 目标

- 限制 `paperclipContextBlock` 大小，避免无限膨胀。

### 4.2 实现

- **位置**：`server/src/services/heartbeat.ts`
- **常量**：
  - 默认 `PAPERCLIP_MAX_CONTEXT_CHARS=12000`、`PAPERCLIP_MAX_PRIOR_SNAPSHOTS=8`（可环境变量覆盖）
- **逻辑**：
  - 调用 `buildContext(contextStore, scope, { maxLength, maxSnapshots })` 传入上述选项。
  - `context-manager` 内部优先保留 module signatures 和 prior snapshots，按需裁剪 recent changes。
  - 若序列化后仍超配置的上限，再做截断并追加 `[... context truncated by size limit ...]`。
  - 截断时写 debug 日志。

### 4.3 裁剪优先级

1. 保留：module signatures、dependency summaries、prior snapshots（最多 8 条）
2. 裁剪：recent git changes（从尾部开始删）
3. 最后防线：序列化结果超长时尾部截断

### 4.4 配置

- 上限写死在 heartbeat 常量中，未做 env 配置。
- 后续可改为从 `process.env.PAPERCLIP_MAX_CONTEXT_CHARS` 读取。

### 4.5 风险与回滚

- **风险**：大项目可能丢失部分 recent changes 信息。
- **回滚**：提高 `PAPERCLIP_MAX_CONTEXT_CHARS` 或移除二次截断逻辑。

### 4.6 验收

- 在存在较多 diff snapshot 的项目中执行 run。
- 检查 run 的 `contextSnapshot.paperclipContextBlock` 长度不超过约 12k 字符。
- 若发生截断，日志中应有 “paperclipContextBlock truncated”。

---

## 5. P1-2：后端高成本 Agent 标识（Org API）

### 5.1 目标

- Org API 返回足够信息，供前端统一做高成本收敛。

### 5.2 实现

- **位置**：`server/src/routes/agents.ts` 中 `toLeanOrgNode`
- **新增字段**：
  - `adapterType`：适配器类型，如 `openclaw_gateway`
  - `costTier`：`"high" | "normal"`，由 `adapterType` 推导
- **前端**：`ui/src/api/agents.ts` 中 `OrgNode` 类型新增可选字段 `adapterType`, `costTier`。

### 5.3 兼容性

- 仅新增可选字段，旧前端忽略即可，无破坏性变更。

### 5.4 后续（已补齐）

- Org 视图已与 list 一致：`filterOrgTree` 接受 `hideHighCostAdapters`，当为 true 时排除 `costTier === "high"` 的节点；与 list 的「默认隐藏高成本」共用同一 Filters 开关。

### 5.5 验收

- 调用 `GET /companies/:companyId/org`。
- 预期：每个 node 含 `adapterType`、`costTier`，openclaw_gateway 为 `costTier: "high"`。

---

## 6. 改动文件清单

| 文件 | 修改目的 | 风险等级 |
|------|----------|----------|
| `server/src/services/heartbeat.ts` | P0-1 timer guard、P1-1 context 裁剪、HIGH_COST_ADAPTER_TYPES | 低 |
| `server/src/services/issues.ts` | P0-2 filterMentionedAgentsForHighCostLimit | 低 |
| `server/src/routes/issues.ts` | P0-2 两处调用 filter，记录日志 | 低 |
| `server/src/routes/agents.ts` | P1-2 toLeanOrgNode 增加 adapterType/costTier | 低 |
| `ui/src/api/agents.ts` | P1-2 OrgNode 类型扩展 | 低 |
| `ui/src/pages/Agents.tsx` | Org 与 list 一致：filterOrgTree 按 costTier 默认隐藏高成本 | 低 |

---

## 7. 待拍板项

- timer 对高成本 adapter：是保留「默认拦截 + opt-in」还是改为「默认允许、仅记录警告」。
- comment mention：是维持「硬限制 1 个」还是改为「软限制 + UI 二次确认」。
- per-issue budget 设计（字段、继承规则）。
- `costTier` 是否在更多前端页面使用（例如 Org 视图默认过滤）。

---

## 8. 回滚方式速查

| 改造 | 回滚 |
|------|------|
| P0-1 timer guard | 删除 `isHighCostAdapter` 与 timer guard 逻辑，或将 `allowTimerForHighCostAdapter` 默认改为 true |
| P0-2 mention limit | 移除对 `filterMentionedAgentsForHighCostLimit` 的调用，恢复直接使用 `mentionedIds` |
| P1-1 context limit | 移除 `maxLength`/`maxSnapshots` 传参，移除二次截断 |
| P1-2 Org 字段 | 在 `toLeanOrgNode` 中不再返回 `adapterType`、`costTier` |
