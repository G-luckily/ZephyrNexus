import React from 'react'
import { Ic } from './Icons'
import { Console, KPIs, Workflow, RuntimeLog, Spark } from './Console'

export const ConsoleSection = () => (
  <section className="section" id="console" style={{ paddingTop: 40 }}>
    <div className="shell">
      <div className="section-header">
        <div className="title-block">
          <div className="eyebrow eyebrow-dot">04 · The Console</div>
          <h2 className="section-title">指挥台 · 一屏看完整运行态。</h2>
          <p className="section-sub">
            重做后的 Console 把 "运维 + 运行 + 风险" 三件事压在同一屏。
            上排 KPI 是健康概要，中段是当前在跑的 workflow + execution trace，下段是 attention queue 与 Budget Guard，
            最后一排是 adapter 健康。所有节点点击下钻。
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", paddingBottom: 6 }}>
          <span className="tag ok"><span className="dot" /> live data shape</span>
          <span className="tag"><span className="dot" /> 1440 × 900 baseline</span>
        </div>
      </div>

      <Console />

      <p style={{ marginTop: 18, color: "var(--sand-400)", fontFamily: "var(--font-mono)", fontSize: 11.5, letterSpacing: "0.05em" }}>
        ＊ 数值为产品演示用 dummy data — 数据来自 server/routes/dashboard.ts 的 schema 占位。
      </p>
    </div>
  </section>
);

export const WorkflowCloseup = () => (
  <section className="section" id="workflow">
    <div className="shell">
      <div className="section-header">
        <div className="title-block">
          <div className="eyebrow eyebrow-dot">05 · Workflow Surface</div>
          <h2 className="section-title">Workflow 是这个产品的主名词。</h2>
          <p className="section-sub">
            把一条 workflow 画清楚，比把 dashboard 画漂亮重要 —— Console 上的那张图直接复用到 Designer / Run Detail 页。
            节点用同一种 pill，状态只有四种：done · running · queued · warn，颜色绝不重复使用。
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", paddingBottom: 6 }}>
          <span className="tag ok"><span className="dot" /> 4 states only</span>
          <span className="tag"><span className="dot" /> mono labels</span>
        </div>
      </div>

      <div className="card elev" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Ic name="workflow" size={16} style={{ color: "var(--copper-300)" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--sand-200)", letterSpacing: "0.05em" }}>
              hr_screening_v3
            </span>
            <span className="tag ok"><span className="dot" /> RUNNING</span>
            <span className="meta" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--sand-400)" }}>v3.2 · 12 runs today</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn ghost"><Ic name="pause" size={12} /> Pause</button>
            <button className="btn ghost"><Ic name="eye" size={12} /> Trace</button>
            <button className="btn"><Ic name="settings" size={12} /> Settings</button>
          </div>
        </div>

        <div style={{ padding: "12px 20px 24px" }}>
          <div style={{ height: 360, position: "relative" }}>
            <Workflow />
          </div>

          <div style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            paddingTop: 16,
            borderTop: "1px solid var(--line-soft)"
          }}>
            <div>
              <div className="label-mono">CURRENT NODE</div>
              <div style={{ fontSize: 16, color: "var(--sand-50)", fontWeight: 500, marginTop: 4 }}>Merge &amp; Rank</div>
              <div style={{ fontSize: 12, color: "var(--sand-300)", marginTop: 2 }}>Reducer · 0.04s avg</div>
            </div>
            <div>
              <div className="label-mono">ELAPSED · ETA</div>
              <div style={{ fontSize: 16, color: "var(--sand-50)", fontFamily: "var(--font-display)", marginTop: 4 }}>23s <span style={{ color: "var(--sand-400)", fontSize: 14 }}>/ ~ 41s</span></div>
              <div style={{ fontSize: 12, color: "var(--sand-300)", marginTop: 2 }}>p50 38s · p95 67s</div>
            </div>
            <div>
              <div className="label-mono">COST SO FAR</div>
              <div style={{ fontSize: 16, color: "var(--copper-200)", fontFamily: "var(--font-display)", marginTop: 4 }}>$0.41 <span style={{ color: "var(--sand-400)", fontSize: 14 }}>/ ~ $0.78</span></div>
              <div style={{ fontSize: 12, color: "var(--sand-300)", marginTop: 2 }}>78% Claude · 22% Codex</div>
            </div>
            <div>
              <div className="label-mono">RISK FLAGS</div>
              <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className="tag warn"><span className="dot" /> latency</span>
                <span className="tag crit"><span className="dot" /> budget forecast</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export const RuntimeCloseup = () => (
  <section className="section" id="runtime">
    <div className="shell">
      <div className="section-header">
        <div className="title-block">
          <div className="eyebrow eyebrow-dot">06 · Runtime Monitor</div>
          <h2 className="section-title">Trace 是这个产品最值得"卷"的地方。</h2>
          <p className="section-sub">
            实时日志 + 健康分布 + adapter 延迟分桶。出问题第一眼能看到哪个 agent / adapter 在拖后腿，
            一键跳到当条 trace。
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18 }}>
        <div className="card elev" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Ic name="runtime" size={14} style={{ color: "var(--copper-300)" }} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Execution Trace</span>
              <span className="tag ok"><span className="dot" /> streaming</span>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <div className="seg">
                <button className="on">all</button>
                <button>warn</button>
                <button>crit</button>
              </div>
              <button className="btn ghost" style={{ padding: "4px 8px" }}><Ic name="filter" size={12} /></button>
            </div>
          </div>
          <div style={{ padding: 14 }}>
            <RuntimeLog />
          </div>
          <div style={{ padding: "10px 18px", borderTop: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--sand-400)" }}>
            <span>showing 8 of 142 events · last 60s</span>
            <span><span className="kbd">↓</span> follow tail · <span className="kbd">/</span> filter</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="card">
            <div className="panel-head">
              <h3><Ic name="bolt" size={14} /> Adapter Latency · p95</h3>
              <span className="meta">last 60 min</span>
            </div>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                ["Claude Sonnet 4.5", 412, 0.21, "ok"],
                ["Codex-large", 880, 0.44, "ok"],
                ["Cursor Composer", 234, 0.12, "ok"],
                ["OpenClaw Gateway", 1820, 0.91, "warn"],
                ["Gemini 2 Flash", 0, 0, "crit"],
              ].map(([n, ms, w, st]) => (
                <div key={n}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "var(--sand-100)" }}>{n}</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--sand-300)" }}>
                      {ms ? `${ms}ms` : <span style={{ color: "var(--crit)" }}>down</span>}
                    </span>
                  </div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 4, marginTop: 4 }}>
                    <div style={{
                      height: "100%",
                      width: `${w * 100}%`,
                      borderRadius: 4,
                      background: st === "warn" ? "var(--warn)" : st === "crit" ? "var(--crit)" : "var(--mint-300)"
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="panel-head">
              <h3><Ic name="sparkles" size={14} /> Token Flow · 24h</h3>
              <span className="meta">2.1M tokens</span>
            </div>
            <div style={{ marginTop: 12 }}>
              <Spark data={[80, 120, 100, 140, 180, 220, 260, 240, 280, 320, 360, 410, 380, 420, 460, 480, 520, 540, 600, 620, 580, 540, 520, 500]} w={300} h={70} color="#C97847" />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--sand-400)" }}>
              <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>now</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export const MetricCards = () => (
  <section className="section" id="metrics">
    <div className="shell">
      <div className="section-header">
        <div className="title-block">
          <div className="eyebrow eyebrow-dot">07 · Metric Cards</div>
          <h2 className="section-title">每张卡只回答一个问题。</h2>
          <p className="section-sub">
            四张 KPI 卡用同一节奏：上 label + delta，中 number + unit，下 micro-context + sparkline。
            带 accent 边的那张永远代表 "钱"，整套设计里只有它能用 copper。
          </p>
        </div>
      </div>
      <KPIs />

      <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 12 }}>Anatomy</div>
          <div style={{ position: "relative", padding: "10px 0" }}>
            <div className="kpi accent" style={{ maxWidth: 320 }}>
              <div className="lbl">
                <span>BUDGET BURN</span>
                <span className="delta down">↑ 23%</span>
              </div>
              <div className="val">$1,284<small>.40</small></div>
              <div className="sub">of $4,800 · 26.8% used · 12d left</div>
              <div className="spark">
                <Spark data={[120, 140, 160, 180, 175, 220, 230, 240, 260, 280, 295]} color="#C97847" />
              </div>
            </div>
            <ul style={{ marginTop: 16, padding: 0, listStyle: "none", fontSize: 13, color: "var(--sand-200)", display: "flex", flexDirection: "column", gap: 8 }}>
              <li><code style={{ fontFamily: "var(--font-mono)", color: "var(--copper-200)" }}>label</code> — uppercase mono, 0.12em tracking</li>
              <li><code style={{ fontFamily: "var(--font-mono)", color: "var(--copper-200)" }}>delta</code> — mint up / coral down / sand flat</li>
              <li><code style={{ fontFamily: "var(--font-mono)", color: "var(--copper-200)" }}>value</code> — Schibsted Grotesk 500, tabular-nums</li>
              <li><code style={{ fontFamily: "var(--font-mono)", color: "var(--copper-200)" }}>sub</code> — micro-context in mono · max 60ch</li>
              <li><code style={{ fontFamily: "var(--font-mono)", color: "var(--copper-200)" }}>spark</code> — 26px tall, last point dotted</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 12 }}>States</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="kpi">
              <div className="lbl"><span>EMPTY</span><span className="delta flat">—</span></div>
              <div className="val" style={{ color: "var(--sand-300)" }}>—</div>
              <div className="sub">no runs yet · create a workflow</div>
            </div>
            <div className="kpi">
              <div className="lbl"><span>LOADING</span><span className="delta flat">···</span></div>
              <div className="val" style={{ color: "var(--sand-400)" }}>
                <span style={{ display: "inline-block", width: 90, height: 24, background: "rgba(255,255,255,0.05)", borderRadius: 4 }} />
              </div>
              <div className="sub"><span style={{ display: "inline-block", width: 140, height: 10, background: "rgba(255,255,255,0.05)", borderRadius: 4 }} /></div>
            </div>
            <div className="kpi" style={{ borderColor: "rgba(212,176,95,0.35)" }}>
              <div className="lbl"><span>WARN</span><span className="delta down">↑ 38%</span></div>
              <div className="val" style={{ color: "var(--warn)" }}>4.8<small>s</small></div>
              <div className="sub">p95 latency above 4.0s threshold</div>
            </div>
            <div className="kpi" style={{ borderColor: "rgba(224,121,94,0.35)", background: "rgba(224,121,94,0.04)" }}>
              <div className="lbl"><span>CRITICAL</span><span className="delta down">DOWN</span></div>
              <div className="val" style={{ color: "var(--crit)" }}>0<small>/3</small></div>
              <div className="sub">Gemini 2 Flash unreachable · 4m</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export const Responsive = () => (
  <section className="section" id="responsive">
    <div className="shell">
      <div className="section-header">
        <div className="title-block">
          <div className="eyebrow eyebrow-dot">08 · Responsive</div>
          <h2 className="section-title">桌面是主战场。手机是值班手机。</h2>
          <p className="section-sub">
            控制面 95% 的工作发生在桌面。手机版只承担三件事：看 attention queue · approve / pause · 看 burn rate。
            其它能力都不在手机端开放，避免在小屏上做 destructive 操作。
          </p>
        </div>
      </div>

      <div className="responsive-grid">
        <div className="device tablet">
          <div className="scr">
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Ic name="wind" size={16} style={{ color: "var(--copper-300)" }} />
                <span style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600 }}>Zephyr Nexus</span>
                <span className="tag" style={{ fontSize: 9 }}><span className="dot" /> PROD</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <span className="kbd">⌘K</span>
                <span style={{ width: 22, height: 22, borderRadius: 6, background: "var(--copper-300)" }} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: 14 }}>
              <div className="kpi" style={{ padding: 10 }}><div className="lbl"><span>AGENTS</span><span className="delta">↑12%</span></div><div className="val" style={{ fontSize: 22 }}>42<small>/60</small></div></div>
              <div className="kpi" style={{ padding: 10 }}><div className="lbl"><span>SUCCESS</span><span className="delta">↑1.4</span></div><div className="val" style={{ fontSize: 22 }}>97.8<small>%</small></div></div>
              <div className="kpi accent" style={{ padding: 10 }}><div className="lbl"><span>BURN</span><span className="delta down">↑23%</span></div><div className="val" style={{ fontSize: 22 }}>$1.28k</div></div>
            </div>
            <div style={{ padding: "0 14px" }}>
              <div className="panel" style={{ padding: 12 }}>
                <div className="panel-head"><h3 style={{ fontSize: 12.5 }}><Ic name="workflow" size={12} /> hr_screening_v3</h3><span className="meta" style={{ fontSize: 10 }}>RUNNING · 23s</span></div>
                <div style={{ height: 130, position: "relative" }}>
                  <Workflow />
                </div>
              </div>
            </div>
            <div style={{ padding: 14 }}>
              <div className="panel" style={{ padding: 12 }}>
                <div className="panel-head"><h3 style={{ fontSize: 12.5 }}><Ic name="runtime" size={12} /> Live Trace</h3><span className="meta" style={{ fontSize: 10 }}>↓ tail</span></div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--sand-200)", lineHeight: 1.7 }}>
                  <div><span style={{ color: "var(--sand-400)" }}>16:42:21</span> <span style={{ color: "var(--mint-300)" }}>INFO</span> <span style={{ color: "var(--copper-200)" }}>merge.reducer</span> · shortlist=4</div>
                  <div><span style={{ color: "var(--sand-400)" }}>16:42:24</span> <span style={{ color: "var(--crit)" }}>CRIT</span> <span style={{ color: "var(--copper-200)" }}>budget-guard</span> · forecast +8%</div>
                  <div><span style={{ color: "var(--sand-400)" }}>16:42:26</span> <span style={{ color: "var(--mint-300)" }}>INFO</span> <span style={{ color: "var(--copper-200)" }}>review_gate</span> · approval requested</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="device phone">
          <div className="scr">
            <div style={{ padding: "12px 14px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--sand-400)" }}>9:41</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--sand-400)" }}>● ● ●</span>
            </div>
            <div style={{ padding: "8px 16px 0" }}>
              <div className="eyebrow" style={{ fontSize: 9.5 }}>OPS · 值班手机 · ON-CALL</div>
              <h2 style={{ fontSize: 22, marginTop: 6 }}><span className="font-cjk">指挥台</span> <span style={{ color: "var(--sand-300)", fontSize: 14, fontWeight: 400 }}>· now</span></h2>
            </div>
            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="kpi accent" style={{ padding: 12 }}>
                <div className="lbl"><span>BURN · 26.8%</span><span className="delta down">↑23%</span></div>
                <div className="val" style={{ fontSize: 26 }}>$1,284<small>.40</small></div>
                <div className="sub">12d left · forecast +8%</div>
              </div>
              <div className="kpi" style={{ padding: 12 }}>
                <div className="lbl"><span>ATTENTION</span><span className="delta flat">→ 0</span></div>
                <div className="val" style={{ fontSize: 26 }}>7</div>
                <div className="sub">3 approvals · 2 blocked · 2 budget</div>
              </div>
              <div className="panel" style={{ padding: 12 }}>
                <div className="panel-head"><h3 style={{ fontSize: 12 }}>Top priority</h3><span className="meta" style={{ fontSize: 10 }}>P0</span></div>
                <div style={{ fontSize: 12.5, color: "var(--sand-50)", fontWeight: 500 }}>Approve shortlist · req_4f8c</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--sand-400)", marginTop: 2 }}>hr_screening_v3 · gate</div>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <button className="btn copper" style={{ flex: 1, justifyContent: "center", padding: "8px 10px", fontSize: 12 }}>Approve</button>
                  <button className="btn ghost" style={{ flex: 1, justifyContent: "center", padding: "8px 10px", fontSize: 12 }}>Hold</button>
                </div>
              </div>
            </div>
            <div style={{ position: "absolute", bottom: 12, left: 16, right: 16, display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid var(--line)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--sand-400)" }}>
              <span style={{ color: "var(--sand-50)" }}>OPS</span><span>QUEUE</span><span>BURN</span><span>TRACE</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ alignSelf: "stretch" }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>Breakpoints &amp; rules</div>
          <ul style={{ padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12, fontSize: 13, color: "var(--sand-200)" }}>
            <li><strong style={{ color: "var(--sand-50)" }}>≥ 1280px</strong> — full console: sidebar + 2-column body + KPI strip.</li>
            <li><strong style={{ color: "var(--sand-50)" }}>1024–1279</strong> — sidebar collapses to icon rail · KPI 2×2 · workflow + trace stack.</li>
            <li><strong style={{ color: "var(--sand-50)" }}>768–1023 (tablet)</strong> — bottom-tab nav · KPI 3-up · workflow keeps shape (read-only).</li>
            <li><strong style={{ color: "var(--sand-50)" }}>≤ 480 (phone)</strong> — on-call mode only: burn · attention · approve / pause. No destructive edits.</li>
          </ul>
          <hr className="divider" style={{ margin: "16px 0" }} />
          <div className="eyebrow" style={{ marginBottom: 10 }}>Non-goals</div>
          <p style={{ fontSize: 12.5, color: "var(--sand-300)" }}>
            Workflow Designer 不做手机适配。Settings / Audit 不做手机适配。这是有意的产品取舍。
          </p>
        </div>
      </div>
    </div>
  </section>
);
