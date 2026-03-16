#!/usr/bin/env node
/**
 * CLI: run context extraction and write to SQLite.
 * Usage: context-extractor [--repo-root <path>] [--db-path <path>] [--days <n>]
 * Default: repo-root = cwd, db-path = <repo-root>/.paperclip/context.db, days = 7
 */

import { mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { SqliteContextStore } from "@paperclipai/context-manager";
import { run } from "./run.js";

function parseArgs(): { repoRoot: string; dbPath: string; days: number } {
  const args = process.argv.slice(2);
  let repoRoot = process.cwd();
  let dbPath = "";
  let days = 7;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--repo-root" && args[i + 1]) {
      repoRoot = resolve(args[++i]);
    } else if (args[i] === "--db-path" && args[i + 1]) {
      dbPath = resolve(args[++i]);
    } else if (args[i] === "--days" && args[i + 1]) {
      days = parseInt(args[++i], 10) || 7;
    }
  }
  if (!dbPath) dbPath = join(repoRoot, ".paperclip", "context.db");
  return { repoRoot, dbPath, days };
}

async function main(): Promise<void> {
  const { repoRoot, dbPath, days } = parseArgs();
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const store = new SqliteContextStore({ dbPath });
  try {
    await run({ repoRoot, store, sinceDays: days });
    console.log(`Context extracted: ${repoRoot} -> ${dbPath} (git last ${days} days)`);
  } finally {
    store.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
