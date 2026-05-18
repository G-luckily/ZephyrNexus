import React from 'react'
import { Ic } from './Icons'

const { useState, useMemo, useEffect } = React;

export const Spark = ({ data, color = "var(--mint-300)", w = 120, h = 26 }) => {
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / Math.max(0.001, max - min)) * (h - 4) - 2;
    return [x, y];
  });
  const path = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
  const area = `${path} L${w},${h} L0,${h} Z`;
  const gradId = `sg-${color.replace(/[^a-z0-9]/gi, '_')}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={path} stroke={color} strokeWidth="1.5" fill="none" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2" fill={color} />
    </svg>
  );
};

export const KPIs = () => (
  <div className="kpi-row">
    <div className="kpi">
      <div className="lbl">
        <span>ACTIVE AGENTS</span>
        <span className="delta">↑ 12%</span>
      </div>
      <div className="val">42<small>/ 60</small></div>
      <div className="sub">28 running · 14 idle · 0 quarantined</div>
      <div className="spark">
        <Spark data={[20, 22, 25, 24, 28, 30, 28, 32, 38, 40, 42]} color="#5DD2A3" />
      </div>
    </div>

    <div className="kpi">
      <div className="lbl">
        <span>WORKFLOW SUCCESS</span>
        <span className="delta">↑ 1.4pt</span>
      </div>
      <div className="val">97.8<small>%</small></div>
      <div className="sub">last 24h · p95 lat 3.2s</div>
      <div className="spark">
        <Spark data={[94, 95, 95, 96, 95, 96, 97, 96, 97, 97, 98]} color="#8FE9C2" />
      </div>
    </div>

    <div className="kpi accent">
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

    <div className="kpi">
      <div className="lbl">
        <span>ATTENTION QUEUE</span>
        <span className="delta flat">→ 0</span>
      </div>
      <div className="val">7</div>
      <div className="sub">3 approvals · 2 blocked · 2 budget guard</div>
      <div className="spark">
        <Spark data={[5, 4, 6, 8, 9, 7, 6, 7, 8, 7, 7]} color="#D4B05F" />
      </div>
    </div>
  </div>
);

export const Workflow = () => {
  const nodes = [
    { id: "intake", x: 4,  y: 50, title: "Intake", role: "Trigger · Webhook", state: "done" },
    { id: "route",  x: 22, y: 50, title: "Router", role: "Decision · Heuristic", state: "done" },
    { id: "screen", x: 40, y: 22, title: "Resume Screen", role: "Agent · Claude-Sonnet", state: "done" },
    { id: "score",  x: 40, y: 78, title: "Skill Score", role: "Agent · Codex", state: "done" },
    { id: "merge",  x: 58, y: 50, title: "Merge & Rank", role: "Reducer", state: "running" },
    { id: "review", x: 76, y: 30, title: "Human Review", role: "Approval Gate", state: "queued" },
    { id: "notify", x: 76, y: 70, title: "Notify HR", role: "Adapter · Slack", state: "queued" },
    { id: "out",    x: 93, y: 50, title: "Export", role: "Sink · Postgres", state: "queued" },
  ];
  const edges = [
    ["intake","route"], ["route","screen"], ["route","score"],
    ["screen","merge"], ["score","merge"],
    ["merge","review"], ["merge","notify"],
    ["review","out"], ["notify","out"],
  ];
  const pct = (n) => `${n}%`;

  return (
    <div className="workflow">
      <svg className="wf-svg" preserveAspectRatio="none" viewBox="0 0 100 100">
        <defs>
          <marker id="arr" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" fill="rgba(242,237,223,0.35)" />
          </marker>
          <marker id="arr-live" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" fill="#5DD2A3" />
          </marker>
        </defs>
        {edges.map(([a, b]) => {
          const A = nodes.find(n => n.id === a), B = nodes.find(n => n.id === b);
          const live = A.state !== "queued" && B.state !== "queued";
          const mx = (A.x + B.x) / 2;
          const d = `M ${A.x + 6},${A.y} C ${mx},${A.y} ${mx},${B.y} ${B.x - 6},${B.y}`;
          return (
            <path
              key={a + b}
              d={d}
              stroke={live ? "#5DD2A3" : "rgba(242,237,223,0.18)"}
              strokeWidth={live ? 0.4 : 0.3}
              fill="none"
              markerEnd={live ? "url(#arr-live)" : "url(#arr)"}
              strokeDasharray={B.state === "running" ? "1.2 1.2" : "none"}
            >
              {B.state === "running" && (
                <animate attributeName="stroke-dashoffset" from="0" to="-8" dur="1.4s" repeatCount="indefinite" />
              )}
            </path>
          );
        })}
      </svg>
      {nodes.map(n => (
        <div
          key={n.id}
          className={`node ${n.state}`}
          style={{ left: pct(n.x), top: pct(n.y), transform: "translate(-50%, -50%)" }}
        >
          <div className="pill">
            <span className="tit">{n.title}</span>
            <span className="role">{n.role}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export const RuntimeLog = () => {
  const baseRows = [
    { ts: "16:42:08", lvl: "info", a: "router-01", msg: "Routed inbound to screen+score (heuristic confidence 0.91).", tok: "—" },
    { ts: "16:42:09", lvl: "info", a: "screen.claude-s", msg: "Loaded resume_batch_204 (12 docs, 38.1k tokens).", tok: "38,124" },
    { ts: "16:42:14", lvl: "info", a: "score.codex", msg: "Skill matrix computed for 12 candidates.", tok: "11,802" },
    { ts: "16:42:17", lvl: "warn", a: "screen.claude-s", msg: "Adapter latency p95 → 4.8s (threshold 4.0s).", tok: "—" },
    { ts: "16:42:21", lvl: "info", a: "merge.reducer", msg: "Reduce-rank produced shortlist of 4 → review_gate.", tok: "—" },
    { ts: "16:42:24", lvl: "crit", a: "budget-guard", msg: "Workflow hr_screening_v3 forecast to exceed monthly cap by 8%.", tok: "—", high: true },
    { ts: "16:42:26", lvl: "info", a: "review_gate", msg: "Approval requested → 1 reviewer notified via Slack.", tok: "—" },
    { ts: "16:42:31", lvl: "info", a: "trace-store", msg: "Persisted execution trace 7b3c…e419 (2.1 MB).", tok: "—" },
  ];
  return (
    <div className="runtime-log">
      {baseRows.map((r, i) => (
        <div className={`row ${r.high ? "high" : ""}`} key={i}>
          <span className="ts">{r.ts}</span>
          <span className={`lvl ${r.lvl}`}>{r.lvl.toUpperCase()}</span>
          <span className="msg">
            <span className="agent">{r.a}</span>{" · "}
            {r.msg}
            {r.tok !== "—" && <span className="tok"> · tokens={r.tok}</span>}
          </span>
        </div>
      ))}
    </div>
  );
};

export const BudgetGuard = () => {
  const rows = [
    { name: "Monthly company cap", used: 1284.4, cap: 4800, threshold: 70, level: "ok" },
    { name: "HR Screening · Workflow", used: 612.8, cap: 800, threshold: 75, level: "warn" },
    { name: "Customer Triage · Workflow", used: 188.0, cap: 600, threshold: 80, level: "ok" },
    { name: "Codex-mini · Adapter", used: 296.2, cap: 320, threshold: 85, level: "crit" },
  ];
  return (
    <div className="budget-list">
      {rows.map((r, i) => {
        const pct = Math.min(100, (r.used / r.cap) * 100);
        return (
          <div className="budget-row" key={i}>
            <div className="top">
              <span className="name">{r.name}</span>
              <span className="num-line">
                <strong>${r.used.toFixed(2)}</strong> / ${r.cap.toFixed(2)} · {pct.toFixed(1)}%
              </span>
            </div>
            <div className={`budget-bar ${r.level === "warn" ? "warn" : r.level === "crit" ? "crit" : ""}`}>
              <div className="fill" style={{ width: `${pct}%` }} />
              <div className="threshold" style={{ left: `${r.threshold}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const Adapters = () => {
  const rows = [
    { logo: "CL", name: "Claude Sonnet 4.5", sub: "ANTHROPIC · streaming", lat: 412, status: "ok", q: 18 },
    { logo: "CX", name: "Codex-large", sub: "OPENAI · batch", lat: 880, status: "ok", q: 7 },
    { logo: "CS", name: "Cursor Composer", sub: "CURSOR · ws", lat: 234, status: "ok", q: 3 },
    { logo: "OC", name: "OpenClaw Gateway", sub: "INTERNAL · :18789", lat: 1820, status: "warn", q: 12 },
    { logo: "GM", name: "Gemini 2 Flash", sub: "GOOGLE · streaming", lat: 0, status: "crit", q: 0 },
  ];
  return (
    <div>
      {rows.map((r, i) => (
        <div className="adapter-row" key={i}>
          <div className="logo">{r.logo}</div>
          <div>
            <div className="nm">{r.name}</div>
            <div className="sub">{r.sub}</div>
          </div>
          <div className="lat">{r.lat ? `${r.lat}ms` : "—"} <small>p95</small></div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--sand-400)" }}>q={r.q}</div>
          <span className={`tag ${r.status === "warn" ? "warn" : r.status === "crit" ? "crit" : "ok"}`}>
            <span className="dot" />
            {r.status === "ok" ? "healthy" : r.status === "warn" ? "degraded" : "down"}
          </span>
        </div>
      ))}
    </div>
  );
};

export const TaskQueue = () => {
  const rows = [
    { pri: "P0", ttl: "Approve shortlist · req_4f8c", meta: "hr_screening_v3 · gate", agent: "review_gate", dur: "—", state: "needs approval" },
    { pri: "P1", ttl: "Budget overrun forecast · Codex-mini", meta: "budget-guard · forecast", agent: "budget-guard", dur: "ETA 2h", state: "blocked" },
    { pri: "P1", ttl: "Re-ingest CRM delta sync", meta: "customer_triage_v2 · adapter", agent: "salesforce", dur: "running 4m", state: "running" },
    { pri: "P2", ttl: "Refresh embedding index for FAQ", meta: "support_kb · sched", agent: "embeddings.svc", dur: "queued", state: "queued" },
    { pri: "P3", ttl: "Weekly compliance audit report", meta: "audit · cron", agent: "audit.reporter", dur: "in 6h", state: "scheduled" },
  ];
  return (
    <div className="task-list">
      {rows.map((r, i) => (
        <div className="task-row" key={i}>
          <div className={`pri ${r.pri.toLowerCase()}`}>{r.pri}</div>
          <div className="title-line">
            <div className="ttl">{r.ttl}</div>
            <div className="meta">{r.meta}</div>
          </div>
          <div className="agent-tag">@{r.agent}</div>
          <div className="dur">{r.dur}</div>
          <span className={`tag ${r.state === "blocked" || r.state === "needs approval" ? "warn" : r.state === "running" ? "ok" : ""}`}>
            <span className="dot" />
            {r.state}
          </span>
          <div className="more"><Ic name="more" size={14} /></div>
        </div>
      ))}
    </div>
  );
};

const Sidebar = () => (
  <aside className="console-side">
    <div className="side-org">
      <div className="avatar">TF</div>
      <div className="meta">
        <div className="name">TalentForce AI</div>
        <div className="env">● PRODUCTION</div>
      </div>
      <Ic name="chevD" size={14} style={{ marginLeft: "auto", color: "var(--sand-400)" }} />
    </div>

    <div className="side-section">
      <div className="title">操作 · Operate</div>
      <div className="side-link active">
        <Ic name="dashboard" /> 总览指挥台 <span className="count">⌘1</span>
      </div>
      <div className="side-link">
        <Ic name="workflow" /> Workflows <span className="count">12</span>
      </div>
      <div className="side-link">
        <Ic name="agents" /> Agents <span className="count ok">42</span>
      </div>
      <div className="side-link">
        <Ic name="inbox" /> 任务队列 <span className="count warn">7</span>
      </div>
    </div>

    <div className="side-section">
      <div className="title">运行 · Runtime</div>
      <div className="side-link"><Ic name="runtime" /> Execution Traces</div>
      <div className="side-link"><Ic name="bolt" /> Adapter Health <span className="count warn">1</span></div>
      <div className="side-link"><Ic name="budget" /> Budget Guard</div>
    </div>

    <div className="side-section">
      <div className="title">治理 · Governance</div>
      <div className="side-link"><Ic name="shield" /> Policies</div>
      <div className="side-link"><Ic name="audit" /> Audit Log</div>
      <div className="side-link"><Ic name="settings" /> Settings</div>
    </div>
  </aside>
);

export const Console = () => {
  return (
    <div className="console-frame">
      <div className="console-top">
        <div className="dots"><span /><span /><span /></div>
        <div className="url">app.zephyrnexus.io / talentforce / console</div>
        <div style={{ display: "flex", gap: 8 }}>
          <span className="tag ok"><span className="dot" /> live</span>
          <span className="tag"><span className="dot" /> 5s polling</span>
        </div>
      </div>

      <div className="console-body">
        <Sidebar />

        <main className="console-main">
          <div className="console-head">
            <div>
              <div className="crumbs">TalentForce <span>›</span> Console <span>›</span> 总览</div>
              <h2>
                <span className="cjk">指挥台</span>
                <span style={{ fontFamily: "var(--font-display)", color: "var(--sand-300)", fontSize: 18, fontWeight: 400 }}>
                  Command Center
                </span>
              </h2>
            </div>
            <div className="right">
              <div className="seg">
                <button className="on">24h</button>
                <button>7d</button>
                <button>30d</button>
              </div>
              <button className="btn ghost"><Ic name="filter" /> Filter</button>
              <button className="btn copper"><Ic name="plus" /> 新建 Workflow</button>
            </div>
          </div>

          <KPIs />

          <div className="console-cols">
            <div className="panel">
              <div className="panel-head">
                <h3><Ic name="workflow" size={14} /> hr_screening_v3 · live execution</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <span className="tag ok"><span className="dot" /> 4 / 8 nodes done</span>
                  <span className="meta">trace 7b3c…e419</span>
                </div>
              </div>
              <Workflow />
              <div style={{ display: "flex", gap: 16, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--sand-300)" }}>
                <span>started 16:42:08</span>
                <span>elapsed 23s</span>
                <span>cost so far <span style={{ color: "var(--copper-200)" }}>$0.41</span></span>
                <span style={{ marginLeft: "auto" }}>
                  <span className="kbd">space</span> pause &nbsp;
                  <span className="kbd">i</span> inspect
                </span>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <h3><Ic name="runtime" size={14} /> Runtime · Execution Trace</h3>
                <span className="meta">↓ streaming</span>
              </div>
              <RuntimeLog />
            </div>
          </div>

          <div className="console-cols">
            <div className="panel">
              <div className="panel-head">
                <h3><Ic name="inbox" size={14} /> 任务队列 · Attention Queue</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <span className="tag warn"><span className="dot" /> 7 need attention</span>
                  <button className="btn ghost" style={{ padding: "4px 8px", fontSize: 12 }}>open all</button>
                </div>
              </div>
              <TaskQueue />
            </div>

            <div className="panel">
              <div className="panel-head">
                <h3><Ic name="budget" size={14} /> Budget Guard</h3>
                <span className="meta">forecast 26.8%</span>
              </div>
              <BudgetGuard />
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3><Ic name="bolt" size={14} /> Adapter Health</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <span className="tag warn"><span className="dot" /> 1 degraded</span>
                <span className="tag crit"><span className="dot" /> 1 down</span>
              </div>
            </div>
            <Adapters />
          </div>
        </main>
      </div>
    </div>
  );
};
