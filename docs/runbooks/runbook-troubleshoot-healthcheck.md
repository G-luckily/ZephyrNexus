# Runbook：健康检查（health-check）排查指南

当你执行 `bash scripts/health-check.sh` 出现 FAIL 或大量 WARN 时，可以按本 Runbook 排查。

## 1. 快速理解输出结构

健康检查脚本会输出三段关键信息：

1. **基础命令检查**
2. **路径与配置检查**
3. **服务进程检查（基于 pid 文件）**

最后给出：

```text
整体健康状态：PASS / WARN / FAIL
```

- **PASS**：整体看起来没问题。
- **WARN**：有非致命问题（如某些服务没启用/没配置），但核心控制平面仍可工作。
- **FAIL**：存在必须修的错误（如基础命令缺失、关键路径不存在）。

## 2. 基础命令检查失败

典型输出：

```text
FAIL: 未找到命令：jq
整体健康状态：FAIL
```

处理方法（以 Ubuntu/WSL 为例）：

```bash
sudo apt-get update
sudo apt-get install -y jq
```

安装完成后重新执行：

```bash
cd ~/ZephyrNexus
source .env
bash scripts/health-check.sh
```

## 3. 路径与配置检查失败

典型输出：

```text
FAIL: 服务 paperclip 路径不存在：/home/guo/paperclip
```

或：

```text
WARN: 服务 openclaw 无法解析到路径（env + config 未配置），若该服务暂不使用可忽略。
```

### 3.1 关键服务（如 paperclip）路径不存在

检查步骤：

1. 检查 `.env` 中是否配置了 `PAPERCLIP_PATH`：

   ```bash
   cat .env | grep PAPERCLIP_PATH
   ```

2. 确认该目录实际存在：

   ```bash
   ls -d /home/guo/paperclip
   ```

3. 如路径有误：
   - 在 `.env` 中改为正确值（例如 `PAPERCLIP_PATH=~/projects/paperclip`）。
   - 重新 `source .env` 后，再跑 `health-check.sh`。

### 3.2 暂不使用的服务（如 openclaw / browser-use）

如果你当前阶段只需要 paperclip：

- 可以在 `workspace.config.json` 中把对应服务的 `enabled` 设为 `false`：

  ```json
  "services": {
    "paperclip": { "enabled": true, ... },
    "openclaw":  { "enabled": false, ... },
    "browser-use": { "enabled": false, ... }
  }
  ```

- 此时 health-check 中出现的关于这些服务的 WARN 可以视为“信息提示”，不必强制处理。

## 4. 服务进程检查失败

典型输出：

```text
FAIL: 服务 paperclip pid=12345 未在运行。
```

说明：

- `runtime/paperclip.pid` 中记录的 PID 对应的进程已经不在运行。
- 可能是在脚本之外手动杀进程，或者服务崩溃退出。

处理方案：

1. 查看最近日志：

   ```bash
   cd ~/ZephyrNexus
   tail -n 100 logs/paperclip.log
   ```

2. 尝试用 `stop-all` + `start-all` 恢复：

   ```bash
   source .env
   bash scripts/stop-all.sh
   bash scripts/start-all.sh
   ```

3. 如果仍然失败，考虑：
   - 在 paperclip 仓库内单独运行启动命令，观察更详细的错误。

## 5. 健康状态 FAIL 但你只想检查控制平面

有时某些服务暂时没有部署或不计划使用，但 health-check 仍会因为路径不存在而给出 FAIL。

你可以：

1. 确认当前真正需要哪些服务：
   - 如果当前只需要 paperclip，可以先只启用 paperclip：

     ```json
     "services": {
       "paperclip": { "enabled": true, ... },
       "openclaw":  { "enabled": false, ... },
       "browser-use": { "enabled": false, ... }
     }
     ```

2. 重新执行 `health-check.sh`，应只对 paperclip 路径给出严格 FAIL/PASS，对其它服务则给 WARN/信息级输出。

## 6. 何时可以“带 WARN 继续前进”

一般规则：

- **可以接受 WARN 的场景**：
  - 当前阶段只需要 paperclip，openclaw/browser-use 未来再接入。
  - 某个服务暂时停机维护，短时间内不准备启动。

- **必须清零 FAIL 的场景**：
  - 第一次在某新环境（例如 SSH）引入 ZephyrNexus。
  - 准备将该环境视为“准线上环境”。
  - 计划在该环境中长期运行高成本服务。

## 7. 常见问题速查

- **命令缺失（jq/git/bash）**：
  - 优先通过包管理器安装。

- **workspace.config.json 不存在或格式错误**：
  - 检查文件是否存在、JSON 语法是否正确。
  - 必要时从 GitHub 的 main 分支重新拉取。

- **pid 文件残留且进程不在**：
  - `stop-all.sh` 会自动删除这类“失效 pid 文件”，可以多执行一次。

## 8. 排查后如何记录经验

- 对于重复出现的问题或值得记住的排查路径：
  - 在本文件末尾追加新的“场景 + 步骤”。
  - 或在 `docs/workflow-sop.md` 里补一个小节。
- 所有这类文档改动都走 ZephyrNexus 仓库的 PR 流程，这样未来的自己也能直接在 GitHub 上看到。

