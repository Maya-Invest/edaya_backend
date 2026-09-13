/* eslint-disable node/no-process-env -- Disposable test process configuration */
import process from "node:process";
import { mock } from "bun:test";
import { createPostgresSchoolDatabase } from "../../src/runtime/shared/school-database";

// Test harness only: production local runtime continues to require persisted PGlite.
const target = new URL(process.env.DATABASE_URL ?? "");
if (process.env.EDAYA_DISPOSABLE_POSTGRES !== "true" || target.hostname !== "127.0.0.1"
  || target.username !== "edaya_rehearsal" || target.pathname !== "/neondb") {
  throw new Error("Native bootstrap server requires the disposable loopback cluster");
}
mock.module("@/runtime/local/school-database", () => ({
  createSchoolDatabase: () => createPostgresSchoolDatabase(target.toString()),
}));
await import("../../src/entries/local");
