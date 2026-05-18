# Next Actions

## DeepSeek adapter (2026-05-18)
- [ ] End-to-end verify: create a `deepseek_local` agent with a real
      `DEEPSEEK_API_KEY`, run once on the OpenCode engine, then on Codex.
- [ ] Confirm cost/usage and `provider=deepseek` are recorded for the run.
- [ ] Consider reusing the adapter for other OpenAI-compatible providers
      (Moonshot/Kimi, OpenRouter) by overriding the API base URL.

## Workspace reorg (legacy)
- [ ] Complete `ai-context/` populating (Steps 04-05).
- [ ] Update root `AGENTS.md` to point to `ai-context/`.
- [ ] Move `paperclip` from `~/projects/paperclip` to `~/workspace/paperclip`.
- [ ] Verify environment variables and tool paths after the move.
- [ ] Repeat the process for `ZephyrNexus`.
