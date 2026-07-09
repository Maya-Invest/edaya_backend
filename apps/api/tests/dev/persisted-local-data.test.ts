import { describe, expect, it } from "bun:test";
import type { Environment } from "@/runtime/shared/env/schema";
import { resolveRepoLocalDataPath } from "@/runtime/shared/env/repo-root";
import { isPersistedLocalDataDeployment } from "@/dev/persisted-local-data";

const persistedLocalEnv: Pick<Environment, "RUNTIME" | "DATABASE_URL"> = {
  RUNTIME: "local",
  DATABASE_URL: `pglite:${resolveRepoLocalDataPath(".data/school")}`,
};

describe("isPersistedLocalDataDeployment", () => {
  it("matches repo-root .data PGlite", () => {
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
