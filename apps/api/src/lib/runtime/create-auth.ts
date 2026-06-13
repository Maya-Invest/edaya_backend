import { authSchema } from "@edaya/adaptor-betterauth";
import { betterAuth } from "better-auth";
import { openAPI } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Environment } from "@/lib/runtime/env";
import type { AuthService } from "@/lib/runtime/types";
import { createBetterAuthLogger } from "../http/middleware/logger";

export function createAuth(db: unknown, env: Environment): AuthService {
  return betterAuth({
    database: drizzleAdapter(db as never, {
      provider: "sqlite",
      schema: authSchema,
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/auth",
    trustedOrigins: env.TRUSTED_ORIGINS ? env.TRUSTED_ORIGINS.split(",") : [],
    advanced: {
      ...(env.COOKIE_DOMAIN
        ? {
            crossSubDomainCookies: {
              enabled: true,
              domain: env.COOKIE_DOMAIN,
            },
          }
        : {}),
    },
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      openAPI({
        disableDefaultReference: true,
      }),
    ],
    logger: createBetterAuthLogger(env),
  }) as AuthService;
}
