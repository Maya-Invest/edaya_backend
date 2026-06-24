import { resolve } from "node:path";
import { buildEmailWebhookIntegration } from "../catalog/integrations";
import type { BootstrapIntegrationDefinition } from "./types";

export interface BootstrapEnv {
  secretKey: string;
  serverURL?: string;
  emailWebhook?: {
    webhookUrl: string;
    secretKey: string;
    from: string;
    senderName: string;
  };
}

export interface LoadBootstrapEnvOptions {
  /** Repo root; defaults to three levels above this file. */
  repoRoot?: string;
  /** Load apps/api/.env when vars are missing from process.env */
  loadApiEnvFile?: boolean;
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export async function loadApiDotEnv(repoRoot: string): Promise<void> {
  const envPath = resolve(repoRoot, "apps/api/.env");
  const text = await Bun.file(envPath).text().catch(() => "");
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
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
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
    throw new Error("NOVU_SECRET_KEY is required (set in env or apps/api/.env)");
  }

  const webhookUrl = readEnv("NOVU_EMAIL_WEBHOOK_URL");
  const webhookSecret = readEnv("NOVU_EMAIL_WEBHOOK_SECRET");
  const from = readEnv("NOVU_EMAIL_FROM");
  const senderName = readEnv("NOVU_EMAIL_SENDER_NAME") ?? "Edaya";

  let emailWebhook: BootstrapEnv["emailWebhook"];
  if (webhookUrl && webhookSecret && from) {
    emailWebhook = {
      webhookUrl,
      secretKey: webhookSecret,
      from,
      senderName,
    };
  }

  return {
    secretKey,
    ...(readEnv("NOVU_API_URL") ? { serverURL: readEnv("NOVU_API_URL") } : {}),
    ...(emailWebhook ? { emailWebhook } : {}),
  };
}

export function resolveBootstrapIntegrations(env: BootstrapEnv): BootstrapIntegrationDefinition[] {
  if (!env.emailWebhook) {
    return [];
  }

  return [buildEmailWebhookIntegration(env.emailWebhook)];
}
