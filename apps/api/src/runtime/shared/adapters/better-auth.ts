import * as authSchema from "@edaya/integration-migrations/auth/schema";
import { betterAuth } from "better-auth";
import { emailOTP, openAPI } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Environment } from "@/runtime/shared/env/schema";
import type { AuthService } from "@/runtime/types";
import { createAppLogger, createBetterAuthLogger } from "@/runtime/shared/adapters/pino-logger";
import { createAuthOtpMailer } from "@/runtime/shared/adapters/auth-otp-mailer";

export type BetterAuthEnv = Pick<
  Environment,
  "BETTER_AUTH_SECRET" | "BETTER_AUTH_URL" | "LOG_LEVEL" | "NODE_ENV"
> & Pick<Partial<Environment>, "TRUSTED_ORIGINS" | "COOKIE_DOMAIN">;

function resolveBetterAuthTrustedOrigins(env: BetterAuthEnv): string[] {
  const configured = env.TRUSTED_ORIGINS?.split(",").map(origin => origin.trim()).filter(Boolean) ?? [];
  if (env.NODE_ENV === "development") {
    return [...new Set([
      ...configured,
      "http://localhost:*",
      "http://127.0.0.1:*",
      "http://10.0.2.2:*",
    ])];
  }
  return configured;
}

export function buildBetterAuthConfig(db: unknown, env: BetterAuthEnv): Parameters<typeof betterAuth>[0] {
  const appLogger = createAppLogger(env as Environment);
  const sendAuthVerificationOtp = createAuthOtpMailer(env as Environment, appLogger);

  return {
    database: drizzleAdapter(db as never, {
      provider: "sqlite",
      schema: authSchema,
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/auth",
    trustedOrigins: resolveBetterAuthTrustedOrigins(env),
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
    session: {
      cookieCache: {
        enabled: false,
      },
    },
    plugins: [
      openAPI({
        disableDefaultReference: true,
      }),
      emailOTP({
        disableSignUp: true,
        sendVerificationOTP: async ({ email, otp, type }) => {
          await sendAuthVerificationOtp({ email, otp, type });
        },
      }),
    ],
    logger: createBetterAuthLogger(env as Environment),
  };
}

export function createBetterAuth(db: unknown, env: BetterAuthEnv): AuthService {
  return betterAuth(buildBetterAuthConfig(db, env)) as AuthService;
}
