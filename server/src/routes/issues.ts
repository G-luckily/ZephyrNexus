import { Router, type Request, type Response } from "express";
import multer from "multer";
import { agents, costEvents, heartbeatRuns, issues, issueDeliverables, notifications, type Db } from "@zephyr-nexus/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { buildExecutionTelemetry } from "@zephyr-nexus/shared";
import {
  addIssueCommentSchema,
  createIssueAttachmentMetadataSchema,
  createIssueLabelSchema,
  checkoutIssueSchema,
  createIssueSchema,
  linkIssueApprovalSchema,
  updateIssueSchema,
} from "@zephyr-nexus/shared";
import type { StorageService } from "../storage/types.js";
import { validate } from "../middleware/validate.js";
import {
  accessService,
  agentService,
  costService,
  goalService,
  heartbeatService,
  issueApprovalService,
  issueService,
  logActivity,
  projectService,
} from "../services/index.js";
import { logger } from "../middleware/logger.js";
import { forbidden, HttpError, unauthorized } from "../errors.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { shouldWakeAssigneeOnCheckout } from "./issues-checkout-wakeup.js";
import { isAllowedContentType, MAX_ATTACHMENT_BYTES } from "../attachment-types.js";

export function issueRoutes(db: Db, storage: StorageService) {
  const router = Router();
  const svc = issueService(db);
  const access = accessService(db);
  const heartbeat = heartbeatService(db);
  const agentsSvc = agentService(db);
  const projectsSvc = projectService(db);
  const goalsSvc = goalService(db);
  const issueApprovalsSvc = issueApprovalService(db);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 },
  });
  const CHIEF_OF_STAFF_AGENT_NAME = "总裁助理-交付中枢";
  const SYNTHESIS_TITLE_PREFIX = "汇总：";

  function withContentPath<T extends { id: string }>(attachment: T) {
    return {
      ...attachment,
      contentPath: `/api/attachments/${attachment.id}/content`,
    };
  }

  async function runSingleFileUpload(req: Request, res: Response) {
    await new Promise<void>((resolve, reject) => {
      upload.single("file")(req, res, (err: unknown) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async function assertCanManageIssueApprovalLinks(req: Request, res: Response, companyId: string) {
    assertCompanyAccess(req, companyId);
    if (req.actor.type === "board") return true;
    if (!req.actor.agentId) {
      res.status(403).json({ error: "Agent authentication required" });
      return false;
    }
    const actorAgent = await agentsSvc.getById(req.actor.agentId);
    if (!actorAgent || actorAgent.companyId !== companyId) {
      res.status(403).json({ error: "Forbidden" });
      return false;
    }
    if (actorAgent.role === "ceo" || Boolean(actorAgent.permissions?.canCreateAgents)) return true;
    res.status(403).json({ error: "Missing permission to link approvals" });
    return false;
  }

  function canCreateAgentsLegacy(agent: { permissions: Record<string, unknown> | null | undefined; role: string }) {
    if (agent.role === "ceo") return true;
    if (!agent.permissions || typeof agent.permissions !== "object") return false;
    return Boolean((agent.permissions as Record<string, unknown>).canCreateAgents);
  }

  async function assertCanAssignTasks(req: Request, companyId: string) {
    assertCompanyAccess(req, companyId);
    if (req.actor.type === "board") {
      if (req.actor.source === "local_implicit" || req.actor.isInstanceAdmin) return;
      const allowed = await access.canUser(companyId, req.actor.userId, "tasks:assign");
      if (!allowed) throw forbidden("Missing permission: tasks:assign");
      return;
    }
    if (req.actor.type === "agent") {
      if (!req.actor.agentId) throw forbidden("Agent authentication required");
      const allowedByGrant = await access.hasPermission(companyId, "agent", req.actor.agentId, "tasks:assign");
      if (allowedByGrant) return;
      const actorAgent = await agentsSvc.getById(req.actor.agentId);
      if (actorAgent && actorAgent.companyId === companyId && canCreateAgentsLegacy(actorAgent)) return;
      throw forbidden("Missing permission: tasks:assign");
    }
    throw unauthorized();
  }

  function requireAgentRunId(req: Request, res: Response) {
    if (req.actor.type !== "agent") return null;
    const runId = req.actor.runId?.trim();
    if (runId) return runId;
    res.status(401).json({ error: "Agent run id required" });
    return null;
  }

  async function assertAgentRunCheckoutOwnership(
    req: Request,
    res: Response,
    issue: { id: string; companyId: string; status: string; assigneeAgentId: string | null },
  ) {
    if (req.actor.type !== "agent") return true;
    const actorAgentId = req.actor.agentId;
    if (!actorAgentId) {
      res.status(403).json({ error: "Agent authentication required" });
      return false;
    }
    if (issue.status !== "in_progress" || issue.assigneeAgentId !== actorAgentId) {
      return true;
    }
    const runId = requireAgentRunId(req, res);
    if (!runId) return false;
    const ownership = await svc.assertCheckoutOwner(issue.id, actorAgentId, runId);
    if (ownership.adoptedFromRunId) {
      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId: issue.companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "issue.checkout_lock_adopted",
        entityType: "issue",
        entityId: issue.id,
        details: {
          previousCheckoutRunId: ownership.adoptedFromRunId,
          checkoutRunId: runId,
          reason: "stale_checkout_run",
        },
      });
    }
    return true;
  }

  async function normalizeIssueIdentifier(rawId: string): Promise<string> {
    if (/^[A-Z]+-\d+$/i.test(rawId)) {
      const issue = await svc.getByIdentifier(rawId);
      if (issue) {
        return issue.id;
      }
    }
    return rawId;
  }

  const OFFICE_ROLES = new Set(["firecrawl", "prompt", "pencil", "research", "code", "paperclip"]);

  function normalizeTaskRole(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const lowered = value.trim().toLowerCase();
    return OFFICE_ROLES.has(lowered) ? lowered : null;
  }

  function resolveIssueTaskRole(issue: { description?: string | null } | null | undefined): string | null {
    const text = issue?.description;
    if (!text || typeof text !== "string") return null;
    const lowered = text.toLowerCase();
    const explicit = lowered.match(/(?:^|\n)\s*role\s*[:：]\s*(firecrawl|prompt|pencil|research|code|paperclip)\b/);
    if (explicit?.[1]) return explicit[1];
    const inline = lowered.match(/\b(?:role|角色)\s*[:：]?\s*(firecrawl|prompt|pencil|research|code|paperclip)\b/);
    if (inline?.[1]) return inline[1];
    return null;
  }

  function buildRoleWakeContext(
    issue: { title?: string | null; description?: string | null },
    source: string,
  ) {
    const role = normalizeTaskRole(resolveIssueTaskRole(issue));
    const contextBase = {
      source,
      ...(typeof issue.title === "string" && issue.title.trim().length > 0 ? { issueTitle: issue.title } : {}),
      ...(typeof issue.description === "string" && issue.description.trim().length > 0
        ? { issueDescription: issue.description }
        : {}),
    };
    return role
      ? { ...contextBase, taskRole: role, issueRole: role, officeRole: role }
      : contextBase;
  }

  async function maybeTriggerDeliverableRollup(params: {
    issueId: string;
    companyId: string;
    actor: ReturnType<typeof getActorInfo>;
  }) {
    const issue = await svc.getById(params.issueId);
    if (!issue?.parentId) return;
    if (issue.title.startsWith(SYNTHESIS_TITLE_PREFIX)) return;
    if (issue.status !== "done" && issue.status !== "cancelled") return;

    const parent = await svc.getById(issue.parentId);
    if (!parent || parent.status === "done" || parent.status === "cancelled") return;

    const children = await svc.list(params.companyId, { parentId: parent.id });
    const nonSynthesisChildren = children.filter((child) => !child.title.startsWith(SYNTHESIS_TITLE_PREFIX));
    if (nonSynthesisChildren.length === 0) return;

    const allTerminal = nonSynthesisChildren.every((child) => child.status === "done" || child.status === "cancelled");
    const anyDone = nonSynthesisChildren.some((child) => child.status === "done");
    if (!allTerminal || !anyDone) return;

    const existingSynthesis = children.find((child) => child.title.startsWith(SYNTHESIS_TITLE_PREFIX));
    if (existingSynthesis) return;

    const possibleAgents = await db.select().from(agents).where(eq(agents.companyId, params.companyId));
    let assigneeId = parent.assigneeAgentId;
    if (!assigneeId) {
      const synthesisAgent = possibleAgents.find(a => a.role?.toLowerCase()?.includes("chief_of_staff") || a.role?.toLowerCase()?.includes("synthesis")) || possibleAgents[0];
      if (!synthesisAgent) return;
      assigneeId = synthesisAgent.id;
    }

    const childLines = nonSynthesisChildren
      .map((child) => `- ${child.identifier} | ${child.title} | 状态: ${child.status}`)
      .join("\n");
    const synthesisTitle = `${SYNTHESIS_TITLE_PREFIX}${parent.title}`;
    const synthesisDescription = [
      `请汇总父任务「${parent.title}」下所有已完成子任务，形成最终交付版本。`,
      "",
      "要求：",
      "- 必须读取各子任务评论与工作区产物路径。",
      "- 汇总内容必须落到该项目工作区；如果父任务或项目配置了自定义路径，则以该路径为准。",
      "- 在 issue comment 中明确列出最终交付文件路径、已汇总的子任务、仍存在的缺口。",
      "",
      "已完成子任务：",
      childLines,
      "",
      `原始父任务描述：${parent.description ?? ""}`,
    ].join("\n");

    const synthesisIssue = await svc.create(params.companyId, {
      title: synthesisTitle,
      description: synthesisDescription,
      parentId: parent.id,
      projectId: parent.projectId ?? undefined,
      goalId: parent.goalId ?? undefined,
      priority: parent.priority,
      status: "todo",
      assigneeAgentId: assigneeId,
      createdByAgentId: params.actor.agentId,
      createdByUserId: params.actor.actorType === "user" ? params.actor.actorId : null,
    });

    await logActivity(db, {
      companyId: params.companyId,
      actorType: params.actor.actorType,
      actorId: params.actor.actorId,
      agentId: params.actor.agentId,
      runId: params.actor.runId,
      action: "issue.synthesis_requested",
      entityType: "issue",
      entityId: parent.id,
      details: {
        synthesisIssueId: synthesisIssue.id,
        synthesisIssueIdentifier: synthesisIssue.identifier,
        assigneeAgentId: assigneeId,
      },
    });

    await svc.addComment(parent.id, [
      "## Update",
      "",
      "所有直属子任务已完成，已自动创建最终交付汇总任务。",
      `- 汇总任务: ${synthesisIssue.identifier} ${synthesisIssue.title}`,
    ].join("\n"), {
      agentId: params.actor.agentId ?? undefined,
      userId: params.actor.actorType === "user" ? params.actor.actorId : undefined,
    });

    await heartbeat.wakeup(assigneeId, {
      source: "assignment",
      triggerDetail: "system",
      reason: "issue_assigned",
      payload: { issueId: synthesisIssue.id, mutation: "create" },
      requestedByActorType: params.actor.actorType,
      requestedByActorId: params.actor.actorId,
      contextSnapshot: { issueId: synthesisIssue.id, ...buildRoleWakeContext(synthesisIssue, "issue.synthesis") },
    });
  }

  // Resolve issue identifiers (e.g. "PAP-39") to UUIDs for all /issues/:id routes
  router.param("id", async (req, res, next, rawId) => {
    try {
      req.params.id = await normalizeIssueIdentifier(rawId);
      next();
    } catch (err) {
      next(err);
    }
  });

  // Resolve issue identifiers (e.g. "PAP-39") to UUIDs for company-scoped attachment routes.
  router.param("issueId", async (req, res, next, rawId) => {
    try {
      req.params.issueId = await normalizeIssueIdentifier(rawId);
      next();
    } catch (err) {
      next(err);
    }
  });

  // Common malformed path when companyId is empty in "/api/companies/{companyId}/issues".
  router.get("/issues", (_req, res) => {
    res.status(400).json({
      error: "Missing companyId in path. Use /api/companies/{companyId}/issues.",
    });
  });

  router.get("/companies/:companyId/issues", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const assigneeUserFilterRaw = req.query.assigneeUserId as string | undefined;
    const touchedByUserFilterRaw = req.query.touchedByUserId as string | undefined;
    const unreadForUserFilterRaw = req.query.unreadForUserId as string | undefined;
    const assigneeUserId =
      assigneeUserFilterRaw === "me" && req.actor.type === "board"
        ? req.actor.userId
        : assigneeUserFilterRaw;
    const touchedByUserId =
      touchedByUserFilterRaw === "me" && req.actor.type === "board"
        ? req.actor.userId
        : touchedByUserFilterRaw;
    const unreadForUserId =
      unreadForUserFilterRaw === "me" && req.actor.type === "board"
        ? req.actor.userId
        : unreadForUserFilterRaw;

    if (assigneeUserFilterRaw === "me" && (!assigneeUserId || req.actor.type !== "board")) {
      res.status(403).json({ error: "assigneeUserId=me requires board authentication" });
      return;
    }
    if (touchedByUserFilterRaw === "me" && (!touchedByUserId || req.actor.type !== "board")) {
      res.status(403).json({ error: "touchedByUserId=me requires board authentication" });
      return;
    }
    if (unreadForUserFilterRaw === "me" && (!unreadForUserId || req.actor.type !== "board")) {
      res.status(403).json({ error: "unreadForUserId=me requires board authentication" });
      return;
    }

    const result = await svc.list(companyId, {
      status: req.query.status as string | undefined,
      assigneeAgentId: req.query.assigneeAgentId as string | undefined,
      assigneeUserId,
      touchedByUserId,
      unreadForUserId,
      projectId: req.query.projectId as string | undefined,
      parentId: req.query.parentId as string | undefined,
      labelId: req.query.labelId as string | undefined,
      q: req.query.q as string | undefined,
      contextUserId: req.actor.type === "board" ? req.actor.userId : undefined,
    });
    res.json(result);
  });

  router.get("/companies/:companyId/issues/action-queue", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    
    const contextUserId = req.actor.type === "board" ? req.actor.userId : undefined;
    
    // Fetch all active issues for the queue analysis
    const allIssues = await svc.list(companyId, {
      status: "todo,in_progress,in_review,blocked",
      contextUserId, 
    });

    const attention: any[] = [];
    const ready: any[] = [];

    for (const issue of allIssues) {
      if (issue.status === "cancelled" || issue.status === "done") continue;

      const health = issue.healthSummary;
      let reason: string | null = null;
      let isAttention = false;
      let isReady = false;

      // 1. Needs Attention Rules (Highest Priority)
      if (health?.unreadNotificationCount && health.unreadNotificationCount > 0) {
        reason = `${health.unreadNotificationCount} unread events`;
        isAttention = true;
      } else if (issue.status === "in_review") {
        reason = "Ready for review";
        isAttention = true;
      } else if (issue.status === "in_progress" && health?.contractSatisfied === false) {
        if (health.missingSummary) {
          reason = "Missing summary";
        } else if (health.missingFileCount && health.missingFileCount > 0) {
          reason = `Missing ${health.missingFileCount} file deliverables`;
        } else {
          reason = "Missing deliverables";
        }
        isAttention = true;
      }

      // 2. Ready to Go Rules
      if (!isAttention) {
        if (issue.dependsOn && issue.dependsOn.length > 0 && health?.isBlocked === false) {
          reason = "Dependencies satisfied & Unblocked";
          isReady = true;
        } else if (issue.status === "todo" && health?.isBlocked === false && (!issue.dependsOn || issue.dependsOn.length === 0)) {
          reason = "Ready to pick up";
          isReady = true;
        }
      }

      if (isAttention && reason) {
        attention.push({ issue, reason });
      } else if (isReady && reason) {
        ready.push({ issue, reason });
      }
    }

    res.json({ attention, ready });
  });
  
  router.get("/companies/:companyId/issues/overshooting-top", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    
    // Find issues where spent > budget
    // We'll join issues with a subquery of cost_events to find the ones over budget.
    const results = await db
      .select({
        issueId: issues.id,
        issueIdentifier: issues.identifier,
        issueTitle: issues.title,
        budgetCents: sql<number>`coalesce((${issues.executionWorkspaceSettings} ->> 'budgetCents')::int, 0)`,
        spentCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
      })
      .from(issues)
      .innerJoin(costEvents, eq(issues.id, costEvents.issueId))
      .where(and(
        eq(issues.companyId, companyId),
        sql`coalesce((${issues.executionWorkspaceSettings} ->> 'budgetCents')::int, 0) > 0`
      ))
      .groupBy(issues.id, issues.identifier, issues.title, issues.executionWorkspaceSettings)
      .having(sql`sum(${costEvents.costCents}) > coalesce((${issues.executionWorkspaceSettings} ->> 'budgetCents')::int, 0)`)
      .orderBy(desc(sql`sum(${costEvents.costCents}) - coalesce((${issues.executionWorkspaceSettings} ->> 'budgetCents')::int, 0)`))
      .limit(5);

    res.json(results);
  });

  router.get("/companies/:companyId/issues/:id/budget-summary", async (req, res) => {
    const companyId = req.params.companyId as string;
    const id = req.params.id as string;
    const issue = await svc.getById(id);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    assertCompanyAccess(req, issue.companyId);

    const budgetCents = Number((issue.executionWorkspaceSettings as any)?.budgetCents ?? 0);
    const spentCents = await costService(db).getSpentCentsForIssue(companyId, id);
    
    // Fetch recent cost events
    const recentEvents = await db
      .select({
        id: costEvents.id,
        occurredAt: costEvents.occurredAt,
        provider: costEvents.provider,
        model: costEvents.model,
        costCents: costEvents.costCents,
      })
      .from(costEvents)
      .where(eq(costEvents.issueId, id))
      .orderBy(desc(costEvents.occurredAt))
      .limit(10);

    // Fetch blocked runs
    const blockedRuns = await db
      .select({
        id: heartbeatRuns.id,
        errorCode: heartbeatRuns.errorCode,
        finishedAt: heartbeatRuns.finishedAt,
      })
      .from(heartbeatRuns)
      .where(and(
        eq(heartbeatRuns.companyId, companyId),
        sql`${heartbeatRuns.contextSnapshot} ->> 'issueId' = ${id}`,
        inArray(heartbeatRuns.errorCode, ["budget_exceeded", "issue_budget_exceeded"])
      ))
      .orderBy(desc(heartbeatRuns.finishedAt))
      .limit(5);

    res.json({
      issueId: id,
      budgetCents,
      spentCents,
      status: spentCents >= budgetCents && budgetCents > 0 ? "exceeded" : "ok",
      recentEvents,
      blockedRuns,
    });
  });

  router.get("/companies/:companyId/labels", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const result = await svc.listLabels(companyId);
    res.json(result);
  });

  router.post("/companies/:companyId/labels", validate(createIssueLabelSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const label = await svc.createLabel(companyId, req.body);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "label.created",
      entityType: "label",
      entityId: label.id,
      details: { name: label.name, color: label.color },
    });
    res.status(201).json(label);
  });

  router.delete("/labels/:labelId", async (req, res) => {
    const labelId = req.params.labelId as string;
    const existing = await svc.getLabelById(labelId);
    if (!existing) {
      res.status(404).json({ error: "Label not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    const removed = await svc.deleteLabel(labelId);
    if (!removed) {
      res.status(404).json({ error: "Label not found" });
      return;
    }
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: removed.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "label.deleted",
      entityType: "label",
      entityId: removed.id,
      details: { name: removed.name, color: removed.color },
    });
    res.json(removed);
  });

  router.get("/issues/:id", async (req, res) => {
    const id = req.params.id as string;
    const issue = await svc.getById(id);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    assertCompanyAccess(req, issue.companyId);
    const [ancestors, project, goal, mentionedProjectIds] = await Promise.all([
      svc.getAncestors(issue.id),
      issue.projectId ? projectsSvc.getById(issue.projectId) : null,
      issue.goalId ? goalsSvc.getById(issue.goalId) : null,
      svc.findMentionedProjectIds(issue.id),
    ]);
    const mentionedProjects = mentionedProjectIds.length > 0
      ? await projectsSvc.listByIds(issue.companyId, mentionedProjectIds)
      : [];
    res.json({ ...issue, ancestors, project: project ?? null, goal: goal ?? null, mentionedProjects });
  });

  router.post("/issues/:id/read", async (req, res) => {
    const id = req.params.id as string;
    const issue = await svc.getById(id);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    assertCompanyAccess(req, issue.companyId);
    if (req.actor.type !== "board") {
      res.status(403).json({ error: "Board authentication required" });
      return;
    }
    if (!req.actor.userId) {
      res.status(403).json({ error: "Board user context required" });
      return;
    }
    const readState = await svc.markRead(issue.companyId, issue.id, req.actor.userId, new Date());
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.read_marked",
      entityType: "issue",
      entityId: issue.id,
      details: { userId: req.actor.userId, lastReadAt: readState.lastReadAt },
    });
    res.json(readState);
  });

  router.get("/issues/:id/approvals", async (req, res) => {
    const id = req.params.id as string;
    const issue = await svc.getById(id);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    assertCompanyAccess(req, issue.companyId);
    const approvals = await issueApprovalsSvc.listApprovalsForIssue(id);
    res.json(approvals);
  });

  router.get("/issues/:id/deliverables", async (req, res) => {
    const id = req.params.id as string;
    const issue = await svc.getById(id);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    assertCompanyAccess(req, issue.companyId);
    
    const deliverables = await db
      .select({
        id: issueDeliverables.id,
        issueId: issueDeliverables.issueId,
        title: issueDeliverables.title,
        summary: issueDeliverables.summary,
        kind: issueDeliverables.kind,
        payload: issueDeliverables.payload,
        producerId: issueDeliverables.producerId,
        producerName: agents.name,
        createdAt: issueDeliverables.createdAt,
        updatedAt: issueDeliverables.updatedAt,
      })
      .from(issueDeliverables)
      .leftJoin(agents, eq(issueDeliverables.producerId, agents.id))
      .where(eq(issueDeliverables.issueId, id))
      .orderBy(desc(issueDeliverables.createdAt));
      
    res.json(deliverables);
  });

  router.get("/issues/:id/dependencies", async (req, res) => {
    const id = req.params.id as string;
    const issue = await svc.getById(id);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    assertCompanyAccess(req, issue.companyId);
    
    const dependsOn = (issue.dependsOn as string[]) ?? [];
    if (dependsOn.length === 0) {
      res.json([]);
      return;
    }
    
    const deps = await db.select({
      id: issues.id,
      identifier: issues.identifier,
      title: issues.title,
      status: issues.status,
    }).from(issues).where(inArray(issues.id, dependsOn));
    
    res.json(deps);
  });

  router.post("/issues/:id/approvals", validate(linkIssueApprovalSchema), async (req, res) => {
    const id = req.params.id as string;
    const issue = await svc.getById(id);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    if (!(await assertCanManageIssueApprovalLinks(req, res, issue.companyId))) return;

    const actor = getActorInfo(req);
    await issueApprovalsSvc.link(id, req.body.approvalId, {
      agentId: actor.agentId,
      userId: actor.actorType === "user" ? actor.actorId : null,
    });

    await logActivity(db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.approval_linked",
      entityType: "issue",
      entityId: issue.id,
      details: { approvalId: req.body.approvalId },
    });

    const approvals = await issueApprovalsSvc.listApprovalsForIssue(id);
    res.status(201).json(approvals);
  });

  router.delete("/issues/:id/approvals/:approvalId", async (req, res) => {
    const id = req.params.id as string;
    const approvalId = req.params.approvalId as string;
    const issue = await svc.getById(id);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    if (!(await assertCanManageIssueApprovalLinks(req, res, issue.companyId))) return;

    await issueApprovalsSvc.unlink(id, approvalId);

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.approval_unlinked",
      entityType: "issue",
      entityId: issue.id,
      details: { approvalId },
    });

    res.json({ ok: true });
  });

  router.post("/companies/:companyId/issues", validate(createIssueSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    if (req.body.assigneeAgentId || req.body.assigneeUserId) {
      await assertCanAssignTasks(req, companyId);
    }

    const actor = getActorInfo(req);
    const issue = await svc.create(companyId, {
      ...req.body,
      createdByAgentId: actor.agentId,
      createdByUserId: actor.actorType === "user" ? actor.actorId : null,
      outputContract: {
        requiresSummary: true,
        minFileDeliverables: 0,
      },
    });

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.created",
      entityType: "issue",
      entityId: issue.id,
      details: { title: issue.title, identifier: issue.identifier },
    });

    if (issue.assigneeAgentId && issue.status !== "backlog") {
      void heartbeat
        .wakeup(issue.assigneeAgentId, {
          source: "assignment",
          triggerDetail: "system",
          reason: "issue_assigned",
          payload: { issueId: issue.id, mutation: "create" },
          requestedByActorType: actor.actorType,
          requestedByActorId: actor.actorId,
          contextSnapshot: { issueId: issue.id, ...buildRoleWakeContext(issue, "issue.create") },
        })
        .catch((err) => logger.warn({ err, issueId: issue.id }, "failed to wake assignee on issue create"));
    }

    res.status(201).json(issue);
  });

  router.patch("/issues/:id", validate(updateIssueSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    const assigneeWillChange =
      (req.body.assigneeAgentId !== undefined && req.body.assigneeAgentId !== existing.assigneeAgentId) ||
      (req.body.assigneeUserId !== undefined && req.body.assigneeUserId !== existing.assigneeUserId);

    const isAgentReturningIssueToCreator =
      req.actor.type === "agent" &&
      !!req.actor.agentId &&
      existing.assigneeAgentId === req.actor.agentId &&
      req.body.assigneeAgentId === null &&
      typeof req.body.assigneeUserId === "string" &&
      !!existing.createdByUserId &&
      req.body.assigneeUserId === existing.createdByUserId;

    if (assigneeWillChange) {
      if (!isAgentReturningIssueToCreator) {
        await assertCanAssignTasks(req, existing.companyId);
      }
    }
    if (!(await assertAgentRunCheckoutOwnership(req, res, existing))) return;

    const { comment: commentBody, hiddenAt: hiddenAtRaw, ...updateFields } = req.body;
    if (hiddenAtRaw !== undefined) {
      updateFields.hiddenAt = hiddenAtRaw ? new Date(hiddenAtRaw) : null;
    }

    if (updateFields.dependsOn) {
      const nextDependsOn = updateFields.dependsOn as string[];
      if (nextDependsOn.includes(id)) {
        res.status(400).json({ error: "任务不能将自身设为依赖。" });
        return;
      }
    }

    // Dependency Gate Check
    if (updateFields.status && updateFields.status !== existing.status && ["in_progress", "in_review", "done"].includes(updateFields.status as string)) {
      const dependsOn = (updateFields.dependsOn as string[] | undefined) ?? (existing.dependsOn as string[] | null) ?? [];
      if (dependsOn.length > 0) {
        const incompleteDeps = await db
          .select({ identifier: issues.identifier })
          .from(issues)
          .where(and(inArray(issues.id, dependsOn), sql`status != 'done'`));
        if (incompleteDeps.length > 0) {
          const blockedBy = incompleteDeps.map(d => d.identifier).join(", ");
          
          if (req.actor.userId) {
            await db.insert(notifications).values({
              companyId: existing.companyId,
              userId: req.actor.userId,
              title: "依赖未满足 (Dependency Blocked)",
              body: `任务 ${existing.identifier ?? existing.id.slice(0, 8)} 在推进状态时被关联的前置任务阻塞。`,
              type: "dependency_blocked",
              relatedIssueId: existing.id,
            });
          }

          res.status(400).json({ error: `未满足前置依赖 (Dependency Gate)：当前任务状态流转被阻塞。\n请先完成依赖任务：${blockedBy}` });
          return;
        }
      }
    }

    let issue;
    try {
      if (updateFields.status === "done" && existing.status !== "done") {
        const contract = existing.outputContract as { requiresSummary?: boolean; minFileDeliverables?: number } | null;
        if (contract) {
          const hasSummary = !!(commentBody || updateFields.description || existing.description);
          let fileCount = 0;

          const attachments = await svc.listAttachments(existing.id);
          fileCount += attachments.length;

          const latestRunRow = await db
            .select({ run: heartbeatRuns })
            .from(heartbeatRuns)
            .where(sql`${heartbeatRuns.contextSnapshot}->>'issueId' = ${existing.id}`)
            .orderBy(desc(heartbeatRuns.createdAt))
            .limit(1)
            .then(res => res[0]);

          if (latestRunRow) {
            const tel = buildExecutionTelemetry({
              runId: latestRunRow.run.id,
              runStatus: latestRunRow.run.status,
              runError: latestRunRow.run.error,
              contextSnapshot: latestRunRow.run.contextSnapshot as Record<string, unknown> | null,
              resultJson: latestRunRow.run.resultJson as Record<string, unknown> | null,
            });
            fileCount += tel.outputArtifacts?.length ?? 0;
          }

          if (contract.requiresSummary && !hasSummary) {
            if (req.actor.userId) {
              await db.insert(notifications).values({
                companyId: existing.companyId,
                userId: req.actor.userId,
                title: "交付契约未满足",
                body: `任务 ${existing.identifier ?? existing.id.slice(0, 8)} 尝试标记完成，但缺乏必要的文字摘要。`,
                type: "output_contract_failed",
                relatedIssueId: existing.id,
              });
            }
            res.status(400).json({ error: "未满足交付契约：必须提供至少一份概要描述 (Summary Deliverable) 才可完成任务。" });
            return;
          }
          if ((contract.minFileDeliverables ?? 0) > 0 && fileCount < contract.minFileDeliverables!) {
            if (req.actor.userId) {
              await db.insert(notifications).values({
                companyId: existing.companyId,
                userId: req.actor.userId,
                title: "交付契约未满足",
                body: `任务 ${existing.identifier ?? existing.id.slice(0, 8)} 尝试标记完成，但提交的文件数量不足（需 ${contract.minFileDeliverables} 份）。`,
                type: "output_contract_failed",
                relatedIssueId: existing.id,
              });
            }
            res.status(400).json({ error: `未满足交付契约：必须产出至少 ${contract.minFileDeliverables} 个文件或附件成果 (File Deliverables)，当前仅发现 ${fileCount} 个。` });
            return;
          }
        }
      }

      issue = await svc.update(id, updateFields);
      
      if (issue && updateFields.status === "done" && existing.status !== "done") {
        const dependants = await db
          .select()
          .from(issues)
          .where(and(eq(issues.companyId, existing.companyId), sql`${issues.dependsOn} @> ${JSON.stringify([issue.id])}::jsonb`));
          
        for (const dep of dependants) {
          if ((dep.dependsOn as string[]).length > 0) {
             const incompleteDeps = await db
                .select({ id: issues.id })
                .from(issues)
                .where(and(inArray(issues.id, dep.dependsOn as string[]), sql`status != 'done'`));
                
             if (incompleteDeps.length === 0 && dep.assigneeUserId) {
                await db.insert(notifications).values({
                  companyId: existing.companyId,
                  userId: dep.assigneeUserId,
                  title: "依赖已解除",
                  body: `前置任务全部完结！任务 ${dep.identifier ?? dep.id.slice(0, 8)} 现在已无阻塞，可以开始推进。`,
                  type: "dependency_unblocked",
                  relatedIssueId: dep.id,
                });
             }
          }
        }
      }
    } catch (err) {
      if (err instanceof HttpError && err.status === 422) {
        logger.warn(
          {
            issueId: id,
            companyId: existing.companyId,
            assigneePatch: {
              assigneeAgentId:
                req.body.assigneeAgentId === undefined ? "__omitted__" : req.body.assigneeAgentId,
              assigneeUserId:
                req.body.assigneeUserId === undefined ? "__omitted__" : req.body.assigneeUserId,
            },
            currentAssignee: {
              assigneeAgentId: existing.assigneeAgentId,
              assigneeUserId: existing.assigneeUserId,
            },
            error: err.message,
            details: err.details,
          },
          "issue update rejected with 422",
        );
      }
      throw err;
    }
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }

    // Build activity details with previous values for changed fields
    const previous: Record<string, unknown> = {};
    for (const key of Object.keys(updateFields)) {
      if (key in existing && (existing as Record<string, unknown>)[key] !== (updateFields as Record<string, unknown>)[key]) {
        previous[key] = (existing as Record<string, unknown>)[key];
      }
    }

    const actor = getActorInfo(req);
    const hasFieldChanges = Object.keys(previous).length > 0;
    await logActivity(db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.updated",
      entityType: "issue",
      entityId: issue.id,
      details: {
        ...updateFields,
        identifier: issue.identifier,
        ...(commentBody ? { source: "comment" } : {}),
        _previous: hasFieldChanges ? previous : undefined,
      },
    });

    let comment = null;
    if (commentBody) {
      comment = await svc.addComment(id, commentBody, {
        agentId: actor.agentId ?? undefined,
        userId: actor.actorType === "user" ? actor.actorId : undefined,
      });

      await logActivity(db, {
        companyId: issue.companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "issue.comment_added",
        entityType: "issue",
        entityId: issue.id,
        details: {
          commentId: comment.id,
          bodySnippet: comment.body.slice(0, 120),
          identifier: issue.identifier,
          issueTitle: issue.title,
          ...(hasFieldChanges ? { updated: true } : {}),
        },
      });

    }

    const assigneeChanged = assigneeWillChange;
    const statusChangedFromBacklog =
      existing.status === "backlog" &&
      issue.status !== "backlog" &&
      req.body.status !== undefined;

    // Merge all wakeups from this update into one enqueue per agent to avoid duplicate runs.
    if (updateFields.status === "done" && existing.status !== "done") {
      const deliverableSummary = commentBody || updateFields.description || existing.description || "Task completed";
      await db.insert(issueDeliverables).values({
        companyId: issue.companyId,
        issueId: issue.id,
        title: `Deliverable: ${issue.title}`,
        summary: deliverableSummary.substring(0, 5000),
        kind: "summary",
        producerId: actor.agentId ?? null,
      });

      // Extract real files from issue attachments
      const attachments = await svc.listAttachments(issue.id);
      for (const att of attachments) {
        await db.insert(issueDeliverables).values({
          companyId: issue.companyId,
          issueId: issue.id,
          title: att.originalFilename ?? "Attachment",
          summary: `上传的附件产物文件：${att.originalFilename}`,
          kind: "file",
          producerId: actor.agentId ?? null,
          payload: {
            filename: att.originalFilename,
            contentType: att.contentType,
            size: att.byteSize,
            url: `/api/attachments/${att.id}/content`
          }
        });
      }

      // Extract outputArtifacts from latest heartbeatRun
      const latestRunRow = await db
        .select({
          run: heartbeatRuns,
          agentName: agents.name,
        })
        .from(heartbeatRuns)
        .leftJoin(agents, eq(heartbeatRuns.agentId, agents.id))
        .where(sql`${heartbeatRuns.contextSnapshot}->>'issueId' = ${issue.id}`)
        .orderBy(desc(heartbeatRuns.createdAt))
        .limit(1)
        .then(res => res[0]);

      if (latestRunRow) {
        const latestRun = latestRunRow.run;
        const tel = buildExecutionTelemetry({
          runId: latestRun.id,
          runStatus: latestRun.status,
          runError: latestRun.error,
          contextSnapshot: latestRun.contextSnapshot as Record<string, unknown> | null,
          resultJson: latestRun.resultJson as Record<string, unknown> | null,
          fallbackAgentName: latestRunRow.agentName,
        });
        if (tel.outputArtifacts && tel.outputArtifacts.length > 0) {
          for (const art of tel.outputArtifacts) {
            await db.insert(issueDeliverables).values({
              companyId: issue.companyId,
              issueId: issue.id,
              title: art.name ?? "Execution Artifact",
              summary: `执行流产生的工作区文件：${art.path}`,
              kind: "file",
              producerId: latestRun.agentId ?? actor.agentId ?? null,
              payload: {
                filename: art.name,
                filePath: art.path,
                version: art.version,
                source: "workspace_artifact"
              }
            });
          }
        }
      }
    }

    void (async () => {
      const wakeups = new Map<string, Parameters<typeof heartbeat.wakeup>[1]>();

      if (assigneeChanged && issue.assigneeAgentId && issue.status !== "backlog") {
        wakeups.set(issue.assigneeAgentId, {
          source: "assignment",
          triggerDetail: "system",
          reason: "issue_assigned",
          payload: { issueId: issue.id, mutation: "update" },
          requestedByActorType: actor.actorType,
          requestedByActorId: actor.actorId,
          contextSnapshot: { issueId: issue.id, ...buildRoleWakeContext(issue, "issue.update") },
        });
      }

      if (!assigneeChanged && statusChangedFromBacklog && issue.assigneeAgentId) {
        wakeups.set(issue.assigneeAgentId, {
          source: "automation",
          triggerDetail: "system",
          reason: "issue_status_changed",
          payload: { issueId: issue.id, mutation: "update" },
          requestedByActorType: actor.actorType,
          requestedByActorId: actor.actorId,
          contextSnapshot: { issueId: issue.id, ...buildRoleWakeContext(issue, "issue.status_change") },
        });
      }

      if (commentBody && comment) {
        let mentionedIds: string[] = [];
        try {
          mentionedIds = await svc.findMentionedAgents(issue.companyId, commentBody);
        } catch (err) {
          logger.warn({ err, issueId: id }, "failed to resolve @-mentions");
        }

        const { allowed: allowedMentionIds, skipped: skippedMentionIds } =
          await svc.filterMentionedAgentsForHighCostLimit(issue.companyId, mentionedIds);
        if (skippedMentionIds.length > 0) {
          logger.info(
            { issueId: id, skippedCount: skippedMentionIds.length, skippedIds: skippedMentionIds },
            "P0-2: high-cost adapter mentions limited per comment",
          );
        }

        for (const mentionedId of allowedMentionIds) {
          if (wakeups.has(mentionedId)) continue;
          if (actor.actorType === "agent" && actor.actorId === mentionedId) continue;
          wakeups.set(mentionedId, {
            source: "automation",
            triggerDetail: "system",
            reason: "issue_comment_mentioned",
            payload: { issueId: id, commentId: comment.id },
            requestedByActorType: actor.actorType,
            requestedByActorId: actor.actorId,
            contextSnapshot: {
              issueId: id,
              taskId: id,
              commentId: comment.id,
              wakeCommentId: comment.id,
              wakeReason: "issue_comment_mentioned",
              ...buildRoleWakeContext(issue, "comment.mention"),
            },
          });
        }
      }

      for (const [agentId, wakeup] of wakeups.entries()) {
        heartbeat
          .wakeup(agentId, wakeup)
          .catch((err) => logger.warn({ err, issueId: issue.id, agentId }, "failed to wake agent on issue update"));
      }

      if (existing.parentId && (issue.status === "done" || issue.status === "cancelled")) {
        try {
          await maybeTriggerDeliverableRollup({
            issueId: issue.id,
            companyId: issue.companyId,
            actor,
          });
        } catch (err) {
          logger.warn({ err, issueId: issue.id, parentId: existing.parentId }, "failed to create synthesis issue");
        }
      }
    })();

    res.json({ ...issue, comment });
  });

  router.delete("/issues/:id", async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    const attachments = await svc.listAttachments(id);

    const issue = await svc.remove(id);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }

    for (const attachment of attachments) {
      try {
        await storage.deleteObject(attachment.companyId, attachment.objectKey);
      } catch (err) {
        logger.warn({ err, issueId: id, attachmentId: attachment.id }, "failed to delete attachment object during issue delete");
      }
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.deleted",
      entityType: "issue",
      entityId: issue.id,
    });

    res.json(issue);
  });

  router.post("/issues/:id/checkout", validate(checkoutIssueSchema), async (req, res) => {
    const id = req.params.id as string;
    const issue = await svc.getById(id);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    assertCompanyAccess(req, issue.companyId);

    if (req.actor.type === "agent" && req.actor.agentId !== req.body.agentId) {
      res.status(403).json({ error: "Agent can only checkout as itself" });
      return;
    }

    const checkoutRunId = requireAgentRunId(req, res);
    if (req.actor.type === "agent" && !checkoutRunId) return;
    const updated = await svc.checkout(id, req.body.agentId, req.body.expectedStatuses, checkoutRunId);
    const actor = getActorInfo(req);

    await logActivity(db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.checked_out",
      entityType: "issue",
      entityId: issue.id,
      details: { agentId: req.body.agentId },
    });

    if (
      shouldWakeAssigneeOnCheckout({
        actorType: req.actor.type,
        actorAgentId: req.actor.type === "agent" ? req.actor.agentId ?? null : null,
        checkoutAgentId: req.body.agentId,
        checkoutRunId,
      })
    ) {
      void heartbeat
        .wakeup(req.body.agentId, {
          source: "assignment",
          triggerDetail: "system",
          reason: "issue_checked_out",
          payload: { issueId: issue.id, mutation: "checkout" },
          requestedByActorType: actor.actorType,
          requestedByActorId: actor.actorId,
          contextSnapshot: { issueId: issue.id, ...buildRoleWakeContext(issue, "issue.checkout") },
        })
        .catch((err) => logger.warn({ err, issueId: issue.id }, "failed to wake assignee on issue checkout"));
    }

    res.json(updated);
  });

  router.post("/issues/:id/release", async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    if (!(await assertAgentRunCheckoutOwnership(req, res, existing))) return;
    const actorRunId = requireAgentRunId(req, res);
    if (req.actor.type === "agent" && !actorRunId) return;

    const released = await svc.release(
      id,
      req.actor.type === "agent" ? req.actor.agentId : undefined,
      actorRunId,
    );
    if (!released) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: released.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.released",
      entityType: "issue",
      entityId: released.id,
    });

    res.json(released);
  });

  router.get("/issues/:id/comments", async (req, res) => {
    const id = req.params.id as string;
    const issue = await svc.getById(id);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    assertCompanyAccess(req, issue.companyId);
    const comments = await svc.listComments(id);
    res.json(comments);
  });

  router.get("/issues/:id/comments/:commentId", async (req, res) => {
    const id = req.params.id as string;
    const commentId = req.params.commentId as string;
    const issue = await svc.getById(id);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    assertCompanyAccess(req, issue.companyId);
    const comment = await svc.getComment(commentId);
    if (!comment || comment.issueId !== id) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }
    res.json(comment);
  });

  router.post("/issues/:id/comments", validate(addIssueCommentSchema), async (req, res) => {
    const id = req.params.id as string;
    const issue = await svc.getById(id);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    assertCompanyAccess(req, issue.companyId);
    if (!(await assertAgentRunCheckoutOwnership(req, res, issue))) return;

    const actor = getActorInfo(req);
    const reopenRequested = req.body.reopen === true;
    const interruptRequested = req.body.interrupt === true;
    const isClosed = issue.status === "done" || issue.status === "cancelled";
    let reopened = false;
    let reopenFromStatus: string | null = null;
    let interruptedRunId: string | null = null;
    let currentIssue = issue;

    if (reopenRequested && isClosed) {
      const reopenedIssue = await svc.update(id, { status: "todo" });
      if (!reopenedIssue) {
        res.status(404).json({ error: "Issue not found" });
        return;
      }
      reopened = true;
      reopenFromStatus = issue.status;
      currentIssue = reopenedIssue;

      await logActivity(db, {
        companyId: currentIssue.companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "issue.updated",
        entityType: "issue",
        entityId: currentIssue.id,
        details: {
          status: "todo",
          reopened: true,
          reopenedFrom: reopenFromStatus,
          source: "comment",
          identifier: currentIssue.identifier,
        },
      });
    }

    if (interruptRequested) {
      if (req.actor.type !== "board") {
        res.status(403).json({ error: "Only board users can interrupt active runs from issue comments" });
        return;
      }

      let runToInterrupt = currentIssue.executionRunId
        ? await heartbeat.getRun(currentIssue.executionRunId)
        : null;

      if (
        (!runToInterrupt || runToInterrupt.status !== "running") &&
        currentIssue.assigneeAgentId
      ) {
        const activeRun = await heartbeat.getActiveRunForAgent(currentIssue.assigneeAgentId);
        const activeIssueId =
          activeRun &&
            activeRun.contextSnapshot &&
            typeof activeRun.contextSnapshot === "object" &&
            typeof (activeRun.contextSnapshot as Record<string, unknown>).issueId === "string"
            ? ((activeRun.contextSnapshot as Record<string, unknown>).issueId as string)
            : null;
        if (activeRun && activeRun.status === "running" && activeIssueId === currentIssue.id) {
          runToInterrupt = activeRun;
        }
      }

      if (runToInterrupt && runToInterrupt.status === "running") {
        const cancelled = await heartbeat.cancelRun(runToInterrupt.id);
        if (cancelled) {
          interruptedRunId = cancelled.id;
          await logActivity(db, {
            companyId: cancelled.companyId,
            actorType: actor.actorType,
            actorId: actor.actorId,
            agentId: actor.agentId,
            runId: actor.runId,
            action: "heartbeat.cancelled",
            entityType: "heartbeat_run",
            entityId: cancelled.id,
            details: { agentId: cancelled.agentId, source: "issue_comment_interrupt", issueId: currentIssue.id },
          });
        }
      }
    }

    const comment = await svc.addComment(id, req.body.body, {
      agentId: actor.agentId ?? undefined,
      userId: actor.actorType === "user" ? actor.actorId : undefined,
    });

    await logActivity(db, {
      companyId: currentIssue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.comment_added",
      entityType: "issue",
      entityId: currentIssue.id,
      details: {
        commentId: comment.id,
        bodySnippet: comment.body.slice(0, 120),
        identifier: currentIssue.identifier,
        issueTitle: currentIssue.title,
        ...(reopened ? { reopened: true, reopenedFrom: reopenFromStatus, source: "comment" } : {}),
        ...(interruptedRunId ? { interruptedRunId } : {}),
      },
    });

    // Merge all wakeups from this comment into one enqueue per agent to avoid duplicate runs.
    void (async () => {
      const wakeups = new Map<string, Parameters<typeof heartbeat.wakeup>[1]>();
      const assigneeId = currentIssue.assigneeAgentId;
      const actorIsAgent = actor.actorType === "agent";
      const selfComment = actorIsAgent && actor.actorId === assigneeId;
      const skipWake = selfComment || isClosed;
      if (assigneeId && (reopened || !skipWake)) {
        if (reopened) {
          wakeups.set(assigneeId, {
            source: "automation",
            triggerDetail: "system",
            reason: "issue_reopened_via_comment",
            payload: {
              issueId: currentIssue.id,
              commentId: comment.id,
              reopenedFrom: reopenFromStatus,
              mutation: "comment",
              ...(interruptedRunId ? { interruptedRunId } : {}),
            },
            requestedByActorType: actor.actorType,
            requestedByActorId: actor.actorId,
            contextSnapshot: {
              issueId: currentIssue.id,
              taskId: currentIssue.id,
              commentId: comment.id,
              ...buildRoleWakeContext(currentIssue, "issue.comment.reopen"),
              wakeReason: "issue_reopened_via_comment",
              reopenedFrom: reopenFromStatus,
              ...(interruptedRunId ? { interruptedRunId } : {}),
            },
          });
        } else {
          wakeups.set(assigneeId, {
            source: "automation",
            triggerDetail: "system",
            reason: "issue_commented",
            payload: {
              issueId: currentIssue.id,
              commentId: comment.id,
              mutation: "comment",
              ...(interruptedRunId ? { interruptedRunId } : {}),
            },
            requestedByActorType: actor.actorType,
            requestedByActorId: actor.actorId,
            contextSnapshot: {
              issueId: currentIssue.id,
              taskId: currentIssue.id,
              commentId: comment.id,
              ...buildRoleWakeContext(currentIssue, "issue.comment"),
              wakeReason: "issue_commented",
              ...(interruptedRunId ? { interruptedRunId } : {}),
            },
          });
        }
      }

      let mentionedIds: string[] = [];
      try {
        mentionedIds = await svc.findMentionedAgents(currentIssue.companyId, req.body.body);
      } catch (err) {
        logger.warn({ err, issueId: id }, "failed to resolve @-mentions");
      }

      const { allowed: allowedMentionIds, skipped: skippedMentionIds } =
        await svc.filterMentionedAgentsForHighCostLimit(currentIssue.companyId, mentionedIds);
      if (skippedMentionIds.length > 0) {
        logger.info(
          { issueId: id, skippedCount: skippedMentionIds.length, skippedIds: skippedMentionIds },
          "P0-2: high-cost adapter mentions limited per comment",
        );
      }

      for (const mentionedId of allowedMentionIds) {
        if (wakeups.has(mentionedId)) continue;
        if (actorIsAgent && actor.actorId === mentionedId) continue;
        wakeups.set(mentionedId, {
          source: "automation",
          triggerDetail: "system",
          reason: "issue_comment_mentioned",
          payload: { issueId: id, commentId: comment.id },
          requestedByActorType: actor.actorType,
          requestedByActorId: actor.actorId,
          contextSnapshot: {
            issueId: id,
            taskId: id,
            commentId: comment.id,
            wakeCommentId: comment.id,
            wakeReason: "issue_comment_mentioned",
            ...buildRoleWakeContext(currentIssue, "comment.mention"),
          },
        });
      }

      for (const [agentId, wakeup] of wakeups.entries()) {
        heartbeat
          .wakeup(agentId, wakeup)
          .catch((err) => logger.warn({ err, issueId: currentIssue.id, agentId }, "failed to wake agent on issue comment"));
      }
    })();

    res.status(201).json(comment);
  });

  router.get("/issues/:id/attachments", async (req, res) => {
    const issueId = req.params.id as string;
    const issue = await svc.getById(issueId);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    assertCompanyAccess(req, issue.companyId);
    const attachments = await svc.listAttachments(issueId);
    res.json(attachments.map(withContentPath));
  });

  router.post("/companies/:companyId/issues/:issueId/attachments", async (req, res) => {
    const companyId = req.params.companyId as string;
    const issueId = req.params.issueId as string;
    assertCompanyAccess(req, companyId);
    const issue = await svc.getById(issueId);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    if (issue.companyId !== companyId) {
      res.status(422).json({ error: "Issue does not belong to company" });
      return;
    }

    try {
      await runSingleFileUpload(req, res);
    } catch (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(422).json({ error: `Attachment exceeds ${MAX_ATTACHMENT_BYTES} bytes` });
          return;
        }
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }

    const file = (req as Request & { file?: { mimetype: string; buffer: Buffer; originalname: string } }).file;
    if (!file) {
      res.status(400).json({ error: "Missing file field 'file'" });
      return;
    }
    const contentType = (file.mimetype || "").toLowerCase();
    if (!isAllowedContentType(contentType)) {
      res.status(422).json({ error: `Unsupported attachment type: ${contentType || "unknown"}` });
      return;
    }
    if (file.buffer.length <= 0) {
      res.status(422).json({ error: "Attachment is empty" });
      return;
    }

    const parsedMeta = createIssueAttachmentMetadataSchema.safeParse(req.body ?? {});
    if (!parsedMeta.success) {
      res.status(400).json({ error: "Invalid attachment metadata", details: parsedMeta.error.issues });
      return;
    }

    const actor = getActorInfo(req);
    const stored = await storage.putFile({
      companyId,
      namespace: `issues/${issueId}`,
      originalFilename: file.originalname || null,
      contentType,
      body: file.buffer,
    });

    const attachment = await svc.createAttachment({
      issueId,
      issueCommentId: parsedMeta.data.issueCommentId ?? null,
      provider: stored.provider,
      objectKey: stored.objectKey,
      contentType: stored.contentType,
      byteSize: stored.byteSize,
      sha256: stored.sha256,
      originalFilename: stored.originalFilename,
      createdByAgentId: actor.agentId,
      createdByUserId: actor.actorType === "user" ? actor.actorId : null,
    });

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.attachment_added",
      entityType: "issue",
      entityId: issueId,
      details: {
        attachmentId: attachment.id,
        originalFilename: attachment.originalFilename,
        contentType: attachment.contentType,
        byteSize: attachment.byteSize,
      },
    });

    res.status(201).json(withContentPath(attachment));
  });

  router.get("/attachments/:attachmentId/content", async (req, res, next) => {
    const attachmentId = req.params.attachmentId as string;
    const attachment = await svc.getAttachmentById(attachmentId);
    if (!attachment) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }
    assertCompanyAccess(req, attachment.companyId);

    const object = await storage.getObject(attachment.companyId, attachment.objectKey);
    res.setHeader("Content-Type", attachment.contentType || object.contentType || "application/octet-stream");
    res.setHeader("Content-Length", String(attachment.byteSize || object.contentLength || 0));
    res.setHeader("Cache-Control", "private, max-age=60");
    const filename = attachment.originalFilename ?? "attachment";
    res.setHeader("Content-Disposition", `inline; filename=\"${filename.replaceAll("\"", "")}\"`);

    object.stream.on("error", (err) => {
      next(err);
    });
    object.stream.pipe(res);
  });

  router.delete("/attachments/:attachmentId", async (req, res) => {
    const attachmentId = req.params.attachmentId as string;
    const attachment = await svc.getAttachmentById(attachmentId);
    if (!attachment) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }
    assertCompanyAccess(req, attachment.companyId);

    try {
      await storage.deleteObject(attachment.companyId, attachment.objectKey);
    } catch (err) {
      logger.warn({ err, attachmentId }, "storage delete failed while removing attachment");
    }

    const removed = await svc.removeAttachment(attachmentId);
    if (!removed) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: removed.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.attachment_removed",
      entityType: "issue",
      entityId: removed.issueId,
      details: {
        attachmentId: removed.id,
      },
    });

    res.json({ ok: true });
  });

  return router;
}
