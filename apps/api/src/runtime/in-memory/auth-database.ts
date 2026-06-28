import { runMigrations as runAuthMigrations } from "@edaya/integration-migrations";
import type { DatabaseHandle } from "@/runtime/types";

export async function createAuthDatabase(options: { runMigrations?: boolean } = {}): Promise<DatabaseHandle> {
  const { Database } = await import("bun:sqlite");
  const { drizzle } = await import("drizzle-orm/bun-sqlite");

  const sqlite = new Database(":memory:", { create: true });
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
