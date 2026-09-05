import * as authSchema from "@edaya/adaptor-auth/schema";
import type { AuthSecondaryStoragePort } from "@edaya/adaptor-auth";
import {
  buildBetterAuthRateLimitOptions,
  buildBetterAuthSessionOptions,
  toBetterAuthSecondaryStorage,
} from "@edaya/adaptor-auth";
import { betterAuth } from "better-auth";
import { emailOTP, openAPI } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Environment } from "@/runtime/shared/env/schema";
import type { AuthService } from "@/runtime/types";
import { createAppLogger, createBetterAuthLogger } from "@/runtime/shared/adapters/pino-logger";
import { createAuthEmailSenders } from "@/runtime/shared/adapters/auth-otp-mailer";
import { shouldRequireEmailVerification } from "@/runtime/shared/adapters/auth-email-delivery";
import { isSeedAuthProvisionRequest } from "@/runtime/shared/adapters/seed-auth-provision";
import { applyEmailVerificationCallbackUrl } from "@/runtime/shared/env/derived";

export type BetterAuthEnv = Pick<
  Environment,
  "BETTER_AUTH_SECRET" | "BETTER_AUTH_URL" | "LOG_LEVEL" | "NODE_ENV"
> & Pick<
  Partial<Environment>,
  "TRUSTED_ORIGINS" | "COOKIE_DOMAIN" | "NOVU_SECRET_KEY" | "NOVU_API_URL"
  | "REQUIRE_EMAIL_VERIFICATION" | "AUTH_EMAIL_LOG_OTP" | "WEBAPP_ORIGIN"
>;

export interface BuildBetterAuthConfigOptions {
  secondaryStorage?: AuthSecondaryStoragePort;
}

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

export function buildBetterAuthConfig(
  db: unknown,
  env: BetterAuthEnv,
  options: BuildBetterAuthConfigOptions = {},
): Parameters<typeof betterAuth>[0] {
  const fullEnv = env as Environment;
  const appLogger = createAppLogger(fullEnv);
  const authEmail = createAuthEmailSenders(fullEnv, appLogger);
  const requireEmailVerification = shouldRequireEmailVerification(fullEnv);
  const rateLimit = buildBetterAuthRateLimitOptions(options);

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
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }, request) => {
        if (isSeedAuthProvisionRequest(request?.headers)) {
          return;
        }
        // Await delivery so Cloudflare Workers do not tear down the isolate
        // before the Novu request completes (void + catch was fire-and-forget).
        try {
          await authEmail.sendAuthVerificationEmail({
            email: user.email,
            url: applyEmailVerificationCallbackUrl(url, fullEnv),
            displayName: user.name,
          });
        }
        catch (error: unknown) {
          appLogger.error(
            { err: error, email: user.email },
            "Failed to send auth verification email",
          );
        }
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user, ctx) => {
            if (isSeedAuthProvisionRequest(ctx?.headers)) {
              return {
                data: {
                  ...user,
                  emailVerified: true,
                },
              };
            }
            if (!requireEmailVerification) {
              return {
                data: {
                  ...user,
                  emailVerified: true,
                },
              };
            }
          },
        },
      },
    },
    session: buildBetterAuthSessionOptions(options),
    ...(options.secondaryStorage
      ? { secondaryStorage: toBetterAuthSecondaryStorage(options.secondaryStorage) }
      : {}),
    ...(rateLimit ? { rateLimit } : {}),
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

export function createBetterAuth(
  db: unknown,
  env: BetterAuthEnv,
  options: BuildBetterAuthConfigOptions = {},
): AuthService {
  return betterAuth(buildBetterAuthConfig(db, env, options)) as AuthService;
}
