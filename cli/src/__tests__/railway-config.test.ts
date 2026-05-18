import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Railway deployment configuration", () => {
  it("uses current Zephyr env variables in the production Docker image", () => {
    const dockerfile = fs.readFileSync(path.resolve(process.cwd(), "Dockerfile"), "utf-8");

    expect(dockerfile).toContain("ZEPHYR_HOME=/zephyr-nexus");
    expect(dockerfile).toContain("ZEPHYR_INSTANCE_ID=default");
    expect(dockerfile).toContain("ZEPHYR_DEPLOYMENT_MODE=authenticated");
    expect(dockerfile).toContain("ZEPHYR_DEPLOYMENT_EXPOSURE=public");
    expect(dockerfile).toContain("ZEPHYR_AUTH_BASE_URL_MODE=explicit");
    expect(dockerfile).not.toMatch(/PAPERCLIP_(HOME|INSTANCE_ID|CONFIG|DEPLOYMENT_MODE|DEPLOYMENT_EXPOSURE)/);
    expect(dockerfile).not.toContain("VOLUME [");
  });

  it("pins Railway to the Dockerfile build and API health check", () => {
    const railwayToml = fs.readFileSync(path.resolve(process.cwd(), "railway.toml"), "utf-8");

    expect(railwayToml).toContain('builder = "DOCKERFILE"');
    expect(railwayToml).toContain('dockerfilePath = "Dockerfile"');
    expect(railwayToml).toContain('healthcheckPath = "/api/health"');
    expect(railwayToml).toContain("healthcheckTimeout = 300");
  });

  it("builds dist-exporting workspace packages before the server", () => {
    const dockerfile = fs.readFileSync(path.resolve(process.cwd(), "Dockerfile"), "utf-8");
    expect(dockerfile).toContain("COPY packages/context-manager/package.json packages/context-manager/");
    expect(dockerfile).toContain("COPY packages/context-extractor/package.json packages/context-extractor/");

    const contextManagerBuild = dockerfile.indexOf("pnpm --filter @zephyr-nexus/context-manager build");
    const contextExtractorBuild = dockerfile.indexOf("pnpm --filter @zephyr-nexus/context-extractor build");
    const serverBuild = dockerfile.indexOf("pnpm --filter @zephyr-nexus/server build");

    expect(contextManagerBuild).toBeGreaterThan(-1);
    expect(contextExtractorBuild).toBeGreaterThan(contextManagerBuild);
    expect(serverBuild).toBeGreaterThan(contextExtractorBuild);
  });
});
