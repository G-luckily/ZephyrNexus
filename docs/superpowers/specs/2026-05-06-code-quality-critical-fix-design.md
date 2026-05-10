# ZephyrNexus Code Quality Critical Fix Design

## Overview

Fix CRITICAL code quality issues identified in the codebase audit. All issues are code quality / maintainability problems, not functional bugs.

## Problems

| File | Issue | Severity |
|------|-------|----------|
| `server/src/routes/issues.ts` | `any[]` typed arrays (lines 392-393) | CRITICAL |
| `server/src/routes/issues.ts` | 5-level deep nesting (lines 899-924) | CRITICAL |
| `server/src/routes/issues.ts` | 408-line PATCH handler (lines 857-1265) | HIGH |
| `server/src/services/activity-log.ts` | (no issues) | - |
| `packages/adapter-utils/src/server-utils.ts` | Silent JSON parse failure returning null (lines 59-64) | CRITICAL |
| `ui/src/pages/Dashboard.tsx` | Multiple `any[]` typed arrays (lines 392-393, 464) | CRITICAL |
| `ui/src/pages/Dashboard.tsx` | 7 inline components (100-174 lines each) | CRITICAL |
| `ui/src/pages/Dashboard.tsx` | 6-level deep nesting in OrgRuntimePanel `.map()` | CRITICAL |
| `ui/src/pages/Dashboard.tsx` | Hardcoded magic numbers (140, 160, 12, 5, 96%) | MEDIUM |

## Scope

- Fix CRITICAL issues only (HIGH for oversized handler)
- No functional changes — purely code quality
- No API contract changes
- No database schema changes

## Design

### Fix 1: `issues.ts` — Type Safety

**Problem**: Lines 392-393 use `any[]`:
```typescript
const attention: any[] = [];
const ready: any[] = [];
```

**Solution**: Define proper interfaces:
```typescript
interface ActionQueueItem {
  id: string;
  type: 'attention' | 'ready';
  // ... specific fields
}

const attention: ActionQueueItem[] = [];
const ready: ActionQueueItem[] = [];
```

Also fix line 533:
```typescript
// Before
const budgetCents = Number((issue.executionWorkspaceSettings as any)?.budgetCents ?? 0);

// After — define ExecutionWorkspaceSettings interface
const budgetCents = Number(issue.executionWorkspaceSettings?.budgetCents ?? 0);
```

### Fix 2: `issues.ts` — Deep Nesting

**Problem**: Lines 899-924 have 5-level nesting for dependency gate check.

**Solution**: Use early-return guard pattern:
```typescript
// Before: 5-level nesting
if (updateFields.status && ...) {
  const dependsOn = ...;
  if (dependsOn.length > 0) {
    const incompleteDeps = await db.select(...);
    if (incompleteDeps.length > 0) {
      const blockedBy = ...;
      if (req.actor.userId) {
        await db.insert(notifications)...;
      }
    }
  }
}

// After: early returns, max 2-level nesting
if (!updateFields.status || updateFields.status === existing.status) {
  // fall through
} else if (!['in_progress', 'in_review', 'done'].includes(updateFields.status)) {
  // fall through
} else {
  const dependsOn = await svc.getDependencies(issue.id);
  if (dependsOn.length === 0) return next();

  const incompleteDeps = await db.select(...).where(...);
  if (incompleteDeps.length === 0) return next();

  const blockedBy = incompleteDeps.map(...).join(', ');
  if (!req.actor.userId) return next();

  await db.insert(notifications).values({...});
}
```

### Fix 3: `issues.ts` — Oversized Handler

**Problem**: PATCH handler is 408 lines (lines 857-1265).

**Solution**: Extract sub-handlers:
```typescript
// Extract to named functions at bottom of file
async function handleStatusChange(issue, updateFields, ...): Promise<void> { ... }
async function handleAssignmentChange(issue, updateFields, ...): Promise<void> { ... }
async function handleBudgetUpdate(issue, updateFields, ...): Promise<void> { ... }

// Main handler becomes ~50 lines
router.patch("/issues/:id", async (req, res, next) => {
  // Validation only
  // Switch on what changed
  // Call extracted handlers
});
```

### Fix 4: `server-utils.ts` — Silent Failure

**Problem**: Lines 59-64:
```typescript
catch {
  return null;  // Silent — caller can't distinguish parse failure from valid null
}
```

**Solution**: Log + throw, or return a discriminated union:
```typescript
export function parseJson(value: string): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  try {
    return { ok: true, data: JSON.parse(value) as Record<string, unknown> };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown parse error' };
  }
}

// Caller updates to check .ok field
```

### Fix 5: `Dashboard.tsx` — Inline Components

**Problem**: 7 inline components (103-174 lines each):
- `OrgRuntimePanel` (149 lines)
- `ActiveAgentsPanel` (174 lines)
- `ZephyrHero` (102 lines)
- `SystemMetricsPanel` (98 lines)
- `OrchestrationLane` (148 lines)
- `MissionControl` (26 lines)
- `EventTimeline` (85 lines)

**Solution**: Extract each to `ui/src/components/dashboard/`:
```
ui/src/components/dashboard/
├── OrgRuntimePanel.tsx
├── ActiveAgentsPanel.tsx
├── ZephyrHero.tsx
├── SystemMetricsPanel.tsx
├── OrchestrationLane.tsx
├── MissionControl.tsx
└── EventTimeline.tsx
```

Each component gets its own props interface. Extract shared types to `ui/src/types/dashboard.ts`.

### Fix 6: `Dashboard.tsx` — Type Safety

**Problem**: `any[]` arrays at lines 392-393, 464.

**Solution**: Define `IssueAttentionItem` and `IssueReadyItem` interfaces. Replace `any` casts with proper type assertions.

### Fix 7: `Dashboard.tsx` — Magic Numbers

**Problem**: Hardcoded values like `140`, `160`, `12`, `5`, `96%`.

**Solution**: Define at top of file:
```typescript
const CHART_BAR_MAX_HEIGHT = 26;
const CHART_BAR_MIN_HEIGHT = 2;
const RECENT_ISSUES_LIMIT = 5;
const AGENT_LOGS_LIMIT = 5;
const ORG_UNITS_DISPLAY_LIMIT = 12;
const HEALTH_CHECK_PERCENT = 96;
```

## Testing

- Run existing tests: `pnpm test` (or existing test command)
- Manual smoke: start dev server, verify pages load without errors
- No new tests required (refactoring only)

## Out of Scope

- `Dashboard.tsx` deep nesting in `OrgRuntimePanel` — cosmetic refactor would break too many lines; will be addressed when that component is extracted
- Other files not listed above
- Functional changes
