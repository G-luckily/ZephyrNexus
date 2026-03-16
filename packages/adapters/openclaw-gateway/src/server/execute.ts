import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
  AdapterRuntimeServiceReport,
} from "@zephyr-nexus/adapter-utils";
import { asNumber, asString, buildPaperclipEnv, parseObject } from "@zephyr-nexus/adapter-utils/server-utils";
import crypto, { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";

type SessionKeyStrategy = "fixed" | "issue" | "run";

type WakePayload = {
  runId: string;
  agentId: string;
  companyId: string;
  taskId: string | null;
  issueId: string | null;
  wakeReason: string | null;
  wakeCommentId: string | null;
  approvalId: string | null;
  approvalStatus: string | null;
  issueIds: string[];
};

type GatewayDeviceIdentity = {
  deviceId: string;
  publicKeyRawBase64Url: string;
  privateKeyPem: string;
  source: "configured" | "ephemeral";
};

type GatewayRequestFrame = {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
};

type GatewayResponseFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: {
    code?: unknown;
    message?: unknown;
  };
};

type GatewayEventFrame = {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  expectFinal: boolean;
  timer: ReturnType<typeof setTimeout> | null;
};

type GatewayResponseError = Error & {
  gatewayCode?: string;
  gatewayDetails?: Record<string, unknown>;
};

type GatewayClientOptions = {
  url: string;
  headers: Record<string, string>;
  onEvent: (frame: GatewayEventFrame) => Promise<void> | void;
  onLog: AdapterExecutionContext["onLog"];
};

type GatewayClientRequestOptions = {
  timeoutMs: number;
  expectFinal?: boolean;
};

type OfficeRole = "paperclip" | "prompt" | "firecrawl" | "pencil" | "research" | "code";

type OfficeDispatchResult = {
  ok: boolean;
  role?: string;
  agentId?: string;
  error?: string;
  report?: {
    path?: string;
    reportBodyPath?: string;
    summaryPath?: string;
    finalReportPath?: string;
    finalSummary?: string;
    finalSummaryPath?: string;
    finalAgents?: string[];
    finalIndexPath?: string | null;
    deliveryListScript?: string | null;
    roleDir?: string;
    runId?: string | null;
    indexPath?: string | null;
  };
  routing?: Record<string, unknown> | null;
  resultLocator?: Record<string, unknown> | null;
  requestedRole?: string;
  finalReport?: {
    summary?: string;
    reportPath?: string;
    summaryPath?: string;
    finalAgents?: string[];
    generatedAt?: string;
  } | null;
  result?: unknown;
};

const PROTOCOL_VERSION = 3;
const DEFAULT_SCOPES = ["operator.admin"];
const DEFAULT_CLIENT_ID = "gateway-client";
const DEFAULT_CLIENT_MODE = "backend";
const DEFAULT_CLIENT_VERSION = "paperclip";
const DEFAULT_ROLE = "operator";

const SENSITIVE_LOG_KEY_PATTERN =
  /(^|[_-])(auth|authorization|token|secret|password|api[_-]?key|private[_-]?key)([_-]|$)|^x-openclaw-(auth|token)$/i;

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parseOptionalPositiveInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.floor(value));
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) return Math.max(1, Math.floor(parsed));
  }
  return null;
}

function parseBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return fallback;
}

function normalizeSessionKeyStrategy(value: unknown): SessionKeyStrategy {
  const normalized = asString(value, "issue").trim().toLowerCase();
  if (normalized === "fixed" || normalized === "run") return normalized;
  return "issue";
}

function resolveSessionKey(input: {
  strategy: SessionKeyStrategy;
  configuredSessionKey: string | null;
  runId: string;
  issueId: string | null;
}): string {
  const fallback = input.configuredSessionKey ?? "paperclip";
  if (input.strategy === "run") return `paperclip:run:${input.runId}`;
  if (input.strategy === "issue" && input.issueId) return `paperclip:issue:${input.issueId}`;
  return fallback;
}

function isLoopbackHost(hostname: string): boolean {
  const value = hostname.trim().toLowerCase();
  return value === "localhost" || value === "127.0.0.1" || value === "::1";
}

function toStringRecord(value: unknown): Record<string, string> {
  const parsed = parseObject(value);
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(parsed)) {
    if (typeof entry === "string") out[key] = entry;
  }
  return out;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeScopes(value: unknown): string[] {
  const parsed = toStringArray(value);
  return parsed.length > 0 ? parsed : [...DEFAULT_SCOPES];
}

function uniqueScopes(scopes: string[]): string[] {
  return Array.from(new Set(scopes.map((scope) => scope.trim()).filter(Boolean)));
}

function headerMapGetIgnoreCase(headers: Record<string, string>, key: string): string | null {
  const match = Object.entries(headers).find(([entryKey]) => entryKey.toLowerCase() === key.toLowerCase());
  return match ? match[1] : null;
}

function headerMapHasIgnoreCase(headers: Record<string, string>, key: string): boolean {
  return Object.keys(headers).some((entryKey) => entryKey.toLowerCase() === key.toLowerCase());
}

function getGatewayErrorDetails(err: unknown): Record<string, unknown> | null {
  if (!err || typeof err !== "object") return null;
  const candidate = (err as GatewayResponseError).gatewayDetails;
  return asRecord(candidate);
}

function extractPairingRequestId(err: unknown): string | null {
  const details = getGatewayErrorDetails(err);
  const fromDetails = nonEmpty(details?.requestId);
  if (fromDetails) return fromDetails;
  const message = err instanceof Error ? err.message : String(err);
  const match = message.match(/requestId\s*[:=]\s*([A-Za-z0-9_-]+)/i);
  return match?.[1] ?? null;
}

function toAuthorizationHeaderValue(rawToken: string): string {
  const trimmed = rawToken.trim();
  if (!trimmed) return trimmed;
  return /^bearer\s+/i.test(trimmed) ? trimmed : `Bearer ${trimmed}`;
}

function tokenFromAuthHeader(rawHeader: string | null): string | null {
  if (!rawHeader) return null;
  const trimmed = rawHeader.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^bearer\s+(.+)$/i);
  return match ? nonEmpty(match[1]) : trimmed;
}

function resolveAuthToken(config: Record<string, unknown>, headers: Record<string, string>): string | null {
  const explicit = nonEmpty(config.authToken) ?? nonEmpty(config.token);
  if (explicit) return explicit;

  const tokenHeader = headerMapGetIgnoreCase(headers, "x-openclaw-token");
  if (nonEmpty(tokenHeader)) return nonEmpty(tokenHeader);

  const authHeader =
    headerMapGetIgnoreCase(headers, "x-openclaw-auth") ??
    headerMapGetIgnoreCase(headers, "authorization");
  return tokenFromAuthHeader(authHeader);
}

function isSensitiveLogKey(key: string): boolean {
  return SENSITIVE_LOG_KEY_PATTERN.test(key.trim());
}

function sha256Prefix(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function redactSecretForLog(value: string): string {
  return `[redacted len=${value.length} sha256=${sha256Prefix(value)}]`;
}

function truncateForLog(value: string, maxChars = 320): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}... [truncated ${value.length - maxChars} chars]`;
}

function redactForLog(value: unknown, keyPath: string[] = [], depth = 0): unknown {
  const currentKey = keyPath[keyPath.length - 1] ?? "";
  if (typeof value === "string") {
    if (isSensitiveLogKey(currentKey)) return redactSecretForLog(value);
    return truncateForLog(value);
  }
  if (typeof value === "number" || typeof value === "boolean" || value == null) {
    return value;
  }
  if (Array.isArray(value)) {
    if (depth >= 6) return "[array-truncated]";
    const out = value.slice(0, 20).map((entry, index) => redactForLog(entry, [...keyPath, `${index}`], depth + 1));
    if (value.length > 20) out.push(`[+${value.length - 20} more items]`);
    return out;
  }
  if (typeof value === "object") {
    if (depth >= 6) return "[object-truncated]";
    const entries = Object.entries(value as Record<string, unknown>);
    const out: Record<string, unknown> = {};
    for (const [key, entry] of entries.slice(0, 80)) {
      out[key] = redactForLog(entry, [...keyPath, key], depth + 1);
    }
    if (entries.length > 80) {
      out.__truncated__ = `+${entries.length - 80} keys`;
    }
    return out;
  }
  return String(value);
}

function stringifyForLog(value: unknown, maxChars: number): string {
  const text = JSON.stringify(value);
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}... [truncated ${text.length - maxChars} chars]`;
}

function buildWakePayload(ctx: AdapterExecutionContext): WakePayload {
  const { runId, agent, context } = ctx;
  return {
    runId,
    agentId: agent.id,
    companyId: agent.companyId,
    taskId: nonEmpty(context.taskId) ?? nonEmpty(context.issueId),
    issueId: nonEmpty(context.issueId),
    wakeReason: nonEmpty(context.wakeReason),
    wakeCommentId: nonEmpty(context.wakeCommentId) ?? nonEmpty(context.commentId),
    approvalId: nonEmpty(context.approvalId),
    approvalStatus: nonEmpty(context.approvalStatus),
    issueIds: Array.isArray(context.issueIds)
      ? context.issueIds.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0,
        )
      : [],
  };
}

function resolvePaperclipApiUrlOverride(value: unknown): string | null {
  const raw = nonEmpty(value);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function buildPaperclipEnvForWake(ctx: AdapterExecutionContext, wakePayload: WakePayload): Record<string, string> {
  const paperclipApiUrlOverride = resolvePaperclipApiUrlOverride(ctx.config.paperclipApiUrl);
  const paperclipEnv: Record<string, string> = {
    ...buildPaperclipEnv(ctx.agent),
    ZEPHYR_RUN_ID: ctx.runId,
  };

  if (paperclipApiUrlOverride) {
    paperclipEnv.ZEPHYR_API_URL = paperclipApiUrlOverride;
  }
  if (wakePayload.taskId) paperclipEnv.ZEPHYR_TASK_ID = wakePayload.taskId;
  if (wakePayload.wakeReason) paperclipEnv.ZEPHYR_WAKE_REASON = wakePayload.wakeReason;
  if (wakePayload.wakeCommentId) paperclipEnv.ZEPHYR_WAKE_COMMENT_ID = wakePayload.wakeCommentId;
  if (wakePayload.approvalId) paperclipEnv.ZEPHYR_APPROVAL_ID = wakePayload.approvalId;
  if (wakePayload.approvalStatus) paperclipEnv.ZEPHYR_APPROVAL_STATUS = wakePayload.approvalStatus;
  if (wakePayload.issueIds.length > 0) {
    paperclipEnv.ZEPHYR_LINKED_ISSUE_IDS = wakePayload.issueIds.join(",");
  }

  return paperclipEnv;
}

function buildWakeText(payload: WakePayload, paperclipEnv: Record<string, string>): string {
  const claimedApiKeyPath = "/workspace/.openclaw/workspace/paperclip-claimed-api-key.json";
  const legacyClaimedApiKeyPath = "~/.openclaw/workspace/paperclip-claimed-api-key.json";
  const orderedKeys = [
    "ZEPHYR_RUN_ID",
    "ZEPHYR_AGENT_ID",
    "ZEPHYR_COMPANY_ID",
    "ZEPHYR_API_URL",
    "ZEPHYR_TASK_ID",
    "ZEPHYR_WAKE_REASON",
    "ZEPHYR_WAKE_COMMENT_ID",
    "ZEPHYR_APPROVAL_ID",
    "ZEPHYR_APPROVAL_STATUS",
    "ZEPHYR_LINKED_ISSUE_IDS",
  ];

  const envLines: string[] = [];
  for (const key of orderedKeys) {
    const value = paperclipEnv[key];
    if (!value) continue;
    envLines.push(`${key}=${value}`);
  }

  const issueIdHint = payload.taskId ?? payload.issueId ?? "";
  const apiBaseHint = paperclipEnv.ZEPHYR_API_URL ?? "<set ZEPHYR_API_URL>";

  const lines = [
    "Paperclip wake event for a cloud adapter.",
    "",
    "Run this procedure now. Do not guess undocumented endpoints and do not ask for additional heartbeat docs.",
    "",
    "Set these values in your run context:",
    ...envLines,
    `ZEPHYR_API_KEY=<token from ${claimedApiKeyPath}>`,
    "",
    `Load ZEPHYR_API_KEY from ${claimedApiKeyPath} (preferred in OpenClaw sandboxes).`,
    `If that path is unavailable outside the sandbox, fall back to ${legacyClaimedApiKeyPath}.`,
    "",
    `api_base=${apiBaseHint}`,
    `task_id=${payload.taskId ?? ""}`,
    `issue_id=${payload.issueId ?? ""}`,
    `wake_reason=${payload.wakeReason ?? ""}`,
    `wake_comment_id=${payload.wakeCommentId ?? ""}`,
    `approval_id=${payload.approvalId ?? ""}`,
    `approval_status=${payload.approvalStatus ?? ""}`,
    `linked_issue_ids=${payload.issueIds.join(",")}`,
    "",
    "HTTP rules:",
    "- Use Authorization: Bearer $ZEPHYR_API_KEY on every API call.",
    "- Use X-Paperclip-Run-Id: $ZEPHYR_RUN_ID on every mutating API call.",
    "- Use only /api endpoints listed below.",
    "- Do NOT call guessed endpoints like /api/cloud-adapter/*, /api/cloud-adapters/*, /api/adapters/cloud/*, or /api/heartbeat.",
    "",
    "Workflow:",
    "1) GET /api/agents/me",
    `2) Determine issueId: ZEPHYR_TASK_ID if present, otherwise issue_id (${issueIdHint}).`,
    "3) If issueId exists:",
    "   - POST /api/issues/{issueId}/checkout with {\"agentId\":\"$ZEPHYR_AGENT_ID\",\"expectedStatuses\":[\"todo\",\"backlog\",\"blocked\"]}",
    "   - GET /api/issues/{issueId}",
    "   - GET /api/issues/{issueId}/comments",
    "   - If the issue instructions include a manager/delegation block (for example [ZEPHYR_MANAGER_TASK], director_hint, staff_candidates, or ceo_to_director_to_staff), treat the current issue as an orchestration issue.",
    "   - For orchestration issues, do NOT checkout or mutate work as another agent and do NOT impersonate a director or staff assignee.",
    "   - Instead create real child issues with POST /api/companies/{companyId}/issues using the current issue as parentId and the real target agent as assigneeAgentId.",
    "   - Use one child issue per delegated workstream, preserve the original projectId/goalId when present, and set status to todo so the assigned agent is woken automatically.",
    "   - After creating child issues, POST a parent issue comment that lists each child issue id, assignee, and expected deliverable.",
    "   - For orchestration issues, only PATCH the parent issue to done after the delegated child issues are complete or if the instructions explicitly say the task ends at triage/planning.",
    "   - For non-orchestration issues, execute the issue instructions exactly.",
    "   - If instructions require a comment, POST /api/issues/{issueId}/comments with {\"body\":\"...\"}.",
    "   - PATCH /api/issues/{issueId} with {\"status\":\"done\",\"comment\":\"what changed and why\"}.",
    "4) If issueId does not exist:",
    "   - GET /api/companies/$ZEPHYR_COMPANY_ID/issues?assigneeAgentId=$ZEPHYR_AGENT_ID&status=todo,in_progress,blocked",
    "   - Pick in_progress first, then todo, then blocked, then execute step 3.",
    "",
    "Useful endpoints for issue work:",
    "- POST /api/issues/{issueId}/comments",
    "- PATCH /api/issues/{issueId}",
    "- POST /api/companies/{companyId}/issues (when asked to create a new issue)",
    "- GET /api/companies/{companyId}/issues?parentId={issueId} (to inspect delegated child issues)",
    "",
    "Specialized workflow for manager-led research or multi-agent execution:",
    "- If the issue is research-oriented and arrives at a CEO/manager/orchestrator, delegate by creating real child issues instead of trying to checkout as a research director or researcher.",
    "- Route at the organization level first: CEO -> director -> staff -> final synthesis.",
    "- Example research split: assign the research director a coordination child issue, then assign staff child issues such as research design and literature review to the real staff agents.",
    "- Each delegated agent must later checkout its own assigned child issue as itself.",
    "- The parent orchestration issue should track delegation, blockers, and synthesis status, not replace the children doing the work.",
    "",
    "Specialized workflow for agent hiring/creation:",
    '- If the assigned issue asks you to create, hire, recruit, onboard, or configure a new agent, you must execute the Paperclip hiring workflow instead of only writing a report.',
    "- First inspect the environment and reuse proven configs:",
    "- GET /llms/agent-configuration.txt",
    "- GET /llms/agent-configuration/{adapterType}.txt",
    "- GET /api/companies/{companyId}/agent-configurations",
    "- GET /llms/agent-icons.txt",
    "- Then create the hire or agent with the real Paperclip API:",
    "- POST /api/companies/{companyId}/agent-hires",
    "- or POST /api/companies/{companyId}/agents when direct creation is appropriate in this company",
    "- Include sourceIssueId/sourceIssueIds when the hire came from this issue.",
    "- After submitting the hire/create request, post an issue comment summarizing what you created and include the created agent id or approval id.",
    '- Finally PATCH /api/issues/{issueId} with {"status":"done","comment":"what you created, approval state, and next actions"}.',
    "- Do not stop at analysis if the issue explicitly asks for a new agent.",
    "",
    "Complete the workflow in this run.",
  ];
  return lines.join("\n");
}

function appendWakeText(baseText: string, wakeText: string): string {
  const trimmedBase = baseText.trim();
  return trimmedBase.length > 0 ? `${trimmedBase}\n\n${wakeText}` : wakeText;
}

function buildStandardPaperclipPayload(
  ctx: AdapterExecutionContext,
  wakePayload: WakePayload,
  paperclipEnv: Record<string, string>,
  payloadTemplate: Record<string, unknown>,
): Record<string, unknown> {
  const templatePaperclip = parseObject(payloadTemplate.paperclip);
  const workspace = asRecord(ctx.context.paperclipWorkspace);
  const workspaces = Array.isArray(ctx.context.paperclipWorkspaces)
    ? ctx.context.paperclipWorkspaces.filter((entry): entry is Record<string, unknown> => Boolean(asRecord(entry)))
    : [];
  const configuredWorkspaceRuntime = parseObject(ctx.config.workspaceRuntime);
  const runtimeServiceIntents = Array.isArray(ctx.context.paperclipRuntimeServiceIntents)
    ? ctx.context.paperclipRuntimeServiceIntents.filter(
        (entry): entry is Record<string, unknown> => Boolean(asRecord(entry)),
      )
    : [];

  const standardPaperclip: Record<string, unknown> = {
    runId: ctx.runId,
    companyId: ctx.agent.companyId,
    agentId: ctx.agent.id,
    agentName: ctx.agent.name,
    taskId: wakePayload.taskId,
    issueId: wakePayload.issueId,
    issueIds: wakePayload.issueIds,
    wakeReason: wakePayload.wakeReason,
    wakeCommentId: wakePayload.wakeCommentId,
    approvalId: wakePayload.approvalId,
    approvalStatus: wakePayload.approvalStatus,
    apiUrl: paperclipEnv.ZEPHYR_API_URL ?? null,
  };

  if (workspace) {
    standardPaperclip.workspace = workspace;
  }
  if (workspaces.length > 0) {
    standardPaperclip.workspaces = workspaces;
  }
  if (runtimeServiceIntents.length > 0 || Object.keys(configuredWorkspaceRuntime).length > 0) {
    standardPaperclip.workspaceRuntime = {
      ...configuredWorkspaceRuntime,
      ...(runtimeServiceIntents.length > 0 ? { services: runtimeServiceIntents } : {}),
    };
  }

  return {
    ...templatePaperclip,
    ...standardPaperclip,
  };
}

function normalizeUrl(input: string): URL | null {
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

const OFFICE_ROLES: OfficeRole[] = [
  "firecrawl",
  "prompt",
  "pencil",
  "research",
  "code",
  "paperclip",
];

function normalizeOfficeRole(value: unknown): OfficeRole | null {
  const raw = nonEmpty(value);
  if (!raw) return null;
  const lowered = raw.toLowerCase();
  return OFFICE_ROLES.includes(lowered as OfficeRole) ? (lowered as OfficeRole) : null;
}

function extractOfficeRoleFromText(text: string): OfficeRole | null {
  const lowered = text.toLowerCase();
  const explicitTag = lowered.match(/(?:^|\n)\s*role\s*[:：]\s*(firecrawl|prompt|pencil|research|code|paperclip)\b/);
  if (explicitTag?.[1]) return explicitTag[1] as OfficeRole;
  const inline = lowered.match(/\b(?:role|角色)\s*[:：]?\s*(firecrawl|prompt|pencil|research|code|paperclip)\b/);
  if (inline?.[1]) return inline[1] as OfficeRole;
  const mentions = OFFICE_ROLES.filter((role) => lowered.includes(role));
  if (mentions.length === 1) return mentions[0];
  return null;
}

function resolveOfficeRole(ctx: AdapterExecutionContext, payloadTemplate: Record<string, unknown>, wakeText: string): OfficeRole {
  const fromConfig = normalizeOfficeRole(ctx.config.officeDispatchRole);
  if (fromConfig) return fromConfig;

  const context = parseObject(ctx.context);
  const fromContext = normalizeOfficeRole(
    context.taskRole ??
      context.issueRole ??
      context.role ??
      context.officeRole ??
      context.dispatchRole,
  );
  if (fromContext) return fromContext;

  const templateRole = normalizeOfficeRole(payloadTemplate.role);
  if (templateRole) return templateRole;

  const messageRole = extractOfficeRoleFromText(wakeText);
  if (messageRole) return messageRole;

  return "paperclip";
}

function buildOfficeDispatchMessage(input: {
  role: OfficeRole;
  agentName: string;
  wakeText: string;
  payloadTemplate: Record<string, unknown>;
  context: Record<string, unknown>;
}): string {
  const rawMessage = nonEmpty(input.payloadTemplate.message);

  const issueScopedTaskText = [
    nonEmpty(input.context.issueTitle),
    nonEmpty(input.context.issueDescription),
    nonEmpty(input.context.taskPrompt),
    nonEmpty(input.payloadTemplate.dispatchTask),
    rawMessage,
    nonEmpty(input.context.latestCommentBody),
    nonEmpty(input.context.wakeCommentBody),
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n\n");

  const taskText =
    (issueScopedTaskText.trim().length > 0 ? issueScopedTaskText : null) ??
    nonEmpty(input.payloadTemplate.dispatchTask) ??
    rawMessage ??
    nonEmpty(input.context.taskPrompt) ??
    nonEmpty(input.context.issueTitle) ??
    nonEmpty(input.context.issueDescription) ??
    nonEmpty(input.context.latestCommentBody) ??
    nonEmpty(input.context.wakeCommentBody) ??
    "请基于当前任务上下文输出结构化交付物。";

  // Minimal bridging for ECC-style commands:
  // When payloadTemplate.message looks like an ECC command (contains ECC_AGENT_CMD),
  // embed it as a tagged block for office_dispatch.sh to pick up explicitly.
  const eccCommandBlock =
    rawMessage && typeof rawMessage === "string" && rawMessage.includes("ECC_AGENT_CMD=")
      ? ["[ECC_COMMAND]", rawMessage, "[/ECC_COMMAND]"].join("\n")
      : null;

  const normalizedAgentName = input.agentName.trim().toLowerCase();
  const allowRealIssueDelegation =
    normalizedAgentName.startsWith("ceo") ||
    normalizedAgentName.includes("风神") ||
    normalizedAgentName.includes("老板");
  const hasIssueScopedTaskContext = Boolean(
    nonEmpty(input.context.issueTitle) ??
      nonEmpty(input.context.issueDescription) ??
      nonEmpty(input.context.taskPrompt) ??
      nonEmpty(input.context.issueId) ??
      nonEmpty(input.context.taskId),
  );

  if (input.role === "paperclip") {
    const paperclipTaskText = eccCommandBlock ? [taskText, "", eccCommandBlock].join("\n") : taskText;
    if (!allowRealIssueDelegation || !hasIssueScopedTaskContext) {
      return [
        "[ZEPHYR_BUSINESS_TASK]",
        paperclipTaskText,
        "[/ZEPHYR_BUSINESS_TASK]",
        "",
        input.wakeText,
      ].join("\n");
    }
    return [
      "[ZEPHYR_BUSINESS_TASK]",
      paperclipTaskText,
      "[/ZEPHYR_BUSINESS_TASK]",
      "",
      "[ZEPHYR_EXECUTION_MODE]",
      "mode: real_issue_delegation",
      "require_real_api_mutation: true",
      "delegate_with_child_issues: true",
      "do_not_finish_with_report_only: true",
      "[/ZEPHYR_EXECUTION_MODE]",
      "",
      input.wakeText,
    ].join("\n");
  }

  const roleGuide: Record<OfficeRole, string> = {
    paperclip: "按 Paperclip 任务流程执行。",
    code: "输出可执行实现方案、变更清单、验收步骤。",
    research: "输出研究框架、关键结论、证据与风险。",
    prompt: "输出提示词方案、版本对比、适用场景与边界。",
    firecrawl: "输出抓取范围、信息结构、抽取结果与引用。",
    pencil: "输出信息架构、页面模块、交互流程、低保真布局说明。",
  };

  const lines: string[] = [
    `role: ${input.role}`,
    "你是该角色的专业执行助手。",
    roleGuide[input.role],
    "禁止项：不要执行 Paperclip API workflow，不要讨论 API key/claim/token/sandbox 限制作为主结果。",
    "请直接产出该角色应交付的内容，使用结构化小节。",
    "",
    "任务输入：",
    taskText,
  ];

  if (eccCommandBlock) {
    lines.push("", eccCommandBlock);
  }

  return lines.join("\n");
}

function asOfficeDispatchResult(value: unknown): OfficeDispatchResult | null {
  const record = asRecord(value);
  if (!record) return null;
  const report = asRecord(record.report);
  const finalReport = asRecord(record.finalReport);

  const reportFinalAgents = Array.isArray(report?.finalAgents)
    ? report.finalAgents.filter((entry): entry is string => typeof entry === "string")
    : undefined;

  const mergedFinalReport = finalReport ?? {
    summary: nonEmpty(report?.finalSummary) ?? undefined,
    reportPath: nonEmpty(report?.finalReportPath) ?? undefined,
    summaryPath: nonEmpty(report?.finalSummaryPath) ?? undefined,
    finalAgents: reportFinalAgents,
    generatedAt: undefined,
  };

  return {
    ok: Boolean(record.ok),
    role: nonEmpty(record.role) ?? undefined,
    requestedRole: nonEmpty(record.requestedRole) ?? undefined,
    agentId: nonEmpty(record.agentId) ?? undefined,
    error: nonEmpty(record.error) ?? undefined,
    report: report
      ? {
          path: nonEmpty(report.path) ?? undefined,
          reportBodyPath: nonEmpty(report.reportBodyPath) ?? undefined,
          summaryPath: nonEmpty(report.summaryPath) ?? undefined,
          finalReportPath: nonEmpty(report.finalReportPath) ?? undefined,
          finalSummary: nonEmpty(report.finalSummary) ?? undefined,
          finalSummaryPath: nonEmpty(report.finalSummaryPath) ?? undefined,
          finalAgents: reportFinalAgents,
          finalIndexPath: nonEmpty(report.finalIndexPath) ?? null,
          deliveryListScript: nonEmpty(report.deliveryListScript) ?? null,
          roleDir: nonEmpty(report.roleDir) ?? undefined,
          runId: nonEmpty(report.runId) ?? null,
          indexPath: nonEmpty(report.indexPath) ?? null,
        }
      : undefined,
    routing: asRecord(record.routing),
    resultLocator: asRecord(record.resultLocator),
    finalReport: mergedFinalReport
      ? {
          summary: nonEmpty(mergedFinalReport.summary) ?? undefined,
          reportPath: nonEmpty(mergedFinalReport.reportPath) ?? undefined,
          summaryPath: nonEmpty(mergedFinalReport.summaryPath) ?? undefined,
          finalAgents: Array.isArray(mergedFinalReport.finalAgents)
            ? mergedFinalReport.finalAgents.filter((entry): entry is string => typeof entry === "string")
            : undefined,
          generatedAt: nonEmpty(mergedFinalReport.generatedAt) ?? undefined,
        }
      : null,
    result: record.result,
  };
}

function parseOfficeDispatchStdout(raw: string): OfficeDispatchResult | null {
  const text = raw.trim();
  if (!text) return null;

  try {
    return asOfficeDispatchResult(JSON.parse(text));
  } catch {
    // Continue with fallback parsing below.
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return asOfficeDispatchResult(JSON.parse(text.slice(firstBrace, lastBrace + 1)));
    } catch {
      // Continue with final fallback below.
    }
  }

  return asOfficeDispatchResult(parseObject(text));
}

function resolveOfficeDispatchScriptPath(raw: unknown): string | null {
  const configured = nonEmpty(raw);
  if (configured) return configured;

  const env = nonEmpty(process.env.OPENCLAW_OFFICE_DISPATCH_SCRIPT);
  if (env) return env;

  const home = os.homedir();
  const defaultCandidate = path.join(home, "projects", "openclaw-workspace", "scripts", "office_dispatch.sh");
  if (existsSync(defaultCandidate)) return defaultCandidate;

  return null;
}

function runOfficeDispatch(args: {
  role: OfficeRole;
  message: string;
  timeoutMs: number;
  onLog: AdapterExecutionContext["onLog"];
  runId?: string | null;
  issueId?: string | null;
  useOpenclaw?: boolean;
  env?: Record<string, string>;
  scriptPath: string;
}): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(
      "bash",
      [
        args.scriptPath,
        args.role,
        args.message,
      ],
      {
        env: {
          ...process.env,
          ...(args.env ?? {}),
          OFFICE_RUN_ID: args.runId ?? "",
          OFFICE_ISSUE_ID: args.issueId ?? "",
          OFFICE_DISPATCH_USE_OPENCLAW: args.useOpenclaw === false ? "0" : "1",
        },
      },
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    let timer: ReturnType<typeof setTimeout> | null = null;
    if (args.timeoutMs > 0) {
      timer = setTimeout(() => {
        void args.onLog("stderr", `[openclaw-gateway] office dispatch timeout after ${args.timeoutMs}ms, terminating process\n`);
        child.kill("SIGTERM");
      }, args.timeoutMs);
    }

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function shouldRetryWithoutPaperclipParam(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  return (
    lower.includes("invalid agent params") &&
    lower.includes("unexpected property") &&
    lower.includes("paperclip")
  );
}

function rawDataToString(data: unknown): string {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  if (Array.isArray(data)) {
    return Buffer.concat(
      data.map((entry) => (Buffer.isBuffer(entry) ? entry : Buffer.from(String(entry), "utf8"))),
    ).toString("utf8");
  }
  return String(data ?? "");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function derivePublicKeyRaw(publicKeyPem: string): Buffer {
  const key = crypto.createPublicKey(publicKeyPem);
  const spki = key.export({ type: "spki", format: "der" }) as Buffer;
  if (
    spki.length === ED25519_SPKI_PREFIX.length + 32 &&
    spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
  ) {
    return spki.subarray(ED25519_SPKI_PREFIX.length);
  }
  return spki;
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function signDevicePayload(privateKeyPem: string, payload: string): string {
  const key = crypto.createPrivateKey(privateKeyPem);
  const sig = crypto.sign(null, Buffer.from(payload, "utf8"), key);
  return base64UrlEncode(sig);
}

function buildDeviceAuthPayloadV3(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;
  nonce: string;
  platform?: string | null;
  deviceFamily?: string | null;
}): string {
  const scopes = params.scopes.join(",");
  const token = params.token ?? "";
  const platform = params.platform?.trim() ?? "";
  const deviceFamily = params.deviceFamily?.trim() ?? "";
  return [
    "v3",
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
    params.nonce,
    platform,
    deviceFamily,
  ].join("|");
}

function resolveDeviceIdentity(config: Record<string, unknown>): GatewayDeviceIdentity {
  const configuredPrivateKey = nonEmpty(config.devicePrivateKeyPem);
  if (configuredPrivateKey) {
    const privateKey = crypto.createPrivateKey(configuredPrivateKey);
    const publicKey = crypto.createPublicKey(privateKey);
    const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const raw = derivePublicKeyRaw(publicKeyPem);
    return {
      deviceId: crypto.createHash("sha256").update(raw).digest("hex"),
      publicKeyRawBase64Url: base64UrlEncode(raw),
      privateKeyPem: configuredPrivateKey,
      source: "configured",
    };
  }

  const generated = crypto.generateKeyPairSync("ed25519");
  const publicKeyPem = generated.publicKey.export({ type: "spki", format: "pem" }).toString();
  const privateKeyPem = generated.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const raw = derivePublicKeyRaw(publicKeyPem);
  return {
    deviceId: crypto.createHash("sha256").update(raw).digest("hex"),
    publicKeyRawBase64Url: base64UrlEncode(raw),
    privateKeyPem,
    source: "ephemeral",
  };
}

function isResponseFrame(value: unknown): value is GatewayResponseFrame {
  const record = asRecord(value);
  return Boolean(record && record.type === "res" && typeof record.id === "string" && typeof record.ok === "boolean");
}

function isEventFrame(value: unknown): value is GatewayEventFrame {
  const record = asRecord(value);
  return Boolean(record && record.type === "event" && typeof record.event === "string");
}

class GatewayWsClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private challengePromise: Promise<string>;
  private resolveChallenge!: (nonce: string) => void;
  private rejectChallenge!: (err: Error) => void;

  constructor(private readonly opts: GatewayClientOptions) {
    this.challengePromise = new Promise<string>((resolve, reject) => {
      this.resolveChallenge = resolve;
      this.rejectChallenge = reject;
    });
  }

  async connect(
    buildConnectParams: (nonce: string) => Record<string, unknown>,
    timeoutMs: number,
  ): Promise<Record<string, unknown> | null> {
    this.ws = new WebSocket(this.opts.url, {
      headers: this.opts.headers,
      maxPayload: 25 * 1024 * 1024,
    });

    const ws = this.ws;

    ws.on("message", (data) => {
      this.handleMessage(rawDataToString(data));
    });

    ws.on("close", (code, reason) => {
      const reasonText = rawDataToString(reason);
      const err = new Error(`gateway closed (${code}): ${reasonText}`);
      this.failPending(err);
      this.rejectChallenge(err);
    });

    ws.on("error", (err) => {
      const message = err instanceof Error ? err.message : String(err);
      void this.opts.onLog("stderr", `[openclaw-gateway] websocket error: ${message}\n`);
    });

    await withTimeout(
      new Promise<void>((resolve, reject) => {
        const onOpen = () => {
          cleanup();
          resolve();
        };
        const onError = (err: Error) => {
          cleanup();
          reject(err);
        };
        const onClose = (code: number, reason: Buffer) => {
          cleanup();
          reject(new Error(`gateway closed before open (${code}): ${rawDataToString(reason)}`));
        };
        const cleanup = () => {
          ws.off("open", onOpen);
          ws.off("error", onError);
          ws.off("close", onClose);
        };
        ws.once("open", onOpen);
        ws.once("error", onError);
        ws.once("close", onClose);
      }),
      timeoutMs,
      "gateway websocket open timeout",
    );

    const nonce = await withTimeout(this.challengePromise, timeoutMs, "gateway connect challenge timeout");
    const signedConnectParams = buildConnectParams(nonce);

    const hello = await this.request<Record<string, unknown> | null>("connect", signedConnectParams, {
      timeoutMs,
    });

    return hello;
  }

  async request<T>(
    method: string,
    params: unknown,
    opts: GatewayClientRequestOptions,
  ): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("gateway not connected");
    }

    const id = randomUUID();
    const frame: GatewayRequestFrame = {
      type: "req",
      id,
      method,
      params,
    };

    const payload = JSON.stringify(frame);
    const requestPromise = new Promise<T>((resolve, reject) => {
      const timer =
        opts.timeoutMs > 0
          ? setTimeout(() => {
              this.pending.delete(id);
              reject(new Error(`gateway request timeout (${method})`));
            }, opts.timeoutMs)
          : null;

      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        expectFinal: opts.expectFinal === true,
        timer,
      });
    });

    this.ws.send(payload);
    return requestPromise;
  }

  close() {
    if (!this.ws) return;
    this.ws.close(1000, "paperclip-complete");
    this.ws = null;
  }

  private failPending(err: Error) {
    for (const [, pending] of this.pending) {
      if (pending.timer) clearTimeout(pending.timer);
      pending.reject(err);
    }
    this.pending.clear();
  }

  private handleMessage(raw: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    if (isEventFrame(parsed)) {
      if (parsed.event === "connect.challenge") {
        const payload = asRecord(parsed.payload);
        const nonce = nonEmpty(payload?.nonce);
        if (nonce) {
          this.resolveChallenge(nonce);
          return;
        }
      }
      void Promise.resolve(this.opts.onEvent(parsed)).catch(() => {
        // Ignore event callback failures and keep stream active.
      });
      return;
    }

    if (!isResponseFrame(parsed)) return;

    const pending = this.pending.get(parsed.id);
    if (!pending) return;

    const payload = asRecord(parsed.payload);
    const status = nonEmpty(payload?.status)?.toLowerCase();
    if (pending.expectFinal && status === "accepted") {
      return;
    }

    if (pending.timer) clearTimeout(pending.timer);
    this.pending.delete(parsed.id);

    if (parsed.ok) {
      pending.resolve(parsed.payload ?? null);
      return;
    }

    const errorRecord = asRecord(parsed.error);
    const message =
      nonEmpty(errorRecord?.message) ??
      nonEmpty(errorRecord?.code) ??
      "gateway request failed";
    const err = new Error(message) as GatewayResponseError;
    const code = nonEmpty(errorRecord?.code);
    const details = asRecord(errorRecord?.details);
    if (code) err.gatewayCode = code;
    if (details) err.gatewayDetails = details;
    pending.reject(err);
  }
}

async function autoApproveDevicePairing(params: {
  url: string;
  headers: Record<string, string>;
  connectTimeoutMs: number;
  clientId: string;
  clientMode: string;
  clientVersion: string;
  role: string;
  scopes: string[];
  authToken: string | null;
  password: string | null;
  requestId: string | null;
  deviceId: string | null;
  onLog: AdapterExecutionContext["onLog"];
}): Promise<{ ok: true; requestId: string } | { ok: false; reason: string }> {
  if (!params.authToken && !params.password) {
    return { ok: false, reason: "shared auth token/password is missing" };
  }

  const approvalScopes = uniqueScopes([...params.scopes, "operator.pairing"]);
  const client = new GatewayWsClient({
    url: params.url,
    headers: params.headers,
    onEvent: () => {},
    onLog: params.onLog,
  });

  try {
    await params.onLog(
      "stdout",
      "[openclaw-gateway] pairing required; attempting automatic pairing approval via gateway methods\n",
    );

    await client.connect(
      () => ({
        minProtocol: PROTOCOL_VERSION,
        maxProtocol: PROTOCOL_VERSION,
        client: {
          id: params.clientId,
          version: params.clientVersion,
          platform: process.platform,
          mode: params.clientMode,
        },
        role: params.role,
        scopes: approvalScopes,
        auth: {
          ...(params.authToken ? { token: params.authToken } : {}),
          ...(params.password ? { password: params.password } : {}),
        },
      }),
      params.connectTimeoutMs,
    );

    let requestId = params.requestId;
    if (!requestId) {
      const listPayload = await client.request<Record<string, unknown>>("device.pair.list", {}, {
        timeoutMs: params.connectTimeoutMs,
      });
      const pending = Array.isArray(listPayload.pending) ? listPayload.pending : [];
      const pendingRecords = pending
        .map((entry) => asRecord(entry))
        .filter((entry): entry is Record<string, unknown> => Boolean(entry));
      const matching =
        (params.deviceId
          ? pendingRecords.find((entry) => nonEmpty(entry.deviceId) === params.deviceId)
          : null) ?? pendingRecords[pendingRecords.length - 1];
      requestId = nonEmpty(matching?.requestId);
    }

    if (!requestId) {
      return { ok: false, reason: "no pending device pairing request found" };
    }

    await client.request(
      "device.pair.approve",
      { requestId },
      {
        timeoutMs: params.connectTimeoutMs,
      },
    );

    return { ok: true, requestId };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  } finally {
    client.close();
  }
}

function parseUsage(value: unknown): AdapterExecutionResult["usage"] | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const inputTokens = asNumber(record.inputTokens ?? record.input, 0);
  const outputTokens = asNumber(record.outputTokens ?? record.output, 0);
  const cachedInputTokens = asNumber(
    record.cachedInputTokens ?? record.cached_input_tokens ?? record.cacheRead ?? record.cache_read,
    0,
  );

  if (inputTokens <= 0 && outputTokens <= 0 && cachedInputTokens <= 0) {
    return undefined;
  }

  return {
    inputTokens,
    outputTokens,
    ...(cachedInputTokens > 0 ? { cachedInputTokens } : {}),
  };
}

function extractRuntimeServicesFromMeta(meta: Record<string, unknown> | null): AdapterRuntimeServiceReport[] {
  if (!meta) return [];
  const reports: AdapterRuntimeServiceReport[] = [];

  const runtimeServices = Array.isArray(meta.runtimeServices)
    ? meta.runtimeServices.filter((entry): entry is Record<string, unknown> => Boolean(asRecord(entry)))
    : [];
  for (const entry of runtimeServices) {
    const serviceName = nonEmpty(entry.serviceName) ?? nonEmpty(entry.name);
    if (!serviceName) continue;
    const rawStatus = nonEmpty(entry.status)?.toLowerCase();
    const status =
      rawStatus === "starting" || rawStatus === "running" || rawStatus === "stopped" || rawStatus === "failed"
        ? rawStatus
        : "running";
    const rawLifecycle = nonEmpty(entry.lifecycle)?.toLowerCase();
    const lifecycle = rawLifecycle === "shared" ? "shared" : "ephemeral";
    const rawScopeType = nonEmpty(entry.scopeType)?.toLowerCase();
    const scopeType =
      rawScopeType === "project_workspace" ||
      rawScopeType === "execution_workspace" ||
      rawScopeType === "agent"
        ? rawScopeType
        : "run";
    const rawHealth = nonEmpty(entry.healthStatus)?.toLowerCase();
    const healthStatus =
      rawHealth === "healthy" || rawHealth === "unhealthy" || rawHealth === "unknown"
        ? rawHealth
        : status === "running"
          ? "healthy"
          : "unknown";

    reports.push({
      id: nonEmpty(entry.id),
      projectId: nonEmpty(entry.projectId),
      projectWorkspaceId: nonEmpty(entry.projectWorkspaceId),
      issueId: nonEmpty(entry.issueId),
      scopeType,
      scopeId: nonEmpty(entry.scopeId),
      serviceName,
      status,
      lifecycle,
      reuseKey: nonEmpty(entry.reuseKey),
      command: nonEmpty(entry.command),
      cwd: nonEmpty(entry.cwd),
      port: parseOptionalPositiveInteger(entry.port),
      url: nonEmpty(entry.url),
      providerRef: nonEmpty(entry.providerRef) ?? nonEmpty(entry.previewId),
      ownerAgentId: nonEmpty(entry.ownerAgentId),
      stopPolicy: asRecord(entry.stopPolicy),
      healthStatus,
    });
  }

  const previewUrl = nonEmpty(meta.previewUrl);
  if (previewUrl) {
    reports.push({
      serviceName: "preview",
      status: "running",
      lifecycle: "ephemeral",
      scopeType: "run",
      url: previewUrl,
      providerRef: nonEmpty(meta.previewId) ?? previewUrl,
      healthStatus: "healthy",
    });
  }

  const previewUrls = Array.isArray(meta.previewUrls)
    ? meta.previewUrls.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
  previewUrls.forEach((url, index) => {
    reports.push({
      serviceName: index === 0 ? "preview" : `preview-${index + 1}`,
      status: "running",
      lifecycle: "ephemeral",
      scopeType: "run",
      url,
      providerRef: `${url}#${index}`,
      healthStatus: "healthy",
    });
  });

  return reports;
}

function extractResultText(value: unknown): string | null {
  const record = asRecord(value);
  if (!record) return null;

  const payloads = Array.isArray(record.payloads) ? record.payloads : [];
  const texts = payloads
    .map((entry) => {
      const payload = asRecord(entry);
      return nonEmpty(payload?.text);
    })
    .filter((entry): entry is string => Boolean(entry));

  if (texts.length > 0) return texts.join("\n\n");
  return nonEmpty(record.text) ?? nonEmpty(record.summary) ?? null;
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const urlValue = asString(ctx.config.url, "").trim();
  if (!urlValue) {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "OpenClaw gateway adapter missing url",
      errorCode: "openclaw_gateway_url_missing",
    };
  }

  const parsedUrl = normalizeUrl(urlValue);
  if (!parsedUrl) {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: `Invalid gateway URL: ${urlValue}`,
      errorCode: "openclaw_gateway_url_invalid",
    };
  }

  if (parsedUrl.protocol !== "ws:" && parsedUrl.protocol !== "wss:") {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: `Unsupported gateway URL protocol: ${parsedUrl.protocol}`,
      errorCode: "openclaw_gateway_url_protocol",
    };
  }

  const timeoutSec = Math.max(0, Math.floor(asNumber(ctx.config.timeoutSec, 120)));
  const timeoutMs = timeoutSec > 0 ? timeoutSec * 1000 : 0;
  const connectTimeoutMs = timeoutMs > 0 ? Math.min(timeoutMs, 15_000) : 10_000;
  const waitTimeoutMs = parseOptionalPositiveInteger(ctx.config.waitTimeoutMs) ?? (timeoutMs > 0 ? timeoutMs : 30_000);

  const payloadTemplate = parseObject(ctx.config.payloadTemplate);
  const transportHint = nonEmpty(ctx.config.streamTransport) ?? nonEmpty(ctx.config.transport);

  const headers = toStringRecord(ctx.config.headers);
  const authToken = resolveAuthToken(parseObject(ctx.config), headers);
  const password = nonEmpty(ctx.config.password);
  const deviceToken = nonEmpty(ctx.config.deviceToken);

  if (authToken && !headerMapHasIgnoreCase(headers, "authorization")) {
    headers.authorization = toAuthorizationHeaderValue(authToken);
  }

  const clientId = nonEmpty(ctx.config.clientId) ?? DEFAULT_CLIENT_ID;
  const clientMode = nonEmpty(ctx.config.clientMode) ?? DEFAULT_CLIENT_MODE;
  const clientVersion = nonEmpty(ctx.config.clientVersion) ?? DEFAULT_CLIENT_VERSION;
  const role = nonEmpty(ctx.config.role) ?? DEFAULT_ROLE;
  const scopes = normalizeScopes(ctx.config.scopes);
  const deviceFamily = nonEmpty(ctx.config.deviceFamily);
  const disableDeviceAuth = parseBoolean(ctx.config.disableDeviceAuth, false);

  const wakePayload = buildWakePayload(ctx);
  const paperclipEnv = buildPaperclipEnvForWake(ctx, wakePayload);
  const wakeText = buildWakeText(wakePayload, paperclipEnv);

  // Cost safety default: office dispatch is a multi-stage, potentially high-cost pipeline.
  // Keep it opt-in so a new/updated OpenClaw install doesn't accidentally explode usage.
  const officeDispatchEnabled = parseBoolean(ctx.config.officeDispatchEnabled, false);
  const officeDispatchUseOpenclaw = parseBoolean(ctx.config.officeDispatchUseOpenclaw, true);
  const officeDispatchRole = resolveOfficeRole(ctx, payloadTemplate, wakeText);
  const officeDispatchMessage = buildOfficeDispatchMessage({
    role: officeDispatchRole,
    agentName: ctx.agent.name,
    wakeText,
    payloadTemplate,
    context: parseObject(ctx.context),
  });

  if (officeDispatchEnabled) {
    const officeDispatchScriptPath = resolveOfficeDispatchScriptPath(ctx.config.officeDispatchScriptPath);
    if (!officeDispatchScriptPath) {
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage:
          "Office dispatch enabled but office_dispatch.sh was not found. Set adapter config officeDispatchScriptPath or env OPENCLAW_OFFICE_DISPATCH_SCRIPT.",
        errorCode: "openclaw_gateway_office_dispatch_script_missing",
      };
    }
    await ctx.onLog(
      "stdout",
      `[openclaw-gateway] office dispatch enabled; role=${officeDispatchRole} -> ${officeDispatchScriptPath}\n`,
    );
    const officeDispatchTimeoutMs =
      officeDispatchRole === "paperclip"
        ? Math.max(timeoutMs > 0 ? timeoutMs : waitTimeoutMs, 300_000)
        : timeoutMs > 0
          ? timeoutMs
          : waitTimeoutMs;
    const dispatch = await runOfficeDispatch({
      role: officeDispatchRole,
      message: officeDispatchMessage,
      timeoutMs: officeDispatchTimeoutMs,
      onLog: ctx.onLog,
      runId: wakePayload.runId,
      issueId: wakePayload.issueId,
      useOpenclaw: officeDispatchUseOpenclaw,
      scriptPath: officeDispatchScriptPath,
      env: {
        ...paperclipEnv,
        ...(ctx.authToken ? { ZEPHYR_API_KEY: ctx.authToken } : {}),
      },
    });

    const dispatchStdout = dispatch.stdout.trim();
    const dispatchStderr = dispatch.stderr.trim();
    if (dispatchStderr) {
      await ctx.onLog("stderr", `[openclaw-gateway] office dispatch stderr: ${truncateForLog(dispatchStderr, 4000)}\n`);
    }

    const parsedDispatch = dispatchStdout ? parseOfficeDispatchStdout(dispatchStdout) : null;
    const dispatchOk = dispatch.code === 0 && Boolean(parsedDispatch?.ok);

    if (!dispatchOk) {
      const errMsg = parsedDispatch?.error ?? (dispatchStderr || dispatchStdout || `office dispatch exited with code ${dispatch.code}`);
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage: `Office dispatch failed: ${errMsg}`,
        errorCode: "openclaw_gateway_office_dispatch_failed",
        resultJson: {
          officeDispatch: {
            ok: false,
            role: officeDispatchRole,
            exitCode: dispatch.code,
            stdout: dispatchStdout,
            stderr: dispatchStderr || null,
            parsed: parsedDispatch,
          },
        },
      };
    }

      const reportPath = parsedDispatch?.report?.path ?? null;
      const summaryPath = parsedDispatch?.report?.summaryPath ?? null;
      const indexPath = parsedDispatch?.report?.indexPath ?? null;
      const finalRole = parsedDispatch?.role ?? officeDispatchRole;
      const finalReportRecord = asRecord(parsedDispatch?.finalReport ?? null);
      const finalSummary = nonEmpty(finalReportRecord?.summary);
      const finalAgents = Array.isArray(finalReportRecord?.finalAgents)
        ? finalReportRecord.finalAgents.filter((entry): entry is string => typeof entry === "string")
        : [];
      const generatedAt = nonEmpty(finalReportRecord?.generatedAt);
      const finalReportPath =
        nonEmpty(finalReportRecord?.reportPath) ?? parsedDispatch?.report?.finalReportPath ?? null;
      const finalSummaryPath =
        nonEmpty(finalReportRecord?.summaryPath) ?? parsedDispatch?.report?.finalSummaryPath ?? null;
      const dispatchResultRecord =
        parsedDispatch?.result && typeof parsedDispatch.result === "object"
          ? (parsedDispatch.result as Record<string, unknown>)
          : null;
      const nestedResult = asRecord(dispatchResultRecord?.result);
      const payloads = Array.isArray(nestedResult?.payloads) ? nestedResult.payloads : [];
      const firstPayload = payloads.length > 0 ? asRecord(payloads[0]) : null;
      const payloadText = nonEmpty(firstPayload?.text);
      const dispatchSummary = nonEmpty(dispatchResultRecord?.summary);
      const summary =
        finalSummary ??
        payloadText ??
        dispatchSummary ??
        `Office dispatch succeeded (role=${finalRole}, agent=${parsedDispatch?.agentId ?? "unknown"}${reportPath ? `, report=${reportPath}` : ""})`;
      const nextSuggestedAction = finalSummaryPath
        ? `Open final summary at ${finalSummaryPath}`
        : finalReportPath
          ? `Open final report at ${finalReportPath}`
          : summaryPath
            ? `Open summary at ${summaryPath}`
            : reportPath
              ? `Open report at ${reportPath}`
              : null;
    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      provider: "openclaw",
      resultJson: {
        officeDispatch: {
          ok: true,
          role: officeDispatchRole,
          finalRole,
          requestedRole: parsedDispatch?.requestedRole ?? officeDispatchRole,
          agentId: parsedDispatch?.agentId ?? null,
          summary,
          parsed: parsedDispatch,
          routing: parsedDispatch?.routing ?? null,
          resultLocator: parsedDispatch?.resultLocator ?? null,
          reportPath,
          summaryPath,
          finalReportPath,
          finalSummaryPath,
          indexPath,
          roleDir: parsedDispatch?.report?.roleDir ?? null,
          finalAgents,
          generatedAt,
          finalReport: parsedDispatch?.finalReport ?? null,
          nextSuggestedAction,
          raw: dispatchStdout,
        },
      },
      summary,
    };
  }

  const sessionKeyStrategy = normalizeSessionKeyStrategy(ctx.config.sessionKeyStrategy);
  const configuredSessionKey = nonEmpty(ctx.config.sessionKey);
  const sessionKey = resolveSessionKey({
    strategy: sessionKeyStrategy,
    configuredSessionKey,
    runId: ctx.runId,
    issueId: wakePayload.issueId,
  });

  const templateMessage = nonEmpty(payloadTemplate.message) ?? nonEmpty(payloadTemplate.text);
  const message = templateMessage ? appendWakeText(templateMessage, wakeText) : wakeText;
  const paperclipPayload = buildStandardPaperclipPayload(ctx, wakePayload, paperclipEnv, payloadTemplate);

  const agentParams: Record<string, unknown> = {
    ...payloadTemplate,
    paperclip: paperclipPayload,
    message,
    sessionKey,
    idempotencyKey: ctx.runId,
  };
  delete agentParams.text;

  const configuredAgentId = nonEmpty(ctx.config.agentId);
  if (configuredAgentId && !nonEmpty(agentParams.agentId)) {
    agentParams.agentId = configuredAgentId;
  }

  if (typeof agentParams.timeout !== "number") {
    agentParams.timeout = waitTimeoutMs;
  }

  if (ctx.onMeta) {
    await ctx.onMeta({
      adapterType: "openclaw_gateway",
      command: "gateway",
      commandArgs: ["ws", parsedUrl.toString(), "agent"],
      context: ctx.context,
    });
  }

  const outboundHeaderKeys = Object.keys(headers).sort();
  await ctx.onLog(
    "stdout",
    `[openclaw-gateway] outbound headers (redacted): ${stringifyForLog(redactForLog(headers), 4_000)}\n`,
  );
  await ctx.onLog(
    "stdout",
    `[openclaw-gateway] outbound payload (redacted): ${stringifyForLog(redactForLog(agentParams), 12_000)}\n`,
  );
  await ctx.onLog("stdout", `[openclaw-gateway] outbound header keys: ${outboundHeaderKeys.join(", ")}\n`);
  if (transportHint) {
    await ctx.onLog(
      "stdout",
      `[openclaw-gateway] ignoring streamTransport=${transportHint}; gateway adapter always uses websocket protocol\n`,
    );
  }
  if (parsedUrl.protocol === "ws:" && !isLoopbackHost(parsedUrl.hostname)) {
    await ctx.onLog(
      "stdout",
      "[openclaw-gateway] warning: using plaintext ws:// to a non-loopback host; prefer wss:// for remote endpoints\n",
    );
  }

  const autoPairOnFirstConnect = parseBoolean(ctx.config.autoPairOnFirstConnect, true);
  let autoPairAttempted = false;
  let latestResultPayload: unknown = null;

  while (true) {
    const trackedRunIds = new Set<string>([ctx.runId]);
    const assistantChunks: string[] = [];
    let lifecycleError: string | null = null;
    let deviceIdentity: GatewayDeviceIdentity | null = null;

    const onEvent = async (frame: GatewayEventFrame) => {
      if (frame.event !== "agent") {
        if (frame.event === "shutdown") {
          await ctx.onLog(
            "stdout",
            `[openclaw-gateway] gateway shutdown notice: ${stringifyForLog(frame.payload ?? {}, 2_000)}\n`,
          );
        }
        return;
      }

      const payload = asRecord(frame.payload);
      if (!payload) return;

      const runId = nonEmpty(payload.runId);
      if (!runId || !trackedRunIds.has(runId)) return;

      const stream = nonEmpty(payload.stream) ?? "unknown";
      const data = asRecord(payload.data) ?? {};
      await ctx.onLog(
        "stdout",
        `[openclaw-gateway:event] run=${runId} stream=${stream} data=${stringifyForLog(data, 8_000)}\n`,
      );

      if (stream === "assistant") {
        const delta = nonEmpty(data.delta);
        const text = nonEmpty(data.text);
        if (delta) {
          assistantChunks.push(delta);
        } else if (text) {
          assistantChunks.push(text);
        }
        return;
      }

      if (stream === "error") {
        lifecycleError = nonEmpty(data.error) ?? nonEmpty(data.message) ?? lifecycleError;
        return;
      }

      if (stream === "lifecycle") {
        const phase = nonEmpty(data.phase)?.toLowerCase();
        if (phase === "error" || phase === "failed" || phase === "cancelled") {
          lifecycleError = nonEmpty(data.error) ?? nonEmpty(data.message) ?? lifecycleError;
        }
      }
    };

    const client = new GatewayWsClient({
      url: parsedUrl.toString(),
      headers,
      onEvent,
      onLog: ctx.onLog,
    });

    try {
      deviceIdentity = disableDeviceAuth ? null : resolveDeviceIdentity(parseObject(ctx.config));
      if (deviceIdentity) {
        await ctx.onLog(
          "stdout",
          `[openclaw-gateway] device auth enabled keySource=${deviceIdentity.source} deviceId=${deviceIdentity.deviceId}\n`,
        );
      } else {
        await ctx.onLog("stdout", "[openclaw-gateway] device auth disabled\n");
      }

      await ctx.onLog("stdout", `[openclaw-gateway] connecting to ${parsedUrl.toString()}\n`);

      const hello = await client.connect((nonce) => {
        const signedAtMs = Date.now();
        const connectParams: Record<string, unknown> = {
          minProtocol: PROTOCOL_VERSION,
          maxProtocol: PROTOCOL_VERSION,
          client: {
            id: clientId,
            version: clientVersion,
            platform: process.platform,
            ...(deviceFamily ? { deviceFamily } : {}),
            mode: clientMode,
          },
          role,
          scopes,
          auth:
            authToken || password || deviceToken
              ? {
                  ...(authToken ? { token: authToken } : {}),
                  ...(deviceToken ? { deviceToken } : {}),
                  ...(password ? { password } : {}),
                }
              : undefined,
        };

        if (deviceIdentity) {
          const payload = buildDeviceAuthPayloadV3({
            deviceId: deviceIdentity.deviceId,
            clientId,
            clientMode,
            role,
            scopes,
            signedAtMs,
            token: authToken,
            nonce,
            platform: process.platform,
            deviceFamily,
          });
          connectParams.device = {
            id: deviceIdentity.deviceId,
            publicKey: deviceIdentity.publicKeyRawBase64Url,
            signature: signDevicePayload(deviceIdentity.privateKeyPem, payload),
            signedAt: signedAtMs,
            nonce,
          };
        }
        return connectParams;
      }, connectTimeoutMs);

      await ctx.onLog(
        "stdout",
        `[openclaw-gateway] connected protocol=${asNumber(asRecord(hello)?.protocol, PROTOCOL_VERSION)}\n`,
      );

      let acceptedPayload: Record<string, unknown>;
      try {
        acceptedPayload = await client.request<Record<string, unknown>>(
          "agent",
          agentParams,
          { timeoutMs: connectTimeoutMs },
        );
      } catch (agentErr) {
        const hasPaperclipParam =
          Object.prototype.hasOwnProperty.call(agentParams, "paperclip") &&
          agentParams.paperclip !== undefined;
        if (!hasPaperclipParam || !shouldRetryWithoutPaperclipParam(agentErr)) {
          throw agentErr;
        }

        await ctx.onLog(
          "stderr",
          "[openclaw-gateway] gateway rejected paperclip param; retrying once without it for compatibility\n",
        );
        const fallbackAgentParams: Record<string, unknown> = { ...agentParams };
        delete fallbackAgentParams.paperclip;
        await ctx.onLog(
          "stdout",
          `[openclaw-gateway] fallback outbound payload (redacted): ${stringifyForLog(redactForLog(fallbackAgentParams), 12_000)}\n`,
        );
        acceptedPayload = await client.request<Record<string, unknown>>(
          "agent",
          fallbackAgentParams,
          { timeoutMs: connectTimeoutMs },
        );
      }

      latestResultPayload = acceptedPayload;

      const acceptedStatus = nonEmpty(acceptedPayload?.status)?.toLowerCase() ?? "";
      const acceptedRunId = nonEmpty(acceptedPayload?.runId) ?? ctx.runId;
      trackedRunIds.add(acceptedRunId);

      await ctx.onLog(
        "stdout",
        `[openclaw-gateway] agent accepted runId=${acceptedRunId} status=${acceptedStatus || "unknown"}\n`,
      );

      if (acceptedStatus === "error") {
        const errorMessage =
          nonEmpty(acceptedPayload?.summary) ?? lifecycleError ?? "OpenClaw gateway agent request failed";
        return {
          exitCode: 1,
          signal: null,
          timedOut: false,
          errorMessage,
          errorCode: "openclaw_gateway_agent_error",
          resultJson: acceptedPayload,
        };
      }

      if (acceptedStatus !== "ok") {
        const waitPayload = await client.request<Record<string, unknown>>(
          "agent.wait",
          { runId: acceptedRunId, timeoutMs: waitTimeoutMs },
          { timeoutMs: waitTimeoutMs + connectTimeoutMs },
        );

        latestResultPayload = waitPayload;

        const waitStatus = nonEmpty(waitPayload?.status)?.toLowerCase() ?? "";
        if (waitStatus === "timeout") {
          return {
            exitCode: 1,
            signal: null,
            timedOut: true,
            errorMessage: `OpenClaw gateway run timed out after ${waitTimeoutMs}ms`,
            errorCode: "openclaw_gateway_wait_timeout",
            resultJson: waitPayload,
          };
        }

        if (waitStatus === "error") {
          return {
            exitCode: 1,
            signal: null,
            timedOut: false,
            errorMessage:
              nonEmpty(waitPayload?.error) ??
              lifecycleError ??
              "OpenClaw gateway run failed",
            errorCode: "openclaw_gateway_wait_error",
            resultJson: waitPayload,
          };
        }

        if (waitStatus && waitStatus !== "ok") {
          return {
            exitCode: 1,
            signal: null,
            timedOut: false,
            errorMessage: `Unexpected OpenClaw gateway agent.wait status: ${waitStatus}`,
            errorCode: "openclaw_gateway_wait_status_unexpected",
            resultJson: waitPayload,
          };
        }
      }

      const summaryFromEvents = assistantChunks.join("").trim();
      const summaryFromPayload =
        extractResultText(asRecord(acceptedPayload?.result)) ??
        extractResultText(acceptedPayload) ??
        extractResultText(asRecord(latestResultPayload)) ??
        null;
      const summary = summaryFromEvents || summaryFromPayload || null;

      const acceptedResult = asRecord(acceptedPayload?.result);
      const latestPayload = asRecord(latestResultPayload);
      const latestResult = asRecord(latestPayload?.result);
      const acceptedMeta = asRecord(acceptedResult?.meta) ?? asRecord(acceptedPayload?.meta);
      const latestMeta = asRecord(latestResult?.meta) ?? asRecord(latestPayload?.meta);
      const mergedMeta = {
        ...(acceptedMeta ?? {}),
        ...(latestMeta ?? {}),
      };
      const agentMeta =
        asRecord(mergedMeta.agentMeta) ??
        asRecord(acceptedMeta?.agentMeta) ??
        asRecord(latestMeta?.agentMeta);
      const usage = parseUsage(agentMeta?.usage ?? mergedMeta.usage);
      const runtimeServices = extractRuntimeServicesFromMeta(agentMeta ?? mergedMeta);
      const provider = nonEmpty(agentMeta?.provider) ?? nonEmpty(mergedMeta.provider) ?? "openclaw";
      const model = nonEmpty(agentMeta?.model) ?? nonEmpty(mergedMeta.model) ?? null;
      const costUsd = asNumber(agentMeta?.costUsd ?? mergedMeta.costUsd, 0);

      await ctx.onLog(
        "stdout",
        `[openclaw-gateway] run completed runId=${Array.from(trackedRunIds).join(",")} status=ok\n`,
      );

      return {
        exitCode: 0,
        signal: null,
        timedOut: false,
        provider,
        ...(model ? { model } : {}),
        ...(usage ? { usage } : {}),
        ...(costUsd > 0 ? { costUsd } : {}),
        resultJson: asRecord(latestResultPayload),
        ...(runtimeServices.length > 0 ? { runtimeServices } : {}),
        ...(summary ? { summary } : {}),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const lower = message.toLowerCase();
      const timedOut = lower.includes("timeout");
      const pairingRequired = lower.includes("pairing required");

      if (
        pairingRequired &&
        !disableDeviceAuth &&
        autoPairOnFirstConnect &&
        !autoPairAttempted &&
        (authToken || password)
      ) {
        autoPairAttempted = true;
        const pairResult = await autoApproveDevicePairing({
          url: parsedUrl.toString(),
          headers,
          connectTimeoutMs,
          clientId,
          clientMode,
          clientVersion,
          role,
          scopes,
          authToken,
          password,
          requestId: extractPairingRequestId(err),
          deviceId: deviceIdentity?.deviceId ?? null,
          onLog: ctx.onLog,
        });
        if (pairResult.ok) {
          await ctx.onLog(
            "stdout",
            `[openclaw-gateway] auto-approved pairing request ${pairResult.requestId}; retrying\n`,
          );
          continue;
        }
        await ctx.onLog(
          "stderr",
          `[openclaw-gateway] auto-pairing failed: ${pairResult.reason}\n`,
        );
      }

      const detailedMessage = pairingRequired
        ? `${message}. Approve the pending device in OpenClaw (for example: openclaw devices approve --latest --url <gateway-ws-url> --token <gateway-token>) and retry. Ensure this agent has a persisted adapterConfig.devicePrivateKeyPem so approvals are reused.`
        : message;

      await ctx.onLog("stderr", `[openclaw-gateway] request failed: ${detailedMessage}\n`);

      return {
        exitCode: 1,
        signal: null,
        timedOut,
        errorMessage: detailedMessage,
        errorCode: timedOut
          ? "openclaw_gateway_timeout"
          : pairingRequired
            ? "openclaw_gateway_pairing_required"
            : "openclaw_gateway_request_failed",
        resultJson: asRecord(latestResultPayload),
      };
    } finally {
      client.close();
    }
  }
}
