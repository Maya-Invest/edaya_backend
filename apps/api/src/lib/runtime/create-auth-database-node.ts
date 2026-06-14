import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Environment } from "@/lib/runtime/env";
import type { DatabaseHandle } from "@/lib/runtime/database";
import { runMigrations as runAuthMigrations } from "@edaya/betterauth-d1-migrations";

export async function createAuthDatabase(env: Environment): Promise<DatabaseHandle> {
  const { Database } = await import("bun:sqlite");
  const { drizzle } = await import("drizzle-orm/bun-sqlite");
  mkdirSync(dirname(env.AUTH_DATABASE_PATH), { recursive: true });
  const sqlite = new Database(env.AUTH_DATABASE_PATH, { create: true });
  const db = drizzle(sqlite);
  await runAuthMigrations(db, { driver: "sqlite" });

  return {
    db,
    sqlClient: null,
    async dispose() {
      sqlite.close();
    },
  };
}
