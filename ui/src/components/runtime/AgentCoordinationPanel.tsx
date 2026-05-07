import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import {
  AGENT_COORDINATION_CONFIGS,
  type AgentInstance,
  type CoordinationRelation,
} from "../../lib/runtime";
import { useRuntime } from "../../context/RuntimeContext";

interface AgentNodeProps {
  agent: AgentInstance;
  isActive?: boolean;
  isSelected?: boolean;
  onSelect?: (agent: AgentInstance | null) => void;
  style?: React.CSSProperties;
}

function AgentNode({ agent, isActive, isSelected, onSelect, style }: AgentNodeProps) {
  const config = AGENT_COORDINATION_CONFIGS[agent.coordinationState];

  const layerColors: Record<string, string> = {
    ORG: "border-amber-400/40",
    "V1-PROJECT": "border-violet-400/40",
    "V2-PIPELINE": "border-zephyr-blue/40",
    INFRA: "border-emerald-400/40",
  };

  const layerBg: Record<string, string> = {
    ORG: "bg-amber-400/5",
    "V1-PROJECT": "bg-violet-400/5",
    "V2-PIPELINE": "bg-zephyr-blue/5",
    INFRA: "bg-emerald-400/5",
  };

  return (
    <button
      type="button"
      onClick={() => onSelect?.(isSelected ? null : agent)}
      className={cn(
        "absolute flex flex-col items-center gap-1.5 rounded-xl border py-2.5 px-3 transition-all duration-300",
        "hover:scale-105 hover:z-10 hover:cursor-pointer",
        config.bgColor,
        config.borderColor,
        layerColors[agent.layer],
        layerBg[agent.layer],
        isActive && "runtime-node-active",
        isSelected && "ring-2 ring-offset-2 ring-offset-background"
      )}
      style={{
        width: 90,
        boxShadow: isActive
          ? `0 0 20px 2px ${config.glowColor}, 0 0 40px 0 ${config.glowColor}30`
          : config.glowColor
          ? `0 0 8px 0 ${config.glowColor}40`
          : undefined,
        ...style,
      }}
    >
      {/* Active pulse indicator */}
      {isActive && (
        <div
          className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full"
          style={{
            backgroundColor: config.color.replace("text-", ""),
            boxShadow: `0 0 8px 2px ${config.glowColor}`,
            animation: "status-breathe 2s ease-in-out infinite",
          }}
        />
      )}

      {/* Agent avatar */}
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg border",
          config.bgColor,
          config.borderColor
        )}
      >
        <span className={cn("text-xs font-bold", config.color)}>
          {agent.name.slice(0, 2)}
        </span>
      </div>

      {/* Agent name */}
      <div className="flex flex-col items-center gap-0.5">
        <span className={cn("text-[10px] font-semibold", config.color)}>
          {agent.name.length > 8 ? agent.name.slice(0, 8) + "…" : agent.name}
        </span>
        <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[7px] font-medium uppercase tracking-wider text-muted-foreground/70">
          {agent.layer}
        </span>
      </div>

      {/* State badge */}
      <div
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[8px] font-medium",
          isActive ? "bg-current/10" : "bg-white/5"
        )}
      >
        <span className={cn(config.color)}>{config.label}</span>
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
      agent.coordinationState === "coordinating",
    []
  );

  // Calculate node positions based on layer
  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    const layerOrder = ["ORG", "V1-PROJECT", "V2-PIPELINE", "INFRA"];
    const layerY: Record<string, number> = {
      ORG: 15,
      "V1-PROJECT": 85,
      "V2-PIPELINE": 155,
      INFRA: 225,
    };
    const perLayer: Record<string, number> = {};

    agents.forEach((agent) => {
      const layer = agent.layer;
      const idx = perLayer[layer] ?? 0;
      perLayer[layer] = idx + 1;
      const layerAgents = agents.filter((a) => a.layer === layer).length;
      const totalWidth = Math.min(layerAgents * 110, 320);
      const startX = (320 - totalWidth) / 2 + idx * 110 + 55 - 45;
      positions[agent.id] = { x: startX, y: layerY[layer] };
    });

    return positions;
  }, [agents]);

  // Filter active relations (between active agents)
  const activeRelations = useMemo(
    () => relations.filter((r) => r.isActive),
    [relations]
  );

  const selectedConfig = selectedAgent
    ? AGENT_COORDINATION_CONFIGS[selectedAgent.coordinationState]
    : null;

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

  return (
    <div className={cn("panel-floating relative overflow-hidden", className)}>
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(139, 92, 246, 0.06) 0%, transparent 70%)",
        }}
      />

      {/* Header */}
      <div className="relative flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-400/10">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-3.5 w-3.5 text-violet-400"
            >
              <circle cx="12" cy="12" r="3" />
              <circle cx="19" cy="12" r="2" />
              <circle cx="5" cy="12" r="2" />
              <path d="M12 9V6M12 15v3M9 12H6M15 12h3" />
            </svg>
          </div>
          <span className="text-sm font-medium">智能体协同</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span
              className="absolute inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400"
              style={{ animation: "status-breathe 2s ease-in-out infinite" }}
            />
            <span className="absolute inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping opacity-50" />
          </span>
          <span className="text-[10px] text-muted-foreground">实时同步</span>
        </div>
      </div>

      {/* Graph canvas */}
      <div ref={containerRef} className="relative h-[280px] w-full overflow-hidden">
        {/* Layer background stripes */}
        <div className="pointer-events-none absolute inset-0">
          {["ORG", "V1-PROJECT", "V2-PIPELINE", "INFRA"].map((layer, i) => (
            <div
              key={layer}
              className="absolute left-0 right-0 h-[70px] border-b border-white/[0.03]"
              style={{ top: i * 70 + 15 }}
            />
          ))}
        </div>

        {/* SVG Connection lines */}
        <svg className="absolute inset-0 h-full w-full pointer-events-none">
          <defs>
            {relationLines.map(
              (line: (typeof relationLines)[0]) =>
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
                          .color.replace("text-", "") || "#7a8ba8"
                      }
                      stopOpacity={line.isActive ? 0.8 : 0.2}
                    />
                    <stop
                      offset="100%"
                      stopColor={
                        AGENT_COORDINATION_CONFIGS[line.toAgent.coordinationState]
                          .color.replace("text-", "") || "#7a8ba8"
                      }
                      stopOpacity={line.isActive ? 0.8 : 0.2}
                    />
                  </linearGradient>
                )
            )}
            <filter id="line-glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {relationLines.map(
            (line: (typeof relationLines)[0]) =>
              line && (
                <g key={line.relation.id}>
                  {/* Connection line */}
                  <path
                    d={`M ${line.fromPos.x + 45} ${line.fromPos.y + 35}
                        C ${line.fromPos.x + 45} ${(line.fromPos.y + line.toPos.y) / 2 + 17},
                          ${line.toPos.x + 45} ${(line.fromPos.y + line.toPos.y) / 2 + 17},
                          ${line.toPos.x + 45} ${line.toPos.y + 20}`}
                    stroke={`url(#relation-grad-${line.relation.id})`}
                    strokeWidth={line.isActive ? 2 : 1}
                    strokeDasharray={
                      line.relation.type === "observation" ? "4 3" : "none"
                    }
                    fill="none"
                    filter={line.isActive ? "url(#line-glow)" : undefined}
                    opacity={line.isActive ? 1 : 0.4}
                  />
                  {/* Arrow head */}
                  <circle
                    cx={line.toPos.x + 45}
                    cy={line.toPos.y + 20}
                    r={3}
                    fill={
                      AGENT_COORDINATION_CONFIGS[line.toAgent.coordinationState]
                        .color.replace("text-", "") || "#7a8ba8"
                    }
                    opacity={line.isActive ? 0.8 : 0.3}
                  />
                </g>
              )
          )}
        </svg>

        {/* Agent nodes */}
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

        {/* Selected agent detail panel */}
        {selectedAgent && selectedConfig && (
          <div
            className="absolute inset-x-3 bottom-3 rounded-xl border border-white/[0.08] bg-black/40 p-3 backdrop-blur-md"
            style={{
              boxShadow: `0 0 20px 0 ${selectedConfig.glowColor}30`,
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-sm font-bold", selectedConfig.color)}>
                    {selectedAgent.name}
                  </span>
                  <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                    {selectedAgent.layer}
                  </span>
                </div>
                <div className={cn("text-[10px]", selectedConfig.color)}>
                  {selectedConfig.label} · {selectedConfig.description}
                </div>
                {selectedAgent.currentTask && (
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    任务: {selectedAgent.currentTask}
                  </div>
                )}
                {selectedAgent.connections.length > 0 && (
                  <div className="mt-0.5 flex gap-1">
                    {selectedAgent.connections.map((conn) => (
                      <span
                        key={conn}
                        className="rounded-full bg-white/5 px-1.5 py-0.5 text-[8px] text-muted-foreground/70"
                      >
                        {conn}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedAgent(null)}
                className="shrink-0 rounded-lg bg-white/10 px-2 py-1 text-[10px] hover:bg-white/20"
              >
                关闭
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 border-t border-white/[0.06] px-4 py-2">
        {(["idle", "thinking", "speaking", "coordinating"] as const).map((state) => {
          const config = AGENT_COORDINATION_CONFIGS[state];
          return (
            <div key={state} className="flex items-center gap-1.5">
              <div
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: config.color.replace("text-", ""),
                  boxShadow: config.glowColor ? `0 0 4px 0 ${config.glowColor}` : undefined,
                }}
              />
              <span className="text-[9px] text-muted-foreground">{config.label}</span>
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