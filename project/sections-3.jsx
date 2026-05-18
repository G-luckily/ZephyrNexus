/* global React, Ic */

/* ============================================================
   Component library + Handoff + Footer
   ============================================================ */

const ComponentLibrary = () => (
  <section className="section" id="components">
    <div className="shell">
      <div className="section-header">
        <div className="title-block">
          <div className="eyebrow eyebrow-dot">09 · Component System</div>
          <h2 className="section-title">小而真。先做对的 12 个，再扩。</h2>
          <p className="section-sub">
            不做一整套 Figma 库 — 只画 Console 真正用到的那 12 个：button · input · tag · kpi · sparkline · workflow node · log row · budget bar · adapter row · task row · seg control · toggle.
          </p>
        </div>
      </div>

      <div className="lib-grid">
        <div className="lib-card span-4">
          <div className="ttl">Buttons</div>
          <div className="row">
            <button className="btn copper"><Ic name="plus" size={12} /> Primary</button>
            <button className="btn primary">Sand</button>
            <button className="btn">Default</button>
            <button className="btn ghost">Ghost</button>
          </div>
          <div className="row">
            <button className="btn copper" style={{ padding: "6px 10px", fontSize: 12 }}>sm</button>
            <button className="btn" style={{ padding: "11px 18px", fontSize: 14 }}>lg</button>
            <button className="btn" style={{ padding: "9px 10px" }}><Ic name="settings" size={14} /></button>
            <span className="kbd">⌘K</span>
          </div>
        </div>

        <div className="lib-card span-4">
          <div className="ttl">Tags · Status</div>
          <div className="row">
            <span className="tag ok"><span className="dot" /> healthy</span>
            <span className="tag warn"><span className="dot" /> degraded</span>
            <span className="tag crit"><span className="dot" /> down</span>
            <span className="tag copper"><span className="dot" /> budget</span>
          </div>
          <div className="row">
            <span className="tag"><span className="dot" /> queued</span>
            <span className="tag ok"><span className="dot" /> running</span>
            <span className="tag"><span className="dot" /> done</span>
            <span className="tag warn"><span className="dot" /> needs approval</span>
          </div>
        </div>

        <div className="lib-card span-4">
          <div className="ttl">Inputs</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input className="input" placeholder="Search agents, workflows, traces…" />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div className="seg">
                <button className="on">24h</button>
                <button>7d</button>
                <button>30d</button>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: 8 }}>
                <span style={{ fontSize: 12, color: "var(--sand-300)" }}>Streaming</span>
                <div className="tgl on" />
              </div>
            </div>
          </div>
        </div>

        <div className="lib-card span-6">
          <div className="ttl">Workflow Node — 4 states</div>
          <div style={{ position: "relative", height: 110 }}>
            <div className="node done" style={{ left: "12%", top: "50%", transform: "translate(-50%,-50%)" }}>
              <div className="pill"><span className="tit">Router</span><span className="role">Decision</span></div>
            </div>
            <div className="node running" style={{ left: "37%", top: "50%", transform: "translate(-50%,-50%)" }}>
              <div className="pill"><span className="tit">Merge &amp; Rank</span><span className="role">Reducer · live</span></div>
            </div>
            <div className="node queued" style={{ left: "62%", top: "50%", transform: "translate(-50%,-50%)" }}>
              <div className="pill"><span className="tit">Review Gate</span><span className="role">Approval</span></div>
            </div>
            <div className="node warn" style={{ left: "87%", top: "50%", transform: "translate(-50%,-50%)" }}>
              <div className="pill"><span className="tit">Export</span><span className="role">Postgres · warn</span></div>
            </div>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--sand-400)", letterSpacing: "0.06em", display: "flex", justifyContent: "space-around" }}>
            <span>DONE</span><span>RUNNING</span><span>QUEUED</span><span>WARN</span>
          </div>
        </div>

        <div className="lib-card span-6">
          <div className="ttl">Log Row · Trace Format</div>
          <div className="runtime-log" style={{ maxHeight: "none" }}>
            <div className="row"><span className="ts">16:42:14</span><span className="lvl">INFO</span><span className="msg"><span className="agent">score.codex</span> · skill matrix → 12 candidates <span className="tok">· tokens=11,802</span></span></div>
            <div className="row"><span className="ts">16:42:17</span><span className="lvl warn">WARN</span><span className="msg"><span className="agent">screen.claude-s</span> · adapter latency p95 → 4.8s</span></div>
            <div className="row high"><span className="ts">16:42:24</span><span className="lvl crit">CRIT</span><span className="msg"><span className="agent">budget-guard</span> · forecast overrun 8%</span></div>
          </div>
        </div>

        <div className="lib-card span-6">
          <div className="ttl">Budget Bar</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="budget-row">
              <div className="top"><span className="name">Monthly cap</span><span className="num-line"><strong>$1,284</strong> / $4,800 · 26.8%</span></div>
              <div className="budget-bar"><div className="fill" style={{ width: "26.8%" }} /><div className="threshold" style={{ left: "70%" }} /></div>
            </div>
            <div className="budget-row">
              <div className="top"><span className="name">Codex-mini adapter</span><span className="num-line"><strong>$296</strong> / $320 · 92.6%</span></div>
              <div className="budget-bar crit"><div className="fill" style={{ width: "92.6%" }} /><div className="threshold" style={{ left: "85%" }} /></div>
            </div>
          </div>
        </div>

        <div className="lib-card span-6">
          <div className="ttl">Task Row</div>
          <div className="task-list">
            <div className="task-row">
              <div className="pri p0">P0</div>
              <div className="title-line"><div className="ttl">Approve shortlist · req_4f8c</div><div className="meta">hr_screening_v3 · gate</div></div>
              <div className="agent-tag">@review_gate</div>
              <div className="dur">—</div>
              <span className="tag warn"><span className="dot" /> needs approval</span>
              <div className="more"><Ic name="more" size={14} /></div>
            </div>
            <div className="task-row">
              <div className="pri p2">P2</div>
              <div className="title-line"><div className="ttl">Refresh FAQ embedding index</div><div className="meta">support_kb · sched</div></div>
              <div className="agent-tag">@embeddings.svc</div>
              <div className="dur">queued</div>
              <span className="tag"><span className="dot" /> queued</span>
              <div className="more"><Ic name="more" size={14} /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const Handoff = () => (
  <section className="section" id="handoff">
    <div className="shell">
      <div className="section-header">
        <div className="title-block">
          <div className="eyebrow eyebrow-dot">10 · Engineering Handoff</div>
          <h2 className="section-title">交给前端实施时要说清的事。</h2>
          <p className="section-sub">
            这套 redesign 不绑定 Figma —— tokens 全部在 <code style={{ fontFamily: "var(--font-mono)", color: "var(--copper-200)" }}>tokens.css</code> 里以 CSS 变量定义。
            React 实现建议路径如下。
          </p>
        </div>
      </div>

      <div className="handoff">
        <div className="handoff-card">
          <h4><Ic name="settings" size={14} style={{ color: "var(--copper-300)" }} /> 落地步骤</h4>
          <ul>
            <li>在 <code>ui/src/styles/</code> 下落 <code>tokens.css</code> + <code>theme.dark.css</code>。</li>
            <li>把 Tailwind 主题改成消费 CSS 变量（<code>colors.ink.900 = var(--ink-900)</code>）。</li>
            <li>移除现有 Inter / 紫色头像 / 蓝白主色 — grep <code>blue-</code>, <code>purple-</code>, <code>indigo-</code>, <code>Inter</code>。</li>
            <li>新增 <code>&lt;StatusTag/&gt;</code>, <code>&lt;KPI/&gt;</code>, <code>&lt;Sparkline/&gt;</code>, <code>&lt;WorkflowNode/&gt;</code>, <code>&lt;TraceRow/&gt;</code>, <code>&lt;BudgetBar/&gt;</code>。</li>
            <li>侧边栏按 <code>Operate / Runtime / Governance</code> 三段重写，去掉 "全部智能体"。</li>
            <li>Console 路由从 <code>/dashboard</code> 切到 <code>/console</code>，旧路径 301。</li>
          </ul>
        </div>

        <div className="handoff-card">
          <h4><Ic name="audit" size={14} style={{ color: "var(--copper-300)" }} /> 数据契约</h4>
          <ul>
            <li><code>GET /api/console/overview</code> → KPI 四件套 + 当前活跃 workflow id。</li>
            <li><code>GET /api/workflows/:id/run</code> → 节点 + 状态 + cost + ETA。</li>
            <li><code>WS /api/trace/stream?run=…</code> → SSE 形式的 trace row。</li>
            <li><code>GET /api/budget/forecast</code> → 当前 burn + 30d 预测 + threshold 命中表。</li>
            <li><code>GET /api/adapters/health</code> → 每个 adapter latency p50/p95/q/status。</li>
            <li><code>GET /api/queue?pri=P0..P3</code> → 任务队列（需 attention 优先）。</li>
          </ul>
        </div>

        <div className="handoff-card">
          <h4><Ic name="shield" size={14} style={{ color: "var(--copper-300)" }} /> 设计原则（写进 ESLint 提醒）</h4>
          <ul>
            <li><strong>Copper 只用于 "钱" 与 primary CTA</strong>。其它 accent 一律 sand。</li>
            <li><strong>Mint 只用于实时态</strong>。静态展示用 sand-100。</li>
            <li><strong>不要用 drop-shadow + glow 组合</strong>。只能选一种，且默认不用。</li>
            <li><strong>Mono 字体仅用于 runtime / id / 数字</strong>。导航、标题永远 sans。</li>
            <li><strong>动画 ≤ 380ms · ease-out</strong>。pulse 只能贴在 "running" 状态上。</li>
          </ul>
        </div>

        <div className="handoff-card">
          <h4><Ic name="sparkles" size={14} style={{ color: "var(--copper-300)" }} /> PM 视角的成功指标</h4>
          <ul>
            <li><strong>TTV (time-to-value)</strong>：新用户从注册到完成 1 次 workflow run ≤ 5 min。</li>
            <li><strong>Attention queue 清空率</strong>：日 P0 任务 SLA &lt; 30 min。</li>
            <li><strong>Budget overrun</strong>：月度超支事件 / 公司数 → 目标 &lt; 5%。</li>
            <li><strong>Console DAU/MAU</strong>：≥ 0.55 — 证明这是真正的日常控制面。</li>
            <li><strong>Trace 查阅率</strong>：> 60% 的失败 run 在 5 min 内被打开过 trace 页。</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
);

const Foot = () => (
  <footer className="foot">
    <div className="shell">
      <div className="row">
        <div>
          <div className="nm">Zephyr Nexus — Control Plane Redesign</div>
          <div className="meta" style={{ marginTop: 6 }}>设计 · 信息架构 · 前端规范 · 2026 / Q2</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="meta">MADE WITH HTML / CSS / REACT · NO FIGMA</div>
          <div style={{ marginTop: 6 }}>风之灵枢 · 让一个人管 100 个 AI，像管 1 个一样。</div>
        </div>
      </div>
    </div>
  </footer>
);

window.ComponentLibrary = ComponentLibrary;
window.Handoff = Handoff;
window.Foot = Foot;
