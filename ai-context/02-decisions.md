# Decisions Log

## 2026-03-16: Workspace Structure Standard
- **Decision**: Adopt a forced separation between `workspace/` (active), `sandbox/` (experiment/tools), and `archive/` (legacy).
- **Rationale**: Reduces clutter and prevents multiple tools from indexing hundreds of irrelevant files/folders in the home directory.
- **Status**: Accepted.

## 2026-03-16: Shared Context Layer (ai-context/)
- **Decision**: Use a structured subfolder `ai-context/` instead of a single long `AGENTS.md`.
- **Rationale**: 
    - `AGENTS.md` is too long for quick context injection in many tools.
    - Sub-files allow agents to read only what's needed (e.g., just `current-state.md` for a task update).
    - Reduces token waste by avoiding re-reading static project briefs for every small bug fix.
- **Status**: Accepted.
