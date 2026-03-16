import fs from "node:fs";
import path from "node:path";
import { resolveDefaultConfigPath } from "./home-paths.js";

const ZEPHYR_CONFIG_BASENAME = "config.json";
const ZEPHYR_ENV_FILENAME = ".env";

function findConfigFileFromAncestors(startDir: string): string | null {
  const absoluteStartDir = path.resolve(startDir);
  let currentDir = absoluteStartDir;

  while (true) {
    const newCandidate = path.resolve(currentDir, ".zephyr-nexus", ZEPHYR_CONFIG_BASENAME);
    if (fs.existsSync(newCandidate)) {
      return newCandidate;
    }

    const oldCandidate = path.resolve(currentDir, ".paperclip", ZEPHYR_CONFIG_BASENAME);
    if (fs.existsSync(oldCandidate)) {
      return oldCandidate;
    }

    const nextDir = path.resolve(currentDir, "..");
    if (nextDir === currentDir) break;
    currentDir = nextDir;
  }

  return null;
}

export function resolvePaperclipConfigPath(overridePath?: string): string {
  if (overridePath) return path.resolve(overridePath);
  if (process.env.ZEPHYR_CONFIG) return path.resolve(process.env.ZEPHYR_CONFIG);
  return findConfigFileFromAncestors(process.cwd()) ?? resolveDefaultConfigPath();
}

export function resolvePaperclipEnvPath(overrideConfigPath?: string): string {
  return path.resolve(path.dirname(resolvePaperclipConfigPath(overrideConfigPath)), ZEPHYR_ENV_FILENAME);
}
