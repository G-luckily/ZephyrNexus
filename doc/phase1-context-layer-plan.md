# Phase 1 Context Layer — Implementation Plan

## 1. 目标与约束（摘要）

- **目标**：worker 执行前拿到结构化项目上下文（模块签名、依赖、最近变更、前序 diff snapshot）；执行后写回结构化 diff snapshot。
- **约束**：不改 UI/WebSocket/adapter 体系；不做 prompt caching/实时监听；仅新增包 + 最小接线；存储用 SQLite + 抽象 store 接口。

---

## 2. 架构概览

```
[context-extractor]  (CLI，在 repo 根执行)
       │ ts-morph + git
       ▼
  ContextStore (SQLite 实现)
       ▲
       │ read / write
[context-manager]  (ContextStore 接口 + Builder + Snapshot 写回)
       ▲
       │ buildContext(scope) → context block
       │ writeSnapshot(snapshot)
server/heartbeat ──┘
  - executeRun 开始前：buildContext(scope) → 注入 context.paperclipContextBlock
  - executeRun 结束后：writeSnapshot(…) 写回
```

- **Scope**：`{ projectRoot, issueId?, taskKey? }`，由 heartbeat 在已有 `executionWorkspace.cwd` 与 `context` 上构造。
- **Context block**：给 worker 的结构化文本/JSON，含模块签名、直接依赖摘要、最近 7 天变更摘要、前序任务 diff snapshots；有长度预算，优先保留签名与 snapshot，裁剪 recent changes。
- **Diff snapshot**：由 adapter 通过 `resultJson.paperclipDiffSnapshot` 返回（或 heartbeat 构造最小 snapshot），由 context-manager 写入 store。

---

## 3. 实现阶段划分

### Phase 1.1 — context-manager 包（接口 + SQLite + Builder + Snapshot）

1. 定义 **ContextStore 接口**（与 SQLite 解耦）。
2. 定义 **类型**：模块信息、git 变更条目、diff snapshot、context block、subtask scope。
3. 实现 **SqliteContextStore**（SQLite 表：modules, git_changes, diff_snapshots）。
4. 实现 **ContextBuilder**：`buildContext(store, scope, options?)` → context block，带长度预算。
5. 实现 **writeDiffSnapshot(store, snapshot)**。
6. 导出：store 接口、SQLite 实现、builder、writeDiffSnapshot；CLI 不在此包。

### Phase 1.2 — context-extractor 包

1. 使用 **ts-morph** 扫描项目，产出模块列表（path, exports, imports, loc, lastModified）。
2. 使用 **git**（Node 子进程或 simple-git）取最近 7 天变更（file, commitHash, summary, date）。
3. 依赖 **context-manager** 的 ContextStore 接口；CLI 里实例化 **SqliteContextStore**，调用 extractor。
4. Extractor 将结果写入 store（modules 表、git_changes 表）；不写 diff_snapshots（由 worker 写回）。
5. 提供 **CLI 入口**，在 repo 根目录执行，默认写入 `./.paperclip/context.db`（可配置）。

### Phase 1.3 — Orchestrator 接入（heartbeat 最小插入）

1. **Build context 插入点**：`executeRun` 内，在 `context.paperclipWorkspace = ...` 之后、`adapter.execute()` 之前。
   - 使用 `executionWorkspace.cwd` 与已有 `context.issueId` / `context.taskKey` 构造 scope。
   - 调用 `context-manager` 的 `buildContext(store, scope)`；若 store 不可用或出错，则 `context.paperclipContextBlock = null` 或省略，不阻塞执行。
   - 将结果写入 `context.paperclipContextBlock`（字符串或结构化对象，由 adapter 消费）。
2. **Snapshot 写回插入点**：`adapter.execute()` 返回后，在 `setRunStatus` 之前或之后、`releaseIssueExecutionAndPromote` 之前。
   - 从 `adapterResult.resultJson?.paperclipDiffSnapshot` 取 snapshot；若无，则构造最小 snapshot（taskId, runId, workerId, touchedFiles: [] 等）。
   - 调用 `context-manager` 的 `writeDiffSnapshot(store, snapshot)`；store 路径由 `executionWorkspace.cwd` 推导（与 extractor 一致）。
3. **Store 实例**：heartbeat 内按 run 的 `executionWorkspace.cwd` 创建或复用 SqliteContextStore（路径 `cwd + '/.paperclip/context.db'`）；无 DB 时 builder 返回空 block，writeSnapshot 可 no-op 或写内存/跳过。

---

## 4. 数据模型（Store 抽象）

- **ModuleRow**：id, projectRoot, filePath, exports (JSON array), imports (JSON array), loc, lastModified (ISO string).
- **GitChangeRow**：id, projectRoot, filePath, commitHash, summary, date (ISO string).
- **DiffSnapshotRow**：id, projectRoot, taskId, runId, workerId, touchedFiles (JSON), signatureChanges (JSON), newDependencies (JSON), brokenContracts (JSON), plainSummary (text), createdAt.

ContextStore 接口示例（方法名可微调）：

- `getModules(projectRoot: string): Promise<ModuleRow[]>`
- `getGitChanges(projectRoot: string, sinceDays?: number): Promise<GitChangeRow[]>`
- `upsertModules(projectRoot: string, modules: ModuleRow[]): Promise<void>`
- `upsertGitChanges(projectRoot: string, changes: GitChangeRow[]): Promise<void>`
- `getDiffSnapshots(projectRoot: string, taskId?: string, limit?: number): Promise<DiffSnapshotRow[]>`
- `insertDiffSnapshot(projectRoot: string, snapshot: DiffSnapshotRow): Promise<void>`

---

## 5. Context Block 结构（给 worker）

- 可序列化为一段 Markdown 或 JSON。
- 必含：当前 scope 模块导出签名、直接依赖模块接口摘要、前序 diff snapshots（按 task/run 排序）。
- 可选（按预算裁剪）：最近 7 天相关文件变更摘要。
- 长度预算：例如 8K/16K 字符，超出时优先裁 recent changes，再裁 snapshot 条数。

---

## 6. Diff Snapshot 结构（adapter 返回 / 写回）

与需求一致：

- taskId, workerId (agentId), runId
- touchedFiles: string[]
- signatureChanges, newDependencies, brokenContracts（结构化，可 JSON）
- plainSummary: string

---

## 7. 依赖关系

- **context-manager**：无 server/db 依赖；仅 Node + 可选 better-sqlite3（或 sql.js）。
- **context-extractor**：依赖 context-manager（接口 + SQLite 实现）、ts-morph、git 调用。
- **server**：依赖 context-manager（builder + writeDiffSnapshot + SqliteContextStore）；不依赖 context-extractor。

---

## 8. File-by-File Patch Plan

### 8.1 新增包 `packages/context-manager`

| 文件 | 操作 | 说明 |
|------|------|------|
| `package.json` | 新增 | name: @paperclipai/context-manager，依赖 better-sqlite3（或 sql.js），无 db/server |
| `tsconfig.json` | 新增 | 继承 root/base，outDir dist |
| `src/types.ts` | 新增 | ModuleRow, GitChangeRow, DiffSnapshotRow, SubtaskScope, ContextBlock, ContextBuildOptions |
| `src/store.ts` | 新增 | ContextStore 接口（getModules, getGitChanges, getDiffSnapshots, upsertModules, upsertGitChanges, insertDiffSnapshot） |
| `src/sqlite-store.ts` | 新增 | SqliteContextStore 实现，建表（modules, git_changes, diff_snapshots），实现上述方法 |
| `src/builder.ts` | 新增 | buildContext(store, scope, options?)：读 store，组 context block，长度预算，返回字符串或对象 |
| `src/snapshot.ts` | 新增 | writeDiffSnapshot(store, snapshot)：校验 snapshot 字段，insertDiffSnapshot |
| `src/index.ts` | 新增 | 导出 types, store 接口, SqliteContextStore, buildContext, writeDiffSnapshot |

### 8.2 新增包 `packages/context-extractor`

| 文件 | 操作 | 说明 |
|------|------|------|
| `package.json` | 新增 | name: @paperclipai/context-extractor，依赖 @paperclipai/context-manager, ts-morph，CLI 入口 bin |
| `tsconfig.json` | 新增 | 继承 root/base |
| `src/extract-modules.ts` | 新增 | 使用 ts-morph 扫描目录，返回 ModuleRow[]（path, exports, imports, loc, lastModified） |
| `src/extract-git.ts` | 新增 | 调用 git log 等，返回 GitChangeRow[]（最近 7 天） |
| `src/run.ts` | 新增 | run(repoRoot, store)：extract modules + git，调用 store.upsertModules / upsertGitChanges |
| `src/cli.ts` | 新增 | CLI：解析 --repo-root、--db-path，创建 SqliteContextStore，调用 run() |
| `src/index.ts` | 新增 | 导出 run, extractModules, extractGit（供程序化调用） |

### 8.3 修改 `server`

| 文件 | 操作 | 说明 |
|------|------|------|
| `package.json` | 修改 | 增加依赖 "@paperclipai/context-manager": "workspace:*" |
| `src/services/heartbeat.ts` | 修改 | 在 executionWorkspace 就绪后、adapter.execute 前：创建 store(cwd)，buildContext(store, scope)，注入 context.paperclipContextBlock；在 adapter.execute 返回后：从 adapterResult.resultJson?.paperclipDiffSnapshot 或构造最小 snapshot，writeDiffSnapshot(store, snapshot) |

### 8.4 根 workspace

| 文件 | 操作 | 说明 |
|------|------|------|
| `pnpm-workspace.yaml` | 修改 | 确保 packages/* 已包含（context-manager、context-extractor 在 packages/ 下即可） |
| `tsconfig.json`（如有 project references） | 修改 | 添加 packages/context-manager、packages/context-extractor 的 reference |

---

## 9. 验收与顺序

1. **Phase 1.1**：context-manager 单元可测（builder 返回格式正确，snapshot 写入可读）。
2. **Phase 1.2**：在任意 TypeScript 仓库根执行 `pnpm exec context-extractor`（或类似），生成 `.paperclip/context.db`，且 context-manager 能读出。
3. **Phase 1.3**：跑一次 heartbeat 执行 run，检查 context 中带 paperclipContextBlock，run 结束后 DB 中有对应 diff_snapshot 记录（可为最小 snapshot）。

实现顺序：先 1.1，再 1.2，最后 1.3；每步小步提交、可验证。
