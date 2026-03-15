# 平台架构与角色定位

## 1. 控制平面 vs 执行平面

整个系统可以简单拆成两层：

- **控制平面（Control Plane）**
  - AetherStack 仓库本身
  - 提供：架构定义、仓库注册表、环境模板、启动/停机/健康检查脚本、Runbook/SOP
  - 不直接承载业务代码与运行态
- **执行平面（Execution Plane）**
  - paperclip 服务
  - openclaw（gateway / agents）
  - browser-use 以及其他运行型服务
  - 这些服务实际处理请求、执行工作流、与用户交互

两者通过 **配置（workspace.config.json + .env）** 和 **脚本（scripts/*.sh）** 产生连接。

## 2. AetherStack 的定位

- 控制平面仓库（control-plane repository）
- 统一入口：
  - 一键启动整个平台（`scripts/start-all.sh`）
  - 一键健康检查（`scripts/health-check.sh`）
  - 一键停机（`scripts/stop-all.sh`）
- 负责：
  - 架构文档（本文件等）
  - 仓库注册表（`docs/repo-registry.md`）
  - workspace 配置（`workspace.config.json`）
  - env 模板（`infra/env-templates/*.example`）
  - 运行/回滚 Runbook 与工作流 SOP
- 不负责：
  - 业务逻辑实现（UI、后端、Agent 代码）
  - runtime 数据、日志、数据库文件

> 简化理解：AetherStack 决定“有哪些服务、怎么连起来、怎么启动/停机”，但不关心这些服务内部如何实现具体业务。

## 3. paperclip 的定位

- **前台控制台 & 调度界面**
- 主要作用：
  - 暴露 Web UI，供人类在浏览器中操作平台
  - 管理 Agent、Issue、Cost、任务编排等
- 在架构中扮演：
  - “人机交互界面”
  - “调度中枢”（对其他 Agent / 服务进行编排）

控制平面与 paperclip 的关系：

- AetherStack 负责：
  - 知道 paperclip 仓库在本机（WSL/SSH/Windows）哪里
  - 知道如何启动 / 停止 / 健康检查 paperclip
- 一旦 `start-all.sh` 启动成功：
  - 你就可以在浏览器中打开 paperclip 页面
  - 后续所有调度动作都在 paperclip 内完成

**paperclip 是主要操作界面，AetherStack 是统一入口。**

## 4. openclaw 的定位

这里的 openclaw 代表一类 **Agent 运行时 / 后端服务仓库**，典型形态为：

- gateway + agents 组合
- 独立 git 仓库
- 有独立的依赖、启动脚本和发布节奏

在架构中的关系：

- paperclip 可以通过 HTTP/gRPC/队列等方式调用 openclaw
- AetherStack 只负责：
  - 在 `repo-registry` 和 `workspace.config.json` 中注册 openclaw
  - 提供统一的启动/停机/健康检查入口
  - 不关心内部业务细节

## 5. browser-use 的定位

browser-use 代表一类 **辅助功能/浏览器自动化服务**：

- 提供浏览器自动化、E2E 测试、网页交互等能力
- 同样是独立 git 仓库

在架构中的关系：

- paperclip 或其他服务通过 API 调用 browser-use
- AetherStack：
  - 注册其仓库与服务信息
  - 统一启动/停机/健康检查

## 6. 启动链路：AetherStack → paperclip 页面

从你执行一条命令，到打开 paperclip 页面，中间发生了什么：

1. 在 WSL/SSH 中执行：

   ```bash
   cd ~/AetherStack
   source .env
   bash scripts/start-all.sh
   ```

2. `start-all.sh` 会：
   - 读取 `workspace.config.json` 与 `AETHERSTACK_ENV_PROFILE`（wsl / ssh / windows）
   - 解析当前环境下的路径映射（`environmentProfiles[profile].pathMappings`）
   - 找到 paperclip 仓库，并执行配置好的启动命令（例如 `pnpm dev`）
   - 将 paperclip 的 pid 写入 `runtime/paperclip.pid`，日志写入 `logs/paperclip.log`

3. 启动完成后，脚本输出：
   - 哪些服务已成功启动
   - 哪些服务被跳过（disabled / 缺路径 / 无命令）
   - paperclip 页面可尝试访问的地址/端口（例如 `http://localhost:3000`）

4. 你在浏览器中访问 paperclip 地址，平台控制权从命令行切换到 Web UI。

总结：

- **AetherStack**：负责“按统一规范拉起/关闭所有必要服务”。
- **paperclip 页面**：负责“在统一 UI 内调度 Agent、查看 Issue/Cost、进行前台编排”。

## 7. GitHub 在整体中的角色

- GitHub 是各仓库（AetherStack、paperclip、openclaw、browser-use 等）的 **唯一真相来源（source of truth）**。
- WSL / SSH / Windows 上的仓库只是这些真相的不同工作副本：
  - 在 WSL 开发和验证
  - 在 GitHub 通过 PR 管理变更
  - 在 SSH 执行 `git pull`，然后跑 AetherStack 脚本启动服务
- 所有结构性变更（脚本、配置、架构文档）都应：
  1. 在 WSL 上开发、测试
  2. 通过 GitHub PR 合入 main
  3. 在 SSH 上 `git pull` + `start-all.sh` 应用

长期来看，本文件和 `docs/github-management-strategy.md` 一起定义了：**“平台长什么样 + 怎么演进”**。

