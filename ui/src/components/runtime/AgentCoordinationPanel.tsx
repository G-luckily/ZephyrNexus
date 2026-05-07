import { useMemo, useState } from "react";
import { cn } from "../../lib/utils";
import {
  AGENT_COORDINATION_CONFIGS,
  type AgentInstance,
} from "../../lib/runtime";
import { useRuntime } from "../../context/RuntimeContext";
import { Check, X, Loader, AlertTriangle, ArrowRight } from "lucide-react";

type InspectorTab = "detail" | "summary";

export function AgentCoordinationPanel({ className }: { className?: string }) {
  const { agents, relations } = useRuntime();
  const [activeTab, setActiveTab] = useState<InspectorTab>("detail");
  const [selectedAgent, setSelectedAgent] = useState<AgentInstance | null>(null);

  const isActive = (agent: AgentInstance) =>
    agent.coordinationState === "speaking" ||
    agent.coordinationState === "coordinating" ||
    agent.coordinationState === "thinking";

  // Counts
  const activeAgents = useMemo(
    () => agents.filter(isActive),
    [agents]
  );
  const idleAgents = useMemo(
    () => agents.filter((a) => a.coordinationState === "idle"),
    [agents]
  );
  const errorAgents = useMemo(
    () => agents.filter((a) => a.coordinationState === "error"),
    [agents]
  );
  const listeningAgents = useMemo(
    () => agents.filter((a) => a.coordinationState === "listening"),
    [agents]
  );

  // Active path
  const activePath = useMemo(() => {
    const activeIds = new Set(activeAgents.map((a) => a.id));
    const path = relations.filter(
      (r) => r.isActive || (activeIds.has(r.from) && activeIds.has(r.to))
    );
    return path;
  }, [activeAgents, relations]);

  // Current latest event time
  const latestActivity = useMemo(() => {
    if (agents.length === 0) return null;
    const sorted = [...agents].sort(
      (a, b) => b.lastActive.getTime() - a.lastActive.getTime()
    );
    return sorted[0];
  }, [agents]);

  // Selected agent downstream
  const downstreamAgents = useMemo(() => {
    if (!selectedAgent) return [];
    return relations
      .filter((r) => r.from === selectedAgent.id)
      .map((r) => agents.find((a) => a.id === r.to))
      .filter(Boolean) as AgentInstance[];
  }, [selectedAgent, relations, agents]);

  return (
    <div className={cn("panel-floating relative flex flex-col overflow-hidden", className)}>
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 30%, rgba(139, 92, 246, 0.08) 0%, transparent 70%)",
        }}
      />

      {/* Header */}
      <div className="relative flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-400/10">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 text-violet-400">
              <circle cx="12" cy="12" r="3" />
              <circle cx="19" cy="12" r="2" />
              <circle cx="5" cy="12" r="2" />
              <path d="M12 9V6M12 15v3M9 12H6M15 12h3" />
            </svg>
          </div>
          <span className="text-sm font-medium">Agent 检查器</span>
          {activeAgents.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-medium text-emerald-400">
              <span className="h-1 w-1 rounded-full bg-emerald-400" style={{ animation: "status-breathe 2s ease-in-out infinite" }} />
              {activeAgents.length} 活跃
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/80">
          <span>{agents.length} 智能体</span>
        </div>
      </div>

      {/* Tab Bar — NO graph tab */}
      <div className="relative flex shrink-0 border-b border-white/[0.06]">
        <button
          type="button"
          onClick={() => setActiveTab("detail")}
          className={cn(
            "flex-1 px-3 py-2 text-[11px] font-semibold transition-colors duration-150",
            activeTab === "detail"
              ? "text-foreground border-b-2 border-violet-400"
              : "text-muted-foreground/60 hover:text-muted-foreground"
          )}
        >
          Agent Detail
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("summary")}
          className={cn(
            "flex-1 px-3 py-2 text-[11px] font-semibold transition-colors duration-150",
            activeTab === "summary"
              ? "text-foreground border-b-2 border-violet-400"
              : "text-muted-foreground/60 hover:text-muted-foreground"
          )}
        >
          Collaboration Summary
        </button>
      </div>

      {/* Tab Content — NO graph, NO SVG, NO AgentNode */}
      <div className="inspector-tab-enter relative flex-1 overflow-hidden">
        {activeTab === "detail" && (
          <AgentDetailTab
            agents={agents}
            activeAgents={activeAgents}
            idleAgents={idleAgents}
            errorAgents={errorAgents}
            listeningAgents={listeningAgents}
            selectedAgent={selectedAgent}
            onSelectAgent={setSelectedAgent}
            downstreamAgents={downstreamAgents}
          />
        )}
        {activeTab === "summary" && (
          <CollaborationSummaryTab
            agents={agents}
            activeAgents={activeAgents}
            activePath={activePath}
            errorAgents={errorAgents}
            listeningAgents={listeningAgents}
            latestActivity={latestActivity}
            relations={relations}
          />
        )}
      </div>
    </div>
  );
}

/* ── Agent Detail Tab ── */
function AgentDetailTab({
  agents,
  activeAgents,
  idleAgents,
  errorAgents,
  listeningAgents,
  selectedAgent,
  onSelectAgent,
  downstreamAgents,
}: {
  agents: AgentInstance[];
  activeAgents: AgentInstance[];
  idleAgents: AgentInstance[];
  errorAgents: AgentInstance[];
  listeningAgents: AgentInstance[];
  selectedAgent: AgentInstance | null;
  onSelectAgent: (agent: AgentInstance | null) => void;
  downstreamAgents: AgentInstance[];
}) {
  // Summary stats row
  const stats = [
    { label: "活跃", value: activeAgents.length, color: "text-zephyr-blue", bg: "bg-zephyr-blue-soft" },
    { label: "监听", value: listeningAgents.length, color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { label: "空闲", value: idleAgents.length, color: "text-muted-foreground", bg: "bg-muted/30" },
    { label: "异常", value: errorAgents.length, color: "text-rose-400", bg: "bg-rose-400/10" },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-1.5 px-3 pt-3 pb-2">
        {stats.map((s) => (
          <div key={s.label} className={cn("rounded-lg border border-white/[0.06] px-2 py-1.5 text-center", s.bg)}>
            <p className={cn("text-sm font-semibold tabular-nums", s.color)}>{s.value}</p>
            <p className="text-[9px] text-muted-foreground/70">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Agent list + selected detail */}
      <div className="flex flex-1 flex-col gap-1.5 overflow-hidden px-3 pb-3">
        {/* Active agent list */}
        <div className="shrink-0">
          {agents.length === 0 ? (
            <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-white/[0.06] text-[11px] text-muted-foreground/50">
              暂无智能体数据
            </div>
          ) : (
            <div className="scrollbar-auto-hide max-h-[180px] space-y-1 overflow-y-auto pr-1">
              {agents.map((agent) => {
                const config = AGENT_COORDINATION_CONFIGS[agent.coordinationState];
                const active = activeAgents.includes(agent);
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => onSelectAgent(selectedAgent?.id === agent.id ? null : agent)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all duration-150",
                      selectedAgent?.id === agent.id
                        ? "border-violet-400/30 bg-violet-400/10"
                        : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
                    )}
                  >
                    {/* State dot */}
                    <span
                      className={cn("h-2 w-2 shrink-0 rounded-full", config.bgColor)}
                      style={{
                        boxShadow: active ? `0 0 6px 0 ${config.glowColor}` : undefined,
                      }}
                    >
                      {active && (
                        <span
                          className="block h-full w-full rounded-full"
                          style={{
                            animation: "status-breathe 2s ease-in-out infinite",
                            backgroundColor: config.color.replace("text-", ""),
                          }}
                        />
                      )}
                    </span>
                    {/* Name + state */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold text-foreground">
                        {agent.name}
                      </p>
                      <p className={cn("text-[9px]", config.color)}>{config.label}</p>
                    </div>
                    {/* Task indicator */}
                    {agent.currentTask && (
                      <span className="shrink-0 truncate rounded-full bg-white/[0.04] px-1.5 py-0.5 text-[8px] text-muted-foreground/60 max-w-[80px]">
                        {agent.currentTask}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected agent detail panel */}
        {selectedAgent && (
          <div className="inspector-tab-enter shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{selectedAgent.name}</span>
                  <span className={cn(
                    "rounded-full px-1.5 py-0.5 text-[8px] font-semibold",
                    AGENT_COORDINATION_CONFIGS[selectedAgent.coordinationState].bgColor,
                    AGENT_COORDINATION_CONFIGS[selectedAgent.coordinationState].color
                  )}>
                    {AGENT_COORDINATION_CONFIGS[selectedAgent.coordinationState].label}
                  </span>
                </div>

                <div className="mt-2 space-y-1 text-[10px] text-muted-foreground">
                  <p>节点: <span className="font-medium text-foreground/80">{selectedAgent.layer}</span></p>
                  {selectedAgent.currentTask && (
                    <p>任务: <span className="font-medium text-foreground/80">{selectedAgent.currentTask}</span></p>
                  )}
                  <p>状态: <span className="font-medium text-foreground/80">{selectedAgent.runtimeState}</span></p>
                  <p>
                    活跃时长: <span className="font-medium text-foreground/80">
                      {Math.round((Date.now() - selectedAgent.lastActive.getTime()) / 1000)}s
                    </span>
                  </p>
                </div>

                {/* Downstream agents */}
                {downstreamAgents.length > 0 && (
                  <div className="mt-2 border-t border-white/[0.06] pt-2">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      下游节点 ({downstreamAgents.length})
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {downstreamAgents.map((down) => {
                        const downConfig = AGENT_COORDINATION_CONFIGS[down.coordinationState];
                        return (
                          <span
                            key={down.id}
                            className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium", downConfig.bgColor, downConfig.color)}
                          >
                            {down.name}
                            <ArrowRight className="h-2.5 w-2.5" />
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => onSelectAgent(null)}
                className="shrink-0 rounded-lg bg-white/10 px-2 py-0.5 text-[9px] hover:bg-white/20"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Collaboration Summary Tab ── */
function CollaborationSummaryTab({
  agents,
  activeAgents,
  activePath,
  errorAgents,
  listeningAgents,
  latestActivity,
  relations,
}: {
  agents: AgentInstance[];
  activeAgents: AgentInstance[];
  activePath: Array<{ id: string; from: string; to: string; isActive: boolean }>;
  errorAgents: AgentInstance[];
  listeningAgents: AgentInstance[];
  latestActivity: AgentInstance | null;
  relations: Array<{ from: string; to: string; isActive: boolean }>;
}) {
  // Determine waiting nodes (listening or idle agents that have connections to active agents)
  const waitingNodes = useMemo(() => {
    const activeIds = new Set(activeAgents.map((a) => a.id));
    const connectedToActive = new Set<string>();
    for (const rel of relations) {
      if (activeIds.has(rel.from)) connectedToActive.add(rel.to);
      if (activeIds.has(rel.to)) connectedToActive.add(rel.from);
    }
    return agents.filter(
      (a) =>
        connectedToActive.has(a.id) &&
        !activeIds.has(a.id) &&
        (a.coordinationState === "listening" || a.coordinationState === "idle")
    );
  }, [agents, activeAgents, relations]);

  return (
    <div className="flex h-full flex-col gap-2 px-3 pt-3 pb-3">
      {/* Big number: active agents */}
      <div className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <div className="text-center">
          <p className="text-3xl font-bold text-zephyr-blue tabular-nums">{activeAgents.length}</p>
          <p className="text-[9px] text-muted-foreground/70">活跃智能体</p>
        </div>
        <div className="h-10 w-px bg-white/[0.06]" />
        <div className="flex-1 space-y-1">
          {/* Active path summary */}
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" style={{ animation: "status-breathe 2s ease-in-out infinite" }} />
            <span className="text-muted-foreground">当前路径:</span>
            <span className="font-medium text-foreground/80">
              {activePath.length > 0
                ? `${activePath.length} 条活跃链路`
                : "无活跃路由"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            <span className="text-muted-foreground">等待节点:</span>
            <span className="font-medium text-foreground/80">{waitingNodes.length}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" style={{ animation: "status-breathe 2s ease-in-out infinite" }} />
            <span className="text-muted-foreground">异常:</span>
            <span className={cn("font-medium", errorAgents.length > 0 ? "text-rose-400" : "text-muted-foreground/60")}>
              {errorAgents.length > 0 ? `${errorAgents.length} 个` : "无"}
            </span>
          </div>
        </div>
      </div>

      {/* Active route path visualization — minimal text flow, NOT a graph */}
      {activeAgents.length > 1 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">
            活跃路由链
          </p>
          <div className="flex flex-wrap items-center gap-1">
            {activeAgents.map((agent, i) => {
              const config = AGENT_COORDINATION_CONFIGS[agent.coordinationState];
              return (
                <span key={agent.id} className="inline-flex items-center gap-1">
                  {i > 0 && <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/30" />}
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium", config.bgColor, config.color)}>
                    <span className={cn("h-1 w-1 rounded-full", config.color.replace("text-", "bg-"))} />
                    {agent.name}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Latest event / recent activity */}
      <div className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">
          最近事件
        </p>
        {latestActivity ? (
          <div className="space-y-1.5">
            {activeAgents.slice(0, 4).map((agent) => {
              const config = AGENT_COORDINATION_CONFIGS[agent.coordinationState];
              return (
                <div key={agent.id} className="flex items-center gap-2 text-[10px]">
                  <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", config.bgColor)} />
                  <span className="text-muted-foreground/80">{agent.name}</span>
                  <span className={cn("font-medium", config.color)}>{config.label}</span>
                  <span className="ml-auto text-muted-foreground/40">
                    {agent.currentTask ?? "—"}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground/50">暂无活动</p>
        )}
      </div>

      {/* Intervention alert */}
      {errorAgents.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/5 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-rose-400">
              {errorAgents.length} 个智能体需要人工介入
            </p>
            <p className="truncate text-[9px] text-muted-foreground/70">
              {errorAgents.map((a) => a.name).join("、")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Compact strip — unchanged
export function AgentCoordinationStrip({ className }: { className?: string }) {
  const { agents } = useRuntime();

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {agents.slice(0, 4).map((agent) => {
        const config = AGENT_COORDINATION_CONFIGS[agent.coordinationState];
        const isActive =
          agent.coordinationState === "speaking" ||
          agent.coordinationState === "coordinating";
        return (
          <div key={agent.id} className="flex items-center gap-1.5">
            <div
              className={cn("relative h-2.5 w-2.5 rounded-full", config.bgColor)}
              style={{
                boxShadow: config.glowColor ? `0 0 4px 0 ${config.glowColor}` : undefined,
              }}
            >
              {isActive && (
                <div
                  className="absolute inset-0 rounded-full border"
                  style={{
                    borderColor: config.color.replace("text-", ""),
                    animation: "node-active-ring 2s ease-in-out infinite",
                  }}
                />
              )}
            </div>
            <span className={cn("text-[10px] font-medium", config.color)}>
              {agent.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
