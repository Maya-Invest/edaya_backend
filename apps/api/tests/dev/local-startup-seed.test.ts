/* eslint-disable node/no-process-env */
import { afterEach, describe, expect, it } from "bun:test";
import type { Environment } from "@/runtime/shared/env/schema";
import { resolveRepoLocalDataPath } from "@/runtime/shared/env/repo-root";
import {
  isPersistedLocalDataDeployment,
  resolveSeedOnStart,
} from "@/dev/local-startup-seed";

const originalEnv = { ...process.env };

const persistedLocalEnv: Pick<Environment, "NODE_ENV" | "RUNTIME" | "DATABASE_URL" | "AUTH_DATABASE_PATH"> = {
  NODE_ENV: "development",
  RUNTIME: "local",
  DATABASE_URL: `pglite:${resolveRepoLocalDataPath(".data/school")}`,
  AUTH_DATABASE_PATH: resolveRepoLocalDataPath(".data/auth.sqlite"),
};

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("isPersistedLocalDataDeployment", () => {
  it("matches repo-root .data PGlite + auth sqlite", () => {
    expect(isPersistedLocalDataDeployment(persistedLocalEnv)).toBe(true);
  });

  it("rejects ephemeral in-memory PGlite", () => {
    expect(isPersistedLocalDataDeployment({
      ...persistedLocalEnv,
      DATABASE_URL: "pglite",
    })).toBe(false);
  });

  it("rejects remote Postgres", () => {
    expect(isPersistedLocalDataDeployment({
      ...persistedLocalEnv,
      DATABASE_URL: "postgres://admin:admin@localhost:5432/edaya",
    })).toBe(false);
  });
});

describe("resolveSeedOnStart", () => {
  it("defaults to true for persisted .data in development", () => {
    delete process.env.SEED_ON_START;
    expect(resolveSeedOnStart(persistedLocalEnv)).toBe(true);
  });

  it("honours SEED_ON_START=false", () => {
    process.env.SEED_ON_START = "false";
    expect(resolveSeedOnStart(persistedLocalEnv)).toBe(false);
  });

  it("honours SEED_ON_START=true only for persisted .data", () => {
    process.env.SEED_ON_START = "true";
    expect(resolveSeedOnStart({
      ...persistedLocalEnv,
      DATABASE_URL: "pglite",
    })).toBe(false);
  });
});
