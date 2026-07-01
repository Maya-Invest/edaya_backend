import { resolve } from "node:path";

export interface BootstrapEnv {
  secretKey: string;
  serverURL?: string;
}

export interface LoadBootstrapEnvOptions {
  /** Repo root; defaults to three levels above this file. */
  repoRoot?: string;
  /** Load apps/api/.env when vars are missing from process.env */
  loadApiEnvFile?: boolean;
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export async function loadApiDotEnv(repoRoot: string): Promise<void> {
  for (const fileName of [".env", ".dev.vars"]) {
    const envPath = resolve(repoRoot, "apps/api", fileName);
    const text = await Bun.file(envPath).text().catch(() => "");
    const override = fileName === ".dev.vars";

    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const separator = trimmed.indexOf("=");
      if (separator <= 0) {
        continue;
      }
      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      const inlineComment = value.indexOf(" #");
      if (inlineComment >= 0) {
        value = value.slice(0, inlineComment).trim();
      }
      if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (override || !(key in process.env) || !process.env[key]?.trim()) {
        process.env[key] = value;
      }
    }
  }
}

export function validateNovuSecretKeyHint(secretKey: string): string | undefined {
  if (secretKey.startsWith("cfat_") || secretKey.includes("_apia")) {
    return "NOVU_SECRET_KEY looks like a Cloudflare R2 token fragment, not a Novu API key.";
  }
  if (secretKey.length < 32) {
    return "NOVU_SECRET_KEY is unusually short — copy the full Secret Key from Novu (Settings → API Keys).";
  }
  return undefined;
}

export async function loadBootstrapEnv(
  options: LoadBootstrapEnvOptions = {},
): Promise<BootstrapEnv> {
  const repoRoot = options.repoRoot ?? resolve(import.meta.dirname, "../../../..");
  if (options.loadApiEnvFile !== false) {
    await loadApiDotEnv(repoRoot);
  }

  const secretKey = readEnv("NOVU_SECRET_KEY");
  if (!secretKey) {
    throw new Error("NOVU_SECRET_KEY is required (set in env, apps/api/.env, or apps/api/.dev.vars)");
  }

  return {
    secretKey,
    ...(readEnv("NOVU_API_URL") ? { serverURL: readEnv("NOVU_API_URL") } : {}),
  };
}
