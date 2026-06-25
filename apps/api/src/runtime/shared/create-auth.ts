import type { Environment } from "@/runtime/env/schema";
import type { AuthService } from "@/runtime/types";
import { createBetterAuth } from "@/runtime/shared/build-better-auth-config";

export function createAuth(db: unknown, env: Environment): AuthService {
  return createBetterAuth(db, env);
}
