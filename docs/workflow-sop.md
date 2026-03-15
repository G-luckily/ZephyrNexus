# 日常工作 SOP（WSL 开发 → PR → SSH 运行）

本文件定义了一条可直接执行的日常工作路径，从 WSL 开发到 GitHub PR，再到 SSH 环境运行验证。

## 1. 在 WSL 准备工作区

1. 克隆或更新各仓库：

   ```bash
   cd ~
   # AetherStack（如果还没 clone）
   git clone git@github.com:your-org/AetherStack.git

   # paperclip / openclaw / browser-use 等业务仓库
   git clone git@github.com:your-org/paperclip.git
   # git clone git@github.com:your-org/openclaw.git
   # git clone git@github.com:your-org/browser-use.git
   ```

2. 在 AetherStack 中配置 `.env`（WSL 版本）：

   ```bash
   cd ~/AetherStack
   cp infra/env-templates/env.wsl.example .env
   vi .env
   ```

   - 设置：
     - `AETHERSTACK_ENV_PROFILE=wsl`
     - `PAPERCLIP_PATH=~/paperclip`（按实际路径修改）
     - `OPENCLAW_WORKSPACE_PATH=~/openclaw-workspace`（如有）
     - `BROWSER_USE_PATH=~/browser-use`（如有）
     - `AETHERSTACK_RUNTIME_DIR=./runtime`
     - `AETHERSTACK_LOG_DIR=./logs`

3. 运行健康检查，确认基础环境没大问题：

   ```bash
   source .env
   bash scripts/health-check.sh
   ```

## 2. 新建分支（AetherStack + 子仓库）

- 在 AetherStack：

  ```bash
  cd ~/AetherStack
  git checkout -b feat/aetherstack-<短描述>
  ```

- 在 paperclip：

  ```bash
  cd ${PAPERCLIP_PATH}
  git checkout -b feat/paperclip-<短描述>
  ```

> 约定：AetherStack 的控制平面变更和 paperclip 的业务变更可以分开提 PR，但要在 PR 描述中相互引用。

## 3. 本地修改与验证

1. 修改 AetherStack 的配置/脚本/文档：

   - `workspace.config.json`
   - `scripts/start-all.sh` / `scripts/stop-all.sh` / `scripts/health-check.sh`
   - `docs/*.md` / `docs/runbooks/*.md`

2. 启动与自检：

   ```bash
   cd ~/AetherStack
   source .env

   # 健康检查
   bash scripts/health-check.sh

   # 一键启动
   bash scripts/start-all.sh
   ```

3. 打开 paperclip 页面进行手工验证：

   - 在浏览器访问 `http://localhost:<paperclip-port>`（如 3000）
   - 执行本次改动相关的关键用例（例如：新的 Agent、新的工作流等）

4. 如有对 paperclip 的改动：

   - 在 paperclip 仓库中跑测试、lint 等。

## 4. 提交与推送到 GitHub

- 对 AetherStack：

  ```bash
  cd ~/AetherStack
  git status
  git add .
  git commit -m "feat: <简要描述 aetherstack 改动意图>"
  git push -u origin feat/aetherstack-<短描述>
  ```

- 对 paperclip：

  ```bash
  cd ${PAPERCLIP_PATH}
  git status
  git add .
  git commit -m "feat: <简要描述 paperclip 改动意图>"
  git push -u origin feat/paperclip-<短描述>
  ```

## 5. 在 GitHub 上开 PR

1. AetherStack PR 标题示例：
   - `feat: bootstrap AetherStack control-plane repository`
   - `feat: improve AetherStack start/stop/healthcheck scripts`

2. AetherStack PR 描述建议结构：

   ```markdown
   ## 背景

   - 简要说明这次为什么要改控制平面（例如：支持 openclaw、加强健康检查、补 runbook 等）。

   ## 变更内容

   - [x] 更新 workspace.config.json
   - [x] 调整 start-all / stop-all / health-check 行为
   - [x] 补充/更新架构文档或 Runbook

   ## 验证记录（WSL）

   - [x] source .env
   - [x] bash scripts/health-check.sh
   - [x] bash scripts/start-all.sh
   - [x] 打开 paperclip 页面，验证 <关键用例>

   ## 关联改动

   - paperclip PR: <link>
   ```

3. paperclip PR 按自身仓库要求书写，注意：
   - 在“关联改动”中引用对应的 AetherStack PR。

## 6. PR merge 后在 SSH 上拉最新并验证

1. 在 SSH 上更新 AetherStack：

   ```bash
   cd ~/AetherStack
   git pull origin main
   cp infra/env-templates/env.ssh.example .env  # 首次使用时
   vi .env   # 确认 SSH 路径正确
   source .env
   bash scripts/health-check.sh
   bash scripts/start-all.sh
   ```

2. 在 SSH 上更新各子仓库：

   ```bash
   cd ${PAPERCLIP_PATH}
   git pull origin main
   # 按需重启 paperclip 服务（如果不是由 AetherStack 启动）

   cd ${OPENCLAW_WORKSPACE_PATH}
   git pull origin main
   # 重启 openclaw（如由 AetherStack 启动，可通过 stop-all + start-all）
   ```

3. 在 SSH 环境打开 paperclip 页面验证：
   - 从外部浏览器访问对应的 SSH 地址/端口（视反向代理/端口映射而定）。

4. 如发现问题：
   - 记录在 `docs/runbooks/runbook-troubleshoot-healthcheck.md` 中。
   - 视情况在 WSL 上修复并重新走 PR 流程。

## 7. 出问题如何回滚（简要）

详细见 `docs/runbooks/runbook-rollback.md`，这里只给大纲：

- 控制平面（AetherStack）：
  - 在 WSL 上通过 `git revert` 回滚问题 commit 或 PR。
  - 提交新的“回滚 PR”，描述原因与影响。
  - 合并后，让 SSH 上 `git pull` 回到安全版本。

- 业务仓库（paperclip / openclaw / browser-use）：
  - 同样只在 WSL 上操作回滚。
  - 通过 PR 合入 main，再在 SSH 上 `git pull`。

> 关键点：**不要在 SSH 上直接 reset --hard 或改历史，所有回滚都通过 GitHub 记录下来。**

