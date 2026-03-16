import type {
  ExecutionTaskStatus,
  ExecutionWorkflowName,
  ExecutionSkillName,
} from "./constants.js";
import { EXECUTION_TASK_STATUSES, EXECUTION_WORKFLOWS, EXECUTION_SKILLS } from "./constants.js";
import type {
  BrowserLogSummary,
  ExecutionTelemetry,
  HumanCheckpointState,
  OutputArtifact,
  RetryState,
  VerificationSnapshot,
} from "./types/execution-workbench.js";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => asString(v))
      .filter((v): v is string => v !== null);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }
  return [];
}

function pickString(records: Array<Record<string, unknown> | null>, keys: string[]): string | null {
  for (const record of records) {
    if (!record) continue;
    for (const key of keys) {
      const value = asString(record[key]);
      if (value) return value;
    }
  }
  return null;
}

function pickStatus(records: Array<Record<string, unknown> | null>, runStatus: string): ExecutionTaskStatus {
  const raw = pickString(records, ["status", "executionStatus", "execution_status", "taskStatus", "task_status"]);
  if (raw && (EXECUTION_TASK_STATUSES as readonly string[]).includes(raw)) {
    return raw as ExecutionTaskStatus;
  }
  if (runStatus === "queued") return "planning";
  if (runStatus === "running") return "running";
  if (runStatus === "succeeded") return "completed";
  if (runStatus === "failed" || runStatus === "timed_out" || runStatus === "cancelled") return "failed";
  return "idle";
}

function pickWorkflow(records: Array<Record<string, unknown> | null>): ExecutionWorkflowName | null {
  const raw = pickString(records, ["workflow", "workflowId", "workflow_id"]);
  if (!raw) return null;
  if ((EXECUTION_WORKFLOWS as readonly string[]).includes(raw)) {
    return raw as ExecutionWorkflowName;
  }
  return null;
}

function parseRetry(records: Array<Record<string, unknown> | null>): RetryState | null {
  for (const record of records) {
    if (!record) continue;
    const retry = asRecord(record.retry);
    if (retry) {
      const attempts = asNumber(retry.attempts) ?? asNumber(retry.count) ?? 0;
      const maxAttempts = asNumber(retry.maxAttempts) ?? asNumber(retry.max_attempts);
      const retrying = asBoolean(retry.retrying) ?? false;
      const reason = asString(retry.reason) ?? asString(retry.lastError);
      return { attempts, maxAttempts, retrying, reason };
    }
    const attempts = asNumber(record.retryCount);
    if (attempts !== null) {
      return {
        attempts,
        maxAttempts: asNumber(record.retryMax),
        retrying: (asBoolean(record.retrying) ?? false),
        reason: asString(record.retryReason),
      };
    }
  }
  return null;
}

function parseHumanCheckpoint(records: Array<Record<string, unknown> | null>): HumanCheckpointState | null {
  for (const record of records) {
    if (!record) continue;
    const checkpoint = asRecord(record.humanCheckpoint) ?? asRecord(record.human_checkpoint);
    if (checkpoint) {
      return {
        required: asBoolean(checkpoint.required) ?? true,
        reason: asString(checkpoint.reason),
        prompt: asString(checkpoint.prompt),
      };
    }
    if (record.requiresHumanInput === true || record.waitingForHuman === true) {
      return {
        required: true,
        reason: asString(record.waitReason) ?? asString(record.reason),
        prompt: asString(record.prompt),
      };
    }
  }
  return null;
}

function parseBrowserSummary(records: Array<Record<string, unknown> | null>): BrowserLogSummary | null {
  for (const record of records) {
    if (!record) continue;
    const summary = asRecord(record.browserLogSummary) ?? asRecord(record.browser_log_summary);
    if (!summary) continue;
    return {
      totalActions: asNumber(summary.totalActions) ?? asNumber(summary.total_actions) ?? 0,
      successfulActions: asNumber(summary.successfulActions) ?? asNumber(summary.successful_actions) ?? 0,
      failedActions: asNumber(summary.failedActions) ?? asNumber(summary.failed_actions) ?? 0,
      lastAction: asString(summary.lastAction) ?? asString(summary.last_action),
    };
  }
  return null;
}

function parseVerification(records: Array<Record<string, unknown> | null>): VerificationSnapshot | null {
  for (const record of records) {
    if (!record) continue;
    const verification = asRecord(record.verification) ?? asRecord(record.validation);
    if (!verification) continue;
    const level = asString(verification.credibilityLevel) ?? asString(verification.credibility_level);
    return {
      credibilityLevel: level === "low" || level === "medium" || level === "high" ? level : null,
      contradictionFlag: asBoolean(verification.contradictionFlag) ?? asBoolean(verification.contradiction_flag) ?? false,
      notes: asString(verification.notes),
    };
  }
  return null;
}

function parseArtifacts(records: Array<Record<string, unknown> | null>): OutputArtifact[] {
  for (const record of records) {
    if (!record) continue;
    const raw = record.outputArtifacts ?? record.output_artifacts ?? record.deliverables;
    if (!Array.isArray(raw)) continue;
    const artifacts: OutputArtifact[] = [];
    for (const item of raw) {
      const parsed = asRecord(item);
      if (!parsed) continue;
      const name = asString(parsed.name) ?? asString(parsed.filename) ?? "artifact";
      const path = asString(parsed.path) ?? asString(parsed.file) ?? asString(parsed.location);
      if (!path) continue;
      artifacts.push({ name, path, version: asString(parsed.version) });
    }
    return artifacts;
  }
  return [];
}

export function buildExecutionTelemetry(input: {
  runId: string;
  runStatus: string;
  runError: string | null | undefined;
  contextSnapshot?: Record<string, unknown> | null;
  resultJson?: Record<string, unknown> | null;
  fallbackAgentName?: string | null;
}) : ExecutionTelemetry {
  const context = asRecord(input.contextSnapshot);
  const result = asRecord(input.resultJson);
  const records = [result, context];

  const workflow = pickWorkflow(records);
  const taskId = pickString(records, ["taskId", "task_id", "issueId", "issue_id"]) ?? input.runId;
  const agentName =
    pickString(records, ["agentName", "agent_name", "currentAgent", "current_agent"]) ??
    asString(input.fallbackAgentName) ??
    "unknown_agent";
  const status = pickStatus(records, input.runStatus);
  const currentStep =
    pickString(records, ["currentStep", "current_step", "step", "phase"]) ??
    "awaiting_execution";
  const rawSkills =
    asStringArray(result?.usedSkills ?? result?.used_skills ?? context?.usedSkills ?? context?.used_skills);
  const usedSkills: ExecutionSkillName[] = rawSkills.filter(
    (skill): skill is ExecutionSkillName => (EXECUTION_SKILLS as readonly string[]).includes(skill),
  );
  const outputSummary =
    pickString(records, ["outputSummary", "output_summary", "summary", "resultSummary", "result_summary"]) ??
    "";
  const blocker = pickString(records, ["blocker", "blockedBy", "blocked_by", "failureReason", "failure_reason"]) ??
    (status === "failed" ? asString(input.runError) : null);
  const nextAction = pickString(records, ["nextAction", "next_action", "recommendedNextAction", "recommended_next_action"]);

  return {
    workflow,
    skills: usedSkills,
    state: {
      task_id: taskId,
      agent_name: agentName,
      status,
      current_step: currentStep,
      used_skills: usedSkills,
      output_summary: outputSummary,
      blocker,
      next_action: nextAction,
    },
    retry: parseRetry(records),
    humanCheckpoint: parseHumanCheckpoint(records),
    browserLogSummary: parseBrowserSummary(records),
    verification: parseVerification(records),
    outputArtifacts: parseArtifacts(records),
  };
}
