# Code Quality Critical Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all CRITICAL code quality issues across 3 files (issues.ts, server-utils.ts, Dashboard.tsx) — type safety, deep nesting, oversized files, silent failures.

**Architecture:** Refactor-only — no functional changes, no API contracts modified. Each fix is self-contained and addresses one specific code smell. Dashboard inline components are extracted to individual files in `ui/src/components/dashboard/`.

**Tech Stack:** TypeScript, React, Express, Drizzle ORM

---

## File Map

| File | Changes |
|------|---------|
| `server/src/routes/issues.ts` | Fix `any[]` types, fix deep nesting (899-924), extract sub-handlers from 408-line PATCH |
| `packages/adapter-utils/src/server-utils.ts` | Fix silent `parseJson` failure |
| `ui/src/pages/Dashboard.tsx` | Extract 6 inline components, fix `any[]` types, add constants |
| `ui/src/components/dashboard/OrgRuntimePanel.tsx` | **NEW** — extracted component |
| `ui/src/components/dashboard/ActiveAgentsPanel.tsx` | **NEW** — extracted component |
| `ui/src/components/dashboard/ZephyrHero.tsx` | **NEW** — extracted component |
| `ui/src/components/dashboard/SystemMetricsPanel.tsx` | **NEW** — extracted component |
| `ui/src/components/dashboard/OrchestrationLane.tsx` | **NEW** — extracted component |
| `ui/src/components/dashboard/MissionControl.tsx` | **NEW** — extracted component |
| `ui/src/components/dashboard/EventTimeline.tsx` | **NEW** — extracted component |
| `ui/src/types/dashboard.ts` | **NEW** — shared TypeScript interfaces |

---

## Task 1: Fix `server-utils.ts` — Silent JSON Parse Failure

**Files:**
- Modify: `packages/adapter-utils/src/server-utils.ts:59-65`

- [ ] **Step 1: Read current implementation**

```typescript
export function parseJson(value: string): Record<string, unknown> | null {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;  // SILENT FAILURE — caller cannot distinguish from valid null
  }
}
```

- [ ] **Step 2: Replace with discriminated union**

```typescript
export type ParseResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string };

export function parseJson(value: string): ParseResult {
  try {
    return { ok: true, data: JSON.parse(value) as Record<string, unknown> };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown parse error"
    };
  }
}
```

- [ ] **Step 3: Find and update all call sites**

Search for `parseJson(` across the codebase. Every call site must be updated to check `.ok`:
```typescript
// Before
const result = parseJson(someString);
if (result === null) { /* handle error */ }

// After
const result = parseJson(someString);
if (!result.ok) { /* handle error using result.error */ }
const data = result.data;
```

Run: `grep -rn "parseJson(" --include="*.ts" packages/adapter-utils/src/`
Expected: Show all call sites that need updating.

- [ ] **Step 4: Commit**

```bash
git add packages/adapter-utils/src/server-utils.ts
git commit -m "fix(adapter-utils): make parseJson return discriminated union instead of silent null"
```

---

## Task 2: Fix `issues.ts` — `any[]` Type Arrays

**Files:**
- Modify: `server/src/routes/issues.ts:392-393`, `server/src/routes/issues.ts:533`

- [ ] **Step 1: Read lines 380-460 to understand the context**

The arrays `attention` and `ready` are populated inside a `for (const issue of allIssues)` loop. Each gets objects with `id`, `type`, `issue`, and `reason` fields.

- [ ] **Step 2: Define interfaces above the route function**

```typescript
interface ActionQueueEntry {
  id: string;
  type: "attention" | "ready";
  issue: typeof allIssues[number];
  reason: string | null;
  priority: number;
}
```

- [ ] **Step 3: Replace `any[]` with typed arrays**

Line ~392:
```typescript
// Before
const attention: any[] = [];
const ready: any[] = [];

// After
const attention: ActionQueueEntry[] = [];
const ready: ActionQueueEntry[] = [];
```

- [ ] **Step 4: Fix `as any` on line 533**

Read lines 520-545 to see `executionWorkspaceSettings` shape. Define:
```typescript
interface ExecutionWorkspaceSettings {
  budgetCents?: number;
  // ... other fields from the actual schema
}
```

Then replace:
```typescript
// Before
const budgetCents = Number((issue.executionWorkspaceSettings as any)?.budgetCents ?? 0);

// After
const budgetCents = Number(issue.executionWorkspaceSettings?.budgetCents ?? 0);
```

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/issues.ts
git commit -m "fix(issues): replace any[] with typed ActionQueueEntry interface"
```

---

## Task 3: Fix `issues.ts` — Deep Nesting (5-level → early returns)

**Files:**
- Modify: `server/src/routes/issues.ts:898-924`

- [ ] **Step 1: Read the current 5-level nesting block**

Lines 898-924. The nesting structure is:
```
if (updateFields.status && ...) {          // L1
  const dependsOn = ...;
  if (dependsOn.length > 0) {               // L2
    const incompleteDeps = await db...;
    if (incompleteDeps.length > 0) {        // L3
      const blockedBy = ...;
      if (req.actor.userId) {              // L4
        await db.insert(notifications)...;
        res.status(400).json({ error: ... });
        return;
      }
    }
  }
}
```

- [ ] **Step 2: Replace with early-return guard pattern**

```typescript
// Guard: skip if status not changing to blocking states
const blockingStatuses = ["in_progress", "in_review", "done"];
if (
  !updateFields.status ||
  updateFields.status === existing.status ||
  !blockingStatuses.includes(updateFields.status)
) {
  // Not a blocking transition — skip dependency gate
}
else {
  const dependsOn = (updateFields.dependsOn as string[] | undefined) ?? (existing.dependsOn as string[] | null) ?? [];

  if (dependsOn.length === 0) {
    // No dependencies — skip
  } else {
    const incompleteDeps = await db
      .select({ identifier: issues.identifier })
      .from(issues)
      .where(and(inArray(issues.id, dependsOn), sql`status != 'done'`));

    if (incompleteDeps.length === 0) {
      // All deps complete — skip
    } else {
      const blockedBy = incompleteDeps.map(d => d.identifier).join(", ");

      if (!req.actor.userId) {
        // Anonymous — skip notification but still block
        res.status(400).json({
          error: `未满足前置依赖 (Dependency Gate)：当前任务状态流转被阻塞。\n请先完成依赖任务：${blockedBy}`
        });
        return;
      }

      await db.insert(notifications).values({
        companyId: existing.companyId,
        userId: req.actor.userId,
        title: "依赖未满足 (Dependency Blocked)",
        body: `任务 ${existing.identifier ?? existing.id.slice(0, 8)} 在推进状态时被关联的前置任务阻塞。`,
        type: "dependency_blocked",
        relatedIssueId: existing.id,
      });

      res.status(400).json({
        error: `未满足前置依赖 (Dependency Gate)：当前任务状态流转被阻塞。\n请先完成依赖任务：${blockedBy}`
      });
      return;
    }
  }
}
```

Max nesting is now **3 levels** (down from 5).

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/issues.ts
git commit -m "refactor(issues): replace 5-level nesting with early-return guard pattern"
```

---

## Task 4: Extract Dashboard Inline Components

**Files:**
- Create: `ui/src/components/dashboard/OrgRuntimePanel.tsx`
- Create: `ui/src/components/dashboard/ActiveAgentsPanel.tsx`
- Create: `ui/src/components/dashboard/ZephyrHero.tsx`
- Create: `ui/src/components/dashboard/SystemMetricsPanel.tsx`
- Create: `ui/src/components/dashboard/OrchestrationLane.tsx`
- Create: `ui/src/components/dashboard/MissionControl.tsx`
- Create: `ui/src/components/dashboard/EventTimeline.tsx`
- Create: `ui/src/types/dashboard.ts`
- Modify: `ui/src/pages/Dashboard.tsx`

> **Note on order:** Extract one component at a time. After each extraction, verify the page still compiles (`cd ui && pnpm tsc --noEmit`). If a compilation error occurs, fix it before continuing to the next component.

### Sub-task 4a: Extract shared types

- [ ] **Step 1: Create `ui/src/types/dashboard.ts`**

Read the Dashboard.tsx file to find all shared types used by inline components (Issue, Agent, OrgUnit, etc.). Define them here. At minimum:

```typescript
// ui/src/types/dashboard.ts
export interface HealthSummary {
  unreadNotificationCount?: number;
  contractSatisfied?: boolean;
  missingSummary?: boolean;
  missingFileCount?: number;
  // ... fill in all fields found in the code
}

export interface Issue {
  id: string;
  identifier?: string;
  status: string;
  healthSummary?: HealthSummary;
  // ... fill in all fields
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/types/dashboard.ts
git commit -m "feat(dashboard): extract shared TypeScript interfaces"
```

### Sub-task 4b: Extract `OrgRuntimePanel`

- [ ] **Step 1: Read lines 1030-1179 of Dashboard.tsx**

Identify the component's props interface and all external state it consumes.

- [ ] **Step 2: Create `ui/src/components/dashboard/OrgRuntimePanel.tsx`**

Extract the component with its props interface. Use imports from `../../types/dashboard` for shared types.

- [ ] **Step 3: Update Dashboard.tsx**

Add import:
```typescript
import { OrgRuntimePanel } from "../components/dashboard/OrgRuntimePanel";
```

Remove the inline definition (lines 1030-1179). Replace usage with `<OrgRuntimePanel ... />`.

- [ ] **Step 4: Verify compilation**

Run: `cd /home/glf/projects/ZephyrNexus/ui && pnpm tsc --noEmit`
Expected: No errors related to OrgRuntimePanel

- [ ] **Step 5: Commit**

```bash
git add ui/src/components/dashboard/OrgRuntimePanel.tsx ui/src/pages/Dashboard.tsx
git commit -m "refactor(dashboard): extract OrgRuntimePanel inline component"
```

### Sub-task 4c: Extract `ActiveAgentsPanel`

- [ ] **Step 1: Read lines 1181-1355 of Dashboard.tsx**

- [ ] **Step 2: Create `ui/src/components/dashboard/ActiveAgentsPanel.tsx`**

- [ ] **Step 3: Update Dashboard.tsx** — import and remove inline definition

- [ ] **Step 4: Verify compilation**

- [ ] **Step 5: Commit**

### Sub-task 4d: Extract remaining 5 components

Repeat the same pattern for:
- `ZephyrHero` (lines 1357-1459)
- `SystemMetricsPanel` (lines 1461-1559)
- `OrchestrationLane` (lines 1561-1709)
- `MissionControl` (lines 1711-1737)
- `EventTimeline` (lines 1739-1824)

Each gets its own commit.

---

## Task 5: Fix `Dashboard.tsx` — `any[]` Type Arrays

**Files:**
- Modify: `ui/src/pages/Dashboard.tsx:392-393`, `ui/src/pages/Dashboard.tsx:464`

- [ ] **Step 1: Define proper interfaces using types from `../../types/dashboard`**

```typescript
// Define based on actual data shape — look at what gets pushed into these arrays
interface AttentionItem {
  issue: Issue;
  reason: string;
  priority: number;
  // ... fill in
}
```

- [ ] **Step 2: Replace `any[]` arrays**

```typescript
// Before
const attention: any[] = [];
const ready: any[] = [];
const createdIssues: Array<{ templateTask: any; issue: any }> = [];

// After
const attention: AttentionItem[] = [];
const ready: AttentionItem[] = [];
const createdIssues: Array<{ templateTask: unknown; issue: Issue }> = [];
```

- [ ] **Step 3: Fix unsafe cast line 734**

```typescript
// Before
const issueId = (run as { issueId?: string }).issueId;

// After — use a type guard or proper cast
const issueId = typeof run === 'object' && run !== null && 'issueId' in run
  ? (run as { issueId?: string }).issueId
  : undefined;
```

- [ ] **Step 4: Commit**

```bash
git add ui/src/pages/Dashboard.tsx
git commit -m "fix(dashboard): replace any[] with typed interfaces"
```

---

## Task 6: Fix `Dashboard.tsx` — Magic Numbers

**Files:**
- Modify: `ui/src/pages/Dashboard.tsx`

- [ ] **Step 1: Add constants at the top of the file (after imports)**

```typescript
// Dashboard metrics constants
const CHART_BAR_MIN_HEIGHT = 2;
const CHART_BAR_MAX_HEIGHT = 26;
const RECENT_ISSUES_LIMIT = 5;
const AGENT_LOGS_LIMIT = 5;
const ORG_UNITS_DISPLAY_LIMIT = 12;
const HEALTH_CHECK_PASS_PERCENT = 96;
const ACTION_QUEUE_SLICE_LIMIT = 160;
```

- [ ] **Step 2: Replace magic numbers**

Search for each magic number and replace:
- `Math.round((b.total / maxTotal) * 26)` → `Math.round((b.total / maxTotal) * CHART_BAR_MAX_HEIGHT)`
- `b.total === 0 ? 2` → `b.total === 0 ? CHART_BAR_MIN_HEIGHT`
- `.slice(0, 160)` → `.slice(0, ACTION_QUEUE_SLICE_LIMIT)`
- `.slice(0, 5)` → `.slice(0, RECENT_ISSUES_LIMIT)` or `AGENT_LOGS_LIMIT`
- `.slice(0, 12)` → `.slice(0, ORG_UNITS_DISPLAY_LIMIT)`
- `96%` → `{HEALTH_CHECK_PASS_PERCENT}%` (in JSX: `{HEALTH_CHECK_PASS_PERCENT}%`)

- [ ] **Step 3: Commit**

```bash
git add ui/src/pages/Dashboard.tsx
git commit -m "chore(dashboard): extract magic numbers to named constants"
```

---

## Task 7: Final Verification

- [ ] **Step 1: Run TypeScript check on entire project**

```bash
cd /home/glf/projects/ZephyrNexus && pnpm -r tsc --noEmit
```
Expected: No errors

- [ ] **Step 2: Run tests**

```bash
cd /home/glf/projects/ZephyrNexus && pnpm test
```
Or the existing test command. Expected: All pass

- [ ] **Step 3: Start dev server and smoke test**

```bash
cd /home/glf/projects/ZephyrNexus && pnpm dev
```
Expected: Server starts, Dashboard page loads without errors

- [ ] **Step 4: Final commit (if any last fixes needed)**

---

## Self-Review Checklist

- [ ] All 7 tasks complete
- [ ] Each fix is in its own commit
- [ ] No `any[]` remaining in the modified files
- [ ] No 5+ level nesting remaining in issues.ts
- [ ] All Dashboard inline components extracted to separate files
- [ ] `parseJson` returns discriminated union, all call sites updated
- [ ] TypeScript compiles without errors
- [ ] Tests pass
