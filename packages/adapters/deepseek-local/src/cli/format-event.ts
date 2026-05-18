import { printCodexStreamEvent } from "@zephyr-nexus/adapter-codex-local/cli";
import { printOpenCodeStreamEvent } from "@zephyr-nexus/adapter-opencode-local/cli";

const CODEX_TYPE_PREFIXES = ["thread.", "turn.", "item."];

/** Codex emits dotted event types; OpenCode emits underscored ones. */
export function looksLikeCodexLine(line: string): boolean {
  try {
    const parsed = JSON.parse(line) as unknown;
    if (typeof parsed !== "object" || parsed === null) return false;
    const type = (parsed as Record<string, unknown>).type;
    return typeof type === "string" && CODEX_TYPE_PREFIXES.some((p) => type.startsWith(p));
  } catch {
    return false;
  }
}

/**
 * Format a streamed stdout line for a DeepSeek run by detecting which engine
 * produced it (Codex vs OpenCode) and delegating to that engine's formatter.
 */
export function printDeepSeekStreamEvent(raw: string, debug: boolean): void {
  const line = raw.trim();
  if (!line) return;
  if (looksLikeCodexLine(line)) {
    printCodexStreamEvent(raw, debug);
    return;
  }
  printOpenCodeStreamEvent(raw, debug);
}
