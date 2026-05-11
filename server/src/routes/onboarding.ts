import { Router } from "express";
import type { Db } from "@zephyr-nexus/db";
import { companyService, agentService, goalService, issueService } from "../services/index.js";

interface QuickstartTask {
  title: string;
  description: string;
}

interface QuickstartResponse {
  companyId: string;
  companyName: string;
  agentId: string;
  agentName: string;
  suggestedTasks: QuickstartTask[];
}

const SUGGESTED_TASKS: QuickstartTask[] = [
  {
    title: "Analyze market trends for Q2",
    description: "Research and summarize key market trends that could impact the company's direction. Focus on competitor movements, emerging technologies, and regulatory changes.",
  },
  {
    title: "Draft founding engineer hiring plan",
    description: "Create a detailed hiring plan for the first engineering hire including role definition, interview process, and onboarding timeline.",
  },
  {
    title: "Set up reporting rhythm",
    description: "Establish a weekly status reporting format for the CEO to share progress, blockers, and priorities with stakeholders.",
  },
];

export function onboardingRoutes(db: Db) {
  const router = Router();
  const companies = companyService(db);
  const agents = agentService(db);
  const goals = goalService(db);
  const issues = issueService(db);

  router.post("/preview", (req, res) => {
    const { companyName } = req.body as {
      companyName: string;
    };

    if (!companyName || typeof companyName !== "string" || companyName.trim().length === 0) {
      res.status(400).json({ error: "companyName is required" });
      return;
    }

    res.json({ suggestedTasks: SUGGESTED_TASKS });
  });

  router.post("/quickstart", async (req, res) => {
    const { companyName, taskTitle, taskDescription } = req.body as {
      companyName: string;
      taskTitle?: string;
      taskDescription?: string;
    };

    if (!companyName || typeof companyName !== "string" || companyName.trim().length === 0) {
      res.status(400).json({ error: "companyName is required" });
      return;
    }

    // 1. Create company
    const company = await companies.create({ name: companyName.trim() });

    // 2. Create CEO agent
    const ceoAgent = await agents.create(company.id, {
      name: "CEO",
      role: "executive",
      title: "Chief Executive Officer",
      status: "idle",
      capabilities: null,
      adapterType: "human",
      adapterConfig: {},
      runtimeConfig: {},
      budgetMonthlyCents: 0,
      permissions: { canCreateAgents: true },
      metadata: null,
    });

    // 3. Create company-level goal
    const goal = await goals.create(company.id, {
      title: "Lead company to success",
      description: "Establish and execute on company strategy, build the team, and drive growth.",
      level: "company",
      status: "planned",
      ownerAgentId: ceoAgent.id,
    });

    // 4. If taskTitle provided, create an issue assigned to the CEO
    if (taskTitle && typeof taskTitle === "string" && taskTitle.trim().length > 0) {
      await issues.create(company.id, {
        title: taskTitle.trim(),
        description: taskDescription ?? null,
        status: "todo",
        priority: "medium",
        assigneeAgentId: ceoAgent.id,
        projectId: null,
        goalId: goal.id,
        parentId: null,
        requestDepth: 0,
        billingCode: null,
        assigneeAdapterOverrides: null,
        executionWorkspaceSettings: null,
        labelIds: undefined,
        dependsOn: undefined,
      });
    }

    const response: QuickstartResponse = {
      companyId: company.id,
      companyName: company.name,
      agentId: ceoAgent.id,
      agentName: ceoAgent.name,
      suggestedTasks: SUGGESTED_TASKS,
    };

    res.status(201).json(response);
  });

  return router;
}
