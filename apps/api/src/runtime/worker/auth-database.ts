/// <reference types="@cloudflare/workers-types" />

import { readAuthDbBinding } from "@/runtime/env/schema";
import type { Environment } from "@/runtime/env/schema";
import type { DatabaseHandle } from "@/runtime/types";

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
