import { afterEach, describe, expect, it } from "vitest";
import { resolveBootstrapCeoRuntime } from "../commands/auth-bootstrap-ceo.js";

const ORIGINAL_ENV = { ...process.env };

describe("auth bootstrap-ceo runtime resolution", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("supports Railway-style env-only authenticated deployments", () => {
    process.env = {
      ...ORIGINAL_ENV,
      ZEPHYR_DEPLOYMENT_MODE: "authenticated",
      DATABASE_URL: "postgres://railway:secret@postgres.railway.internal:5432/railway",
      ZEPHYR_PUBLIC_URL: "https://zephyr-nexus-production.up.railway.app",
    };

    const runtime = resolveBootstrapCeoRuntime({
      config: "C:/tmp/zephyr-nexus-missing-config.json",
    });

    expect(runtime).toEqual({
      shouldCreateInvite: true,
      dbUrl: "postgres://railway:secret@postgres.railway.internal:5432/railway",
      baseUrl: "https://zephyr-nexus-production.up.railway.app",
    });
  });
});
