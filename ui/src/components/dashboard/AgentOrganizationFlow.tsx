import { useMemo } from "react";
import { Link } from "@/lib/router";
import type { Agent } from "@zephyr-nexus/shared";

interface AgentOrganizationFlowProps {
  agents: Agent[];
}

const CORE_DEPARTMENTS = [
  "技术总监",
  "人力总监",
  "社会研究院",
  "公共责任部",
  "新媒体中心",
  "总裁助理",
];

function normalizeStatus(status?: Agent["status"]): {
  text: string;
  dot: string;
} {
  if (status === "running" || status === "active") {
    return { text: "执行中", dot: "bg-[#2f5d7c]" };
  }
  if (status === "error" || status === "terminated") {
    return { text: "异常", dot: "bg-[#d1493f]" };
  }
  if (status === "paused" || status === "pending_approval") {
    return { text: "等待中", dot: "bg-amber-500" };
  }
  return { text: "空闲", dot: "bg-slate-400" };
}

function matchDepartmentAgent(
  agents: Agent[],
  department: string
): Agent | null {
  return (
    agents.find((a) => a.name.includes(department)) ??
    agents.find((a) => (a.title ?? "").includes(department)) ??
    null
  );
}

export function AgentOrganizationFlow({ agents }: AgentOrganizationFlowProps) {
  const ceo = useMemo(
    () =>
      agents.find((a) => a.role === "ceo") ??
      agents.find((a) => !a.reportsTo) ??
      null,
    [agents]
  );

  const nodes = useMemo(() => {
    return CORE_DEPARTMENTS.map((name) => {
      const agent = matchDepartmentAgent(agents, name);
      const state = normalizeStatus(agent?.status);
      return {
        name,
        state,
        url: agent ? `/agents/${agent.urlKey || agent.id}` : null,
      };
    });
  }, [agents]);

  const ceoState = normalizeStatus(ceo?.status);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">首页仅展示公司骨架层级</p>
        <Link
          to="/org"
          className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground no-underline hover:bg-accent/50 hover:text-foreground"
        >
          查看完整组织
        </Link>
      </div>

      <div className="rounded-2xl border border-border bg-[#f7fafc] p-4">
        <div className="mx-auto max-w-[280px] rounded-xl border border-[#2f5d7c]/35 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-base font-semibold text-foreground">总裁</p>
            <span className={`h-2.5 w-2.5 rounded-full ${ceoState.dot}`} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            公司统筹与任务决策
          </p>
        </div>

        <div className="mx-auto h-6 w-px bg-slate-300" />

        <div className="mx-auto max-w-[520px] space-y-2 rounded-xl border border-border bg-white p-3">
          {nodes.map((node) => {
            const content = (
              <div className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-accent/30">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">├</span>
                  <p className="text-sm text-foreground">{node.name}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={`h-2 w-2 rounded-full ${node.state.dot}`} />
                  {node.state.text}
                </div>
              </div>
            );

            if (!node.url) {
              return <div key={node.name}>{content}</div>;
            }

            return (
              <Link
                key={node.name}
                to={node.url}
                className="block no-underline text-inherit"
              >
                {content}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
