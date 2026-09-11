/* eslint-disable node/no-process-env */
import { afterEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { isR2FileStorageConfigured } from "@edaya/adaptor-r2";
import type { R2Environment } from "@edaya/adaptor-r2";
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

function loadLocalEnvFile(apiRoot: string): void {
  expand(config({ path: path.join(apiRoot, ".env") }));
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

  it("does not load R2 credentials from .dev.vars for local process env", async () => {
    const apiRoot = await mkdtemp(path.join(tmpdir(), "edaya-api-env-"));
    try {
      await writeFile(path.join(apiRoot, ".env"), [
        "RUNTIME=local",
        "NODE_ENV=development",
        "DATABASE_URL=pglite",
        "SCHOOL_API_ORIGIN=http://localhost:9999",
        "IDENTITY_DIRECTORY_SECRET=from-env",
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
        SCHOOL_API_ORIGIN: "http://localhost:9999",
      };
      loadLocalEnvFile(apiRoot);

      expect(isR2FileStorageConfigured(r2EnvFromProcessEnv())).toBe(false);
      expect(process.env.R2_BUCKET_NAME).toBeUndefined();
    }
    finally {
      await rm(apiRoot, { recursive: true, force: true });
    }
  });

  it("loads values from .env only", async () => {
    const apiRoot = await mkdtemp(path.join(tmpdir(), "edaya-api-env-"));
    try {
      await writeFile(path.join(apiRoot, ".env"), "IDENTITY_DIRECTORY_SECRET=from-env\n");
      await writeFile(path.join(apiRoot, ".dev.vars"), "IDENTITY_DIRECTORY_SECRET=from-dev-vars\n");

      process.env = {};
      loadLocalEnvFile(apiRoot);

      expect(process.env.IDENTITY_DIRECTORY_SECRET).toBe("from-env");
    }
    finally {
      await rm(apiRoot, { recursive: true, force: true });
    }
  });

  it("ignores workspace .dev.vars when loading local process env", () => {
    const devVarsPath = path.join(resolveApiRootFromLoader(), ".dev.vars");
    if (!existsSync(devVarsPath)) {
      return;
    }

    process.env = {
      RUNTIME: "local",
      NODE_ENV: "development",
      DATABASE_URL: "pglite",
      SCHOOL_API_ORIGIN: "http://localhost:9999",
      TRUSTED_ORIGINS: "http://localhost:5173",
      IDENTITY_DIRECTORY_SECRET: "test-secret",
    };
    const env = loadLocalProcessEnv();
    expect(isR2FileStorageConfigured(env)).toBe(false);
  });
});
