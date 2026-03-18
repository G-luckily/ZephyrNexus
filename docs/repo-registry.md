# 仓库注册表（Repo Registry）

本文件集中描述当前平台涉及的各个 git 仓库及其角色。  
所有路径都采用 **模板化** 表达，具体值由 `.env` 或 `workspace.config.json` 决定。

## 字段约定

- **name**: 仓库名称（唯一）
- **type**:
  - `control-plane`：控制平面仓库（例如 ZephyrNexus）
  - `application`：业务/应用仓库（例如 paperclip）
  - `agent-runtime`：Agent 运行时 / 后端服务（例如 openclaw）
  - `auxiliary`：辅助服务（例如 browser-use）
- **localPathTemplate**: 本地路径模板（不写死用户名），示例：
  - `~/workspace/paperclip`
  - `${PAPERCLIP_PATH}`
- **remoteUrl**: Git 远程仓库 URL（推荐使用 SSH 或 HTTPS）
- **role**: 简要角色描述
- **startCommand**: 启动命令模板（在对应仓库根目录下执行）
- **notes**: 其他说明（可选）

> 实际可执行配置请参考 `workspace.config.json` 中的 `repoInventory` 与 `services`。

## 注册表

### 1. ZephyrNexus（本仓库）

- **name**: `ZephyrNexus`
- **type**: `control-plane`
- **localPathTemplate**:
  - 通常为 `~/ZephyrNexus`
  - 也可以通过环境变量 `ZEPHYR_NEXUS_PATH` 指向其它位置
- **remoteUrl**:
  - 示例：`git@github.com:your-org/ZephyrNexus.git`
- **role**:
  - 控制平面仓库，负责架构文档、脚本、配置、env 模板等
- **startCommand**:
  - 不需要作为服务长期运行
  - 控制命令：
    - `bash scripts/start-all.sh`
    - `bash scripts/health-check.sh`
    - `bash scripts/stop-all.sh`

### 2. paperclip

- **name**: `paperclip`
- **type**: `application`
- **localPathTemplate**:
  - `${PAPERCLIP_PATH}`（从 `.env` 或 `environmentProfiles[profile].pathMappings.paperclip` 解析）
- **remoteUrl**:
  - `_在此填写真实远程地址_`
- **role**:
  - 平台前台控制台、调度与编排界面
  - 提供 Web UI，供人类操作平台
- **startCommand**（示例，按实际情况调整）:
  - `pnpm install --silent && pnpm dev`
- **notes**:
  - 一旦 `start-all.sh` 成功启动 paperclip，即可通过浏览器访问它的页面控制平台

### 3. openclaw

- **name**: `openclaw`
- **type**: `agent-runtime`
- **localPathTemplate**:
  - `${OPENCLAW_WORKSPACE_PATH}`
- **remoteUrl**:
  - `_在此填写真实远程地址_`
- **role**:
  - Agent 运行时 / 后端服务（gateway / agents）
- **startCommand**（示例）:
  - `pnpm install --silent && pnpm dev`
- **notes**:
  - 如果当前工程中暂时没有 openclaw，可以：
    - 在 `workspace.config.json` 的 `services.openclaw.enabled` 中设置为 `false`
    - 或在 `.env` 中先不配置 `OPENCLAW_WORKSPACE_PATH`

### 4. browser-use

- **name**: `browser-use`
- **type**: `auxiliary`
- **localPathTemplate**:
  - `${BROWSER_USE_PATH}`
- **remoteUrl**:
  - `_在此填写真实远程地址_`
- **role**:
  - 浏览器自动化 / E2E 辅助服务
- **startCommand**（示例）:
  - `pnpm install --silent && pnpm dev`
- **notes**:
  - 若未来再纳入平台，可在 `workspace.config.json` 中开启：
    - `services["browser-use"].enabled = true`

---

## 控制仓库 vs 业务仓库

- **控制仓库**
  - ZephyrNexus
  - 只承载控制定义（脚本、配置、运行流程文档）
- **业务仓库**
  - paperclip（前台 UI + 调度）
  - openclaw（Agent runtime）
  - browser-use（辅助服务）

ZephyrNexus 不会托管这些业务仓库的源码，只通过注册表 + 配置知道它们的存在与启动方式。

