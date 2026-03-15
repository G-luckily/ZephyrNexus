# AetherStack 控制平面仓库

## AetherStack 是什么

AetherStack 是整个平台的 **控制平面仓库（control-plane repository）**，负责：

- 定义平台级的 **架构视图** 与 **协作关系**
- 维护一个 **仓库注册表（repo registry）**，记录 paperclip / openclaw / browser-use 等子仓库
- 提供 **一键启动 / 一键停机 / 健康检查** 脚本入口
- 管理 **环境模板（env templates）** 与 **workspace 配置**
- 提供可复用的 **Runbook / SOP / GitHub 管理策略**

它是整个系统的 **总开关与统一入口**。

## AetherStack 不是什么

AetherStack **不是**：

- 业务源码仓库  
  - 不包含 paperclip 源码  
  - 不包含 openclaw 源码  
  - 不包含 browser-use 源码
- monorepo 或“所有代码的大杂烩”
- 运行态或数据仓库  
  - 不承载 runtime 数据、日志、pid、数据库文件、WSL 本机临时状态
- secrets 仓库  
  - 不直接保存 .env、密钥、token 等敏感信息（只提供模板）

简化理解：**这里只有“定义”和“控制”，没有“业务实现”和“运行态”**。

## 为什么存在

- 你的真实工程现实（最新架构、guardrails、成本治理、review 脚本等）分散在多个 environment（WSL / SSH / GitHub）。
- AetherStack 统一这些现实：  
  - 用统一的 **配置文件（workspace.config.json）** 表达“平台应该是什么样”
  - 用 **脚本** 一键拉起或关闭关键服务
  - 用 **文档与 Runbook** 指导自己和未来的协作者，如何在 WSL / SSH / Windows 下协同维护

只要 AetherStack 启动成功，你就可以：

1. 打开 paperclip 页面（作为前台控制台）
2. 在 paperclip 里调度 Agent / Issue / Cost 等
3. AetherStack 自己退居幕后，继续作为“统一入口与控制平面”的定义源。

## 仓库结构概览

```text
.
├─ README.md                  # 本文件
├─ workspace.config.json      # 控制平面主配置（repo, services, env profiles, path mappings）
├─ .gitignore                 # 确保只提交定义，不提交运行态
├─ docs/
│  ├─ architecture.md         # 平台架构与角色定位
│  ├─ repo-registry.md        # 仓库注册表
│  ├─ github-management-strategy.md   # GitHub 代管与协作策略
│  ├─ workflow-sop.md         # 日常开发与部署 SOP
│  └─ runbooks/
│     ├─ runbook-startup.md
│     ├─ runbook-troubleshoot-healthcheck.md
│     └─ runbook-rollback.md
├─ scripts/
│  ├─ start-all.sh            # 一键启动平台
│  ├─ stop-all.sh             # 一键停机
│  └─ health-check.sh         # 健康检查
└─ infra/
   ├─ env-templates/
   │  ├─ .env.example
   │  ├─ env.wsl.example
   │  ├─ env.ssh.example
   │  └─ env.windows.example
   └─ docker/
      └─ docker-compose.example.yml
```

## 快速开始

### 1. 准备环境变量

复制适合当前环境的模板，并按需修改路径与参数：

```bash
cd ~/AetherStack

# 例如在 WSL 中
cp infra/env-templates/env.wsl.example .env
# 或者在 SSH Linux
cp infra/env-templates/env.ssh.example .env
```

然后编辑 `.env`，设置至少以下变量（具体见 `.env.example`）：

- `PAPERCLIP_PATH`
- `OPENCLAW_WORKSPACE_PATH`
- `BROWSER_USE_PATH`
- `AETHERSTACK_RUNTIME_DIR`
- `AETHERSTACK_LOG_DIR`
- `AETHERSTACK_ENV_PROFILE`（例如：wsl / ssh / windows）

### 2. 运行健康检查

```bash
cd ~/AetherStack
source .env
bash scripts/health-check.sh
```

- 如果输出整体 **PASS** 或主要为 **PASS / WARN**，说明环境大体可用。
- 如果有 **FAIL**，参考 `docs/runbooks/runbook-troubleshoot-healthcheck.md` 排查。

### 3. 一键启动平台

```bash
cd ~/AetherStack
source .env
bash scripts/start-all.sh
```

脚本将：

- 按顺序尝试启动：
  - paperclip
  - openclaw（如存在）
  - browser-use（如存在）
- 将 pid 和日志写入 `AETHERSTACK_RUNTIME_DIR` / `AETHERSTACK_LOG_DIR`
- 对不存在路径 / 命令的服务，给出明确提示并跳过，而不是直接崩溃
- 在最后输出总结，包括：
  - 已启动的服务列表
  - 被跳过的服务及原因
  - paperclip 页面可能访问的地址/端口（例如 `http://localhost:3000`）

### 4. 一键停机

```bash
cd ~/AetherStack
source .env
bash scripts/stop-all.sh
```

脚本将根据 pid 文件，尽量只停止由 AetherStack 启动的进程，避免误杀无关进程。

### 5. 打开 paperclip 页面

一旦 `start-all.sh` 成功启动 paperclip，你可以在浏览器中打开：

- `http://localhost:3000`（示例，具体端口见 `workspace.config.json` 与本地实际配置）

在 paperclip 页面中，你可以：

- 查看并调度 Agent
- 查看 Issue / Cost
- 操作前台编排逻辑

此时 AetherStack 继续扮演 **控制平面仓库** 的角色，不参与业务逻辑，只负责定义与控制。

## 跨环境说明（WSL / SSH / Windows）

- **WSL**
  - 主要开发环境：写代码、跑测试、启动本地服务。
  - AetherStack 的脚本和配置以 Linux shell 为主，完全兼容 WSL。
- **SSH Linux**
  - 主要运行环境：部署 / 长期运行服务。
  - 使用同一套 AetherStack 仓库 + `.env` + `workspace.config.json`，通过路径映射适配 SSH 路径。
- **Windows 编辑环境**
  - 主要用于：编辑文件、提交 PR。
  - 不要求在 Windows 原生环境直接运行脚本（但仍可在 Git Bash / WSL 下运行）。
  - AetherStack 的 `environmentProfiles` 中会为 Windows 提供单独的路径模板。

## Git 同步策略：只同步定义，不同步运行态

- GitHub 代管的是：
  - 文档（docs）
  - 配置（workspace.config.json）
  - 脚本（scripts）
  - env 模板（infra/env-templates/*.example）
- GitHub 不代管：
  - `.env` 实际文件
  - `runtime/`、`logs/`、`tmp/` 等运行态
  - PID 文件、数据库文件、业务日志

具体规则见 `.gitignore` 与 `docs/github-management-strategy.md`。

