# Decisions Log

## 2026-05-18: Third-party providers via a dedicated delegating adapter
- **Decision**: Add a standalone `deepseek_local` adapter rather than only
  extending the env editor with a provider catalog. The adapter does not
  re-implement CLI execution — it delegates to the existing OpenCode or Codex
  engine, selectable through an `engine` config field.
- **Rationale**:
    - DeepSeek's API is OpenAI-compatible; OpenCode supports it natively and
      Codex supports it via a custom model provider — no new CLI integration needed.
    - A delegating adapter keeps a clean first-class entry in the configurator
      while reusing battle-tested engine code.
    - The API key flows through the existing `EnvBinding` / company-secret
      mechanism (`DEEPSEEK_API_KEY`), so no new secret storage is introduced.
- **Status**: Accepted, implemented.

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
