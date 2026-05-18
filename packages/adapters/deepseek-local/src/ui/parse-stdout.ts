import type { TranscriptEntry } from "@zephyr-nexus/adapter-utils";
import { parseCodexStdoutLine } from "@zephyr-nexus/adapter-codex-local/ui";
import { parseOpenCodeStdoutLine } from "@zephyr-nexus/adapter-opencode-local/ui";

const CODEX_TYPE_PREFIXES = ["thread.", "turn.", "item."];

function looksLikeCodexLine(line: string): boolean {
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
 * Parse a DeepSeek run's stdout line by detecting the producing engine
 * (Codex vs OpenCode) and delegating to that engine's transcript parser.
 */
export function parseDeepSeekStdoutLine(line: string, ts: string): TranscriptEntry[] {
  return looksLikeCodexLine(line.trim())
    ? parseCodexStdoutLine(line, ts)
    : parseOpenCodeStdoutLine(line, ts);
}
