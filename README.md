# 🌪️ ZephyrNexus（风之灵枢）

> **AI 智能体编排系统 · 现场演示指南**
>
> AI 公司级控制平面——统一管理智能体、任务、组织与运行监控。

---

## 📋 前置条件

在启动前，请确认以下环境已准备好：

| 依赖项 | 最低版本 | 检查命令 |
|--------|---------|---------|
| Node.js | >= 20 | `node -v` |
| pnpm | >= 9 | `pnpm -v` |
| Git | 任意 | `git --version` |

> **推荐运行环境：WSL（Linux）或 macOS**。Windows 原生环境下，数据库将由系统自动管理（embedded-postgres），建议在 WSL 终端中执行以下所有命令。

---

## 🚀 一键启动（首次 / 现场演示）

```bash
# 第一步：进入项目目录
cd ~/workspace/ZephyrNexus   # Linux/WSL
# 或
cd C:\Users\Guo\Documents\GitHub\ZephyrNexus   # Windows PowerShell

# 第二步：安装依赖（首次运行，约 30 秒）
pnpm install

# 第三步：启动开发服务器
pnpm dev
```

启动成功后，终端将打印类似如下内容：

```
[Zephyr Nexus] ✨ Server ready
  API:  http://127.0.0.1:3100
  UI:   http://127.0.0.1:3100
  DB:   embedded-postgres (auto-initialized)
```

📌 **打开浏览器访问：http://localhost:3100**

---

## 🎬 演示路线（Showcase Flow）

启动成功后，按以下顺序向观众演示：

### 1. Dashboard 总览
- 打开 `http://localhost:3100`
- 展示：**运行中智能体数量、任务链路、系统指标**

### 2. 创建公司（Company）
- 点击左上角 **「新建公司」**
- 填写公司名称（例如：`TalentForce AI`）
- 展示：多组织管理能力

### 3. 招募智能体（Agent）
- 进入公司 → **「智能体」** 面板
- 点击 **「招募智能体」**，选择角色（如：HR Director、Resume Screener）
- 展示：角色分工、权限配置

### 4. 创建任务（Issue）
- 进入 **「任务看板」**
- 创建新 Issue，分配给对应智能体
- 展示：任务状态流转（`todo → in progress → in review → done`）

### 5. 智能体心跳（Heartbeat）
- 打开某个智能体详情页
- 展示：实时活动日志、执行记录、Token 用量审计

### 6. 治理与成本控制
- 进入 **「设置」→「预算与策略」**
- 展示：预算上限、权限约束、审计日志

---

## ⚙️ 配置说明（可选）

系统支持三种数据库模式，按优先级：

```
1. DATABASE_URL 环境变量（外部 PostgreSQL，推荐生产）
2. Docker Compose（docker-compose.yml 自带 postgres:17）
3. Embedded PostgreSQL（零配置，自动启动，推荐演示）
```

### 使用 Docker 数据库（若 embedded 有问题）

```bash
# 启动 PostgreSQL 容器
docker compose up db -d

# 以外部 DB 模式启动服务
DATABASE_URL=postgres://zephyr:zephyr_nexus@localhost:5432/zephyr_nexus pnpm dev
```

### 环境变量速查

```bash
DATABASE_URL        # 外部 PostgreSQL 连接字符串
PORT                # API 服务端口（默认 3100）
ZEPHYR_HOME         # 数据目录（默认 ~/.zephyr-nexus）
ZEPHYR_MIGRATION_AUTO_APPLY=true  # 自动应用数据库迁移
```

---

## 📁 项目结构

```
ZephyrNexus/
├── ui/          → 前端 Dashboard（React + Vite）
├── server/      → 后端 API + 调度引擎（Express + TypeScript）
├── packages/
│   ├── db/              → 数据库层（Drizzle ORM）
│   ├── adapters/        → 多模型适配器（Claude / Codex / Cursor / OpenClaw）
│   ├── context-manager/ → 上下文管理
│   └── shared/          → 共享类型与常量
├── scripts/     → 启动/停止/健康检查脚本
└── docs/        → 架构文档与开发指南
```

---

## 🛠️ 常用命令速查

```bash
pnpm dev                    # 启动开发服务器（UI + API 热更）
pnpm dev:server             # 单独启动后端
pnpm dev:ui                 # 单独启动前端
pnpm db:migrate             # 手动执行数据库迁移
pnpm doctor                 # 系统健康检查
pnpm test                   # 运行单元测试
```

---

## 🔍 健康检查 & 常见问题

### 检查系统状态

```bash
pnpm doctor
# 或
./scripts/health-check.sh
```

### 常见问题排查

| 现象 | 原因 | 解决方案 |
|------|------|---------|
| `ERR_CONNECTION_REFUSED` at :3100 | 服务未启动 | 检查终端是否有报错，重新运行 `pnpm dev` |
| `28P01` 认证失败 | 旧版 embedded-postgres 数据残留 | 删除 `~/.zephyr-nexus/instances/default/db` 后重启 |
| 端口被占用 | 其他进程占用 3100 | 系统会自动选择下一个可用端口，查看终端输出 |
| 缺少 Node.js | 版本过低 | 安装 Node.js >= 20（推荐 nvm 管理） |
| Windows 下 embedded-postgres 报错 | 二进制兼容性问题 | 使用 WSL 或通过 Docker 方式运行 |

### 重置数据库（演示前清空）

```bash
# 删除 embedded postgres 数据目录后重启即可自动重建
rm -rf ~/.zephyr-nexus/instances/default/db
pnpm dev
```

---

## 📡 服务端口一览

| 服务 | 端口 | 说明 |
|------|------|------|
| UI + API | 3100 | 统一入口，UI 通过 API 代理 |
| Embedded PostgreSQL | 54329 | 内嵌数据库（自动管理，无需手动操作） |
| OpenClaw Gateway | 18789 | 智能体执行网关（可选） |

---

## 🧠 系统架构速览

```
                    ┌─────────────────────────┐
                    │     Browser / Client     │
                    └────────────┬────────────┘
                                 │ HTTP / WebSocket
                    ┌────────────▼────────────┐
                    │   ZephyrNexus Server     │
                    │  (Express + tsx, :3100)  │
                    └──┬──────────────────┬───┘
                       │                  │
          ┌────────────▼──┐    ┌──────────▼──────────┐
          │  PostgreSQL   │    │    Agent Adapters    │
          │  (embedded /  │    │  Claude / Codex /    │
          │   Docker)     │    │  Cursor / OpenClaw   │
          └───────────────┘    └─────────────────────┘
```

---

*Powered by ZephyrNexus · Built for the Autonomous Era · MIT © 2026*
