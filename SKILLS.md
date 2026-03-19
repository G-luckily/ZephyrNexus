# ZephyrNexus 核心技能拓扑指南

由于本平台承载复杂的 Agentic Monorepo 组件，为确保**环境可迁移**、**代码纯粹化**、以及**通用资产沉淀**，本项目的 `skills/` 执行层已实施“薄入口化”治理。

## 目录边界定义
请所有贡献者与开发者遵循如下调用和配置逻辑：

> **Architecture Note:**
> 当前项目采用 “local/shared 分层治理 + 根层兼容入口” 结构。
> `skills/` 根层目前保留了诸多软链接入口（如 `skills/pr-report`），此举**仅用于兼容现有 resolver 的寻址逻辑**；
> 实际的架构治理语义和物理沉淀分区，严格以 `local/` 与 `shared/` 的边界为准。

- 🗂️ **专属强定制层 (`local/`)**：
    只存放与 `ZephyrNexus`、`Paperclip` 代码体系**绝对强偶合**的技能。如果一个 skill 在其它项目克隆后绝对跑不起来，请放这里。
- 🔗 **外挂复用层 (`shared/`)**：
    只存放**软链接 (Symlinks)**！这些链接均指向您的统一中央资产库（例如 `~/workspace/My_Skills/project-derived/`）。这保障了诸如发版、数据审计等通用工程流能跨仓库无缝漫游。

## OpenClaw Skill Resolution (技能解析策略)
当前项目的技能调用，依赖于默认环境变量及后备查找。当 OpenClaw 发起诸如 `openclaw run pr-report` 这样的指令时，预期解析顺序为：

1. **项目级优先 (Local 薄入口)**：优先检查本级 `./skills/local/` 以及被显式声明的 `./skills/shared/`。
2. **全局兜底 (Implicit Fallback)**：如果本地薄入口没有任何命中，最后会尝试向 `~/.openclaw/skills/` 中要兜底组件。

*注：第二层的兜底能力应尽量只用于极其通用或属于您个人配置的命令（如 `academic-research-skills`）。项目中核心 CI/CD 流请一律在 `shared/` 内做显式链接声明。*
