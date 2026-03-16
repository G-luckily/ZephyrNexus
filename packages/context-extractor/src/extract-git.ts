/**
 * Extract recent git changes (file, commitHash, summary, date) via git log.
 */

import { execSync } from "node:child_process";
import { join } from "node:path";
import type { GitChangeRow } from "@paperclipai/context-manager";

export interface ExtractGitOptions {
  /** Repo root (must be a git repo). */
  repoRoot: string;
  /** Number of days to look back. */
  sinceDays?: number;
}

/**
 * Run git log and parse into GitChangeRow[].
 * Format: one line per file-change with commit hash, subject, date (ISO).
 */
export function extractGitChanges(options: ExtractGitOptions): GitChangeRow[] {
  const repoRoot = options.repoRoot;
  const sinceDays = options.sinceDays ?? 7;
  const since = `${sinceDays} days ago`;

  try {
    const out = execSync(
      `git log --since="${since}" --name-only --pretty=format:"%H%x00%s%x00%ci"`,
      { cwd: repoRoot, encoding: "utf-8", maxBuffer: 4 * 1024 * 1024 },
    );
    const lines = out.trim().split("\n").filter(Boolean);
    const rows: GitChangeRow[] = [];
    let currentHash = "";
    let currentSummary = "";
    let currentDate = "";

    for (const line of lines) {
      if (line.includes("\0")) {
        const [hash, summary, date] = line.split("\0");
        currentHash = hash ?? "";
        currentSummary = summary ?? "";
        currentDate = (date ?? "").slice(0, 10) + "T00:00:00.000Z";
        continue;
      }
      const filePath = line.trim();
      if (!filePath || filePath.includes("\0")) continue;
      rows.push({
        filePath,
        commitHash: currentHash,
        summary: currentSummary,
        date: currentDate,
      });
    }
    return rows;
  } catch {
    return [];
  }
}
