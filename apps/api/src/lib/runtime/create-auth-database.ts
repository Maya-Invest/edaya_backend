/// <reference types="@cloudflare/workers-types" />

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Environment } from "@/lib/runtime/env";
import type { DatabaseHandle } from "@/lib/runtime/database";
import { runMigrations as runAuthMigrations } from "@edaya/betterauth-d1-migrations";

function readAuthDbBinding(source: Record<string, unknown>): D1Database | undefined {
  const binding = source.AUTH_DB;
  if (binding && typeof binding === "object" && "prepare" in binding) {
    return binding as D1Database;
  }
  return undefined;
}

export async function createAuthDatabase(env: Environment, bindings?: Record<string, unknown>): Promise<DatabaseHandle> {
  if (env.RUNTIME === "worker") {
    const authDb = env.AUTH_DB ?? (bindings ? readAuthDbBinding(bindings) : undefined);
    if (!authDb) {
      throw new Error("AUTH_DB D1 binding is required on the worker runtime.");
    }

    const { drizzle } = await import("drizzle-orm/d1");
    return {
      db: drizzle(authDb),
      sqlClient: null,
      dispose: async () => {},
    };
  }

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
