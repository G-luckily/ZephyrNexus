# Heartbeat ExecuteRun Refactor Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the oversized `executeRun()` function (currently ~600 lines within a 2780-line file) into focused, composable helper functions. No functional changes.

**Architecture:** The approach is to extract logical phases into named helper functions at module level. Each helper will receive the state it needs as parameters and return what it computes. Shared mutable state (`run`, `seq`, `stdoutExcerpt`, `stderrExcerpt`, `handle`) stays in the outer function but is passed explicitly where possible.

**Tech Stack:** TypeScript, Node.js, Drizzle ORM

---

## File Map

| File | Changes |
|------|---------|
| `server/src/services/heartbeat.ts` | Extract 4-6 helper functions from `executeRun()`; no new files |

---

## Task 1: Extract `buildRuntimeContext()` — Prepare Phase Part 1

**Files:**
- Modify: `server/src/services/heartbeat.ts:1101-1300`

Read lines 1101-1300 of `executeRun()`. This section handles:
1. Agent fetch + budget guard (lines 1115-1166)
2. Runtime state + context parsing (lines 1168-1172)
3. Issue assignee config resolution (lines 1173-1193)
4. Issue budget guard (lines 1194-1230)
5. Project/workspace policy resolution (lines 1232-1268)

### Step 1: Read the prepare phase

Look at lines 1101-1300 and identify all the early-return guard blocks. The structure is:

```
function executeRun(runId) {
  // Guard: run not found / wrong status
  // Guard: agent not found
  // Guard: budget exceeded (agent level)
  // Guard: budget exceeded (issue level)
  // ... then workspace resolution starts
}
```

### Step 2: Create `buildRuntimeContext()` function

Extract everything from "agent fetch" to "just before runLogStore.begin" into a new async function:

```typescript
async function buildRuntimeContext(params: {
  run: HeartbeatRun;
  db: Db;
  agentsSvc: ReturnType<typeof agentService>;
  issuesSvc: ReturnType<typeof issueService>;
  costSvc: ReturnType<typeof costService>;
  secretsSvc: ReturnType<typeof secretsService>;
  setRunStatus: typeof setRunStatus;
  setWakeupStatus: typeof setWakeupStatus;
  releaseIssueExecutionAndPromote: typeof releaseIssueExecutionAndPromote;
  appendRunEvent: typeof appendRunEvent;
}): Promise<{
  agent: Agent;
  context: Record<string, unknown>;
  sessionCodec: SessionCodec;
  issueId: string | null;
  resolvedWorkspace: ResolvedWorkspace;
  resolvedConfig: ResolvedAdapterConfig;
  runtimeForAdapter: RuntimeForAdapter;
  runtimeWorkspaceWarnings: string[];
  executionWorkspace: ExecutionWorkspace;
} | { done: true }> {
  const { run, db, agentsSvc, costSvc, secretsSvc, setRunStatus, setWakeupStatus, releaseIssueExecutionAndPromote, appendRunEvent } = params;

  // Agent fetch + budget guard (lines 1115-1166)
  const agent = await agentsSvc.getById(run.agentId);
  if (!agent) {
    await setRunStatus(run.id, "failed", { error: "Agent not found", ... });
    // ... rest of agent-not-found handling
    return { done: true };
  }

  // Budget guard (lines 1131-1166)
  // ... budget check code ...

  // Context + task resolution (lines 1168-1230)
  const context = parseObject(run.contextSnapshot);
  // ... issue assignee config + issue budget guard ...

  // Workspace resolution (lines 1256-1297)
  const resolvedWorkspace = await resolveWorkspaceForRun(...);
  // ... more workspace config building ...

  return { agent, context, sessionCodec, issueId, resolvedWorkspace, resolvedConfig, runtimeForAdapter, runtimeWorkspaceWarnings, executionWorkspace };
}
```

### Step 3: Verify TypeScript compiles

Run: `cd /home/glf/projects/ZephyrNexus/.worktrees/critical-refactor && pnpm -r tsc --noEmit 2>&1 | head -10`

### Step 4: Commit

```bash
git add server/src/services/heartbeat.ts
git commit -m "refactor(heartbeat): extract buildRuntimeContext() from executeRun prepare phase"
```

---

## Task 2: Extract `captureRunOutput()` — Execute Phase

**Files:**
- Modify: `server/src/services/heartbeat.ts:1440-1650`

Read lines 1440-1650. This section handles:
1. `runLogStore.begin()` — log store init
2. `onLog` callback — live log streaming
3. Adapter execution (lines ~1490-1520)
4. Context snapshot writing (lines ~1623-1650)
5. Outcome determination (lines ~1660-1685)

### Step 1: Read the execute phase

### Step 2: Create `captureRunOutput()` function

```typescript
async function captureRunOutput(params: {
  run: HeartbeatRun;
  adapterResult: AdapterExecuteResult;
  context: Record<string, unknown>;
  runtimeForAdapter: RuntimeForAdapter;
  previousSessionParams: SessionParams;
  sessionCodec: SessionCodec;
  stdoutExcerpt: string;
  stderrExcerpt: string;
  handle: LogHandle | null;
  runLogStore: LogStore;
  issuesSvc: ReturnType<typeof issueService>;
}): Promise<{
  outcome: "succeeded" | "failed" | "cancelled" | "timed_out";
  logSummary: { bytes: number; sha256?: string; compressed: boolean } | null;
  nextSessionState: string;
}> {
  const { run, adapterResult, context, runtimeForAdapter, previousSessionParams, sessionCodec, handle, runLogStore } = params;

  // Context snapshot writing (lines 1623-1651)
  // ... writeDiffSnapshot logic ...

  // Resolve next session state (lines 1652-1658)
  const nextSessionState = resolveNextSessionState({
    codec: sessionCodec,
    adapterResult,
    previousParams: previousSessionParams,
    previousDisplayId: runtimeForAdapter.sessionDisplayId,
    previousLegacySessionId: runtimeForAdapter.sessionId,
  });

  // Determine outcome (lines 1660-1685)
  let outcome: "succeeded" | "failed" | "cancelled" | "timed_out";
  const latestRun = await getRun(run.id);
  // ... outcome logic ...

  // Finalize log store
  let logSummary = null;
  if (handle) {
    logSummary = await runLogStore.finalize(handle);
  }

  return { outcome, logSummary, nextSessionState };
}
```

### Step 3: Verify and commit

```bash
git add server/src/services/heartbeat.ts
git commit -m "refactor(heartbeat): extract captureRunOutput() from executeRun"
```

---

## Task 3: Rewrite `executeRun()` to delegate to helpers

**Files:**
- Modify: `server/src/services/heartbeat.ts:1101-~1700`

After extracting both helpers, rewrite `executeRun()` to use them. The outer function should be ~150 lines:

```typescript
async function executeRun(runId: string) {
  let run = await getRun(runId);
  if (!run) return;
  if (run.status !== "queued" && run.status !== "running") return;

  if (run.status === "queued") {
    const claimed = await claimQueuedRun(run);
    if (!claimed) return;
    run = claimed;
  }

  const ctx = await buildRuntimeContext({ run, db, agentsSvc, issuesSvc, costSvc, secretsSvc, setRunStatus, setWakeupStatus, releaseIssueExecutionAndPromote, appendRunEvent });
  if ('done' in ctx) return;

  const { agent, context, sessionCodec, issueId, resolvedWorkspace, resolvedConfig, runtimeForAdapter, runtimeWorkspaceWarnings, executionWorkspace } = ctx;

  // Start logging phase (lines ~1440)
  let stdoutExcerpt = "";
  let stderrExcerpt = "";
  let handle: LogHandle | null = null;
  let seq = 0;

  handle = await runLogStore.begin({ companyId: run.companyId, agentId: run.agentId, runId });

  const onLog = async (stream: "stdout" | "stderr", chunk: string) => {
    // ... same as before ...
  };

  for (const warning of runtimeWorkspaceWarnings) {
    await onLog("stderr", `[paperclip] ${warning}\n`);
  }

  // Execute adapter (lines ~1490)
  const adapterEnv = Object.fromEntries(...);
  const runtimeServices = await ensureRuntimeServicesForRun({ ... });
  const adapterResult = await executeAdapterProcess({ ... });

  // Capture output
  const { outcome, logSummary, nextSessionState } = await captureRunOutput({
    run, adapterResult, context, runtimeForAdapter, previousSessionParams: normalizeSessionParams(...), sessionCodec, stdoutExcerpt, stderrExcerpt, handle, runLogStore, issuesSvc
  });

  // Finalize (lines ~1697+)
  await finalizeRunOutcome(run, agent, outcome, logSummary, nextSessionState, adapterResult, runtimeForAdapter);
}
```

### Step 2: Verify TypeScript compiles

```bash
cd /home/glf/projects/ZephyrNexus/.worktrees/critical-refactor && pnpm -r tsc --noEmit 2>&1 | head -20
```

### Step 3: Commit

```bash
git add server/src/services/heartbeat.ts
git commit -m "refactor(heartbeat): rewrite executeRun() to delegate to extracted helpers"
```

---

## Task 4: Final Verification

- [ ] **Step 1: Run TypeScript check**

```bash
cd /home/glf/projects/ZephyrNexus/.worktrees/critical-refactor && pnpm -r tsc --noEmit 2>&1 | grep "heartbeat.ts" | head -10
```

- [ ] **Step 2: Run tests**

```bash
cd /home/glf/projects/ZephyrNexus/.worktrees/critical-refactor && pnpm test:run 2>&1 | tail -5
```

- [ ] **Step 3: Verify executeRun() reduced**

Run: `grep -n "async function executeRun" server/src/services/heartbeat.ts`

Count lines of executeRun after refactor (should be ~150-200 lines, down from ~600).

---

## Self-Review Checklist

- [ ] `buildRuntimeContext()` extracted and handles all 5 guard paths
- [ ] `captureRunOutput()` extracted and handles outcome determination
- [ ] `executeRun()` reduced to ~150-200 lines
- [ ] No function > 50 lines grows beyond what was there before
- [ ] TypeScript compiles without new errors
- [ ] Tests pass (pre-existing failure unrelated)
- [ ] 3 commits (one per task) or fewer if implementer combines