/* global React, Ic, Console, KPIs, Workflow, RuntimeLog, BudgetGuard, Adapters, TaskQueue, Spark, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor */
const { useState, useMemo } = React;

/* ============================================================
   Hero
   ============================================================ */
const HeroTrace = () => (
  <div className="hero-mon">
    <div className="hero-mon-top">
      <div className="hero-mon-dots"><span /><span /><span /></div>
      <div className="hero-mon-title">RUNTIME · trace 7b3c…e419 · live</div>
      <span className="tag ok" style={{ fontSize: 9 }}><span className="dot" /> streaming</span>
    </div>
    <div className="hero-trace">
      <div className="row"><span className="ts">16:42:08</span><span className="lvl">INFO</span><span className="msg"><span className="agent">router-01</span> · routed → screen+score</span><span className="tok">0.02s</span></div>
      <div className="row"><span className="ts">16:42:09</span><span className="lvl">INFO</span><span className="msg"><span className="agent">screen.claude-s</span> · loaded resume_batch_204</span><span className="tok">38.1k tk</span></div>
      <div className="row"><span className="ts">16:42:14</span><span className="lvl">INFO</span><span className="msg"><span className="agent">score.codex</span> · skill matrix → 12 candidates</span><span className="tok">11.8k tk</span></div>
      <div className="row"><span className="ts">16:42:17</span><span className="lvl warn">WARN</span><span className="msg"><span className="agent">screen.claude-s</span> · adapter latency p95 → 4.8s</span><span className="tok">thr 4.0s</span></div>
      <div className="row"><span className="ts">16:42:21</span><span className="lvl">INFO</span><span className="msg"><span className="agent">merge.reducer</span> · shortlist=4 → review_gate</span><span className="tok">—</span></div>
      <div className="row"><span className="ts">16:42:24</span><span className="lvl crit">CRIT</span><span className="msg"><span className="glow"><span className="agent">budget-guard</span> · forecast overrun 8% on hr_screening_v3</span></span><span className="tok">$0.41</span></div>
      <div className="row"><span className="ts">16:42:26</span><span className="lvl">INFO</span><span className="msg"><span className="agent">review_gate</span> · approval requested · 1 reviewer notified</span><span className="tok">—</span></div>
      <div className="row"><span className="ts">16:42:31</span><span className="lvl">INFO</span><span className="msg"><span className="agent">trace-store</span> · persisted 2.1 MB</span><span className="tok">ok</span></div>
    </div>
  </div>
);

const WindStreaks = () => (
  <svg className="hero-wind" viewBox="0 0 1400 600" preserveAspectRatio="none">
    <defs>
      <linearGradient id="wg" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0%" stopColor="rgba(201,120,71,0)" />
        <stop offset="40%" stopColor="rgba(201,120,71,0.18)" />
        <stop offset="100%" stopColor="rgba(201,120,71,0)" />
      </linearGradient>
      <linearGradient id="wg2" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0%" stopColor="rgba(143,233,194,0)" />
        <stop offset="40%" stopColor="rgba(143,233,194,0.12)" />
        <stop offset="100%" stopColor="rgba(143,233,194,0)" />
      </linearGradient>
    </defs>
    {Array.from({ length: 28 }, (_, i) => {
      const y = 30 + i * 22 + (i % 3) * 8;
      const w = 200 + (i * 53) % 500;
      const x = (i * 137) % 1400 - 200;
      const op = 0.3 + ((i * 17) % 40) / 100;
      const g = i % 5 === 0 ? "url(#wg2)" : "url(#wg)";
      return <rect key={i} x={x} y={y} width={w} height="1.2" fill={g} opacity={op} />;
    })}
  </svg>
);

const Hero = () => (
  <header className="hero">
    <WindStreaks />
    <div className="shell">
      <div className="hero-grid">
        <div>
          <div className="eyebrow eyebrow-dot">Zephyr Nexus · 风之灵枢 · Control Plane v2 Redesign</div>
          <h1 style={{ marginTop: 20 }}>
            <span className="cjk">让一个人</span>
            <span>operate <em>100 agents</em></span>
            <span><span className="copper">like one.</span></span>
          </h1>
          <p className="hero-sub">
            Zephyr Nexus 是面向 AI 智能体公司的<strong style={{ color: "var(--sand-50)" }}>控制平面</strong>。
            派活、记账、留痕、止损 —— 一个面板看完整条 workflow 的健康、成本与风险。
          </p>
          <div className="hero-meta">
            <span className="tag"><span className="dot" /> Orchestration</span>
            <span className="tag"><span className="dot" /> Runtime Observability</span>
            <span className="tag copper"><span className="dot" /> Budget Guard</span>
            <span className="tag"><span className="dot" /> Audit Trace</span>
            <span className="tag"><span className="dot" /> Adapter Health</span>
          </div>
          <div className="hero-cta">
            <a className="btn copper" href="#console"><Ic name="play" /> 进入指挥台 Console</a>
            <a className="btn ghost" href="#audit">阅读设计审计 <Ic name="arrow" /></a>
            <span className="kbd" style={{ marginLeft: 8 }}>⌘K</span>
          </div>
        </div>

        <div>
          <HeroTrace />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18, color: "var(--sand-400)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em" }}>
            <span>WORKFLOW · hr_screening_v3</span>
            <span>4 / 8 NODES · $0.41 SPENT</span>
          </div>
        </div>
      </div>
    </div>
  </header>
);

/* ============================================================
   Audit
   ============================================================ */
const Audit = () => (
  <section className="section" id="audit">
    <div className="shell">
      <div className="section-header">
        <div className="title-block">
          <div className="eyebrow eyebrow-dot">01 · UX Audit</div>
          <h2 className="section-title">先把现状说清楚再画图。</h2>
          <p className="section-sub">
            旧版 console 是一张通用 SaaS 模板：蓝白渐变、空状态卡片、缺少 product story。
            以下是基于现有截图与产品定位的三条核心问题。
          </p>
        </div>
        <div className="eyebrow" style={{ paddingBottom: 6 }}>severity · usefulness · narrative</div>
      </div>

      <div className="audit-grid">
        <div className="audit-card">
          <span className="grade">VISUAL · SEVERITY HIGH</span>
          <h3 style={{ fontSize: 18 }}>看上去像 SaaS 模板，<br />不像 control plane。</h3>
          <ul className="findings">
            <li>蓝白主色 + 紫色头像，与 "agent runtime" 主题没有视觉关系。</li>
            <li>所有卡片同一层级、同一密度，没有视觉重点。</li>
            <li>空状态占满首屏，让产品看起来没在运转。</li>
            <li>中英文混排没有节奏：标题英文、标签中文、按钮中文、列表中文。</li>
          </ul>
        </div>

        <div className="audit-card">
          <span className="grade">IA · SEVERITY HIGH</span>
          <h3 style={{ fontSize: 18 }}>侧边导航在<br />列扁平菜单，<br />没有讲流程。</h3>
          <ul className="findings">
            <li>"任务" / "智能体" / "全部智能体" 三个相似入口，用户分不清差异。</li>
            <li>没有 Runtime / Budget / Adapter 这条控制面线索。</li>
            <li>"指挥台" 当前只展示空状态，没有体现"实时"控制的产品定位。</li>
            <li>缺少环境切换 (Production / Staging)，对一个 control plane 是硬伤。</li>
          </ul>
        </div>

        <div className="audit-card">
          <span className="grade">NARRATIVE · SEVERITY HIGH</span>
          <h3 style={{ fontSize: 18 }}>产品没说清楚<br />自己解决什么问题。</h3>
          <ul className="findings">
            <li>Hero 只写了 "1 command center"，没说 who / why / how。</li>
            <li>缺少 "budget guard" / "execution trace" 这种 ownable 名词。</li>
            <li>没有 workflow 视觉化，看不到 multi-agent 协作的形态。</li>
            <li>对 PM 视角：看不出做了 cost / risk / approval 三件控制面的事。</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
);

/* ============================================================
   Information Architecture
   ============================================================ */
const IA = () => (
  <section className="section" id="ia">
    <div className="shell">
      <div className="section-header">
        <div className="title-block">
          <div className="eyebrow eyebrow-dot">02 · Information Architecture</div>
          <h2 className="section-title">三条主线：Operate · Runtime · Governance.</h2>
          <p className="section-sub">
            重新组织导航，让侧边栏直接讲产品故事 —— 上面是用来 "做事" 的，中间是 "看运行"，
            底部是 "管规则与留痕"。每条线下面只暴露用户真正会用的入口。
          </p>
        </div>
      </div>

      <div className="ia">
        <div className="ia-tree">
          <span className="l1">Operate · 操作</span>
          <span className="l2"><span className="copper">总览指挥台</span> <span style={{ color: "var(--sand-400)" }}>Console</span></span>
          <span className="l2">Workflows</span>
          <span className="l3">Designer · Runs · Templates</span>
          <span className="l2">Agents</span>
          <span className="l3">Roster · Roles · Quarantine</span>
          <span className="l2">任务队列 Queue</span>

          <span className="l1">Runtime · 运行</span>
          <span className="l2">Execution Traces</span>
          <span className="l2">Adapter Health</span>
          <span className="l2"><span className="copper">Budget Guard</span></span>
          <span className="l3">Caps · Forecast · Alerts</span>

          <span className="l1">Governance · 治理</span>
          <span className="l2">Policies</span>
          <span className="l3">Approval Gates · Guardrails</span>
          <span className="l2">Audit Log</span>
          <span className="l2">Settings</span>
        </div>

        <div className="ia-grid">
          <div className="ia-card">
            <div className="key">SECTION · OPERATE</div>
            <h4><Ic name="dashboard" size={16} style={{ color: "var(--copper-300)" }} /> 做事</h4>
            <p>派活、设计 workflow、管理 agent 班底、清理 attention queue。每天高频使用，密度可以高。</p>
          </div>
          <div className="ia-card">
            <div className="key">SECTION · RUNTIME</div>
            <h4><Ic name="runtime" size={16} style={{ color: "var(--copper-300)" }} /> 看运行</h4>
            <p>实时 trace、adapter 延迟、token / 成本、预算守门。出问题第一站。</p>
          </div>
          <div className="ia-card">
            <div className="key">SECTION · GOVERNANCE</div>
            <h4><Ic name="shield" size={16} style={{ color: "var(--copper-300)" }} /> 管规则</h4>
            <p>policy & approval、审计 log、settings。低频但严肃，独立颜色与节奏。</p>
          </div>

          <div className="ia-card" style={{ gridColumn: "span 3" }}>
            <div className="key">NORTH-STAR PAGE</div>
            <h4 style={{ marginBottom: 8 }}>指挥台 Console — 一屏看完整运行态</h4>
            <p style={{ fontSize: 13.5 }}>
              KPI 条 · 当前在跑的 workflow · 实时 execution trace · 任务队列 · Budget Guard · Adapter 健康。
              这一页要承担 95% 的日常运维场景，必须以它为信息架构的中心。
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
);

/* ============================================================
   Design Direction / Tokens
   ============================================================ */
const Tokens = () => {
  const ink = [
    ["--ink-950","#0B1815"],["--ink-900","#0F1F1B"],["--ink-850","#142621"],["--ink-800","#1A2E28"],["--ink-700","#213831"]
  ];
  const sand = [
    ["--sand-50","#F2EDDF"],["--sand-100","#E7E1D1"],["--sand-200","#CFC8B6"],["--sand-300","#A9A493"],["--sand-400","#807C6E"]
  ];
  const accent = [
    ["--copper-200","#E0A982"],["--copper-300","#C97847"],["--mint-200","#8FE9C2"],["--mint-300","#5DD2A3"],["--warn / crit","#D4B05F"]
  ];
  return (
    <section className="section" id="direction">
      <div className="shell">
        <div className="section-header">
          <div className="title-block">
            <div className="eyebrow eyebrow-dot">03 · Visual Direction</div>
            <h2 className="section-title">Ink green, sand, copper. <br />控制面的颜色应该像油墨。</h2>
            <p className="section-sub">
              深墨绿是 "运行态" 的底，沙色是信息层，铜是少量重点（CTA / 关键指标 / 当前节点），
              受控薄荷色仅用于实时信号。蓝白只在 informational 提示里出现。
            </p>
          </div>
          <span className="eyebrow" style={{ paddingBottom: 6 }}>Tokens · Type · Motion</span>
        </div>

        <div className="tok-grid">
          {/* swatches */}
          <div className="card">
            <div className="eyebrow" style={{ marginBottom: 12 }}>Surface · Ink Green</div>
            <div className="swatch-stack">
              {ink.map(([n, h]) => (
                <div key={n} className="sw" style={{ background: h }}>
                  <span className="name">{n.replace("--", "")}</span>
                  <span className="hex">{h}</span>
                </div>
              ))}
            </div>
            <div className="eyebrow" style={{ marginTop: 20, marginBottom: 12 }}>Foreground · Sand & Slate</div>
            <div className="swatch-stack">
              {sand.map(([n, h]) => (
                <div key={n} className="sw" style={{ background: h, color: "#1A2E28" }}>
                  <span className="name" style={{ color: "#1A2E28" }}>{n.replace("--", "")}</span>
                  <span className="hex" style={{ color: "rgba(26,46,40,0.65)" }}>{h}</span>
                </div>
              ))}
            </div>
            <div className="eyebrow" style={{ marginTop: 20, marginBottom: 12 }}>Accent · Copper & Mint</div>
            <div className="swatch-stack">
              {accent.map(([n, h]) => (
                <div key={n} className="sw" style={{ background: h, color: "#1A0F08" }}>
                  <span className="name" style={{ color: "#1A0F08" }}>{n.replace("--", "")}</span>
                  <span className="hex" style={{ color: "rgba(26,15,8,0.65)" }}>{h}</span>
                </div>
              ))}
            </div>
            <div className="eyebrow" style={{ marginTop: 18 }}>USAGE RULE</div>
            <p style={{ fontSize: 12.5, color: "var(--sand-300)", marginTop: 6, lineHeight: 1.6 }}>
              Copper = call-to-action / active row / "钱". Mint = real-time signal only.
              Warn / Crit only in runtime context — never decorative.
            </p>
          </div>

          {/* typography */}
          <div className="card">
            <div className="eyebrow" style={{ marginBottom: 16 }}>Type System</div>
            <div className="type-spec">
              <div className="row">
                <span className="font-display" style={{ fontSize: 36, lineHeight: 1, letterSpacing: "-0.03em" }}>Schibsted Grotesk</span>
                <span className="meta">Display · 32–84px · 500</span>
              </div>
              <div className="row">
                <span className="font-cjk" style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.01em" }}>风之灵枢 · 指挥台</span>
                <span className="meta">Noto Sans SC · 22–84px · 600/700</span>
              </div>
              <div className="row">
                <span style={{ fontSize: 15 }}>Body text, mixed 中文 with English terms like <strong>Workflow</strong>.</span>
                <span className="meta">Body · 15px · 400/500</span>
              </div>
              <div className="row">
                <span className="font-mono" style={{ fontSize: 12.5, color: "var(--copper-200)" }}>16:42:24 · CRIT · budget-guard</span>
                <span className="meta">JetBrains Mono · 11–13px</span>
              </div>
              <div className="row">
                <span className="eyebrow">EYEBROW · RUNTIME LABEL</span>
                <span className="meta">Mono UPPER · 11px · 0.18em</span>
              </div>
            </div>

            <hr className="divider" style={{ margin: "20px 0" }} />
            <div className="eyebrow" style={{ marginBottom: 12 }}>Density Scale (4pt grid)</div>
            <div className="scale-list">
              {[
                ["xs", "4", 4],["sm", "8", 8],["md", "12", 12],["lg", "16", 16],["xl", "20", 20],["2xl", "24", 24],["4xl", "32", 32],["8xl", "64", 64]
              ].map(([n, v, w]) => (
                <div className="scale-row" key={n}>
                  <span>{n}</span>
                  <span className="bar" style={{ width: `${w * 2.2}px` }} />
                  <span>{v}px</span>
                </div>
              ))}
            </div>
          </div>

          {/* motion + principles */}
          <div className="card">
            <div className="eyebrow" style={{ marginBottom: 16 }}>Motion · Light · Density</div>
            <div className="type-spec">
              <div className="row">
                <div>
                  <div style={{ color: "var(--sand-50)", fontWeight: 500 }}>Wind, not glow</div>
                  <div style={{ fontSize: 12.5, color: "var(--sand-300)", marginTop: 4 }}>
                    Lateral streaks &amp; dashes for live state. No bloom, no neon halos.
                  </div>
                </div>
                <span className="meta">120–380ms · ease-out</span>
              </div>
              <div className="row">
                <div>
                  <div style={{ color: "var(--sand-50)", fontWeight: 500 }}>Pulse only for "now"</div>
                  <div style={{ fontSize: 12.5, color: "var(--sand-300)", marginTop: 4 }}>
                    The running node breathes (1.6s). Idle / queued never animates.
                  </div>
                </div>
                <span className="meta">opacity + scale</span>
              </div>
              <div className="row">
                <div>
                  <div style={{ color: "var(--sand-50)", fontWeight: 500 }}>Borders over shadows</div>
                  <div style={{ fontSize: 12.5, color: "var(--sand-300)", marginTop: 4 }}>
                    1px hairlines at 6–16% white separate surfaces. Drop shadows only at modal level.
                  </div>
                </div>
                <span className="meta">no glassmorphism</span>
              </div>
              <div className="row">
                <div>
                  <div style={{ color: "var(--sand-50)", fontWeight: 500 }}>Mono for runtime, not chrome</div>
                  <div style={{ fontSize: 12.5, color: "var(--sand-300)", marginTop: 4 }}>
                    Timestamps, IDs, latencies. Nav and headers stay in sans.
                  </div>
                </div>
                <span className="meta">JetBrains Mono</span>
              </div>
            </div>

            <hr className="divider" style={{ margin: "20px 0" }} />
            <div className="eyebrow" style={{ marginBottom: 12 }}>Radii · Elevation</div>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
              {[
                ["xs", 4],["sm", 6],["md", 10],["lg", 14],["xl", 20]
              ].map(([n, r]) => (
                <div key={n} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 44, height: 44, background: "var(--ink-800)", border: "1px solid var(--line)", borderRadius: r }} />
                  <span className="meta" style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--sand-400)" }}>{n} · {r}px</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

window.Hero = Hero;
window.Audit = Audit;
window.IA = IA;
window.Tokens = Tokens;
