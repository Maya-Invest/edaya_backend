import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Environment } from "@/lib/bootstrap/env";
import type { AuthService } from "@/lib/runtime/types";

export function createAuth(db: unknown, env: Environment): AuthService {
  return betterAuth({
    database: drizzleAdapter(db as never, {
      provider: "pg",
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    emailAndPassword: {
      enabled: true,
    },
  }) as AuthService;
}
