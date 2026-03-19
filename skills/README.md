# ZephyrNexus Local vs Shared Skills

> **Note**: 当前项目采用 “local/shared 分层治理 + 根层兼容入口” 结构。
> 外层 `skills/` 根目录中保留的软链接入口，仅用于兼容现有的 OpenClaw resolver；治理语义以本目录下的 `local/` 与 `shared/` 为准。

本目录不直接存放离散的技能包。所有技能均被强行分为两大派系：

## 1. /local/ (项目本地深偶合组件)
包含框架专机（例如专为 Paperclip 代码模型生成的 Agentic Flow）。
- `paperclip`
- `paperclip-create-agent`
- `create-agent-adapter`
- `para-memory-files`

**规则**：此目录下的代码可以在内部直接硬编码本项目的相对路径，这是专属定制特权。

## 2. /shared/ (无状态能力的显式入口)
存放软链接。链接指向 `My_Skills/project-derived/` 中沉淀的可复用组件。本期包括：
- `pr-report` -> [GitHub / 任何库通用] 生成详尽审查件
- `release` -> [任何 Monorepo 通用] 触发版本编排流
- `release-changelog` -> [主要指代 Git 记录解析] 虽然内部有少许遗留框架指代，但不影响其极高的全平台复用率。

**规则**：严禁在此目录放入物理源码夹，严防代码分散化。
