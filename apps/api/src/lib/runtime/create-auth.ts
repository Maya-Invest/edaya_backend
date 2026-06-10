import { authSchema } from "@edaya/adaptor-betterauth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Environment } from "@/lib/bootstrap/env";
import { createBetterAuthLogger } from "@/lib/logging/app-logger";
import type { AuthService } from "@/lib/runtime/types";

export function createAuth(db: unknown, env: Environment): AuthService {
  return betterAuth({
    database: drizzleAdapter(db as never, {
      provider: "pg",
      schema: authSchema,
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    emailAndPassword: {
      enabled: true,
    },
    logger: createBetterAuthLogger(env),
  }) as AuthService;
}
