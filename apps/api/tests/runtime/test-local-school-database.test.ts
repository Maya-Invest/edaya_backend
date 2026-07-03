import { describe, expect, it } from "bun:test";
import { createPgliteTestEnv } from "../support/pglite-env";
import { createSchoolDatabase } from "@/runtime/local/school-database";

describe("local createSchoolDatabase", () => {
  it("rejects postgres DATABASE_URL", async () => {
    await expect(createSchoolDatabase(createPgliteTestEnv({
      RUNTIME: "local",
      DATABASE_URL: "postgres://admin:admin@localhost:5432/edaya",
    }))).rejects.toThrow(/persisted PGlite/);
  });

  it("rejects ephemeral pglite DATABASE_URL", async () => {
    await expect(createSchoolDatabase(createPgliteTestEnv({
      RUNTIME: "local",
      DATABASE_URL: "pglite",
    }))).rejects.toThrow(/persisted PGlite data directory/);
  });
});
