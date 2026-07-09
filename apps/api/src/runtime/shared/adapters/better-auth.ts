import * as authSchema from "@edaya/adaptor-auth/schema";
import { betterAuth } from "better-auth";
import { emailOTP, openAPI } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Environment } from "@/runtime/shared/env/schema";
import type { AuthService } from "@/runtime/types";
import { createAppLogger, createBetterAuthLogger } from "@/runtime/shared/adapters/pino-logger";
import { createAuthEmailSenders } from "@/runtime/shared/adapters/auth-otp-mailer";
import { shouldRequireEmailVerification } from "@/runtime/shared/adapters/auth-email-delivery";
import { isSeedAuthProvisionRequest } from "@/runtime/shared/adapters/seed-auth-provision";

export type BetterAuthEnv = Pick<
  Environment,
  "BETTER_AUTH_SECRET" | "BETTER_AUTH_URL" | "LOG_LEVEL" | "NODE_ENV"
> & Pick<
  Partial<Environment>,
  "TRUSTED_ORIGINS" | "COOKIE_DOMAIN" | "NOVU_SECRET_KEY" | "NOVU_API_URL"
  | "REQUIRE_EMAIL_VERIFICATION" | "AUTH_EMAIL_LOG_OTP"
>;

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
  const fullEnv = env as Environment;
  const appLogger = createAppLogger(fullEnv);
  const authEmail = createAuthEmailSenders(fullEnv, appLogger);
  const requireEmailVerification = shouldRequireEmailVerification(fullEnv);

  return {
    database: drizzleAdapter(db as never, {
      provider: "pg",
      schema: authSchema,
      schemaName: "auth",
    } as Parameters<typeof drizzleAdapter>[1]),
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
      requireEmailVerification,
      autoSignIn: !requireEmailVerification,
    },
    emailVerification: {
      sendOnSignUp: requireEmailVerification,
      sendOnSignIn: requireEmailVerification,
      sendVerificationEmail: async ({ user, url }, request) => {
        if (isSeedAuthProvisionRequest(request?.headers)) {
          return;
        }
        void authEmail.sendAuthVerificationEmail({
          email: user.email,
          url,
          displayName: user.name,
        }).catch((error: unknown) => {
          appLogger.error(
            { err: error, email: user.email },
            "Failed to send auth verification email",
          );
        });
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user, ctx) => {
            if (!isSeedAuthProvisionRequest(ctx?.headers)) {
              return;
            }
            return {
              data: {
                ...user,
                emailVerified: true,
              },
            };
          },
        },
      },
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
          await authEmail.sendAuthVerificationOtp({ email, otp, type });
        },
      }),
    ],
    logger: createBetterAuthLogger(fullEnv),
  };
}

export function createBetterAuth(db: unknown, env: BetterAuthEnv): AuthService {
  return betterAuth(buildBetterAuthConfig(db, env)) as AuthService;
}
