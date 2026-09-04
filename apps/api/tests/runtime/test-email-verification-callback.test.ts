import { describe, expect, it } from "bun:test";
import {
  applyEmailVerificationCallbackUrl,
  resolveEmailVerificationCallbackUrl,
  resolveInviteBaseUrl,
  resolveWebappOrigin,
} from "@/runtime/shared/env/derived";

function callbackOf(verificationUrl: string): string | null {
  return new URL(verificationUrl).searchParams.get("callbackURL");
}

describe("resolveWebappOrigin", () => {
  it("prefers WEBAPP_ORIGIN", () => {
    expect(resolveWebappOrigin({
      WEBAPP_ORIGIN: "https://staging.app.edayaplus.com/",
      TRUSTED_ORIGINS: "https://other.example",
      NODE_ENV: "production",
    })).toBe("https://staging.app.edayaplus.com");
  });

  it("falls back to the first TRUSTED_ORIGINS entry", () => {
    expect(resolveWebappOrigin({
      TRUSTED_ORIGINS: "http://localhost:5173,http://localhost:4173",
      NODE_ENV: "production",
    })).toBe("http://localhost:5173");
  });

  it("uses the local default in development", () => {
    expect(resolveWebappOrigin({ NODE_ENV: "development" })).toBe("http://localhost:5173");
  });

  it("returns undefined in production without origins", () => {
    expect(resolveWebappOrigin({ NODE_ENV: "production" })).toBeUndefined();
  });
});

describe("resolveEmailVerificationCallbackUrl", () => {
  it("builds the local login redirect", () => {
    expect(resolveEmailVerificationCallbackUrl({
      NODE_ENV: "development",
    })).toBe("http://localhost:5173/login?verified=1");
  });

  it("builds the staging login redirect", () => {
    expect(resolveEmailVerificationCallbackUrl({
      WEBAPP_ORIGIN: "https://staging.app.edayaplus.com",
      NODE_ENV: "production",
    })).toBe("https://staging.app.edayaplus.com/login?verified=1");
  });

  it("builds the production login redirect", () => {
    expect(resolveEmailVerificationCallbackUrl({
      WEBAPP_ORIGIN: "https://app.edayaplus.com",
      NODE_ENV: "production",
    })).toBe("https://app.edayaplus.com/login?verified=1");
  });
});

describe("resolveInviteBaseUrl", () => {
  it("still appends /invite to the webapp origin", () => {
    expect(resolveInviteBaseUrl({
      WEBAPP_ORIGIN: "https://staging.app.edayaplus.com",
    } as never)).toBe("https://staging.app.edayaplus.com/invite");
  });
});

describe("applyEmailVerificationCallbackUrl", () => {
  const stagingEnv = {
    WEBAPP_ORIGIN: "https://staging.app.edayaplus.com",
    TRUSTED_ORIGINS: "https://staging.app.edayaplus.com,https://staging.admin.edayaplus.com",
    BETTER_AUTH_URL: "https://staging.api.edayaplus.com",
    NODE_ENV: "production",
  };
  const localEnv = {
    TRUSTED_ORIGINS: "http://localhost:5173,http://localhost:4173",
    BETTER_AUTH_URL: "http://localhost:9999",
    NODE_ENV: "development",
  };

  it("rewrites a relative /login callback", () => {
    const rewritten = applyEmailVerificationCallbackUrl(
      "http://localhost:9999/auth/verify-email?token=abc&callbackURL=%2Flogin",
      localEnv,
    );
    expect(callbackOf(rewritten)).toBe("http://localhost:5173/login?verified=1");
  });

  it("rewrites when callbackURL is missing", () => {
    const rewritten = applyEmailVerificationCallbackUrl(
      "https://staging.api.edayaplus.com/auth/verify-email?token=abc",
      stagingEnv,
    );
    expect(callbackOf(rewritten)).toBe("https://staging.app.edayaplus.com/login?verified=1");
  });

  it("returns the original string when the verification URL is not parseable", () => {
    expect(applyEmailVerificationCallbackUrl("not-a-url", stagingEnv)).toBe("not-a-url");
  });

  it("rewrites a relative callback to the local login page", () => {
    const rewritten = applyEmailVerificationCallbackUrl(
      "http://localhost:9999/auth/verify-email?token=abc&callbackURL=%2F",
      localEnv,
    );
    expect(callbackOf(rewritten)).toBe("http://localhost:5173/login?verified=1");
  });

  it("rewrites a relative callback to the staging login page", () => {
    const rewritten = applyEmailVerificationCallbackUrl(
      "https://staging.api.edayaplus.com/auth/verify-email?token=abc&callbackURL=%2F",
      stagingEnv,
    );
    expect(callbackOf(rewritten)).toBe("https://staging.app.edayaplus.com/login?verified=1");
  });

  it("rewrites a relative callback to the production login page", () => {
    const rewritten = applyEmailVerificationCallbackUrl(
      "https://api.edayaplus.com/auth/verify-email?token=abc&callbackURL=%2F",
      {
        WEBAPP_ORIGIN: "https://app.edayaplus.com",
        TRUSTED_ORIGINS: "https://app.edayaplus.com,https://admin.edayaplus.com",
        BETTER_AUTH_URL: "https://api.edayaplus.com",
        NODE_ENV: "production",
      },
    );
    expect(callbackOf(rewritten)).toBe("https://app.edayaplus.com/login?verified=1");
  });

  it("rewrites an API-origin callback", () => {
    const rewritten = applyEmailVerificationCallbackUrl(
      "https://staging.api.edayaplus.com/auth/verify-email?token=abc&callbackURL=https%3A%2F%2Fstaging.api.edayaplus.com%2F",
      stagingEnv,
    );
    expect(callbackOf(rewritten)).toBe("https://staging.app.edayaplus.com/login?verified=1");
  });

  it("rewrites an untrusted absolute callback", () => {
    const rewritten = applyEmailVerificationCallbackUrl(
      "https://staging.api.edayaplus.com/auth/verify-email?token=abc&callbackURL=https%3A%2F%2Fevil.example%2Flogin",
      stagingEnv,
    );
    expect(callbackOf(rewritten)).toBe("https://staging.app.edayaplus.com/login?verified=1");
  });

  it("preserves a trusted invite callback", () => {
    const invite = "https://staging.app.edayaplus.com/invite/token-123";
    const original = `https://staging.api.edayaplus.com/auth/verify-email?token=abc&callbackURL=${encodeURIComponent(invite)}`;
    expect(applyEmailVerificationCallbackUrl(original, stagingEnv)).toBe(original);
  });

  it("returns the original URL when no webapp origin can be resolved", () => {
    const original = "https://api.edayaplus.com/auth/verify-email?token=abc&callbackURL=%2F";
    expect(applyEmailVerificationCallbackUrl(original, {
      BETTER_AUTH_URL: "https://api.edayaplus.com",
      NODE_ENV: "production",
    })).toBe(original);
  });
});
