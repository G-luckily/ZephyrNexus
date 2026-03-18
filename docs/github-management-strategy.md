# Quick checklist（for future me）

1. **在 WSL 改代码**
   - 控制平面相关改动 → 改 `~/ZephyrNexus`（ZephyrNexus 仓库）。
   - 业务逻辑 / UI 改动 → 改 `~/paperclip`（`G-luckily/paperclip` 仓库）。

2. **本地自测**
   - 在 `~/ZephyrNexus`：
     - `bash scripts/health-check.sh`
     - `bash scripts/start-all.sh`
   - 打开 `http://localhost:3000`，在 Paperclip 页面上验证本轮改动。

3. **提交到自己的 GitHub 仓库**
   - ZephyrNexus：
     - `git commit` → `git push origin <branch>`（或直接 push 到 main）。
   - paperclip：
     - `git commit` → `git push origin <branch>`（或直接 push 到 master）。

4. **可选：在自己仓库里开 PR（self-PR）**
   - 需要多看一眼变更时，用 PR 做分支→主干的合并记录。
   - 不需要给官方提 PR，一切都在 `G-luckily/*` 名下完成。

5. **WSL → SSH 同步**
   - 在 SSH 主机：
     - `cd ~/ZephyrNexus && git pull origin main`
     - 更新 `.env`（如需要）并执行：
       - `bash scripts/health-check.sh`
       - `bash scripts/start-all.sh`
   - 对 `~/paperclip`：
     - `cd ~/paperclip && git pull origin master`
     - 如不是由 ZephyrNexus 统一启动，则按需要手动重启。

6. **只允许 ZephyrNexus 启停**
   - 不在 SSH 上单独启动散落的服务。
   - 一切启停/检查都通过：
     - `bash scripts/start-all.sh`
     - `bash scripts/stop-all.sh`
     - `bash scripts/health-check.sh`

7. **出现问题时**
   - 回到 WSL：
     - 用 `git revert` / 新 commit 修复问题，再 push 回 `G-luckily/ZephyrNexus` 和 `G-luckily/paperclip`。
   - SSH 永远只做 `git pull` + ZephyrNexus 脚本，不在 SSH 上直接改代码。

# GitHub 代管与协作策略

## 1. GitHub 是“最终真相来源”

- 所有关键定义与代码的“真相版本”都以 GitHub 为准：
  - ZephyrNexus：控制平面定义、脚本、配置、Runbook、SOP
  - paperclip：前台控制台业务逻辑
  - openclaw / browser-use：各自的业务与运行时代码
- WSL / SSH / Windows 环境都是这些仓库的 **clone 或工作副本**：
  - 在本地修改，只是暂时偏离“真相”
  - 一旦 PR 合并到 GitHub，GitHub 上的 main 分支才是最新权威版本

> 原则：**任何你希望“未来自己还能记得”的东西，都应该最终进入 GitHub，而不是只留在 SSH/WSL 的本地改动中。**

## 2. WSL / SSH / GitHub / Windows 的职责边界

- **WSL**
  - 主要开发环境：
    - 写代码
    - 跑本地测试
    - 修改 ZephyrNexus 的脚本与配置
  - 输出：高质量 commit 与 PR。

- **SSH Linux**
  - 主要运行/部署环境：
    - `git pull` 获取 GitHub 最新定义
    - 运行 `scripts/start-all.sh` / `stop-all.sh` / `health-check.sh`
  - 不在 SSH 上直接进行结构性开发（除应急 hotfix，且需要随后回写到 GitHub）。

- **Windows 编辑环境**
  - 主要用于编辑文件、使用 IDE（包括 Cursor）提升开发体验：
    - 可以在 Windows + WSL 组合下使用 ZephyrNexus/paperclip 等仓库
  - 真正运行依托 WSL/SSH，不需要在 “纯 Windows” 上直接跑所有脚本。

- **GitHub**
  - 负责任务：
    - 管理所有仓库的远程真相版本
    - PR 审查、合并、历史记录与回滚点
    - 权限控制与协作审计

## 3. 哪些改动进 ZephyrNexus，哪些进 paperclip

- **进 ZephyrNexus 的改动**
  - 平台级架构文档调整（`docs/architecture.md`, `docs/repo-registry.md`）
  - 启动/停机/健康检查脚本的修改（`scripts/*.sh`）
  - `workspace.config.json`（服务映射、仓库清单、环境 profile）
  - env 模板与 Runbook/SOP 修改（`infra/env-templates/*`, `docs/runbooks/*`, `docs/workflow-sop.md`）
  - GitHub 管理策略、运维流程变更（本文件）

- **进 paperclip 的改动**
  - UI / 后端业务逻辑
  - Agent 编排方式
  - 与 openclaw / browser-use 的交互细节（API 协议、数据结构等）
  - paperclip 自己的 README/SOP

## 4. PR 管理改动的流程

1. **在 WSL 创建 feature 分支**
   - ZephyrNexus：
     - `git checkout -b feat/zephyr-nexus-<短描述>`
   - paperclip：
     - `git checkout -b feat/paperclip-<短描述>`

2. **本地修改并测试**
   - ZephyrNexus：
     - `source .env`
     - `bash scripts/health-check.sh`
     - `bash scripts/start-all.sh`
   - paperclip：
     - 运行单测 / 集成测试
     - 启动本地 dev 服务器，并在浏览器中验证关键用例

3. **提交到 GitHub**
   - ZephyrNexus：
     - `git status`
     - `git add .`
     - `git commit -m "feat: <简要描述 zephyr-nexus 改动意图>"`
     - `git push -u origin feat/zephyr-nexus-<短描述>`
   - paperclip 同理。

4. **在 GitHub 上创建 PR**
   - 标题示例：
     - ZephyrNexus：`feat: improve ZephyrNexus startup and healthcheck`
     - paperclip：`feat: new agent dashboard in paperclip`
   - 描述中必须写明：
     - 变更内容概述
     - 影响面（仅控制平面？还是也影响业务行为？）
     - 已在 WSL 上执行的验证步骤（命令 + 简要说明）
     - 如涉及 SSH 环境，是否需要额外手工操作

5. **审查通过后合并到 main**
   - main 分支始终保持“可部署、可启动”的状态。

## 5. merge 后如何同步到 SSH

1. 在 SSH 上同步 ZephyrNexus：

   ```bash
   cd ~/ZephyrNexus
   git pull origin main
   source .env   # SSH 专用 .env
   bash scripts/health-check.sh
   bash scripts/start-all.sh
   ```

2. 在 SSH 上同步各子仓库：

   ```bash
   cd ${PAPERCLIP_PATH}
   git pull origin main
   # 如有必要，重启 paperclip 对应服务

   cd ${OPENCLAW_WORKSPACE_PATH}
   git pull origin main
   # 按需重启 openclaw
   ```

3. 再次打开 paperclip 页面，确认平台可用。

## 6. 为什么 SSH 不应该长期手改代码

- 在 SSH 上直接 `vim` 改脚本、改代码的风险：
  - 容易形成“线上版本”和 GitHub main 分支的 **长期漂移**。
  - 回滚和问题复盘变得困难（没有清晰 commit 记录）。
  - 未来自己也会忘记哪些改动是“临时线上改”、哪些在仓库中有记录。

- 正确模式：
  - 即使在 SSH 上临时 hotfix 也必须：
    - 在 WSL 或本地重新实现对应修改
    - 提交 PR 到 GitHub
    - merge 后通过 `git pull` 同步到 SSH

> 一句话：**线上环境只跑 GitHub main，所有改动最终都要回到 PR 流程。**

## 7. 分支策略（建议）

- **ZephyrNexus**
  - `main`：稳定可运行的控制平面定义，SSH 优先跟随此分支。
  - `develop`（可选）：大改动缓冲区。
  - `feat/*`：新功能，比如 `feat/zephyr-nexus-healthcheck-openclaw`。
  - `fix/*`：缺陷修复，比如 `fix/start-all-handle-missing-paths`。
  - `chore/*`：杂项（CI、格式化、脚手架等）。
  - `docs/*`：只改文档。

- **paperclip / openclaw / browser-use**
  - 可采用类似命名规则，保持认知一致：
    - `main`, `develop`, `feat/*`, `fix/*`, `chore/*` 等。

## 8. 回滚策略（概要）

- **回滚 ZephyrNexus 控制平面改动**
  - 在 WSL：
    1. 找到引入问题的 commit 或 PR。
    2. 使用 `git revert <commit>` 或基于 tag 回退。
    3. 打一个明确的回滚 PR，说明：
       - 回滚原因
       - 影响面评估
       - 已做的验证（`health-check` / `start-all`）。
    4. PR 合并后，在 SSH 上 `git pull`。

- **回滚 paperclip 业务改动**
  - 同样在 WSL：
    1. `git revert` 问题 PR 对应的 merge commit。
    2. 提交回滚 PR，说明影响面与风险。
    3. merge 后 SSH `git pull` 并重启相关服务。

- **避免 SSH 改动漂移**
  - 若 SSH 必须紧急修复：
    - 视为临时手术，立即在 WSL 复现并走 PR。
    - 一旦 PR 合入 main，SSH 通过 `git pull` 与 main 对齐。

## 9. 日常维护节奏（可执行）

1. 在 WSL 开发：
   - 从 main 切 feature 分支。
   - 修改 ZephyrNexus / paperclip / openclaw / browser-use 等。
2. 本地验证：
   - `source .env`
   - `bash scripts/health-check.sh`
   - `bash scripts/start-all.sh`，打开 paperclip 页面检查行为。
3. 推送到 GitHub：
   - `git push -u origin <feature-branch>`
   - 在 GitHub 上创建 PR。
4. PR 合并后：
   - 在 SSH：
     - `cd ~/ZephyrNexus && git pull origin main`
     - `source .env && bash scripts/health-check.sh && bash scripts/start-all.sh`
   - 对相关子仓库重复 `git pull` + 重启。
5. 记录异常与调整：
   - 任意异常、经验教训，都写入：
     - `docs/runbooks/*.md` 或
     - `docs/workflow-sop.md`
   - 通过 PR 更新，让运维经验沉淀在仓库内部。

