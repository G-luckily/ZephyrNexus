# Phase 2 验收报告

> 基于当前代码逐项验证 Phase 2 改造是否真实生效。验收时间：2026-03-14。

## 1. openclaw_gateway 的 source=timer 默认是否被拦截

| 验收项 | 结果 | 证据 |
|--------|------|------|
| timer 默认被拦截 | **pass** | `server/src/services/heartbeat.ts`：在 `enqueueWakeup` 内，当 `source === "timer"` 且 `isHighCostAdapter(agent.adapterType)` 且 `!policy.allowTimerForHighCostAdapter` 时调用 `writeSkippedRequest("high_cost_adapter.timer_blocked_by_default")` 并 return null（L1987–1995）。 |
| 仅 timer 被拦，on_demand/assignment/automation 放行 | **pass** | 条件明确为 `source === "timer"`，其他 source 不进入该分支。 |

**剩余问题**：无。  
**建议**：无需修补。

---

## 2. opt-in 开关是否存在且行为明确

| 验收项 | 结果 | 证据 |
|--------|------|------|
| opt-in 配置存在 | **pass** | `parseHeartbeatPolicy` 返回 `allowTimerForHighCostAdapter: asBoolean(heartbeat.allowTimerForHighCostAdapter, false)`（L850）。 |
| 默认 false | **pass** | `asBoolean(..., false)` 确保未配置时为 false。 |
| 配置来源 | **pass** | 来自 `agent.runtimeConfig.heartbeat.allowTimerForHighCostAdapter`。 |

**剩余问题**：UI 上尚未暴露该字段，用户需通过 API/DB 或 configuration 编辑设置。  
**建议**：可后续在 Agent 编辑/运行时配置中增加「允许定时唤醒（高成本）」开关，非本阶段必须。

---

## 3. comment mention 对高成本 adapter 的上限是否为 1

| 验收项 | 结果 | 证据 |
|--------|------|------|
| 上限为 1 | **pass** | `server/src/services/issues.ts` L1257：`MAX_HIGH_COST_MENTIONS_PER_COMMENT = 1`，`allowedHighCost = highCost.slice(0, 1)`。 |
| 仅高成本受限 | **pass** | 普通 adapter 全部进入 `allowed`，高成本仅取前 1 个（L1265–1279）。 |

**剩余问题**：无。  
**建议**：无需修补。

---

## 4. PATCH comment 与 POST comment 两条路径是否都覆盖

| 验收项 | 结果 | 证据 |
|--------|------|------|
| PATCH /issues/:id（body 含 comment） | **pass** | `server/src/routes/issues.ts` L758–767：调用 `filterMentionedAgentsForHighCostLimit(issue.companyId, mentionedIds)`，用 `allowedMentionIds` 迭代写入 wakeups。 |
| POST /issues/:id/comments | **pass** | 同文件 L1153–1162：对 `currentIssue.companyId` 与 `mentionedIds` 调用同一 filter，用 `allowedMentionIds` 写入 wakeups。 |
| 跳过时打日志 | **pass** | 两处均在 `skippedMentionIds.length > 0` 时 `logger.info(..., "P0-2: high-cost adapter mentions limited per comment")`。 |

**剩余问题**：无。  
**建议**：无需修补。

---

## 5. paperclipContextBlock 的 12k chars / 8 snapshots 裁剪逻辑是否生效

| 验收项 | 结果 | 证据 |
|--------|------|------|
| maxLength 传入 | **pass** | `server/src/services/heartbeat.ts`：`buildContext(..., { maxLength: getMaxContextBlockChars(), maxSnapshots: getMaxContextPriorSnapshots() })`，默认 12_000 与 8，可通过 `PAPERCLIP_MAX_CONTEXT_CHARS` / `PAPERCLIP_MAX_PRIOR_SNAPSHOTS` 配置。 |
| context-manager 使用 options | **pass** | `packages/context-manager/src/builder.ts`：`buildContext` 第三参 `options`，`maxLength`/`maxSnapshots` 用于裁剪；超长时先 trim recent changes。 |

**剩余问题**：无（已改为环境变量 `PAPERCLIP_MAX_CONTEXT_CHARS` / `PAPERCLIP_MAX_PRIOR_SNAPSHOTS`，默认 12000 / 8）。  
**建议**：无需修补。

---

## 6. 超限时是否追加明确标记

| 验收项 | 结果 | 证据 |
|--------|------|------|
| 序列化后二次截断 | **pass** | `heartbeat.ts`：若 `blockText.length > maxContextChars`，则截断并追加 `[... context truncated by size limit ...]`（`maxContextChars` 来自 `getMaxContextBlockChars()`）。 |
| 日志 | **pass** | 同处 `logger.debug({ cwd, originalLen }, "paperclipContextBlock truncated")`。 |

**剩余问题**：无。  
**建议**：无需修补。

---

## 7. Org API 是否真的返回 adapterType 和 costTier

| 验收项 | 结果 | 证据 |
|--------|------|------|
| 返回 adapterType | **pass** | `server/src/routes/agents.ts` L379–387：`toLeanOrgNode` 中 `adapterType = String(node.adapterType ?? "")`，返回 `adapterType: adapterType || undefined`。 |
| 返回 costTier | **pass** | 同处 `costTier = HIGH_COST_ADAPTER_TYPES.has(adapterType) ? "high" : "normal"`，并写入返回对象。 |
| 树递归 | **pass** | `reports` 通过 `map(report => toLeanOrgNode(report))` 递归，每个节点均含 adapterType/costTier。 |

**剩余问题**：无。  
**建议**：无需修补。

---

## 8. 前端类型消费是否兼容

| 验收项 | 结果 | 证据 |
|--------|------|------|
| OrgNode 类型扩展 | **pass** | `ui/src/api/agents.ts`：`OrgNode` 已含可选 `adapterType?: string`、`costTier?: "high" \| "normal"`。 |
| 兼容旧数据 | **pass** | 均为可选字段，旧 API 不返回时不影响渲染。 |

**剩余问题**：无。  
**建议**：无需修补。

---

## 9. Costs / Agents / Org 相关页面是否未被破坏

| 验收项 | 结果 | 证据 |
|--------|------|------|
| Agents list 过滤 | **pass** | `ui/src/pages/Agents.tsx`：`filtered = filterAgents(...).filter(a => !hideHighCostAdapters \|\| a.adapterType !== "openclaw_gateway")`，逻辑独立，未改动 list 数据结构。 |
| Org 数据源 | **pass** | Org 视图使用 `agentsApi.org()`，返回结构已含 costTier；`filterOrgTree` 仅按 status/terminated 过滤，未依赖移除字段。 |
| Costs 页 | **pass** | 无本次改动，仍使用 summary/byAgent/byProject。 |

**剩余问题**：无（已补齐：`filterOrgTree` 接受 `hideHighCostAdapters`，与 list 共用同一开关，按 `costTier === "high"` 默认隐藏）。  
**建议**：无需修补。

---

## 10. 验收汇总

| 项目 | 结果 | 是否建议立即修补 |
|------|------|------------------|
| timer 默认拦截 | pass | 否 |
| opt-in 开关 | pass | 否（UI 可后续补） |
| mention 上限 1 | pass | 否 |
| PATCH/POST 双路径 | pass | 否 |
| 12k/8 裁剪 | pass | 否（已改为 env 可配置） |
| 超限标记 | pass | 否 |
| Org API adapterType/costTier | pass | 否 |
| 前端类型 | pass | 否 |
| 页面未破坏 | pass | 否（已补齐 Org 默认隐藏） |

**结论**：Phase 2 逻辑均按设计生效；收口阶段已完成 Org 视图一致性与 context 上限可配置。
