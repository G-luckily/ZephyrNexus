import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeProjectWorkspaceStarterFiles } from "../services/projects.ts";

const tempDirs = new Set<string>();

async function makeWorkspaceRoot() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-project-workspace-"));
  tempDirs.add(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(Array.from(tempDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
  tempDirs.clear();
});

describe("initializeProjectWorkspaceStarterFiles", () => {
  it("creates starter files for a local workspace", async () => {
    const cwd = await makeWorkspaceRoot();

    await initializeProjectWorkspaceStarterFiles({
      cwd,
      projectName: "Social Work Research",
      projectDescription: "Investigate the social work series project.",
      workspaceName: "测试",
    });

    await expect(fs.readFile(path.join(cwd, "README.md"), "utf8")).resolves.toContain("Social Work Research");
    await expect(fs.readFile(path.join(cwd, "docs", "PROJECT.md"), "utf8")).resolves.toContain(
      "Investigate the social work series project.",
    );
    await expect(fs.readFile(path.join(cwd, "docs", "TASKS.md"), "utf8")).resolves.toContain("Initial Tasks");
    await expect(fs.stat(path.join(cwd, "src"))).resolves.toBeTruthy();
  });

  it("does not overwrite existing starter files", async () => {
    const cwd = await makeWorkspaceRoot();
    await fs.mkdir(path.join(cwd, "docs"), { recursive: true });
    await fs.writeFile(path.join(cwd, "README.md"), "custom readme\n", "utf8");

    await initializeProjectWorkspaceStarterFiles({
      cwd,
      projectName: "Ignored",
      projectDescription: "Ignored",
      workspaceName: "ignored",
    });

    await expect(fs.readFile(path.join(cwd, "README.md"), "utf8")).resolves.toBe("custom readme\n");
    await expect(fs.readFile(path.join(cwd, "docs", "PROJECT.md"), "utf8")).resolves.toContain("Ignored");
  });
});
