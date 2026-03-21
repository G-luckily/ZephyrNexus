import type { WorkflowTemplate } from "@zephyr-nexus/shared";

export const BUILT_IN_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "tpl_engineering_feature",
    name: "Engineering Feature Workflow",
    description: "Standard end-to-end lifecycle for shipping a product feature, including spec, implementation, and review.",
    useCase: "适合标准的研发需求到验证闭环。",
    maybeExpectedOutcome: "需求文档卡片、源码交付物以及验证回执",
    tasks: [
      {
        key: "spec",
        title: "Product Requirement & Tech Spec",
        initialStatus: "todo",
        dependsOnKeys: [],
        outputContract: {
          requiresSummary: true,
          minFileDeliverables: 0,
        },
      },
      {
        key: "dev",
        title: "Implementation & Code",
        initialStatus: "blocked",
        dependsOnKeys: ["spec"],
        outputContract: {
          requiresSummary: true,
          minFileDeliverables: 1, // Expecting a PR link or code artifact
        },
      },
      {
        key: "review",
        title: "Code Review & QA Acceptance",
        initialStatus: "blocked",
        dependsOnKeys: ["dev"],
        outputContract: {
          requiresSummary: true,
          minFileDeliverables: 0,
        },
      },
      {
        key: "release",
        title: "Deploy & Release",
        initialStatus: "blocked",
        dependsOnKeys: ["review"],
        outputContract: {
          requiresSummary: true,
          minFileDeliverables: 0,
        },
      },
    ],
  },
  {
    id: "tpl_bug_resolution",
    name: "Bug Fix & Verification",
    description: "Streamlined workflow for reproducing, fixing, and verifying a bug.",
    useCase: "适合线上故障排查、短平快抢修到验证的应急链路。",
    maybeExpectedOutcome: "修复分支交付物与测试结果截屏",
    tasks: [
      {
        key: "repro",
        title: "Bug Reproduction & Triage",
        initialStatus: "todo",
        dependsOnKeys: [],
        outputContract: {
          requiresSummary: true,
          minFileDeliverables: 0,
        },
      },
      {
        key: "fix",
        title: "Bug Fix Implementation",
        initialStatus: "blocked",
        dependsOnKeys: ["repro"],
        outputContract: {
          requiresSummary: true,
          minFileDeliverables: 1,
        },
      },
      {
        key: "verify",
        title: "Verification & Release",
        initialStatus: "blocked",
        dependsOnKeys: ["fix"],
        outputContract: {
          requiresSummary: true,
          minFileDeliverables: 0,
        },
      },
    ],
  },
];
