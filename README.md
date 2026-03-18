# ZephyrNexus（风之灵枢）

> AI Orchestration System

ZephyrNexus 是一个面向“智能体公司化协作”的控制平面与应用系统，用于统一管理组织结构、任务编排、运行监控、治理策略与多适配器执行。

## 项目定位

- 产品名：`Zephyr Nexus`
- 中文显示名：`风之灵枢`
- 系统描述：`AI Orchestration System`
- 仓库名：`ZephyrNexus`
- 主服务名：`zephyr-nexus`

## 核心能力

- 多组织/多部门智能体编排与治理
- 仪表盘级运行态观测（任务链、系统指标、组织运行、活跃智能体）
- Issue/任务驱动的执行闭环
- 成本、预算、权限、审计与策略约束
- 多适配器协同（OpenClaw / Codex / Cursor / Claude Code 等）

## 仓库结构（Monorepo）

- `ui/`：前端应用（Dashboard、任务、智能体、组织视图）
- `server/`：后端 API、调度、适配器编排、业务路由
- `packages/`：共享包（db、adapters、utils 等）
- `scripts/`：启动、停止、健康检查、烟测脚本
- `docs/` / `doc/`：运行手册、架构与开发文档
- `workspace.config.json`：服务与环境映射配置

## 快速启动

### 1. 安装依赖

```bash
cd /home/guo/workspace/ZephyrNexus
pnpm install
```

### 2. 应用开发模式

```bash
pnpm dev
```

- UI: `http://localhost:3000`
- API: `http://localhost:3100`

## 平台统一入口 (Unified Control Entry)

ZephyrNexus 提供了一组统一的入口脚本供不同场景使用：
- `pnpm dev`：纯本地前端/后端热更开发态。
- `pnpm platform:start`：按 `workspace.config.json` 以后台/生产方式启动所有启用服务。
- `pnpm platform:stop`：停止系统。
- `pnpm platform:doctor`：检查各核心服务（包含 Docker 容器和本地 Node 进程）是否正常运行。
- `pnpm smoke:openclaw-docker-ui`：专项一键启动内嵌的 OpenClaw 控制与网关容器。

## 平台化配置分层 (Configuration Layering)

平台执行层（OpenClaw）采用严格的三层配置稳固架构，避免配置丢失或被覆盖：

1. **Baseline Default (`~/.zephyr-nexus/openclaw/openclaw.json`)**
   由启动脚本（smoke）在首次启动时生成，保障最基础的可用网关端口和模型基线。
   *重置机制*：空文件不覆盖有效值，重启时只做关键键值的选择性更新。

2. **Local Override (`.env` / `~/.secrets` / 环境变量)**
   专门用于注入敏感配置，例如 `OPENROUTER_API_KEY`、`OPENAI_API_KEY`，覆盖基线配置。确保敏感数据绝不落盘写入普通的 `json` 配置文件。

3. **Agent-Specific Override (`auth-profiles.json`)**
   为特定智能体（如 Main Session）在运行时生成的专用权限或模型上下文，覆盖前两层配置。

### 3. 控制平面脚本（推荐）

```bash
./scripts/health-check.sh
./scripts/start-all.sh
./scripts/stop-all.sh
```

默认读取：

- `ZEPHYR_NEXUS_ENV_PROFILE`（如 `wsl` / `ssh` / `windows`）
- `ZEPHYR_NEXUS_RUNTIME_DIR`
- `ZEPHYR_NEXUS_LOG_DIR`



### 4. OpenClaw OAuth 启动（无 API Key）

```bash
pnpm smoke:openclaw-docker-ui:oauth
```

或：

```bash
OPENCLAW_PROVIDER_AUTH_MODE=oauth pnpm smoke:openclaw-docker-ui
```

## 配置入口

- 工作区配置：[workspace.config.json](workspace.config.json)
- 身份与品牌：[IDENTITY.md](IDENTITY.md)
- 开发说明：[doc/DEVELOPING.md](doc/DEVELOPING.md)
- OpenClaw 接入：[doc/OPENCLAW_ONBOARDING.md](doc/OPENCLAW_ONBOARDING.md)

## 命名规范

项目内所有面向用户/团队协作的命名统一使用 `ZephyrNexus / Zephyr Nexus / 风之灵枢`。旧命名仅在兼容变量或历史迁移上下文中保留。

MIT &copy; 2026 ZephyrNexus
