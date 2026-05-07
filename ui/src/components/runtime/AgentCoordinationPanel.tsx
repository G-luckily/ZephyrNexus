import { useCallback, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import {
  AGENT_COORDINATION_CONFIGS,
  type AgentInstance,
} from "../../lib/runtime";
import { useRuntime } from "../../context/RuntimeContext";
import { Check, X, Loader } from "lucide-react";

interface AgentNodeProps {
  agent: AgentInstance;
  isActive?: boolean;
  isSelected?: boolean;
  onSelect?: (agent: AgentInstance | null) => void;
  style?: React.CSSProperties;
}

function AgentNode({ agent, isActive, isSelected, onSelect, style }: AgentNodeProps) {
  const config = AGENT_COORDINATION_CONFIGS[agent.coordinationState];

  const layerAccents: Record<string, string> = {
    ORG: "from-amber-400/20 to-amber-400/5",
    "V1-PROJECT": "from-violet-400/20 to-violet-400/5",
    "V2-PIPELINE": "from-zephyr-blue/20 to-zephyr-blue/5",
    INFRA: "from-emerald-400/20 to-emerald-400/5",
  };

  return (
    <button
      type="button"
      onClick={() => onSelect?.(isSelected ? null : agent)}
      className={cn(
        "absolute flex flex-col rounded-lg border p-2 transition-all duration-200",
        "hover:scale-105 hover:z-20 hover:cursor-pointer",
        "bg-gradient-to-b backdrop-blur-sm",
        layerAccents[agent.layer],
        isActive && "runtime-node-active",
        isSelected && "ring-2 ring-violet-400/50 ring-offset-1 ring-offset-black/20"
      )}
      style={{
        width: 72,
        minHeight: 56,
        boxShadow: isActive
          ? `0 0 16px 1px ${config.glowColor}, 0 0 32px 0 ${config.glowColor}20`
          : `0 2px 8px 0 rgba(0,0,0,0.3)`,
        ...style,
      }}
    >
      {/* Active pulse indicator */}
      {isActive && (
        <div
          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full"
          style={{
            backgroundColor: config.color.replace("text-", ""),
            boxShadow: `0 0 6px 1px ${config.glowColor}`,
            animation: "status-breathe 2s ease-in-out infinite",
          }}
        />
      )}

      {/* Agent icon/avatar */}
      <div className="mb-1 flex items-center justify-center">
        <div className={cn("flex h-6 w-6 items-center justify-center rounded-md border", config.bgColor, config.borderColor)}>
          <span className={cn("text-[9px] font-bold", config.color)}>
            {agent.name.slice(0, 2)}
          </span>
        </div>
      </div>

      {/* Agent name */}
      <span className={cn("text-[9px] font-semibold leading-tight text-foreground/90")}>
        {agent.name.length > 6 ? agent.name.slice(0, 6) : agent.name}
      </span>

      {/* State indicator */}
      <div className="mt-0.5 flex items-center justify-center gap-0.5">
        <span className={cn("h-1 w-1 rounded-full", config.color.replace("text-", "bg-"))} />
        <span className={cn("text-[7px] font-medium", config.color)}>
          {config.label}
        </span>
      </div>
    </button>
  );
}

interface AgentCoordinationPanelProps {
  className?: string;
}

export function AgentCoordinationPanel({ className }: AgentCoordinationPanelProps) {
  const { agents, relations } = useRuntime();
  const [selectedAgent, setSelectedAgent] = useState<AgentInstance | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isActive = useCallback(
    (agent: AgentInstance) =>
      agent.coordinationState === "speaking" ||
      agent.coordinationState === "coordinating" ||
      agent.coordinationState === "thinking",
    []
  );

  // Fixed layer configuration - compact 4-row layout
  const layerConfig = {
    ORG: { y: 8, label: "决策层" },
    "V1-PROJECT": { y: 78, label: "研究层" },
    "V2-PIPELINE": { y: 148, label: "执行层" },
    INFRA: { y: 218, label: "基础设施" },
  };

  // Calculate node positions based on layer - center nodes in canvas
  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    const canvasWidth = 340;
    const perLayer: Record<string, number> = {};

    agents.forEach((agent) => {
      const layer = agent.layer;
      const idx = perLayer[layer] ?? 0;
      perLayer[layer] = idx + 1;
      const layerAgents = agents.filter((a) => a.layer === layer).length;
      // Spread nodes evenly within the layer
      const spacing = Math.min(100, (canvasWidth - 80) / Math.max(layerAgents, 1));
      const totalWidth = spacing * (layerAgents - 1);
      const startX = (canvasWidth - totalWidth) / 2 - 40;
      positions[agent.id] = { x: startX + idx * spacing, y: layerConfig[layer].y };
    });

    return positions;
  }, [agents]);

  // Build relation lines with proper positioning
  const relationLines = useMemo(() => {
    return relations.map((relation) => {
      const fromPos = nodePositions[relation.from];
      const toPos = nodePositions[relation.to];
      if (!fromPos || !toPos) return null;

      const fromAgent = agents.find((a) => a.id === relation.from);
      const toAgent = agents.find((a) => a.id === relation.to);
      if (!fromAgent || !toAgent) return null;

      return {
        relation,
        fromAgent,
        toAgent,
        fromPos,
        toPos,
        isActive: relation.isActive,
      };
    }).filter(Boolean);
  }, [relations, nodePositions, agents]);

  const selectedConfig = selectedAgent
    ? AGENT_COORDINATION_CONFIGS[selectedAgent.coordinationState]
    : null;

  // Determine active collaboration path
  const activePath = useMemo(() => {
    const activeIds = new Set(
      agents.filter(isActive).map((a) => a.id)
    );
    return relationLines
      .filter((line) => line && activeIds.has(line.fromAgent.id) && activeIds.has(line.toAgent.id))
      .map((line) => line!.relation.id);
  }, [relationLines, isActive, agents]);

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
          <span className="text-sm font-medium">协同网络</span>
          {activePath.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-medium text-emerald-400">
              <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
              {activePath.length} 条活跃链路
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/80">
          <span>{agents.length} 个智能体</span>
        </div>
      </div>

      {/* Collaboration Graph Canvas */}
      <div ref={containerRef} className="relative flex-1 overflow-hidden" style={{ minHeight: 280 }}>
        {/* Layer row labels */}
        <div className="pointer-events-none absolute inset-0">
          {(Object.entries(layerConfig) as [string, { y: number; label: string }][]).map(([layer, config]) => (
            <div
              key={layer}
              className="absolute left-1 top-0 flex items-center"
              style={{ top: config.y + 8 }}
            >
              <span className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground/40">
                {config.label}
              </span>
            </div>
          ))}
        </div>

        {/* SVG Connection lines */}
        <svg className="absolute inset-0 h-full w-full pointer-events-none" style={{ marginLeft: 35 }}>
          <defs>
            {relationLines.map((line) =>
              line && (
                <linearGradient
                  key={`grad-${line.relation.id}`}
                  id={`relation-grad-${line.relation.id}`}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop
                    offset="0%"
                    stopColor={
                      AGENT_COORDINATION_CONFIGS[line.fromAgent.coordinationState]
                        .color.replace("text-", "") || "#64748b"
                    }
                    stopOpacity={line.isActive ? 0.9 : 0.15}
                  />
                  <stop
                    offset="100%"
                    stopColor={
                      AGENT_COORDINATION_CONFIGS[line.toAgent.coordinationState]
                        .color.replace("text-", "") || "#64748b"
                    }
                    stopOpacity={line.isActive ? 0.9 : 0.15}
                  />
                </linearGradient>
              )
            )}
            <filter id="agent-line-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {relationLines.map((line) =>
            line && (
              <g key={line.relation.id}>
                {/* Connection bezier curve */}
                <path
                  d={`M ${line.fromPos.x + 36} ${line.fromPos.y + 28}
                      C ${line.fromPos.x + 36} ${(line.fromPos.y + line.toPos.y) / 2 + 14},
                        ${line.toPos.x + 36} ${(line.fromPos.y + line.toPos.y) / 2 + 14},
                        ${line.toPos.x + 36} ${line.toPos.y + 14}`}
                  stroke={`url(#relation-grad-${line.relation.id})`}
                  strokeWidth={line.isActive ? 1.5 : 0.75}
                  strokeDasharray={line.relation.type === "observation" ? "3 2" : "none"}
                  fill="none"
                  filter={line.isActive ? "url(#agent-line-glow)" : undefined}
                  opacity={line.isActive ? 1 : 0.35}
                />
                {/* Arrow head */}
                <circle
                  cx={line.toPos.x + 36}
                  cy={line.toPos.y + 14}
                  r={line.isActive ? 2.5 : 1.5}
                  fill={
                    AGENT_COORDINATION_CONFIGS[line.toAgent.coordinationState]
                      .color.replace("text-", "") || "#64748b"
                  }
                  opacity={line.isActive ? 0.9 : 0.25}
                />
              </g>
            )
          )}
        </svg>

        {/* Agent nodes */}
        <div className="absolute inset-0" style={{ marginLeft: 35, paddingTop: 4 }}>
          {agents.map((agent) => (
            <AgentNode
              key={agent.id}
              agent={agent}
              isActive={isActive(agent)}
              isSelected={selectedAgent?.id === agent.id}
              onSelect={setSelectedAgent}
              style={{
                left: nodePositions[agent.id]?.x ?? 0,
                top: nodePositions[agent.id]?.y ?? 0,
              }}
            />
          ))}
        </div>

        {/* Selected agent detail panel */}
        {selectedAgent && selectedConfig && (
          <div
            className="absolute inset-x-2 bottom-2 rounded-lg border border-white/[0.1] bg-black/50 p-2.5 backdrop-blur-md"
            style={{ boxShadow: `0 0 16px 0 ${selectedConfig.glowColor}25` }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-sm font-bold", selectedConfig.color)}>
                    {selectedAgent.name}
                  </span>
                  <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-muted-foreground/80">
                    {selectedAgent.layer}
                  </span>
                  <span className={cn("text-[9px]", selectedConfig.color)}>
                    {selectedConfig.label}
                  </span>
                </div>
                {selectedAgent.currentTask && (
                  <div className="text-[10px] text-muted-foreground/80">
                    当前任务: {selectedAgent.currentTask}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedAgent(null)}
                className="shrink-0 rounded-lg bg-white/10 px-2 py-0.5 text-[9px] hover:bg-white/20"
              >
                关闭
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 border-t border-white/[0.06] px-4 py-1.5 shrink-0">
        {(["idle", "thinking", "speaking", "coordinating"] as const).map((state) => {
          const config = AGENT_COORDINATION_CONFIGS[state];
          return (
            <div key={state} className="flex items-center gap-1">
              <div
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: config.color.replace("text-", ""),
                  boxShadow: config.glowColor ? `0 0 4px 0 ${config.glowColor}` : undefined,
                }}
              />
              <span className="text-[8px] text-muted-foreground/70">{config.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Compact version for embedding
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