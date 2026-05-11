import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onboardingRoutes } from "../routes/onboarding.js";

const mockCompanyService = vi.hoisted(() => ({
  create: vi.fn(),
}));

const mockAgentService = vi.hoisted(() => ({
  create: vi.fn(),
}));

const mockGoalService = vi.hoisted(() => ({
  create: vi.fn(),
}));

const mockIssueService = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock("../services/index.js", () => ({
  companyService: () => mockCompanyService,
  agentService: () => mockAgentService,
  goalService: () => mockGoalService,
  issueService: () => mockIssueService,
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/onboarding", onboardingRoutes({} as any));
  return app;
}

describe("onboarding routes", () => {
  beforeEach(() => {
    mockCompanyService.create.mockReset();
    mockAgentService.create.mockReset();
    mockGoalService.create.mockReset();
    mockIssueService.create.mockReset();

    mockCompanyService.create.mockResolvedValue({
      id: "company-1",
      name: "Acme",
    });
    mockAgentService.create.mockResolvedValue({
      id: "agent-1",
      name: "CEO",
    });
    mockGoalService.create.mockResolvedValue({
      id: "goal-1",
    });
    mockIssueService.create.mockResolvedValue({
      id: "issue-1",
    });
  });

  it("returns suggested tasks for preview without creating records", async () => {
    const app = createApp();

    const res = await request(app)
      .post("/api/onboarding/preview")
      .send({ companyName: "Acme" });

    expect(res.status).toBe(200);
    expect(res.body.suggestedTasks).toHaveLength(3);
    expect(mockCompanyService.create).not.toHaveBeenCalled();
    expect(mockAgentService.create).not.toHaveBeenCalled();
    expect(mockGoalService.create).not.toHaveBeenCalled();
    expect(mockIssueService.create).not.toHaveBeenCalled();
  });

  it("creates company, CEO agent, goal, and first issue during quickstart", async () => {
    const app = createApp();

    const res = await request(app)
      .post("/api/onboarding/quickstart")
      .send({ companyName: "Acme", taskTitle: "Draft roadmap" });

    expect(res.status).toBe(201);
    expect(res.body.companyId).toBe("company-1");
    expect(mockCompanyService.create).toHaveBeenCalledWith({ name: "Acme" });
    expect(mockAgentService.create).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({ name: "CEO" }),
    );
    expect(mockGoalService.create).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({ ownerAgentId: "agent-1" }),
    );
    expect(mockIssueService.create).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        title: "Draft roadmap",
        assigneeAgentId: "agent-1",
        goalId: "goal-1",
      }),
    );
  });
});
