import { describe, expect, test } from "bun:test";
import path from "node:path";
import {
  resolveRepoLocalDataPath,
  resolveRepoLocalDatabaseUrl,
  resolveRepoRoot,
} from "@/runtime/env/repo-root";

describe("repo-root local data paths", () => {
  test("resolveRepoRoot points at monorepo root", () => {
    expect(resolveRepoRoot()).toBe(path.resolve(import.meta.dirname, "../../../.."));
  });

  test("resolves .data paths from repo root", () => {
    expect(resolveRepoLocalDataPath(".data/auth.sqlite")).toBe(
      path.resolve(resolveRepoRoot(), ".data/auth.sqlite"),
    );
  });

  test("resolves pglite DATABASE_URL from repo root", () => {
    expect(resolveRepoLocalDatabaseUrl("pglite:.data/school")).toBe(
      `pglite:${path.resolve(resolveRepoRoot(), ".data/school")}`,
    );
  });

  test("leaves ephemeral and absolute database URLs unchanged", () => {
    expect(resolveRepoLocalDatabaseUrl("pglite")).toBe("pglite");
    expect(resolveRepoLocalDatabaseUrl("postgres://localhost/edaya")).toBe("postgres://localhost/edaya");
    expect(resolveRepoLocalDatabaseUrl("pglite:/tmp/school")).toBe("pglite:/tmp/school");
  });
});
