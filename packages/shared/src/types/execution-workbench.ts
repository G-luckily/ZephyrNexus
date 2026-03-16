import type {
  ExecutionOrgLayer,
  ExecutionSkillName,
  ExecutionTaskStatus,
  ExecutionWorkflowName,
} from "../constants.js";

export interface ExecutionStateSnapshot {
  task_id: string;
  agent_name: string;
  status: ExecutionTaskStatus;
  current_step: string;
  used_skills: string[];
  output_summary: string;
  blocker: string | null;
  next_action: string | null;
}

export interface RetryState {
  attempts: number;
  maxAttempts: number | null;
  retrying: boolean;
  reason: string | null;
}

export interface HumanCheckpointState {
  required: boolean;
  reason: string | null;
  prompt: string | null;
}

export interface BrowserLogSummary {
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  lastAction: string | null;
}

export interface OutputArtifact {
  name: string;
  path: string;
  version: string | null;
}

export interface VerificationSnapshot {
  credibilityLevel: "low" | "medium" | "high" | null;
  contradictionFlag: boolean;
  notes: string | null;
}

export interface ExecutionTelemetry {
  workflow: ExecutionWorkflowName | null;
  skills: ExecutionSkillName[];
  state: ExecutionStateSnapshot;
  retry: RetryState | null;
  humanCheckpoint: HumanCheckpointState | null;
  browserLogSummary: BrowserLogSummary | null;
  verification: VerificationSnapshot | null;
  outputArtifacts: OutputArtifact[];
}

export interface ExecutionAgentCatalogEntry {
  name: string;
  layer: ExecutionOrgLayer;
  skills: ExecutionSkillName[];
}
