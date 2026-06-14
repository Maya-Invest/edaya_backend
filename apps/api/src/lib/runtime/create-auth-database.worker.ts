/// <reference types="@cloudflare/workers-types" />

import type { Environment } from "@/lib/runtime/env";
import type { DatabaseHandle } from "@/lib/runtime/database";

function readAuthDbBinding(source: Record<string, unknown>): D1Database | undefined {
  const binding = source.AUTH_DB;
  if (binding && typeof binding === "object" && "prepare" in binding) {
    return binding as D1Database;
  }
  return undefined;
}

export async function createAuthDatabase(env: Environment, bindings?: Record<string, unknown>): Promise<DatabaseHandle> {
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
