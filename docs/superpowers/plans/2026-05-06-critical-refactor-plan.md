# ZephyrNexus Critical Refactor Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all CRITICAL code quality issues across services, components, and adapters modules — oversized functions, missing error handlers, infinite loops, and type safety.

**Architecture:** Refactor-only — no functional changes. Each fix is self-contained and addresses one specific code smell. Split large files by extracting logical units (prepare → execute → cleanup phases, error handlers, etc.).

**Tech Stack:** TypeScript, Node.js, React

---

## File Map

| File | Changes |
|------|---------|
| `server/src/services/heartbeat.ts` | Split `executeRun()` (733 lines) into prepare/execute/cleanup phases; fix deep nesting in `releaseIssueExecutionAndPromote()` |
| `server/src/services/issues.ts` | Fix deep nesting in `checkout()`; replace `any` types in `withHealthSummaries()`; add constants |
| `packages/adapters/openclaw-gateway/src/server/execute.ts` | Fix missing `error` event on `spawn`; add max-retries to `while(true)` loop |
| `ui/src/components/IssuesList.tsx` | Extract sub-components (Toolbar, FilterBar, IssueRow) to reduce from 1045 to ~400 lines |
| `packages/adapters/claude-local/src/server/execute.ts` | Wrap `runChildProcess` calls in try/catch |
| `packages/adapters/codex-local/src/server/execute.ts` | Wrap `runChildProcess` calls in try/catch |
| `packages/adapters/opencode-local/src/server/execute.ts` | Wrap `runChildProcess` calls in try/catch |

---

## Task 1: Refactor `heartbeat.ts` — Split `executeRun()`

**Files:**
- Modify: `server/src/services/heartbeat.ts`

### Sub-Task 1a: Analyze `executeRun()` structure

Read `server/src/services/heartbeat.ts` lines 1101-1834 (executeRun function). Map the three phases:
1. **Prepare phase** (lines ~1101-1300): config building, workspace resolution
2. **Execute phase** (lines ~1300-1600): runChildProcess, stream parsing
3. **Cleanup phase** (lines ~1600-1834): result processing, state updates

### Sub-Task 1b: Extract `prepareRuntimeConfig()`

Create a new function at bottom of file (~line 2780):
```typescript
async function prepareRuntimeConfig(
  db: Db,
  agentId: string,
  runId: string,
  issueId: string | null,
  contextSnapshot: Record<string, unknown>,
  adapterOverride: string | null
): Promise<ResolvedWorkspaceAndConfig> {
  // Move ~150 lines from executeRun's prepare phase here
  // Returns { workspace, config, agent }
}
```

### Sub-Task 1c: Extract `processRunResult()`

Create a new function:
```typescript
async function processRunResult(
  db: Db,
  runId: string,
  result: ExecuteResult,
  resolved: ResolvedWorkspaceAndConfig
): Promise<void> {
  // Move cleanup phase logic here
}
```

### Sub-Task 1d: Rewrite `executeRun()` to delegate

Replace the 733-line function body with ~50 lines:
```typescript
async function executeRun(
  db: Db,
  agentId: string,
  runId: string,
  issueId: string | null
): Promise<void> {
  const contextSnapshot = await loadContextSnapshot(db, runId);
  const adapterOverride = await getAdapterOverride(db, runId);

  const { workspace, config, agent } = await prepareRuntimeConfig(
    db, agentId, runId, issueId, contextSnapshot, adapterOverride
  );

  const result = await runChildProcess({ workspace, config, agent });

  await processRunResult(db, runId, result, { workspace, config, agent });
}
```

### Sub-Task 1e: Fix deep nesting in `releaseIssueExecutionAndPromote()`

Read lines 1835-1967. Replace the 6-level nested `while(true)` with:
```typescript
const MAX_PROMOTION_ATTEMPTS = 10;
let attempts = 0;

while (attempts < MAX_PROMOTION_ATTEMPTS) {
  attempts++;
  const deferred = await tx.select().from(deferredWakes).where(...).for("update");
  if (!deferred) return null;

  const deferredAgent = await tx.select().from(agents).where(...);
  if (!deferredAgent) {
    await tx.update(deferredWakes).set({ status: " orphaned" }).where(...);
    continue;
  }

  const enriched = enrichWakeContextSnapshot({ contextSnapshot: deferred.contextSnapshot, agent: deferredAgent });
  // ... rest of logic

  if (/* success */) return result;
  if (/* no more work */) return null;
}
```

### Sub-Task 1f: Add magic number constants

Add at top of file:
```typescript
const MAX_CHAIN_OF_COMMAND = 50;
const MAX_PROMOTION_ATTEMPTS = 10;
const DEFAULT_TRUNCATE_MAX = 128;
const MAX_CONTEXT_CHARS_CAP = 100_000;
```

Replace inline usages.

### Sub-Task 1g: Fix any types in utility functions

Replace:
```typescript
async function withHealthSummaries(dbOrTx: any, companyId: string, contextUserId: string | undefined, rows: any[]): Promise<any[]>
```

With proper types. If the actual DB type is complex, use a type alias:
```typescript
type DbOrTx = Db | Transaction;
async function withHealthSummaries(dbOrTx: DbOrTx, companyId: string, contextUserId: string | undefined, rows: IssueRow[]): Promise<IssueWithHealth[]>
```

### Sub-Task 1h: Commit

```bash
git add server/src/services/heartbeat.ts
git commit -m "refactor(heartbeat): split executeRun() into prepare/execute/process phases"
```

---

## Task 2: Refactor `issues.ts` — Fix deep nesting and type safety

**Files:**
- Modify: `server/src/services/issues.ts`

### Sub-Task 2a: Read `checkout()` lines 924-1050

Map the 5-level nested logic. Key sections:
1. Lines 984-1004: First adopt stale checkout attempt
2. Lines 1006-1041: Second adopt stale checkout attempt
3. Lines ~1015-1025: Notification insertion

### Sub-Task 2b: Extract `adoptStaleCheckoutIfNeeded()`

```typescript
async function adoptStaleCheckoutIfNeeded(
  db: Db,
  issueId: string,
  agentId: string,
  checkoutRunId: string,
  current: Issue
): Promise<Issue | null> {
  // First adopt attempt — lines ~984-1004
  if (
    current.assigneeAgentId === agentId &&
    current.status === "in_progress" &&
    current.checkoutRunId == null &&
    (current.executionRunId == null || current.executionRunId === checkoutRunId)
  ) {
    const adopted = await db.update(issues)...
    if (adopted) return adopted;
  }
  return null;
}
```

### Sub-Task 2c: Extract `insertDependencyBlockedNotification()`

```typescript
async function insertDependencyBlockedNotification(
  db: Db,
  companyId: string,
  userId: string | undefined,
  issueId: string,
  issueIdentifier: string,
  blockedBy: string
): Promise<void> {
  if (!userId) return;
  await db.insert(notifications).values({
    companyId,
    userId,
    title: "依赖未满足 (Dependency Blocked)",
    body: `任务 ${issueIdentifier} 在推进状态时被关联的前置任务阻塞。`,
    type: "dependency_blocked",
    relatedIssueId: issueId,
  });
}
```

### Sub-Task 2d: Rewrite `checkout()` with early returns

After extracting, `checkout()` should be ~80 lines. Max nesting 3 levels.

### Sub-Task 2e: Add UUID_REGEX constant

```typescript
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
```

Replace inline regex at line ~208.

### Sub-Task 2f: Commit

```bash
git add server/src/services/issues.ts
git commit -m "refactor(issues): split checkout() into helper functions, fix deep nesting"
```

---

## Task 3: Fix `openclaw-gateway/execute.ts` — spawn error handler + infinite loop

**Files:**
- Modify: `packages/adapters/openclaw-gateway/src/server/execute.ts`

### Sub-Task 3a: Find `runOfficeDispatch` spawn call (lines ~810-850)

Read the spawn code. Current pattern:
```typescript
const child = spawn("bash", [args.scriptPath, args.role, args.message], { env: ... });
child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
// NOTE: child.on("error", ...) is MISSING
child.on("close", (code) => {
  if (timer) clearTimeout(timer);
  resolve({ code: code ?? 1, stdout, stderr });
});
```

### Sub-Task 3b: Add error event handler

```typescript
child.on("error", (err) => {
  if (timer) clearTimeout(timer);
  reject(new Error(`spawn failed: ${err.message}`));
});
```

Make sure `timer` is defined before the spawn (it's likely already there). The key fix is adding the error handler AND converting the resolve pattern to use a wrapper Promise that handles both error and close.

### Sub-Task 3c: Add max-retries to while(true) loop (line ~1659)

Read lines 1650-1750. Replace:
```typescript
while (true) {
  // retry logic with no bound
  if (condition) continue;
  break;
}
```

With:
```typescript
const MAX_DISPATCH_RETRIES = 5;
let attempt = 0;

while (attempt < MAX_DISPATCH_RETRIES) {
  attempt++;
  try {
    // existing retry logic
    const result = await attemptDispatch(...);
    if (result.done) return result.value;
    if (result.noMoreWork) return null;
  } catch (err) {
    if (attempt >= MAX_DISPATCH_RETRIES) throw err;
    await sleep(100 * attempt); // backoff
  }
}
return null; // exhausted retries
```

### Sub-Task 3d: Commit

```bash
git add packages/adapters/openclaw-gateway/src/server/execute.ts
git commit -m "fix(openclaw-gateway): add spawn error handler and bounded retry loop"
```

---

## Task 4: Extract `IssuesList.tsx` sub-components

**Files:**
- Create: `ui/src/components/issues/IssuesToolbar.tsx`
- Create: `ui/src/components/issues/IssuesFilterBar.tsx`
- Create: `ui/src/components/issues/IssueRow.tsx`
- Modify: `ui/src/components/IssuesList.tsx`

### Sub-Task 4a: Read IssuesList.tsx

Read lines 1-300 to understand:
- What state does the component manage?
- What props does it receive?
- What are the logical sections (filter, list, toolbar)?

### Sub-Task 4b: Create `IssuesToolbar.tsx`

Extract lines ~250-400 (filter/search bar) into a new component with props:
```typescript
interface IssuesToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  groupBy: string;
  onGroupByChange: (groupBy: string) => void;
  // ... other filter controls
}
```

### Sub-Task 4c: Create `IssuesFilterBar.tsx`

Extract the filter chips/state toggles section.

### Sub-Task 4d: Create `IssueRow.tsx`

Extract the individual issue row rendering (~50 lines per row logic).

### Sub-Task 4d: Rewrite `IssuesList.tsx`

After extraction, the component should be ~400 lines, delegating to extracted components. Keep props interface at top, add imports for new components.

### Sub-Task 4e: Verify compilation

```bash
cd /home/glf/projects/ZephyrNexus/ui && pnpm tsc --noEmit 2>&1 | head -20
```

### Sub-Task 4f: Commit

```bash
git add ui/src/components/issues/ ui/src/components/IssuesList.tsx
git commit -m "refactor(issues-list): extract Toolbar, FilterBar, IssueRow sub-components"
```

---

## Task 5: Fix adapter error handling — wrap runChildProcess

**Files:**
- Modify: `packages/adapters/claude-local/src/server/execute.ts`
- Modify: `packages/adapters/codex-local/src/server/execute.ts`
- Modify: `packages/adapters/opencode-local/src/server/execute.ts`

### Sub-Task 5a: Fix claude-local

Read around lines 420-435 where `runChildProcess` is called. Wrap in try/catch:
```typescript
// Before
const result = await runChildProcess({ ... });

// After
let result;
try {
  result = await runChildProcess({ ... });
} catch (err) {
  throw new Error(`execute failed: ${err instanceof Error ? err.message : String(err)}`);
}
```

### Sub-Task 5b: Fix codex-local

Same pattern, around line 271.

### Sub-Task 5c: Fix opencode-local

Same pattern, around line 271.

### Sub-Task 5d: Commit each

```bash
git add packages/adapters/claude-local/src/server/execute.ts
git commit -m "fix(claude-local): wrap runChildProcess in try/catch"

git add packages/adapters/codex-local/src/server/execute.ts
git commit -m "fix(codex-local): wrap runChildProcess in try/catch"

git add packages/adapters/opencode-local/src/server/execute.ts
git commit -m "fix(opencode-local): wrap runChildProcess in try/catch"
```

---

## Task 6: Final Verification

- [ ] **Step 1: Run TypeScript check**

```bash
cd /home/glf/projects/ZephyrNexus && pnpm -r tsc --noEmit 2>&1 | grep -E "(heartbeat|issues\.ts|openclaw|claude-local|codex-local|opencode-local|IssuesList)" | head -20
```

- [ ] **Step 2: Run tests**

```bash
cd /home/glf/projects/ZephyrNexus && pnpm test:run 2>&1 | tail -5
```

- [ ] **Step 3: Report results**

---

## Self-Review Checklist

- [ ] All 5 tasks complete
- [ ] Each fix in its own commit
- [ ] No function > 500 lines in heartbeat.ts after refactor
- [ ] No 5+ level nesting in issues.ts checkout() after refactor
- [ ] openclaw-gateway spawn has error handler
- [ ] openclaw-gateway while(true) has max retries
- [ ] IssuesList.tsx reduced to ~400 lines
- [ ] All runChildProcess calls wrapped in try/catch
- [ ] TypeScript compiles without new errors
- [ ] Tests pass