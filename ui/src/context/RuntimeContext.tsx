import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  generateMockEvents,
  generateMockExecutionFlow,
  generateMockMetrics,
  generateMockAgents,
  generateMockRelations,
  type AgentCoordinationState,
  type AgentInstance,
  type CoordinationRelation,
  type ExecutionNode,
  type RuntimeEvent,
  type RuntimeMetrics,
  type RuntimeState,
} from "../lib/runtime";

// =============================================================================
// CONTEXT
// =============================================================================

interface RuntimeContextValue {
  // Current global runtime state
  globalState: RuntimeState;

  // Metrics
  metrics: RuntimeMetrics;

  // Recent events (live event stream)
  events: RuntimeEvent[];

  // Execution flow visualization
  executionFlow: ExecutionNode[];

  // Agent coordination
  agents: AgentInstance[];
  relations: CoordinationRelation[];

  // State transitions
  transitionTo: (state: RuntimeState) => void;

  // Event management
  addEvent: (event: Omit<RuntimeEvent, "id" | "timestamp">) => void;

  // Node state updates
  updateNodeState: (nodeId: string, state: RuntimeState) => void;

  // Progress updates
  updateNodeProgress: (nodeId: string, progress: number) => void;

  // Agent coordination updates
  updateAgentCoordination: (agentId: string, state: AgentCoordinationState) => void;

  // Is simulation running
  isSimulating: boolean;
  startSimulation: () => void;
  stopSimulation: () => void;
}

const RuntimeContext = createContext<RuntimeContextValue | null>(null);

// =============================================================================
// PROVIDER
// =============================================================================

interface RuntimeProviderProps {
  children: ReactNode;
  autoStart?: boolean;
}

export function RuntimeProvider({
  children,
  autoStart = true,
}: RuntimeProviderProps) {
  const [globalState, setGlobalState] = useState<RuntimeState>("idle");
  const [metrics, setMetrics] = useState<RuntimeMetrics>(generateMockMetrics);
  const [events, setEvents] = useState<RuntimeEvent[]>(generateMockEvents(20));
  const [executionFlow, setExecutionFlow] = useState<ExecutionNode[]>(
    generateMockExecutionFlow()
  );
  const [agents, setAgents] = useState<AgentInstance[]>(generateMockAgents());
  const [relations, setRelations] = useState<CoordinationRelation[]>([]);
  const [isSimulating, setIsSimulating] = useState(autoStart);

  // Initialize relations when agents change
  useEffect(() => {
    setRelations(generateMockRelations(agents));
  }, [agents]);

  // Simulation loop
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      // Update metrics with slight fluctuations
      setMetrics((prev) => {
        const variance = (key: keyof RuntimeMetrics): number => {
          const val = prev[key] as number;
          const maxChange = val * 0.1;
          return Math.max(0, val + (Math.random() - 0.5) * maxChange * 2);
        };

        return {
          totalAgents: Math.max(1, variance("totalAgents")),
          activeAgents: Math.max(0, Math.min(prev.totalAgents, variance("activeAgents"))),
          tasksCompleted: prev.tasksCompleted + Math.floor(Math.random() * 3),
          tasksInFlight: Math.max(
            1,
            Math.min(15, (prev.tasksInFlight + Math.floor(Math.random() * 5) - 2))
          ),
          avgResponseTime: Math.max(100, variance("avgResponseTime")),
          errorRate: Math.max(0, Math.min(10, variance("errorRate"))),
          uptime: Math.min(100, Math.max(95, variance("uptime"))),
        };
      });

      // Random state transitions
      const states: RuntimeState[] = [
        "idle",
        "preparing",
        "routing",
        "executing",
        "syncing",
      ];
      if (Math.random() > 0.7) {
        setGlobalState(states[Math.floor(Math.random() * states.length)]);
      }

      // Update execution flow nodes
      setExecutionFlow((prev) =>
        prev.map((node) => {
          if (node.state === "idle" && Math.random() > 0.8) {
            return { ...node, state: "preparing" as RuntimeState };
          }
          if (
            node.state === "preparing" &&
            Math.random() > 0.6
          ) {
            return { ...node, state: "executing" as RuntimeState };
          }
          if (
            node.state === "executing" &&
            node.metadata?.progress !== undefined
          ) {
            const newProgress = Math.min(
              100,
              node.metadata.progress + Math.floor(Math.random() * 15) + 5
            );
            return {
              ...node,
              metadata: { ...node.metadata, progress: newProgress },
              state: newProgress >= 100 ? "completed" : node.state,
            };
          }
          if (
            node.state === "completed" &&
            Math.random() > 0.9
          ) {
            return { ...node, state: "idle" as RuntimeState, metadata: { ...node.metadata, progress: 0 } };
          }
          return node;
        })
      );

      // Add random events
      if (Math.random() > 0.5) {
        const newEvent: RuntimeEvent = {
          id: `evt-${Date.now()}`,
          timestamp: new Date(),
          type: ["task_start", "task_complete", "task_fail", "agent_register"][
            Math.floor(Math.random() * 4)
          ] as RuntimeEvent["type"],
          source: ["[ORG] CEO Agent", "[V1-PROJECT] Research Agent", "System"][
            Math.floor(Math.random() * 3)
          ],
          message: "模拟事件",
          state: globalState,
        };
        setEvents((prev) => [newEvent, ...prev.slice(0, 49)]);
      }

      // Update agent coordination states
      setAgents((prev) =>
        prev.map((agent) => {
          const coordStates: AgentCoordinationState[] = [
            "idle",
            "thinking",
            "speaking",
            "listening",
            "coordinating",
          ];

          // Random transitions between states
          if (Math.random() > 0.7) {
            const newState = coordStates[Math.floor(Math.random() * coordStates.length)];
            return {
              ...agent,
              coordinationState: newState,
              lastActive: new Date(),
            };
          }
          return agent;
        })
      );

      // Update relations based on agent states
      setRelations((prev) =>
        prev.map((rel) => {
          const fromAgent = agents.find((a) => a.id === rel.from);
          const toAgent = agents.find((a) => a.id === rel.to);
          const isActive =
            fromAgent?.coordinationState === "speaking" ||
            fromAgent?.coordinationState === "coordinating" ||
            toAgent?.coordinationState === "speaking" ||
            toAgent?.coordinationState === "coordinating";
          return {
            ...rel,
            isActive,
            strength: isActive ? 0.8 : 0.3,
          };
        })
      );
    }, 3000);

    return () => clearInterval(interval);
  }, [isSimulating, globalState]);

  // State transition
  const transitionTo = useCallback((state: RuntimeState) => {
    setGlobalState(state);
  }, []);

  // Add event
  const addEvent = useCallback(
    (event: Omit<RuntimeEvent, "id" | "timestamp">) => {
      const newEvent: RuntimeEvent = {
        ...event,
        id: `evt-${Date.now()}`,
        timestamp: new Date(),
      };
      setEvents((prev) => [newEvent, ...prev.slice(0, 99)]);
    },
    []
  );

  // Update node state
  const updateNodeState = useCallback(
    (nodeId: string, state: RuntimeState) => {
      setExecutionFlow((prev) =>
        prev.map((node) => (node.id === nodeId ? { ...node, state } : node))
      );
    },
    []
  );

  // Update node progress
  const updateNodeProgress = useCallback(
    (nodeId: string, progress: number) => {
      setExecutionFlow((prev) =>
        prev.map((node) =>
          node.id === nodeId
            ? { ...node, metadata: { ...node.metadata, progress } }
            : node
        )
      );
    },
    []
  );

  // Update agent coordination
  const updateAgentCoordination = useCallback(
    (agentId: string, state: AgentCoordinationState) => {
      setAgents((prev) =>
        prev.map((agent) =>
          agent.id === agentId
            ? { ...agent, coordinationState: state, lastActive: new Date() }
            : agent
        )
      );
    },
    []
  );

  // Simulation controls
  const startSimulation = useCallback(() => setIsSimulating(true), []);
  const stopSimulation = useCallback(() => setIsSimulating(false), []);

  const value = useMemo<RuntimeContextValue>(
    () => ({
      globalState,
      metrics,
      events,
      executionFlow,
      agents,
      relations,
      transitionTo,
      addEvent,
      updateNodeState,
      updateNodeProgress,
      updateAgentCoordination,
      isSimulating,
      startSimulation,
      stopSimulation,
    }),
    [
      globalState,
      metrics,
      events,
      executionFlow,
      agents,
      relations,
      transitionTo,
      addEvent,
      updateNodeState,
      updateNodeProgress,
      updateAgentCoordination,
      isSimulating,
      startSimulation,
      stopSimulation,
    ]
  );

  return (
    <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>
  );
}

// =============================================================================
// HOOK
// =============================================================================

export function useRuntime(): RuntimeContextValue {
  const context = useContext(RuntimeContext);
  if (!context) {
    throw new Error("useRuntime must be used within a RuntimeProvider");
  }
  return context;
}

// Export individual hooks for specific concerns
export function useRuntimeMetrics() {
  const { metrics } = useRuntime();
  return metrics;
}

export function useRuntimeEvents() {
  const { events } = useRuntime();
  return events;
}

export function useRuntimeState() {
  const { globalState } = useRuntime();
  return globalState;
}

export function useExecutionFlow() {
  const { executionFlow } = useRuntime();
  return executionFlow;
}
