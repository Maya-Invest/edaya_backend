import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { runMigrations as runAuthMigrations } from "@edaya/integration-migrations";
import type { Environment } from "@/runtime/shared/env/schema";
import type { DatabaseHandle } from "@/runtime/types";

export async function createAuthDatabase(
  env: Environment,
  options: { runMigrations?: boolean } = {},
): Promise<DatabaseHandle> {
  const { Database } = await import("bun:sqlite");
  const { drizzle } = await import("drizzle-orm/bun-sqlite");

  mkdirSync(dirname(env.AUTH_DATABASE_PATH), { recursive: true });
  const sqlite = new Database(env.AUTH_DATABASE_PATH, { create: true });
  const db = drizzle(sqlite);

  if (options.runMigrations) {
    await runAuthMigrations(db, { driver: "sqlite" });
  }

  return {
    db,
    sqlClient: null,
    async dispose() {
      sqlite.close();
    },
  };
}
