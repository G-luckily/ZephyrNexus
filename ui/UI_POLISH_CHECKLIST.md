# Zephyr Nexus UI Polish Checklist

## Overview

本轮目标：冻结当前 UI 基线，统一全站 Design Tokens，建立稳定的视觉系统基础。

**Branch**: `ui-polish-token-baseline`

**Preview Deployment**: https://d8085a7e.zephyr-nexus-ui.pages.dev

---

## 当前已知页面

| Page | 文件 | 状态 |
|------|------|------|
| 总览页 | `pages/Dashboard.tsx` | Phase 2 精修完成 |
| 消息中心 | `pages/Inbox.tsx` | 原始状态，待精修 |
| 任务页 | `pages/Issues.tsx` | 原始状态，待精修 |
| 智能体列表 | `pages/Agents.tsx` | Phase 3 精修完成 |
| 智能体详情 | `pages/AgentDetail.tsx` | **Phase 3.9 + 3.10 精修完成** |
| 智能体配置 | `pages/NewAgent.tsx` | Phase 3 精修完成 |
| 工作流模板弹窗 | `components/IssuesTemplateMenu.tsx` | 原始状态 |
| 公司管理 | `pages/Companies.tsx` | 原始状态 |
| 设置 | `pages/CompanySettings.tsx` | 原始状态 |
| Org Chart | `pages/OrgChart.tsx` | 已有部分精修 |
| Cost 页面 | `pages/Costs.tsx` | 原始状态 |

---

## 后续精修阶段

```
Phase 1: Token 统一          ← 已完成
Phase 2: Dashboard 精修      ← 已完成
Phase 3: Agent 页面精修      ← 已完成
Phase 3.5: Agent Overview 精修 ← 已完成
Phase 3.6: AgentConfigForm settings-rows 布局 ← 已完成
Phase 3.7: Motion System — reveal-on-scroll + micro-interactions ← 已完成
Phase 3.8: Visual Direction — Deep Space Orbs Background ← 已完成
Phase 3.9: AgentDetail Configuration Inspector — 12-column layout ← 已完成
Phase 3.10: AgentDetail Visual Polish — LatestRunCard/Costs/Charts/Issues ← 已完成
Phase 4: List 页面精修
Phase 5: Modal / Empty State / Toast 精修
Phase 6: Dark Mode 专项验收
Phase 7: 全站收口
```

---

## 本轮完成项

### Phase 1: Token 定义与注册
- [x] 创建 git branch: `ui-polish-token-baseline`
- [x] 建立 UI_POLISH_CHECKLIST.md
- [x] 扩展 Text tokens: text-subtle, text-disabled, text-inverse, text-brand, text-danger, text-warning, text-success
- [x] 扩展 Border tokens: border-active, border-danger, divider
- [x] 扩展 Status tokens: live, paused, failed, pending, neutral
- [x] 扩展 Shadow tokens: shadow-subtle, shadow-modal, shadow-focus
- [x] 扩展 Spacing tokens: page-padding, section-gap, card-padding 等
- [x] 添加 Overlay backdrop token
- [x] 注册新 tokens 到 tailwind `@theme` inline
- [x] 定义 Chart tokens (chart-1 ~ chart-7) for light & dark modes

### Dark Mode 补充
- [x] 添加 dark mode border-active / border-danger / divider tokens
- [x] 添加 dark mode shadow-subtle / shadow-modal / shadow-focus tokens
- [x] 添加 dark mode overlay token

### 组件硬编码修复
- [x] 修复 ToastViewport: 所有 hex color → CSS 变量引用 (info/success/warning/error)
- [x] 修复 StatusBadge: ring-black/5 → ring-border-subtle, inset shadow → var(--surface-elevated)
- [x] 修复 ActivityCharts: 所有图表色 → chart-1~chart-7 变量引用
- [x] 修复 MobileBottomNav: bg-[#f7f7f8]/95 → bg-surface-floating/95
- [x] 修复 Sidebar 大气渐变: rgba(122,139,168,0.03) → color-mix(var(--periwinkle) 8%, transparent)

### 验证
- [x] build 验证通过

---

### Phase 2: Dashboard 专项精修
- [x] 清理 Dashboard.tsx 中 ~40 个硬编码 hex 颜色为统一 tokens
  - `text-[#4a5e7a]` → `text-text-secondary`
  - `text-[#5d738f]` → `text-text-tertiary`
  - `text-[#6a809e]` / `#7a8da5` / `#8899b3` → `text-text-subtle` / `text-muted-foreground`
  - `border-[#cdd9e8]` → `border-border`
  - `#2d8a6c` → `text-success`, `#b5793a` → `text-warning`, `#3d5170` → `text-muted-foreground`
- [x] 替换 Tailwind v3 默认色名 (rose-* → error/danger, cyan/violet/emerald/amber → brand tokens)
- [x] 修复预存的 text token 映射 bug:
  - `text-secondary` → `text-text-secondary` (原映射到背景色 `#eef2f8`)
  - `text-tertiary` → `text-text-tertiary` (原无此 class)
  - `text-subtle` → `text-text-subtle` (原无此 class)
  - `text-muted` → `text-muted-foreground` (原映射到背景色 `#e8eef7`)
- [x] 在 `index.css` @theme 注册 `text-text-secondary`、`text-text-tertiary`
- [x] MissionSnapshot 指标带精修：每个 cell 根据 status tone 添加背景色（danger-soft/warning-soft/success-soft/zephyr-blue-soft），分隔线使用 border token
- [x] CompactInsightPanel 遥测面板精修：
  - 所有 `text-foreground/80` → `text-text-secondary`
  - 所有 `text-foreground/60` → `text-text-subtle`
  - 所有 items 添加 hover 状态（`hover:bg-surface-muted`）
  - 统一 `border-border-subtle bg-surface-inset` tokens
- [x] PipelineRail 作业流水线精修：
  - 统一切换为选择器 UI（展开/收起按钮+进度胶囊）
  - 节点尺寸压缩（`h-6 w-6` → `h-5 w-5`）
  - 连接线缩短（`w-2.5` → `w-2`）
  - 添加轻量阶段摘要（当前 / 等待 / 最近）
  - 空事件时显示占位事件（任务输入已接入 / CEO 智能体完成拆解 / 研究分派进入数据查询）
  - 底部 metric chips 使用 surface-inset + text-tertiary tokens
- [x] PageHeader 标题区：文字对比度验证通过，按钮视觉权重克制
- [x] PipelineRail 展开状态（Expanded vertical timeline）：使用 tokens 统一状态色
- [x] 修复 area `text-zephyr-blue` 映射为 `text-[var(--zephyr-blue)]`（去除 Tailwind v3 默认色名）

### 验证
- [x] `npx vite build` 两次验证通过

---

### Phase 3: Agent 页面专项精修

**目标**: 替换所有 Tailwind v3 默认色名为语义 CSS token，聚焦 AgentDetail/Agents/NewAgent 页面

#### status-colors.ts 全面迁移
- [x] `bg-green-100 text-green-700` → `bg-success-soft text-success`
- [x] `bg-yellow-100 text-yellow-700` → `bg-warning-soft text-warning`
- [x] `bg-orange-100 text-orange-700` → `bg-warning-soft text-warning`
- [x] `bg-red-100 text-red-700` → `bg-danger-soft text-error`
- [x] `bg-cyan-100 text-cyan-700` → `bg-info-soft text-info`
- [x] `bg-blue-100 text-blue-700` → `bg-info-soft text-info`
- [x] `bg-amber-100 text-amber-700` → `bg-warning-soft text-warning`
- [x] `bg-violet-100 text-violet-700` → `bg-brand-soft text-brand`
- [x] `text-neutral-400 / text-neutral-500` → `text-muted-foreground`
- [x] 所有 dark:bg-* / dark:text-* 变体移除（由 token 系统自动处理）
- [x] 新增 `--brand-soft` token（rgba(138,122,238,0.08) / rgba(157,139,240,0.10)）

#### AgentDetail.tsx
- [x] `runStatusIcons`: `text-green-600` → `text-success`, `text-red-600` → `text-error`, `text-cyan-600` → `text-info`, `text-yellow-600` → `text-warning`, `text-orange-600` → `text-warning`, `text-neutral-500` → `text-muted-foreground`
- [x] Mobile live badge: `bg-blue-500/10` → `bg-info/10`, `text-blue-600` → `text-info`
- [x] Pending approval text: `text-amber-500` → `text-warning`
- [x] Invocation source badges: v3色名 → `bg-info-soft text-info` / `bg-brand-soft text-brand`
- [x] LatestRunCard live border: `border-cyan-500/30` → `border-info/30`
- [x] LatestRunCard open run detail link: `border-zephyr-blue/20 bg-zephyr-blue/5` → `border-info/20 bg-info/10`
- [x] Transcript colors: init/result → `text-info`, user → `text-muted-foreground`, tool_call → `text-warning`, error → `text-error`
- [x] Transcript label cells: `text-neutral-*` → `text-muted-foreground`
- [x] Failure details card: `border-red-300 bg-red-50` → `border-error/30 bg-danger-soft`
- [x] Log viewer: `text-neutral-*` → `text-muted-foreground`

#### Agents.tsx
- [x] Filters button active: `border-cyan-300/22 bg-cyan-400/12` → `border-info/30 bg-info/15`
- [x] Costly badge: `text-amber-600 border-amber-500/30 bg-amber-500/5` → `text-warning border-warning/30 bg-warning/10`
- [x] Live badge: `bg-blue-500/10` → `bg-info/10`, `text-blue-600` → `text-info`

#### AgentConfigForm.tsx
- [x] `text-amber-400` → `text-warning`
- [x] Validation result statusClass: v3色名 → semantic tokens (`text-success border-success/40 bg-success-soft` 等)

#### StatusBadge / ActivityCharts
- [x] 自动受益于 status-colors.ts 迁移，无需单独修改
- [x] ActivityCharts 已使用 chart-* tokens，无需改动

### 新增 Token 注册
- [x] `--color-brand-soft` 注册到 @theme（用于 in_review 等 brand 色）
- [x] `--brand-soft` 在 :root（rgba(138,122,238,0.08)）和 .dark（rgba(157,139,240,0.10)）中定义

### 验证
- [x] `npx vite build` 通过（3次验证）

---

### Phase 3.5: Agent Overview 精修

**目标**: 将 Agent Overview 从 uniformed token page 升级为 professional Agent console

#### BudgetSummaryCard (horizontal layout)
- [x] 重构为 Summary Strip: 月度预算主金额在左，progress bar + 已用/剩余在右
- [x] "超支" badge 使用 `bg-error/10 text-error`
- [x] mini progress bar 使用 `bg-muted` + `bg-success/bg-warning/bg-error` 动态色

#### LatestRunCard → Audit Event Card
- [x] failed 状态使用 `border-l-[3px] border-l-error/60 border border-error/20 bg-danger-soft`
- [x] 错误信息独立行：`bg-error/8 border border-error/20`
- [x] action row 紧凑化：Check codex PATH / Switch provider / Pause heartbeat / Open run detail
- [x] 非 failed 状态：轻量 inline 设计，去掉冗余 padding

#### CostsSection → Compact Metric Strip
- [x] 四项横向排列：输入令牌 / 输出令牌 / 缓存令牌 / 总成本
- [x] label 使用 `text-[10px] uppercase tracking-wider`
- [x] 数值使用 `text-lg font-bold tabular-nums`
- [x] 移除成本历史 table（Phase 3.5 明确不伪造数据）

#### ActivityCharts 低数据状态
- [x] 所有 4 个 chart（RunActivity/Priority/IssueStatus/SuccessRate）统一 low-data state
- [x] 使用 "近 14 天样本不足" + "等待更多执行记录" 双行文案
- [x] 图标：`h-7 w-7` 圆点 + `border-dashed border-muted-foreground/30`
- [x] 整体 padding 压缩：`py-4` 而非 `py-6`

#### ConfigurationTab 两栏布局
- [x] 左栏 65%：AgentConfigForm + Permissions card
- [x] 右栏 35%：sticky aside 包含 Agent Info / Permissions / Quick Actions
- [x] Agent Info：Provider / Model / Heartbeat 状态
- [x] Quick Actions：Test environment / Trigger heartbeat / Pause agent / Assign task
- [x] 导入新增 icon：Activity, Heart, FolderOpen, Terminal

#### 验证
- [x] `npx vite build` 通过

---

### Phase 3.6: AgentConfigForm settings-rows 布局

**目标**: 为 AgentConfigForm 添加 `settings-rows` 布局模式，用于 Phase 3.5+ 的 12-column 配置页面

#### settingsRows 布局实现
- [x] 添加 `sectionLayout?: "inline" | "cards" | "settings-rows"` 类型
- [x] 添加 `const settingsRows = props.sectionLayout === "settings-rows"` 常量
- [x] 添加 `Settings` icon 到 lucide-react 导入

#### Execution Policy section (权限与配置)
- [x] header: `settingsRows` 显示为 `text-text-secondary flex gap-2` 行级标题
- [x] body: 压缩为 settings rows 样式（Command+Extra args 并排、Env、Timeout+Grace 并排）

#### Run Policy section
- [x] isCreate: header `settingsRows` 样式，body 为单行 compact ToggleWithNumber
- [x] !isCreate: header `settingsRows` 样式，body 包含 ToggleWithNumber + Advanced Run Policy CollapsibleSection

#### 验证
- [x] `npx vite build` 通过（4 次验证）

---

### Phase 3.7: Motion System — reveal-on-scroll + micro-interactions

**目标**: 弥补与 2025 benchmark 的差距，建立 entrance orchestration 和 hover micro-interaction 基础

#### CSS 基础 — 5 项新增 classes
- [x] `.reveal-item` — opacity 0→1 + translateY(10px→0), 320ms ease-out
- [x] `.reveal-item.is-visible` — 触发后状态
- [x] `.reveal-item-scale` — scale(0.96→1) 变体
- [x] `.reveal-child` — 子元素 stagger 用，配合 inline transitionDelay
- [x] `.btn-press:active` — scale(0.965) button 压缩反馈
- [x] `.tab-underline` — 滑动下划线 indicator，支持 left/width CSS transition
- [x] `.nav-item-active-indicator` — 侧边栏导航 active 滑动条
- [x] 全局 `prefers-reduced-motion` 覆盖：所有 reveal 类直接显示无动画

#### React Hook — `useReveal` + `useRevealList`
- [x] 新建 `src/hooks/useReveal.ts`
- [x] `useReveal()` — 单元素 IntersectionObserver，自动 toggle `is-visible`
- [x] `useRevealList(count, staggerMs)` — 批量 stagger，每隔 60ms 触发一个
- [x] motion-safe 降级：检测 `prefers-reduced-motion`，直接 mark visible

#### Dashboard panelRiseIn reduced-motion
- [x] 添加 `@media (prefers-reduced-motion: reduce)` 覆盖，禁用 panelRiseIn 动画

#### Component 微交互增强
- [x] `EntityRow` — `transition-colors` → `transition-all` + `hover-lift`，行级 hover 抬起

### 验证
- [x] `npx vite build` 通过

---

### Phase 3.8: Visual Direction — Deep Space Orbs Background

**设计方向**: "Deep Space Minimal" — 深空留白 + 3 个慢速漂浮的氛围光球，无厚重毛玻璃覆盖层

**参考来源**: Dribbble 2025 SaaS Dashboard trends — AuroraEngine / Nova template / Clean SaaS Dashboard

#### 设计决策
- [x] 去掉所有页面内 panel 的顶部 atmospheric glow radial-gradient（Dashboard MissionSnapshot / RuntimePanel compact / RuntimePanel full）
- [x] 页面背景改为 3 个绝对定位的 CSS radial-gradient orbs（blur 60-80px）：
  - Orb 1 (top-left, silver-blue): `rgba(122, 139, 168, 0.18)`
  - Orb 2 (bottom-right, violet): `rgba(141, 121, 242, 0.14)`
  - Orb 3 (center-right, zephyr-blue): `rgba(56, 121, 234, 0.10)`
- [x] Orb 各自独立 float 动画（18s/22s/26s ease-in-out infinite）
- [x] Light mode orb 透明度递减（0.12 / 0.09 / 0.07）
- [x] Dark mode orb 透明度递增（0.18 / 0.14 / 0.10）
- [x] CSS variable 集中管理（`--orb-1-x/y/size/color/opacity`）
- [x] `prefers-reduced-motion`: orbs 动画禁用（`animation: none`）
- [x] 底层 radial base gradient 消除纯黑/纯白背景的平坦感

### 验证
- [x] `npx vite build` 通过

---

### Phase 3.9: AgentDetail Configuration Inspector — 12-column layout

**目标**: 将 Agent 配置页从 `max-w-3xl` 单列改为 12-column 两栏布局（左侧 8 col 配置区 + 右侧 4 col sticky Inspector）

#### Layout restructure
- [x] AgentConfigurePage 移除 `max-w-3xl`，改为 `grid grid-cols-1 lg:grid-cols-12 gap-6`
- [x] 左侧 8 columns (`lg:col-span-8`): AgentConfigForm (settings-rows) + Permissions card
- [x] 右侧 4 columns (`lg:col-span-4 lg:sticky lg:top-4`): ConfigurationInspector
- [x] API Keys 和配置历史保持全宽，在两栏布局下方

#### Configuration Inspector (右侧 sticky 面板)
- [x] 1. Configuration Summary — 名称 / Adapter / Model / Working Dir
- [x] 2. Readiness — 4 项检查（Identity / Adapter model / Prompt template / Heartbeat），带图标状态
- [x] 3. Risks & Notices — 根据 adapter type 和配置状态动态显示警告/提示
- [x] 4. Quick Actions — Test environment / Trigger heartbeat / Pause agent / Assign task

#### 新增图标
- [x] Activity, Heart, FolderOpen, Terminal, Settings, AlertTriangle, CheckCircle, XCircle, Zap

### 验证
- [x] `npx vite build` 通过

---

### Phase 3.10: AgentDetail Visual Polish

**目标**: 将 AgentDetail Overview 从标准控制台页面升级为有品牌个性、层次分明的专业界面

#### LatestRunCard 视觉升级
- [x] Live ping 颜色从 `bg-cyan-400` → `bg-zephyr-blue`，与品牌色统一
- [x] 图标从独立 `h-3.5 w-3.5` 改为带 `bg-zephyr-blue/10` 或 `bg-muted` 背景的 `h-8 w-8 rounded-lg`
- [x] Card 背景从透明改为 `bg-surface-elevated`，边框加粗（`border-border-strong`），阴影加深
- [x] Live 状态使用 `border-zephyr-blue/20` + `shadow-[0_0_20px_rgba(37,99,235,0.10)]` 品牌色光晕
- [x] hover 时阴影递增 `shadow-[0_0_28px_rgba(37,99,235,0.16)]`，边框加深至 `border-zephyr-blue/35`
- [x] 时间戳加 `tabular-nums` 等宽数字

#### Charts — Bento 布局
- [x] 从 4 列均分 grid → 12 列不规则 bento 布局
- [x] 执行统计（主图表）占 `lg:col-span-8`
- [x] 成功率（窄高亮）占 `lg:col-span-4`
- [x] 任务优先级和任务状态各占 `lg:col-span-6`
- [x] 形成视觉层级：主图表突出，次要图表均匀分布

#### CostsSection 数字面板升级
- [x] 整体使用 `bg-surface-inset` 背景，与周围卡片区分
- [x] 标签改为 `text-[10px] uppercase tracking-wider` 小标签
- [x] 数字加大到 `text-xl`，总成本用 `text-zephyr-blue` 品牌色强调
- [x] 表格加 `tabular-nums`、hover 行状态、圆角 `rounded-xl`
- [x] 表头加 `uppercase tracking-wider text-[10px]`
- [x] 成本列数字有值时 `text-foreground`，无值时 `text-muted-foreground/50`

#### Issues List 卡片化
- [x] `rounded-lg` → `rounded-xl`，加 `bg-surface-elevated`
- [x] more row 加 `bg-muted/20` 背景区分
- [x] 链接加 `no-underline` 确保视觉纯净

#### Design Token 补充
- [x] `index.css` 新增 `--surface-overlay` 和 `--surface-inset` tokens（light + dark 各一套）
- [x] light: `rgba(30, 41, 59, 0.06)` / `#E8EBEF`
- [x] dark: `rgba(255, 255, 255, 0.06)` / `#12141a`

### 验证
- [x] `npx vite build` 通过
- [x] Cloudflare Pages 部署成功: https://d8085a7e.zephyr-nexus-ui.pages.dev

---

## 部署工作流

### Cloudflare Pages 手动部署

```bash
# 1. 安装依赖
pnpm install

# 2. 构建
pnpm run build

# 3. 部署（需设置环境变量）
unset http_proxy https_proxy
CLOUDFLARE_API_TOKEN=你的token \
CLOUDFLARE_ACCOUNT_ID=273d4fa9ad8e1e2ed44a4eba55ca5609 \
npx wrangler pages deploy dist --project-name=zephyr-nexus-ui
```

### 环境变量配置（持久化）

```bash
# 写入 ~/.bashrc 或 ~/.zshrc
export CLOUDFLARE_API_TOKEN="cfat_xxx"
export CLOUDFLARE_ACCOUNT_ID="273d4fa9ad8e1e2ed44a4eba55ca5609"
```

### GitHub Actions CI/CD（目标状态）

```yaml
# .github/workflows/deploy-ui.yml
name: Deploy UI to Cloudflare Pages

on:
  push:
    branches: [main]
    paths:
      - 'ui/**'
  pull_request:
    branches: [main]
    paths:
      - 'ui/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
          cache-dependency-path: 'ui/pnpm-lock.yaml'
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        working-directory: ui
      - name: Build
        run: pnpm run build
        working-directory: ui
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=zephyr-nexus-ui --commit-dirty=true
          workingDirectory: ui
```

**需要配置的 GitHub Secrets:**
- `CLOUDFLARE_API_TOKEN` — Cloudflare API Token
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare Account ID: `273d4fa9ad8e1e2ed44a4eba55ca5609`

### 目标自动化流程

```
PR merge to main
    ↓
GitHub Actions 触发
    ↓
pnpm install + build
    ↓
Cloudflare Pages 自动部署
    ↓
Preview URL 自动生成
```

---

## 剩余 UI Debt
- 部分页面仍有 opacity 文字（`text-foreground/60` 等），应逐步转为 text-secondary / text-muted / text-subtle
- `text-muted-foreground` 在部分组件中是唯一的弱文本 token，后续应区分三级弱文本

### Dashboard.tsx
- ✅ 已清理所有 ~40 个硬编码 hex，统一为 text-text-secondary / text-text-tertiary / text-text-subtle / text-muted-foreground tokens

### ToastViewport 已修复
- ✅ 已统一为 token 引用（info/success/warning/error）
- 后续可在 Modal/EmptyState 精修阶段进一步提升 toast 整体视觉

### App Shell (Layout.tsx)
- ✅ 已修复：硬编码 rgba atmospheric div → CSS orb system（3 orbs via CSS vars + float keyframes）

### Sidebar 渐变
- ✅ 已修复：`rgba(122, 139, 168, 0.03)` → `color-mix(in oklab, var(--periwinkle) 8%, transparent)`

### ActivityCharts 图表色
- ✅ 已修复：所有图表色已统一为 chart-1~chart-7 tokens

### MobileBottomNav
- ✅ 已修复：`bg-[#f7f7f8]/95` → `bg-surface-floating/95`

### 部分组件未使用 surface token
- `border-border/50`、`bg-background/95`、`bg-background/80` 等模式应逐步规范
- 当前 `rgba(255,255,255,0.0X)` 硬编码在某些 surface class 的 dark mode 中

### status-colors.ts 仍使用 Tailwind v3 颜色名
- ✅ Phase 3 已完成：`src/lib/status-colors.ts` 全面迁移至语义化 token

### Dark mode 的单元测试
- 全站 dark mode 需要逐个页面验收
- 部分组件在 dark mode 下可能仍有对比度问题
- 留在 Phase 6 专项验收

---

## 本轮不做事项

- ❌ 不改业务逻辑
- ❌ 不重写页面结构
- ❌ 不随意新增组件库
- ❌ 不大范围重构组件
- ❌ 不新增复杂动画
- ❌ 不引入重型 UI 框架
- ❌ 不为了高级感牺牲可读性

---

## Token 体系现状

所有 tokens 集中在 `src/index.css`:

### Light mode (`:root`)
| 类别 | Token 数 | 备注 |
|------|----------|------|
| Background/Surface | ~15 | 六层体系: void→page→section→card→elevated→floating |
| Text | 6 | primary, secondary, tertiary, subtle, disabled, inverse + status variants |
| Border | 5 | subtle, default, strong, active, danger + divider |
| Status | 9 | brand, info, success, warning, danger, neutral, live, paused, etc |
| Shadow | 6 | subtle, sm, card, elevated, modal, focus |
| Radius | 6 | xs, sm, md, lg, xl, 2xl + pill |
| Spacing | ~12 | page-padding, section-gap, card-padding, button-height, etc |
| Shell | ~10 | page-bg, pane-bg, surface-bg, border, hover, selected, chip |
| Brand | 8 | zephyr-blue, violet, cyan, teal, copper, periwinkle |
| Motion | ~8 | duration, easing |

### Dark mode (`.dark`)
- 完整镜像 light mode tokens
- 独立校准值，深墨蓝基调
- 六层明度体系，三层文字层级