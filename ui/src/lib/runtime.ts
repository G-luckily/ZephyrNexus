/**
 * Runtime UX System - AI Runtime Operating System Core
 *
 * Defines runtime states, motion tokens, and orchestration patterns
 * for the multi-agent control plane.
 */

// =============================================================================
// RUNTIME STATES
// =============================================================================

export type RuntimeState =
  | "idle"           // No activity, waiting for tasks
  | "preparing"      // Initializing, loading resources
  | "routing"        // Analyzing and routing to appropriate agent
  | "executing"      // Actively processing task
  | "syncing"        // Synchronizing state with external systems
  | "escalating"     // Elevating to human review or higher authority
  | "retrying"       // Attempting to recover from a failure
  | "degraded"       // Running with reduced functionality
  | "blocked"        // Waiting on external dependency
  | "waiting_human"  // Requires human input to proceed
  | "completed";     // Task successfully completed

export interface RuntimeStateConfig {
  state: RuntimeState;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
  icon: "idle" | "preparing" | "routing" | "executing" | "syncing" | "escalating" | "retrying" | "degraded" | "blocked" | "waiting_human" | "completed";
  animation: "none" | "pulse" | "breathe" | "spin" | "wave" | "ping";
  motionIntensity: 0 | 1 | 2 | 3; // 0=none, 1=subtle, 2=moderate, 3=prominent
}

export const RUNTIME_STATE_CONFIGS: Record<RuntimeState, RuntimeStateConfig> = {
  idle: {
    state: "idle",
    label: "空闲",
    description: "等待任务分配",
    color: "text-muted-foreground",
    bgColor: "bg-muted/40",
    borderColor: "border-muted-foreground/20",
    glowColor: "rgba(161, 161, 170, 0)",
    icon: "idle",
    animation: "none",
    motionIntensity: 0,
  },
  preparing: {
    state: "preparing",
    label: "准备中",
    description: "初始化资源和环境",
    color: "text-cyan-400",
    bgColor: "bg-cyan-400/10",
    borderColor: "border-cyan-400/30",
    glowColor: "rgba(34, 211, 238, 0.15)",
    icon: "preparing",
    animation: "pulse",
    motionIntensity: 1,
  },
  routing: {
    state: "routing",
    label: "路由中",
    description: "分析任务并路由到合适的智能体",
    color: "text-violet-400",
    bgColor: "bg-violet-400/10",
    borderColor: "border-violet-400/30",
    glowColor: "rgba(167, 139, 250, 0.2)",
    icon: "routing",
    animation: "wave",
    motionIntensity: 2,
  },
  executing: {
    state: "executing",
    label: "执行中",
    description: "正在处理任务",
    color: "text-zephyr-blue",
    bgColor: "bg-zephyr-blue/10",
    borderColor: "border-zephyr-blue/30",
    glowColor: "rgba(59, 130, 246, 0.2)",
    icon: "executing",
    animation: "breathe",
    motionIntensity: 3,
  },
  syncing: {
    state: "syncing",
    label: "同步中",
    description: "与外部系统同步状态",
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
    borderColor: "border-emerald-400/30",
    glowColor: "rgba(52, 211, 153, 0.15)",
    icon: "syncing",
    animation: "ping",
    motionIntensity: 2,
  },
  escalating: {
    state: "escalating",
    label: "升级中",
    description: "升级到更高级别的处理",
    color: "text-amber-400",
    bgColor: "bg-amber-400/10",
    borderColor: "border-amber-400/30",
    glowColor: "rgba(251, 191, 36, 0.2)",
    icon: "escalating",
    animation: "pulse",
    motionIntensity: 2,
  },
  retrying: {
    state: "retrying",
    label: "重试中",
    description: "从错误中恢复并重试",
    color: "text-orange-400",
    bgColor: "bg-orange-400/10",
    borderColor: "border-orange-400/30",
    glowColor: "rgba(251, 146, 60, 0.2)",
    icon: "retrying",
    animation: "spin",
    motionIntensity: 2,
  },
  degraded: {
    state: "degraded",
    label: "降级运行",
    description: "以降低的功能运行",
    color: "text-rose-400",
    bgColor: "bg-rose-400/10",
    borderColor: "border-rose-400/30",
    glowColor: "rgba(251, 113, 133, 0.2)",
    icon: "degraded",
    animation: "breathe",
    motionIntensity: 1,
  },
  blocked: {
    state: "blocked",
    label: "阻塞",
    description: "等待外部依赖完成",
    color: "text-slate-400",
    bgColor: "bg-slate-400/10",
    borderColor: "border-slate-400/30",
    glowColor: "rgba(148, 163, 184, 0.1)",
    icon: "blocked",
    animation: "none",
    motionIntensity: 0,
  },
  waiting_human: {
    state: "waiting_human",
    label: "等待人工",
    description: "需要人工介入才能继续",
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/10",
    borderColor: "border-yellow-400/30",
    glowColor: "rgba(227, 213, 0, 0.15)",
    icon: "waiting_human",
    animation: "pulse",
    motionIntensity: 1,
  },
  completed: {
    state: "completed",
    label: "已完成",
    description: "任务成功完成",
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
    borderColor: "border-emerald-400/30",
    glowColor: "rgba(52, 211, 153, 0.15)",
    icon: "completed",
    animation: "none",
    motionIntensity: 0,
  },
};

// =============================================================================
// RUNTIME MOTION TOKENS
// =============================================================================

export const RUNTIME_MOTION = {
  // Durations
  instant: "40ms",
  fast: "120ms",
  normal: "200ms",
  slow: "320ms",
  slower: "480ms",

  // Easing
  easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
  easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  easeSpring: "cubic-bezier(0.34, 1.56, 0.64, 1)",

  // Runtime-specific
  executionPulse: "pulse 2s ease-in-out infinite",
  executionGlow: "executionGlow 2s ease-in-out infinite",
  routingWave: "routingWave 1.5s ease-in-out infinite",
  syncPing: "syncPing 1s ease-out infinite",
  breathe: "breathe 3s ease-in-out infinite",
  statusDot: "statusDot 2s ease-in-out infinite",
} as const;

// =============================================================================
// RUNTIME METRICS
// =============================================================================

export interface RuntimeMetrics {
  activeAgents: number;
  totalAgents: number;
  tasksCompleted: number;
  tasksInFlight: number;
  avgResponseTime: number; // ms
  errorRate: number; // 0-100
  uptime: number; // percentage
}

// Mock runtime metrics generator
export function generateMockMetrics(): RuntimeMetrics {
  const activeAgents = Math.floor(Math.random() * 8) + 2;
  const totalAgents = activeAgents + Math.floor(Math.random() * 5);

  return {
    activeAgents,
    totalAgents,
    tasksCompleted: Math.floor(Math.random() * 50) + 10,
    tasksInFlight: Math.floor(Math.random() * 12) + 1,
    avgResponseTime: Math.floor(Math.random() * 800) + 200,
    errorRate: Math.random() * 5,
    uptime: 99 + Math.random(),
  };
}

// =============================================================================
// RUNTIME EVENT
// =============================================================================

export interface RuntimeEvent {
  id: string;
  timestamp: Date;
  type: "task_start" | "task_complete" | "task_fail" | "agent_register" | "agent_unregister" | "escalation" | "recovery";
  source: string;
  target?: string;
  message: string;
  state?: RuntimeState;
  metadata?: Record<string, unknown>;
}

// Generate mock runtime events
export function generateMockEvents(count: number = 20): RuntimeEvent[] {
  const events: RuntimeEvent[] = [];
  const types: RuntimeEvent["type"][] = [
    "task_start", "task_complete", "task_fail", "agent_register", "agent_unregister", "escalation", "recovery"
  ];
  const sources = ["[ORG] CEO Agent", "[V1-PROJECT] Research Agent", "[V2-PIPELINE] Pipeline Agent", "System"];

  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const source = sources[Math.floor(Math.random() * sources.length)];

    events.push({
      id: `evt-${Date.now()}-${i}`,
      timestamp: new Date(Date.now() - Math.random() * 3600000),
      type,
      source,
      message: getEventMessage(type, source),
      state: getEventState(type),
    });
  }

  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

function getEventMessage(type: RuntimeEvent["type"], source: string): string {
  const messages: Record<RuntimeEvent["type"], string[]> = {
    task_start: ["开始执行新任务", "任务已分配", "开始处理请求"],
    task_complete: ["任务已完成", "执行成功", "请求处理完毕"],
    task_fail: ["任务执行失败", "处理出错", "执行中断"],
    agent_register: ["智能体已注册", "新智能体加入", "智能体激活"],
    agent_unregister: ["智能体已注销", "智能体离线", "智能体退出"],
    escalation: ["已升级处理", "请求人工介入", "升级到主管"],
    recovery: ["已恢复运行", "从错误中恢复", "服务已重启"],
  };

  const opts = messages[type];
  return opts[Math.floor(Math.random() * opts.length)];
}

function getEventState(type: RuntimeEvent["type"]): RuntimeState | undefined {
  const stateMap: Partial<Record<RuntimeEvent["type"], RuntimeState>> = {
    task_start: "executing",
    task_complete: "completed",
    task_fail: "degraded",
    agent_register: "preparing",
    agent_unregister: "idle",
    escalation: "escalating",
    recovery: "syncing",
  };
  return stateMap[type];
}

// =============================================================================
// EXECUTION NODE (for orchestration flow visualization)
// =============================================================================

export interface ExecutionNode {
  id: string;
  label: string;
  type: "agent" | "task" | "decision" | "merge" | "input" | "output";
  state: RuntimeState;
  position: { x: number; y: number };
  connections: string[];
  metadata?: {
    agentId?: string;
    taskId?: string;
    duration?: number;
    progress?: number; // 0-100
  };
}

// Generate mock execution flow
export function generateMockExecutionFlow(): ExecutionNode[] {
  return [
    {
      id: "input-1",
      label: "任务输入",
      type: "input",
      state: "completed",
      position: { x: 0, y: 100 },
      connections: ["agent-ceo"],
    },
    {
      id: "agent-ceo",
      label: "CEO 智能体",
      type: "agent",
      state: "executing",
      position: { x: 200, y: 100 },
      connections: ["decision-1"],
      metadata: { agentId: "ceo-agent", progress: 65 },
    },
    {
      id: "decision-1",
      label: "路由决策",
      type: "decision",
      state: "routing",
      position: { x: 400, y: 100 },
      connections: ["agent-research", "agent-pipeline"],
    },
    {
      id: "agent-research",
      label: "研究智能体",
      type: "agent",
      state: "syncing",
      position: { x: 600, y: 50 },
      connections: ["merge-1"],
      metadata: { agentId: "research-agent", progress: 30 },
    },
    {
      id: "agent-pipeline",
      label: "流水线智能体",
      type: "agent",
      state: "idle",
      position: { x: 600, y: 150 },
      connections: ["merge-1"],
      metadata: { agentId: "pipeline-agent", progress: 0 },
    },
    {
      id: "merge-1",
      label: "结果合并",
      type: "merge",
      state: "preparing",
      position: { x: 800, y: 100 },
      connections: ["output-1"],
    },
    {
      id: "output-1",
      label: "结果输出",
      type: "output",
      state: "idle",
      position: { x: 1000, y: 100 },
      connections: [],
    },
  ];
}

// =============================================================================
// AGENT COORDINATION STATES
// For live agent collaboration visualization
// =============================================================================

/**
 * Multi-dimensional agent coordination state:
 * - thinking: Processing information, analyzing
 * - speaking: Producing output, responding
 * - listening: Waiting for input, observing
 * - idle: Available, not busy
 * - error: Encountered an issue
 * - coordinating: Interacting with other agents
 */
export type AgentCoordinationState =
  | "idle"           // Agent is available and idle
  | "thinking"        // Agent is actively processing/analyzing
  | "speaking"        // Agent is producing output
  | "listening"       // Agent is waiting for input
  | "coordinating"    // Agent is collaborating with others
  | "error";          // Agent encountered an issue

export interface AgentCoordinationConfig {
  state: AgentCoordinationState;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
  icon: "idle" | "thinking" | "speaking" | "listening" | "coordinating" | "error";
  animation: "none" | "pulse" | "breathe" | "wave" | "glow";
}

export const AGENT_COORDINATION_CONFIGS: Record<AgentCoordinationState, AgentCoordinationConfig> = {
  idle: {
    state: "idle",
    label: "空闲",
    description: "智能体空闲，等待任务",
    color: "text-slate-400",
    bgColor: "bg-slate-400/10",
    borderColor: "border-slate-400/20",
    glowColor: "rgba(148, 163, 184, 0)",
    icon: "idle",
    animation: "none",
  },
  thinking: {
    state: "thinking",
    label: "思考中",
    description: "正在分析处理",
    color: "text-violet-400",
    bgColor: "bg-violet-400/10",
    borderColor: "border-violet-400/30",
    glowColor: "rgba(167, 139, 250, 0.2)",
    icon: "thinking",
    animation: "wave",
  },
  speaking: {
    state: "speaking",
    label: "输出中",
    description: "正在生成响应",
    color: "text-zephyr-blue",
    bgColor: "bg-zephyr-blue/10",
    borderColor: "border-zephyr-blue/30",
    glowColor: "rgba(59, 130, 246, 0.25)",
    icon: "speaking",
    animation: "pulse",
  },
  listening: {
    state: "listening",
    label: "监听中",
    description: "正在等待输入",
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
    borderColor: "border-emerald-400/20",
    glowColor: "rgba(52, 211, 153, 0.15)",
    icon: "listening",
    animation: "breathe",
  },
  coordinating: {
    state: "coordinating",
    label: "协同中",
    description: "正在与其他智能体协作",
    color: "text-amber-400",
    bgColor: "bg-amber-400/10",
    borderColor: "border-amber-400/30",
    glowColor: "rgba(251, 191, 36, 0.2)",
    icon: "coordinating",
    animation: "glow",
  },
  error: {
    state: "error",
    label: "异常",
    description: "智能体遇到错误",
    color: "text-rose-400",
    bgColor: "bg-rose-400/10",
    borderColor: "border-rose-400/30",
    glowColor: "rgba(251, 113, 133, 0.3)",
    icon: "error",
    animation: "pulse",
  },
};

// =============================================================================
// AGENT INSTANCE
// Individual agent with coordination state
// =============================================================================

export interface AgentInstance {
  id: string;
  name: string;
  layer: "ORG" | "V1-PROJECT" | "V2-PIPELINE" | "INFRA";
  coordinationState: AgentCoordinationState;
  runtimeState: RuntimeState;
  currentTask?: string;
  lastActive: Date;
  connections: string[]; // IDs of connected agents
}

// Generate mock agent instances
export function generateMockAgents(): AgentInstance[] {
  const agents: AgentInstance[] = [
    {
      id: "agent-ceo",
      name: "CEO 智能体",
      layer: "ORG",
      coordinationState: "speaking",
      runtimeState: "executing",
      currentTask: "分析季度报告",
      lastActive: new Date(),
      connections: ["agent-research", "agent-pipeline"],
    },
    {
      id: "agent-research",
      name: "研究智能体",
      layer: "V1-PROJECT",
      coordinationState: "thinking",
      runtimeState: "executing",
      currentTask: "竞品分析",
      lastActive: new Date(Date.now() - 5000),
      connections: ["agent-ceo"],
    },
    {
      id: "agent-pipeline",
      name: "流水线智能体",
      layer: "V2-PIPELINE",
      coordinationState: "listening",
      runtimeState: "idle",
      lastActive: new Date(),
      connections: ["agent-ceo"],
    },
    {
      id: "agent-security",
      name: "安全智能体",
      layer: "INFRA",
      coordinationState: "coordinating",
      runtimeState: "syncing",
      currentTask: "安全扫描",
      lastActive: new Date(Date.now() - 10000),
      connections: ["agent-pipeline"],
    },
    {
      id: "agent-data",
      name: "数据智能体",
      layer: "V1-PROJECT",
      coordinationState: "idle",
      runtimeState: "idle",
      lastActive: new Date(),
      connections: ["agent-research"],
    },
  ];

  return agents;
}

// =============================================================================
// COORDINATION RELATIONSHIP
// Visual connection between agents
// =============================================================================

export interface CoordinationRelation {
  id: string;
  from: string;
  to: string;
  type: "delegation" | "collaboration" | "observation" | "hierarchical";
  strength: number; // 0-1, affects visual weight
  isActive: boolean;
}

export function generateMockRelations(agents: AgentInstance[]): CoordinationRelation[] {
  const relations: CoordinationRelation[] = [];

  for (const agent of agents) {
    for (const connectedId of agent.connections) {
      const fromAgent = agents.find((a) => a.id === agent.id);
      const toAgent = agents.find((a) => a.id === connectedId);

      if (fromAgent && toAgent) {
        // Determine relation type based on layers
        let type: CoordinationRelation["type"] = "collaboration";
        if (
          fromAgent.layer === "ORG" &&
          toAgent.layer !== "ORG"
        ) {
          type = "delegation";
        } else if (
          fromAgent.layer === "INFRA" ||
          toAgent.layer === "INFRA"
        ) {
          type = "observation";
        }

        // Check if currently active
        const isActive =
          fromAgent.coordinationState === "speaking" ||
          fromAgent.coordinationState === "coordinating" ||
          toAgent.coordinationState === "speaking" ||
          toAgent.coordinationState === "coordinating";

        relations.push({
          id: `rel-${agent.id}-${connectedId}`,
          from: agent.id,
          to: connectedId,
          type,
          strength: isActive ? 0.8 : 0.3,
          isActive,
        });
      }
    }
  }

  return relations;
}
