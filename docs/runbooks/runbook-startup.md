# Runbook：平台启动（start-all）

本 Runbook 说明如何在不同环境下，通过 AetherStack 一键启动整个平台，并快速判断是否成功。

## 1. 前提条件

- 已在当前环境（WSL / SSH）完成：
  - AetherStack 仓库 clone 或更新到最新 main
  - `.env` 配置正确
  - `workspace.config.json` 中服务配置与路径映射大致正确
- 基础工具：
  - `bash`
  - `git`
  - `jq`

## 2. 步骤一：确认环境变量

1. 进入 AetherStack：

   ```bash
   cd ~/ZephyrNexus
   ```

2. 确认 `.env` 存在且大致正确：

   ```bash
   cat .env
   ```

   关键字段：

   - `AETHERSTACK_ENV_PROFILE`（例如：`wsl` / `ssh`）
   - `PAPERCLIP_PATH`
   - `OPENCLAW_WORKSPACE_PATH`（如暂未使用，可先不填）
   - `BROWSER_USE_PATH`（如暂未使用，可先不填）
   - `AETHERSTACK_RUNTIME_DIR`
   - `AETHERSTACK_LOG_DIR`

3. 加载环境变量：

   ```bash
   source .env
   ```

## 3. 步骤二：跑健康检查

执行：

```bash
cd ~/ZephyrNexus
source .env
bash scripts/health-check.sh
```

观察输出：

- **基础命令检查**：
  - `PASS: 命令可用：git / bash / jq`
  - 如有 FAIL，需要先安装对应命令。
- **路径与配置检查**：
  - `PASS: 服务 paperclip 路径存在：...`
  - 暂不使用的服务可以看到 WARN（路径无法解析或不存在），可接受。
- **服务进程检查**：
  - 如果之前已经启动过服务，可能显示 RUNNING/WARN；首次启动阶段可以忽略 WARN。

整体状态：

- `整体健康状态：PASS` 或 `WARN` → 可以继续尝试启动。
- `整体健康状态：FAIL` → 优先参考 `runbook-troubleshoot-healthcheck.md` 排查。

## 4. 步骤三：一键启动

执行：

```bash
cd ~/ZephyrNexus
source .env
bash scripts/start-all.sh
```

脚本会：

- 读取 `workspace.config.json` 中的 `services` 列表。
- 对 `enabled = true` 的服务尝试启动。
- 使用 env + `environmentProfiles[profile].pathMappings` 解析服务路径。
- 在 `AETHERSTACK_RUNTIME_DIR` 下写入 `.pid` 文件，在 `AETHERSTACK_LOG_DIR` 下写日志。

关注输出中的“启动总结”段落，例如：

```text
========== 启动总结 ==========
- paperclip: STARTED (pid=12345)
- openclaw: SKIPPED (disabled)
- browser-use: SKIPPED (no path)
```

以及最后的提示：

```text
如 paperclip 启动成功，可尝试访问：
  http://localhost:3000
```

## 5. 步骤四：验证 paperclip 页面

1. 在本机浏览器中打开：
   - WSL 本机一般为 `http://localhost:3000`
   - SSH 服务器则取决于是否有端口映射/反向代理（例如 `https://your-domain.com`）

2. 快速验证：
   - 是否能正常登录/打开首页
   - 是否能看到核心模块（Agent 列表 / Issue / Cost 等）
   - 是否能触发一个简单的 Agent 工作流

3. 如页面异常：
   - 查看 `logs/paperclip.log`
   - 在 paperclip 仓库中单独跑 `pnpm dev` 复现问题

## 6. 步骤五：必要时查看日志 / PID

- 运行态目录：
  - `runtime/` 下是 pid 文件，例如：
    - `runtime/paperclip.pid`
    - `runtime/openclaw.pid`
- 日志目录：
  - `logs/` 下是各服务日志，例如：
    - `logs/paperclip.log`

示例：

```bash
cd ~/ZephyrNexus
ls runtime
cat runtime/paperclip.pid

tail -n 100 logs/paperclip.log
```

## 7. 步骤六：需要停机时

参考 `runbook-rollback.md` 或直接执行：

```bash
cd ~/ZephyrNexus
source .env
bash scripts/stop-all.sh
```

脚本会：

- 读取 `runtime/*.pid`
- 仅尝试停止由 AetherStack 启动的服务
- 清理对应 pid 文件

如果有进程停不下来，脚本会输出 WARN，之后可以根据 PID 手动排查。

