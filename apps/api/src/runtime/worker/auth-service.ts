import { createAuth } from "@/runtime/shared/create-auth";
import { createAuthDatabase } from "@/runtime/worker/auth-database";
import type { Environment } from "@/runtime/env/schema";
import type { AuthService } from "@/runtime/types";

let cachedAuthService: AuthService | null = null;

/** Reuse Better Auth within a worker isolate — auth routes must stay lightweight. */
export async function resolveWorkerAuthService(env: Environment): Promise<AuthService> {
  if (cachedAuthService) {
    return cachedAuthService;
  }

  const authHandle = await createAuthDatabase(env);
  cachedAuthService = createAuth(authHandle.db, env);
  return cachedAuthService;
}
