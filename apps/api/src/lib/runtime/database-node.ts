import type { Environment } from "@/lib/runtime/env";
import type { DatabaseHandle } from "@/lib/runtime/database";
import { isPgliteDatabase, resolvePgliteDataDir } from "@edaya/adaptor-postgres";

export async function createDatabase(env: Environment): Promise<DatabaseHandle> {
  if (isPgliteDatabase(env.DATABASE_URL)) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");

    const dataDir = resolvePgliteDataDir(env.DATABASE_URL);
    const pglite = dataDir ? new PGlite(dataDir) : new PGlite();
    return {
      db: drizzle(pglite),
      sqlClient: null,
      async dispose() {
        await pglite.close();
      },
    };
  }

  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { default: postgres } = await import("postgres");

  const sqlClient = postgres(env.DATABASE_URL, {
    prepare: false,
  });
  return {
    db: drizzle(sqlClient),
    sqlClient,
    async dispose() {
      await sqlClient.end({ timeout: 5 });
    },
  };
}
