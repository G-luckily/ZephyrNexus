import type { Agent } from "@zephyr-nexus/shared";
import { buildOrgUnits } from "./company-scope";

export interface OrgDepartmentOption {
  key: string;
  label: string;
  aliases?: readonly string[];
}

export type VisibleOrgLayer = "总监层" | "专员层";

export const ORG_DEPARTMENT_PRESETS: OrgDepartmentOption[] = [
  {
    key: "ceo",
    label: "总裁 / CEO",
    aliases: ["总裁", "ceo", "总裁办公室"],
  },
  {
    key: "cho",
    label: "人力总监",
    aliases: ["人力", "hr", "人力与协调"],
  },
  {
    key: "cto",
    label: "技术总监",
    aliases: ["技术", "研发", "cto", "技术线"],
  },
  {
    key: "research",
    label: "社会研究院",
    aliases: ["研究", "研究院", "社会研究"],
  },
  {
    key: "public-affairs",
    label: "公共责任部",
    aliases: ["公共责任", "责任部", "public", "publicaffairs"],
  },
  {
    key: "media",
    label: "新媒体中心",
    aliases: ["媒体", "新媒体", "内容", "市场", "cmo"],
  },
  {
    key: "executive-assistant",
    label: "总裁助理",
    aliases: ["助理", "assistant"],
  },
];

const DIRECTOR_ROLES = new Set<Agent["role"]>([
  "ceo",
  "cto",
  "cmo",
  "cfo",
  "pm",
  "researcher",
]);

const DIRECTOR_KEYWORDS = [
  "总监",
  "院长",
  "主任",
  "助理",
  "ceo",
  "cto",
  "cho",
  "cmo",
  "cfo",
];

function normalizeToken(input: string): string {
  return input.toLowerCase().replace(/[\s_./-]+/g, "").trim();
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findDepartmentOption(
  raw: string,
  options: OrgDepartmentOption[]
): OrgDepartmentOption | null {
  const direct = options.find((item) => item.key === raw);
  if (direct) return direct;

  const normalized = normalizeToken(raw);
  const byNormalized = options.find((item) => {
    if (normalizeToken(item.key) === normalized) return true;
    if (normalizeToken(item.label) === normalized) return true;
    return (item.aliases ?? []).some(
      (alias) => normalizeToken(alias) === normalized
    );
  });
  if (byNormalized) return byNormalized;

  const byKeyword = options.find((item) => {
    const corpus = [item.label, ...(item.aliases ?? [])];
    return corpus.some((entry) => normalizeToken(raw).includes(normalizeToken(entry)));
  });
  return byKeyword ?? null;
}

export function roleFallbackDepartmentKey(role: Agent["role"]): string {
  switch (role) {
    case "ceo":
      return "ceo";
    case "pm":
      return "cho";
    case "cto":
      return "cto";
    case "researcher":
      return "research";
    case "cmo":
      return "media";
    case "cfo":
      return "public-affairs";
    default:
      return "public-affairs";
  }
}

export function deriveOrgDepartmentOptions(
  agents: Agent[]
): OrgDepartmentOption[] {
  const dynamic = buildOrgUnits(agents).map((unit) => ({
    key: unit.key,
    label: unit.label,
  }));

  const dynamicMap = new Map(dynamic.map((item) => [item.key, item]));
  const merged: OrgDepartmentOption[] = ORG_DEPARTMENT_PRESETS.map((preset) => {
    const override = dynamicMap.get(preset.key);
    return override
      ? {
          ...preset,
          label: override.label,
        }
      : preset;
  });

  for (const item of dynamic) {
    if (merged.some((existing) => existing.key === item.key)) continue;
    merged.push(item);
  }

  return merged;
}

export function departmentLabelFromKey(
  key: string,
  options: OrgDepartmentOption[]
): string {
  const matched = options.find((item) => item.key === key);
  return matched?.label ?? key;
}

export function resolveAgentDepartment(
  agent: Agent,
  options: OrgDepartmentOption[]
): OrgDepartmentOption {
  const metadata = isRecord(agent.metadata) ? agent.metadata : null;
  const metaCandidates = metadata
    ? [
        metadata.departmentKey,
        metadata.department,
        metadata.departmentId,
        metadata.departmentLabel,
        metadata.departmentName,
        metadata.orgUnit,
        metadata.orgUnitKey,
      ]
    : [];

  for (const candidate of metaCandidates) {
    const text = toStringOrNull(candidate);
    if (!text) continue;
    const matched = findDepartmentOption(text, options);
    if (matched) return matched;
  }

  const text = `${agent.title ?? ""} ${agent.name}`;
  const keywordMatched = findDepartmentOption(text, options);
  if (keywordMatched) return keywordMatched;

  const fallbackKey = roleFallbackDepartmentKey(agent.role);
  return (
    options.find((item) => item.key === fallbackKey) ??
    ORG_DEPARTMENT_PRESETS.find((item) => item.key === fallbackKey) ??
    ORG_DEPARTMENT_PRESETS[0]
  );
}

export function resolveVisibleOrgLayer(agent: Agent): VisibleOrgLayer {
  const metadata = isRecord(agent.metadata) ? agent.metadata : null;
  const metadataLayer = metadata
    ? toStringOrNull(metadata.orgLayer) ??
      toStringOrNull(metadata.organizationLayer) ??
      toStringOrNull(metadata.layer)
    : null;

  if (metadataLayer) {
    const normalized = metadataLayer.toLowerCase();
    if (normalized.includes("总监") || normalized.includes("director")) {
      return "总监层";
    }
    if (normalized.includes("专员") || normalized.includes("specialist")) {
      return "专员层";
    }
  }

  if (DIRECTOR_ROLES.has(agent.role)) return "总监层";

  const text = `${agent.name} ${agent.title ?? ""}`.toLowerCase();
  if (DIRECTOR_KEYWORDS.some((kw) => text.includes(kw))) return "总监层";

  return "专员层";
}

export function stripTechnicalAgentPrefix(name: string): string {
  return name.replace(/^\[[^\]]+\]\s*/, "").trim() || name;
}

export function cleanVisibleAgentName(name: string): string {
  const stripped = stripTechnicalAgentPrefix(name);
  const match = stripped.match(/^(.*?)[-_]([A-Z]{2,8})$/);
  if (!match) return stripped;
  const base = match[1]?.trim();
  return base && base.length > 0 ? base : stripped;
}
