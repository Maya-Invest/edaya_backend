/* eslint-disable node/no-process-env */
import { afterEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { isR2FileStorageConfigured, type R2Environment } from "@edaya/adaptor-r2";
import { loadLocalProcessEnv } from "@/runtime";

const originalEnv = { ...process.env };

function r2EnvFromProcessEnv(): Partial<R2Environment> {
  return {
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ENDPOINT: process.env.R2_ENDPOINT,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
  };
}

function loadLocalDevEnvFiles(apiRoot: string): void {
  expand(config({ path: path.join(apiRoot, ".env") }));
  expand(config({ path: path.join(apiRoot, ".dev.vars") }));
}

function resolveApiRootFromLoader(): string {
  const loaderDir = path.dirname(fileURLToPath(import.meta.resolve("@/runtime/shared/env/local-loader")));
  return path.resolve(loaderDir, "../../../..");
}

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("local dev env files", () => {
  it("resolves the API package root for env file loading", () => {
    const apiRoot = resolveApiRootFromLoader();
    expect(existsSync(path.join(apiRoot, "package.json"))).toBe(true);
    expect(existsSync(path.join(apiRoot, ".env.example"))).toBe(true);
  });

  it("loads R2 credentials from .dev.vars when absent from .env", async () => {
    const apiRoot = await mkdtemp(path.join(tmpdir(), "edaya-api-env-"));
    try {
      await writeFile(path.join(apiRoot, ".env"), [
        "RUNTIME=local",
        "NODE_ENV=development",
        "DATABASE_URL=pglite",
        "BETTER_AUTH_URL=http://localhost:9999",
      ].join("\n"));
      await writeFile(path.join(apiRoot, ".dev.vars"), [
        "R2_BUCKET_NAME=edaya-files-dev",
        "R2_ACCOUNT_ID=test-account",
        "R2_ACCESS_KEY_ID=test-access-key",
        "R2_SECRET_ACCESS_KEY=test-secret-key",
      ].join("\n"));

      process.env = {
        RUNTIME: "local",
        NODE_ENV: "development",
        DATABASE_URL: "pglite",
        BETTER_AUTH_URL: "http://localhost:9999",
      };
      loadLocalDevEnvFiles(apiRoot);

      expect(isR2FileStorageConfigured(r2EnvFromProcessEnv())).toBe(true);
      expect(process.env.R2_BUCKET_NAME).toBe("edaya-files-dev");
    }
    finally {
      await rm(apiRoot, { recursive: true, force: true });
    }
  });

  it("keeps .env values when both files define the same key", async () => {
    const apiRoot = await mkdtemp(path.join(tmpdir(), "edaya-api-env-"));
    try {
      await writeFile(path.join(apiRoot, ".env"), "BETTER_AUTH_SECRET=from-env\n");
      await writeFile(path.join(apiRoot, ".dev.vars"), "BETTER_AUTH_SECRET=from-dev-vars\n");

      process.env = {};
      loadLocalDevEnvFiles(apiRoot);

      expect(process.env.BETTER_AUTH_SECRET).toBe("from-env");
    }
    finally {
      await rm(apiRoot, { recursive: true, force: true });
    }
  });

  it("loads workspace .dev.vars for local process env when present", () => {
    const devVarsPath = path.join(resolveApiRootFromLoader(), ".dev.vars");
    if (!existsSync(devVarsPath)) {
      return;
    }

    process.env = {
      RUNTIME: "local",
      NODE_ENV: "development",
      DATABASE_URL: "pglite",
      BETTER_AUTH_URL: "http://localhost:9999",
      TRUSTED_ORIGINS: "http://localhost:5173",
    };
    const env = loadLocalProcessEnv();
    expect(isR2FileStorageConfigured(env)).toBe(true);
    expect(env.R2_BUCKET_NAME).toBe("edaya-files-dev");
  });
});
