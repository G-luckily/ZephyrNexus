import type { IssuePriority, IssueStatus } from "../constants.js";
import type { Goal } from "./goal.js";
import type { Project, ProjectWorkspace } from "./project.js";
import type { IssueExecutionWorkspaceSettings } from "./workspace-runtime.js";

export interface IssueAncestorProject {
  id: string;
  name: string;
  description: string | null;
  status: string;
  goalId: string | null;
  workspaces: ProjectWorkspace[];
  primaryWorkspace: ProjectWorkspace | null;
}

export interface IssueAncestorGoal {
  id: string;
  title: string;
  description: string | null;
  level: string;
  status: string;
}

export interface IssueAncestor {
  id: string;
  identifier: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeAgentId: string | null;
  assigneeUserId: string | null;
  projectId: string | null;
  goalId: string | null;
  project: IssueAncestorProject | null;
  goal: IssueAncestorGoal | null;
}

export interface IssueLabel {
  id: string;
  companyId: string;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IssueAssigneeAdapterOverrides {
  adapterConfig?: Record<string, unknown>;
  useProjectWorkspace?: boolean;
}

export interface HealthSummary {
  isBlocked: boolean;
  blockingDependencyCount: number;
  contractSatisfied: boolean | null;
  missingSummary: boolean;
  missingFileCount: number;
  summaryDeliverableCount: number;
  fileDeliverableCount: number;
  unreadNotificationCount: number;
}

export interface Issue {
  id: string;
  companyId: string;
  projectId: string | null;
  goalId: string | null;
  parentId: string | null;
  ancestors?: IssueAncestor[];
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  assigneeAgentId: string | null;
  assigneeUserId: string | null;
  checkoutRunId: string | null;
  executionRunId: string | null;
  executionAgentNameKey: string | null;
  executionLockedAt: Date | null;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  issueNumber: number | null;
  identifier: string | null;
  requestDepth: number;
  billingCode: string | null;
  assigneeAdapterOverrides: IssueAssigneeAdapterOverrides | null;
  executionWorkspaceSettings: IssueExecutionWorkspaceSettings | null;
  outputContract?: { requiresSummary: boolean; minFileDeliverables: number } | null;
  dependsOn?: string[] | null;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  hiddenAt: Date | null;
  labelIds?: string[];
  labels?: IssueLabel[];
  project?: Project | null;
  goal?: Goal | null;
  mentionedProjects?: Project[];
  myLastTouchAt?: Date | null;
  lastExternalCommentAt?: Date | null;
  isUnreadForMe?: boolean;
  healthSummary?: HealthSummary;
  createdAt: Date;
  updatedAt: Date;
}

export interface IssueComment {
  id: string;
  companyId: string;
  issueId: string;
  authorAgentId: string | null;
  authorUserId: string | null;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IssueAttachment {
  id: string;
  companyId: string;
  issueId: string;
  issueCommentId: string | null;
  assetId: string;
  provider: string;
  objectKey: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  originalFilename: string | null;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  contentPath: string;
}

export interface RecentCostEvent {
  id: string;
  createdAt: string;
  adapter: string;
  model: string;
  costCents: number;
}

export interface BlockedRunSummary {
  id: string;
  createdAt: string;
  agentName: string;
  errorCode: "budget_exceeded" | "issue_budget_exceeded";
}

export interface IssueBudgetSummary {
  issueId: string;
  issueTitle: string;
  issueIdentifier: string | null;
  budgetCents: number;
  spentCents: number;
  status: "UNDER_LIMIT" | "OVER_LIMIT" | "UNCONFIGURED";
  recentEvents: RecentCostEvent[];
  blockedRuns: BlockedRunSummary[];
}

export interface ActionQueueItem {
  issue: Issue;
  reason: string;
}

export interface ActionQueueResponse {
  attention: ActionQueueItem[];
  ready: ActionQueueItem[];
}

export interface WorkflowTemplateTask {
  key: string;
  title: string;
  initialStatus: IssueStatus;
  outputContract: any | null; 
  dependsOnKeys: string[];
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  useCase?: string;
  maybeExpectedOutcome?: string;
  tasks: WorkflowTemplateTask[];
}


