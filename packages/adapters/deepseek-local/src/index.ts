export const type = "deepseek_local";
export const label = "DeepSeek (third-party)";

/** DeepSeek's OpenAI-compatible API endpoint. */
export const DEEPSEEK_API_BASE_URL = "https://api.deepseek.com";

/** Environment variable that must carry the DeepSeek API key. */
export const DEEPSEEK_API_KEY_ENV = "DEEPSEEK_API_KEY";

export type DeepSeekEngine = "opencode" | "codex";
export const DEEPSEEK_ENGINES: readonly DeepSeekEngine[] = ["opencode", "codex"];
export const DEFAULT_DEEPSEEK_ENGINE: DeepSeekEngine = "opencode";

export const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";

export const models = [
  { id: "deepseek-chat", label: "DeepSeek V3 (deepseek-chat)" },
  { id: "deepseek-reasoner", label: "DeepSeek R1 (deepseek-reasoner)" },
];

export const agentConfigurationDoc = `# deepseek_local agent configuration

Adapter: deepseek_local

Runs DeepSeek (or any OpenAI-compatible third-party provider) by delegating to an
existing local execution engine — OpenCode or Codex.

Use when:
- You want an agent backed by DeepSeek's API rather than a first-party provider
- You already have the OpenCode or Codex CLI installed locally

Core fields:
- engine (string, optional): execution engine, "opencode" (default) or "codex"
- model (string, optional): DeepSeek model id (deepseek-chat | deepseek-reasoner); defaults to deepseek-chat
- apiBaseUrl (string, optional): OpenAI-compatible base URL; defaults to https://api.deepseek.com
- cwd (string, optional): default absolute working directory fallback
- instructionsFilePath (string, optional): absolute path to a markdown instructions file
- promptTemplate (string, optional): run prompt template
- command (string, optional): engine CLI command override
- extraArgs (string[], optional): additional CLI args passed to the engine
- env (object, optional): KEY=VALUE environment variables — must include DEEPSEEK_API_KEY

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- The DeepSeek API key must be provided via the DEEPSEEK_API_KEY environment variable
  (bind it as a plaintext value or a company secret reference in the configurator).
- engine=opencode: the model is routed as deepseek/<model> via the OpenCode provider system.
- engine=codex: a custom OpenAI-compatible model provider is injected pointing at apiBaseUrl.
`;
