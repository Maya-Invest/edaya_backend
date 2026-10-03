import type { Environment } from "./env";
import { runAccountMigrations } from "@edaya/adaptor-account";
import { mkdirSync } from "node:fs";
import { runMigrations } from "@edaya/adaptor-auth";

export interface AuthDatabaseHandle {
  db: unknown;
  dispose: () => Promise<void>;
}
function pgliteDataDir(databaseUrl: string): string | null {
  const path = databaseUrl.slice("pglite:".length).trim();
  if (!path || path === "memory") {
    return null;
  }
  return path;
}
export async function createAuthDatabase(env: Environment): Promise<AuthDatabaseHandle> {
  const databaseUrl = env.AUTH_DATABASE_URL;
  if (env.RUNTIME === "worker" && (databaseUrl === "pglite" || databaseUrl.startsWith("pglite:")))
    throw new Error("Worker Account storage requires HYPERDRIVE_AUTH");
  const runOnStartup = env.RUNTIME !== "worker";
  if (databaseUrl.startsWith("pglite:") || databaseUrl === "pglite") {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const dataDir = databaseUrl === "pglite" ? null : pgliteDataDir(databaseUrl);
    if (dataDir) {
      mkdirSync(dataDir, { recursive: true });
    }
    const pglite = dataDir ? new PGlite(dataDir) : new PGlite();
    const db = drizzle(pglite);
    let disposal: Promise<void> | undefined;
    const dispose = () => disposal ??= Promise.resolve().then(() => pglite.close());
    try {
      if (runOnStartup) {
        await runMigrations(db, { driver: "pglite" });
        await runAccountMigrations(db, "pglite");
      }
    }
    catch (error) {
      await dispose();
      throw error;
    }
    return { db, dispose };
  }
  const postgres = (await import("postgres")).default;
  const { drizzle } = await import("drizzle-orm/postgres-js");
  // Workers isolate I/O objects per request. Hyperdrive is the pool; create a
  // short-lived client instead of reusing a TCP socket across handlers.
  const sql = postgres(databaseUrl, env.RUNTIME === "worker"
    ? { max: 1, fetch_types: false, prepare: true }
    : { max: 1 });
  const db = drizzle(sql);
  let disposal: Promise<void> | undefined;
  const dispose = () => disposal ??= Promise.resolve().then(() => sql.end({ timeout: 5 }));
  try {
    if (runOnStartup) {
      await runMigrations(db, { driver: "postgres-js" });
      await runAccountMigrations(db, "postgres-js");
    }
  }
  catch (error) {
    await dispose();
    throw error;
  }
  return { db, dispose };
}
