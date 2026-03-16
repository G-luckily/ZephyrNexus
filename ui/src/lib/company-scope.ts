import type { Agent, Project } from "@zephyr-nexus/shared";
import { agentUrl, projectRouteRef } from "./utils";

export interface OrgUnitItem {
  key: string;
  label: string;
  agent: Agent | null;
  to: string;
}

export interface AgentNavItem {
  id: string;
  name: string;
  to: string;
  role: Agent["role"];
}

export interface AgentNavGroups {
  management: AgentNavItem[];
  execution: AgentNavItem[];
}

/** Four-tier agent hierarchy for the sidebar */
export interface AgentNavTiers {
  /** CEO only – 老板级 */
  boss: AgentNavItem[];
  /** 院长、主任、助理、CHO/CMO/CTO etc. – 总监级 */
  directors: AgentNavItem[];
  /** All remaining active agents – 执行专员 */
  executors: AgentNavItem[];
  /** Script executing V1-PROJECT agents - 工程专员 */
  engineers: AgentNavItem[];
}

/** Roles that qualify as 总监级 by role field alone */
const DIRECTOR_ROLES = new Set<Agent["role"]>(["cto", "cmo", "cfo", "pm"]);

/** Keywords that qualify an agent as 总监级 when found in name or title */
const DIRECTOR_KEYWORDS = [
  "院长",
  "主任",
  "助理",
  "CHO",
  "CMO",
  "CTO",
  "总监",
];

const MANAGEMENT_ROLES = new Set<Agent["role"]>([
  "ceo",
  "cto",
  "cmo",
  "cfo",
  "pm",
  "researcher",
]);

const ORG_PRESETS: Array<{
  key: string;
  label: string;
  match: (agent: Agent) => boolean;
}> = [
  { key: "ceo", label: "总裁", match: (agent) => agent.role === "ceo" },
  {
    key: "cho",
    label: "人力总监",
    match: (agent) =>
      agent.role === "pm" || includesAny(agent, ["CHO", "人力总监", "人力"]),
  },
  {
    key: "cto",
    label: "技术总监",
    match: (agent) =>
      agent.role === "cto" || includesAny(agent, ["CTO", "技术总监", "技术"]),
  },
  {
    key: "research",
    label: "社会研究院",
    match: (agent) =>
      agent.role === "researcher" || includesAny(agent, ["研究院", "研究"]),
  },
  {
    key: "public-affairs",
    label: "公共责任部",
    match: (agent) => includesAny(agent, ["公共责任", "责任部", "public"]),
  },
  {
    key: "media",
    label: "新媒体中心",
    match: (agent) =>
      agent.role === "cmo" ||
      includesAny(agent, ["CMO", "媒体", "内容", "宣传", "市场"]),
  },
  {
    key: "executive-assistant",
    label: "总裁助理",
    match: (agent) => includesAny(agent, ["助理", "assistant"]),
  },
];

function includesAny(agent: Agent, keywords: string[]): boolean {
  const text = `${agent.name} ${agent.title ?? ""}`.toLowerCase();
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function isDirector(agent: Agent): boolean {
  if (DIRECTOR_ROLES.has(agent.role)) return true;
  const text = `${agent.name} ${agent.title ?? ""}`;
  return DIRECTOR_KEYWORDS.some((kw) =>
    text.toLowerCase().includes(kw.toLowerCase())
  );
}

function toNavItem(agent: Agent): AgentNavItem {
  return {
    id: agent.id,
    name: agent.name,
    to: agentUrl(agent),
    role: agent.role,
  };
}

export function buildProjectNav(
  projects: Project[]
): Array<{ key: string; label: string; to: string }> {
  return projects
    .filter((project) => !project.archivedAt)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    .map((project) => ({
      key: project.id,
      label: project.name,
      to: `/projects/${projectRouteRef(project)}/issues`,
    }));
}

export function buildOrgUnits(agents: Agent[]): OrgUnitItem[] {
  const units: OrgUnitItem[] = [];

  for (const preset of ORG_PRESETS) {
    const matched = agents.find(preset.match) ?? null;
    if (!matched) continue;
    units.push({
      key: preset.key,
      label: preset.label,
      agent: matched,
      to: `/org?unit=${preset.key}`,
    });
  }

  if (units.length > 0) return units;

  const fallback = agents
    .slice()
    .sort((a, b) => Number(a.reportsTo !== null) - Number(b.reportsTo !== null))
    .slice(0, 6)
    .map((agent) => ({
      key: agent.role,
      label: agent.title || agent.name,
      agent,
      to: "/org",
    }));

  return fallback;
}

/** Returns a four-tier breakdown: boss / directors / executors / engineers
 *  V1-PROJECT tagged agents are specifically placed in the engineers tier. */
export function buildAgentTiers(agents: Agent[]): AgentNavTiers {
  const active = agents
    .filter((a) => a.status !== "terminated")
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

  const boss: AgentNavItem[] = [];
  const directors: AgentNavItem[] = [];
  const executors: AgentNavItem[] = [];
  const engineers: AgentNavItem[] = [];

  for (const agent of active) {
    if (agent.name.startsWith("[V1-PROJECT]")) {
      engineers.push(toNavItem(agent));
    } else if (agent.role === "ceo") {
      boss.push(toNavItem(agent));
    } else if (isDirector(agent)) {
      directors.push(toNavItem(agent));
    } else {
      executors.push(toNavItem(agent));
    }
  }

  return { boss, directors, executors, engineers };
}

/** @deprecated Use buildAgentTiers instead */
export function buildAgentGroups(agents: Agent[]): AgentNavGroups {
  const sorted = agents
    .filter((agent) => agent.status !== "terminated")
    .slice()
    .sort((a, b) => {
      const ma = Number(!MANAGEMENT_ROLES.has(a.role));
      const mb = Number(!MANAGEMENT_ROLES.has(b.role));
      if (ma !== mb) return ma - mb;
      return a.name.localeCompare(b.name, "zh-CN");
    });

  const management: AgentNavItem[] = [];
  const execution: AgentNavItem[] = [];

  for (const agent of sorted) {
    const item = toNavItem(agent);
    if (MANAGEMENT_ROLES.has(agent.role)) {
      management.push(item);
    } else {
      execution.push(item);
    }
  }

  return { management, execution };
}
