/**
 * Extract module info (exports, imports, loc, lastModified) using ts-morph.
 */

import { Project } from "ts-morph";
import type { ModuleRow } from "@zephyr-nexus/context-manager";
import { statSync } from "node:fs";
import { join } from "node:path";

export interface ExtractModulesOptions {
  /** Repo/project root. */
  repoRoot: string;
  /** Glob for source files (default ts/tsx). */
  include?: string[];
}

const DEFAULT_INCLUDE = ["**/*.ts", "**/*.tsx", "!**/node_modules/**", "!**/dist/**"];

function getLastModified(filePath: string): string {
  try {
    const st = statSync(filePath);
    return st.mtime.toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}

/**
 * Scan repo with ts-morph and return ModuleRow[] (path relative to repoRoot).
 */
export function extractModules(options: ExtractModulesOptions): ModuleRow[] {
  const repoRoot = options.repoRoot;
  const include = options.include ?? DEFAULT_INCLUDE;

  const project = new Project({
    compilerOptions: { allowJs: true },
    skipAddingFilesFromTsConfig: true,
  });
  const root = join(repoRoot, ".");
  const paths = include.map((p) => join(root, p));
  project.addSourceFilesAtPaths(paths);

  const rows: ModuleRow[] = [];
  for (const file of project.getSourceFiles()) {
    const filePath = file.getFilePath();
    if (!filePath.startsWith(repoRoot)) continue;
    const relativePath = filePath.slice(repoRoot.length).replace(/^\//, "");
    if (relativePath.includes("node_modules") || relativePath.includes("/dist/") || relativePath.startsWith(".git/")) continue;

    const exports: string[] = [];
    const imports: string[] = [];

    for (const decl of file.getExportedDeclarations()) {
      exports.push(decl[0]);
    }
    for (const imp of file.getImportDeclarations()) {
      const mod = imp.getModuleSpecifierValue();
      if (mod && !mod.startsWith(".") && !mod.startsWith("/")) {
        imports.push(mod);
      } else {
        imports.push(imp.getModuleSpecifierValue());
      }
    }
    const loc = file.getFullText().split(/\n/).length;
    const lastModified = getLastModified(filePath);

    rows.push({
      filePath: relativePath,
      exports,
      imports,
      loc,
      lastModified,
    });
  }
  return rows;
}

// Exclude list used only for simple checks above; full glob not implemented for Phase 1.
