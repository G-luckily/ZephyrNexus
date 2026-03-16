# Runbook：回滚与停机策略

本 Runbook 说明在出现问题时，如何安全地回滚控制平面（AetherStack）和业务仓库（paperclip 等），以及如何使用停机脚本保护成本与稳定性。

## 1. 判定何时需要回滚

典型触发条件：

- AetherStack 的脚本/配置变更导致：
  - `start-all` / `health-check` 无法通过
  - 关键服务无法启动或频繁崩溃
- paperclip / openclaw / browser-use 的变更导致：
  - 平台出现大面积 5xx
  - 核心流程完全不可用
- 成本或风险控制失效：
  - 不受控的高成本调用
  - Agent 触发路径异常扩散

一旦满足以上之一，可以考虑“先恢复到最近的稳定版本”，再慢慢分析问题原因。

## 2. 快速停机（保护成本与状态）

无论是控制平面还是业务问题，第一步通常是**控制损失**：

1. 在出现问题的环境（通常是 SSH）中执行：

   ```bash
   cd ~/ZephyrNexus
   source .env
   bash scripts/stop-all.sh
   ```

2. 观察输出，确认：
   - 关键服务（paperclip / openclaw / browser-use 等）都已被杀掉。
   - 对于无法停止的 PID，脚本会给出 WARN，可手动进一步排查。

3. 根据需要，可以停更广范围的服务（数据库、队列等），但这些不由 AetherStack 直接管理。

## 3. 回滚 AetherStack 控制平面改动（WSL 端）

> 所有结构性回滚都建议在 WSL 进行，再通过 GitHub 同步到 SSH。

1. 在 WSL 上切换到 AetherStack 仓库：

   ```bash
   cd ~/ZephyrNexus
   git fetch origin
   git checkout main
   ```

2. 找到最近“已知稳定”的 commit 或 tag：
   - 可以在 GitHub 上浏览 commit 历史与 tag。

3. 使用 `git revert` 回滚问题 commit 或 PR：

   ```bash
   # 回滚单个 commit
   git revert <bad_commit_sha>

   # 或回滚某个 merge PR 的 merge commit
   git revert <merge_commit_sha>
   ```

4. 创建新的回滚分支并推送：

   ```bash
   git checkout -b fix/aetherstack-rollback-<简短原因>
   git push -u origin fix/aetherstack-rollback-<简短原因>
   ```

5. 在 GitHub 上发起回滚 PR，描述：
   - 回滚的 commit/PR 标识
   - 问题现象
   - 回滚后在 WSL 上的验证步骤（`health-check` / `start-all`）

6. PR 合并后，在 SSH 上执行：

   ```bash
   cd ~/ZephyrNexus
   git pull origin main
   source .env
   bash scripts/health-check.sh
   bash scripts/start-all.sh
   ```

## 4. 回滚业务仓库（paperclip 等）

1. 同样在 WSL 上操作：

   ```bash
   cd ${PAPERCLIP_PATH}
   git fetch origin
   git checkout main
   ```

2. 使用 `git revert` 撤销问题变更：

   ```bash
   git revert <bad_commit_or_merge_commit>
   git checkout -b fix/paperclip-rollback-<简短原因>
   git push -u origin fix/paperclip-rollback-<简短原因>
   ```

3. 在 GitHub 上创建 PR，描述：
   - 回滚哪个 PR/commit
   - 线上/WSL 上遇到的具体问题
   - 回滚后已在 WSL 验证的行为

4. PR 合并后，在 SSH：

   ```bash
   cd ${PAPERCLIP_PATH}
   git pull origin main
   # 重启服务（可通过 AetherStack：stop-all + start-all）
   ```

## 5. 避免 SSH 上直接改历史

不推荐在 SSH 上执行以下操作：

- `git reset --hard <commit>`
- `git push --force`
- 直接在 SSH 上修改脚本/配置而不回写到 GitHub

风险：

- SSH 与 GitHub main 发生不可见漂移。
- 回滚难以在 GitHub 上清晰表达。
- 未来自己也难以回忆当时改了什么。

正确姿势：

- 即使是在线上紧急修复：
  - 也应尽快在 WSL 上“复刻”同样修改并通过 PR。
  - 一旦 PR merge，SSH 通过 `git pull` 与 main 对齐。

## 6. 回滚后的验证

1. 在 WSL：

   ```bash
   cd ~/ZephyrNexus
   source .env
   bash scripts/health-check.sh
   bash scripts/start-all.sh
   ```

   - 打开 paperclip 页面，验证关键路径。

2. 在 SSH：

   ```bash
   cd ~/ZephyrNexus
   git pull origin main
   source .env
   bash scripts/health-check.sh
   bash scripts/start-all.sh
   ```

3. 如果回滚后仍有问题：
   - 记录在本文件下方的“案例记录”区域。

## 7. 案例记录（留给未来自己补充）

> 建议每次发生“需要回滚”的事件，都在这里记录一条简要时间线，帮助未来快速回忆。

- **案例模板：**

  - 时间：YYYY-MM-DD
  - 环境：WSL / SSH / 其它
  - 症状：简要描述问题（例如：start-all 无法启动 paperclip，health-check FAIL）
  - 影响面：只有自己 / 准线上 / 正式线上
  - 采取措施：
    - 停机方式（是否使用 stop-all）
    - 回滚 commit/PR 的 ID
    - 是否修改了 `.env` / `workspace.config.json`
  - 结论：本次回滚是否彻底解决问题，有无后续 TODO

