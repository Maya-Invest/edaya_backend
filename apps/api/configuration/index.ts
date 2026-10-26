/* eslint-disable node/no-process-env -- configuration is the process environment boundary */
/* eslint-disable dot-notation -- shared strict index-signature configuration */
// Shared by local API entrypoints, repository tooling, and Bun-based repository operations.
// This module is never imported by the deployed Worker entrypoint.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseDotenv } from "dotenv";
import { getNodeValue, parseTree } from "jsonc-parser";
import type { ParseError } from "jsonc-parser";

export const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const configKeys = new Set(`LOCAL_OTP_CAPTURE LOCAL_OPERATIONS_ROOT RUNTIME NODE_ENV PORT LOG_LEVEL DATABASE_URL AUTH_DATABASE_URL RUN_MIGRATIONS_ON_STARTUP API_ORIGIN TRUSTED_ORIGINS REQUIRE_PRIVILEGED_TOTP ACCOUNT_SECURITY_KEY_VERSION AUTH_PROVIDER_GENERATION PHONE_AUTH_MODE SMS_ROUTES AFRICAS_TALKING_USERNAME AFRICAS_TALKING_SENDER_ID AFRICAS_TALKING_SANDBOX WHATSAPP_PHONE_NUMBER_ID WHATSAPP_BUSINESS_ACCOUNT_ID WHATSAPP_AUTH_TEMPLATES WHATSAPP_API_VERSION REQUIRE_EMAIL_VERIFICATION EMAIL_FROM EMAIL_TRANSPORT SMS_TRANSPORT CLOUDFLARE_EMAIL_ACCOUNT_ID ALLOW_PUBLIC_SCHOOL_REGISTRATION PLATFORM_BOOTSTRAP_EMAILS WEBAPP_ORIGIN ACCOUNT_INVITATIONS_ENABLED PROFILE_PHOTO_MAX_BYTES GOTENBERG_URL CHROME_PATH DOCS_RENDER_ON_PUBLISH R2_ACCOUNT_ID R2_ENDPOINT R2_BUCKET_NAME LOCAL_FILES_URL LOCAL_FILES_ROOT LOCAL_FILES_PORT CRON_JOB_KEYS PAUSE_API PAUSE_SCHEDULER PAUSE_JOBS`.split(" "));
configKeys.add("AUTH_TERMS_MODE");
configKeys.add("AUTH_TERMS_VERSION");
export const secretKeys = new Set(`IDENTITY_DIRECTORY_SECRET BETTER_AUTH_SECRET ACCOUNT_SECURITY_KEYS CLOUDFLARE_EMAIL_API_TOKEN FCM_SERVICE_ACCOUNT_JSON AFRICAS_TALKING_API_KEY WHATSAPP_ACCESS_TOKEN WHATSAPP_APP_SECRET WHATSAPP_WEBHOOK_VERIFY_TOKEN R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY LOCAL_FILES_SECRET DATABASE_URL AUTH_DATABASE_URL CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_AUTH`.split(" "));
export const databaseKeys = new Set(["DATABASE_URL", "AUTH_DATABASE_URL"]);
export const workerOnlyKeys = new Set<string>([]);
export const localOnlyKeys = new Set(`LOCAL_OTP_CAPTURE LOCAL_OPERATIONS_ROOT PORT DATABASE_URL AUTH_DATABASE_URL RUN_MIGRATIONS_ON_STARTUP LOCAL_FILES_URL LOCAL_FILES_ROOT LOCAL_FILES_PORT CRON_JOB_KEYS CHROME_PATH CLOUDFLARE_EMAIL_ACCOUNT_ID`.split(" "));
export function parseJsonc(text: string, label = "configuration") {
  const errors: ParseError[] = [];
  const tree = parseTree(text, errors, { allowTrailingComma: true });
  if (errors.length || !tree || tree.type !== "object")
    throw new Error(`${label}: expected a valid JSONC object`);
  const names = new Set();
  for (const property of tree.children ?? []) {
    const name = property.children?.[0]?.value;
    if (names.has(name))
      throw new Error(`${label}: duplicate key ${name}`);
    names.add(name);
  }
  return getNodeValue(tree) as Record<string, unknown>;
}
const enumValues: Record<string, string[]> = {
  RUNTIME: ["local", "worker", "in-memory"],
  NODE_ENV: ["development", "production", "test"],
  LOG_LEVEL: ["fatal", "error", "warn", "info", "debug", "trace", "silent"],
  PHONE_AUTH_MODE: ["disabled", "sms_only", "whatsapp_first"],
  AUTH_TERMS_MODE: ["off", "preview", "enforced"],
  EMAIL_TRANSPORT: ["log", "cloudflare", "smtp"],
  SMS_TRANSPORT: ["log", "unimplemented", "router"],
};
const booleanKeys = new Set(`LOCAL_OTP_CAPTURE RUN_MIGRATIONS_ON_STARTUP REQUIRE_PRIVILEGED_TOTP AFRICAS_TALKING_SANDBOX REQUIRE_EMAIL_VERIFICATION ALLOW_PUBLIC_SCHOOL_REGISTRATION ACCOUNT_INVITATIONS_ENABLED DOCS_RENDER_ON_PUBLISH PAUSE_API PAUSE_SCHEDULER PAUSE_JOBS`.split(" "));
const numberKeys = new Set(["PORT", "LOCAL_FILES_PORT", "PROFILE_PHOTO_MAX_BYTES"]);
export function validateRuntimeConfig(input: unknown, label = "configuration", target?: string) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error(`${label}: expected an object`);
  const value = input as Record<string, string>;
  for (const [key, item] of Object.entries(value)) {
    if (key === "PHONE_SMS_ROUTES")
      throw new Error(`${label}: PHONE_SMS_ROUTES was removed; use sms_routes in the environment config`);
    if (!configKeys.has(key))
      throw new Error(`${label}.${key}: unknown or secret key`);
    if (typeof item !== "string")
      throw new Error(`${label}.${key}: expected a string`);
    if (enumValues[key] && !enumValues[key]!.includes(item))
      throw new Error(`${label}.${key}: unsupported setting`);
    if (booleanKeys.has(key) && !["true", "false", "1", "0"].includes(item.trim().toLowerCase()))
      throw new Error(`${label}.${key}: expected a boolean string`);
    if (numberKeys.has(key) && (!/^\d+$/.test(item) || Number(item) <= 0 || !Number.isSafeInteger(Number(item))))
      throw new Error(`${label}.${key}: expected a positive integer string`);
    if ((key === "PORT" || key === "LOCAL_FILES_PORT") && Number(item) > 65535)
      throw new Error(`${label}.${key}: invalid port`);
    if (key === "ACCOUNT_SECURITY_KEY_VERSION" && !/^[\w-]+$/.test(item))
      throw new Error(`${label}.${key}: invalid key version`);
    if (key === "SMS_ROUTES" || key === "WHATSAPP_AUTH_TEMPLATES") {
      let json;
      try {
        json = JSON.parse(item);
      }
      catch {
        throw new Error(`${label}.${key}: expected encoded JSON`);
      }
      if (key === "SMS_ROUTES")
        validateSmsRoutes(json, `${label}.${key}`);
      if (key === "WHATSAPP_AUTH_TEMPLATES" && (!json || !["fr", "en"].every(locale => /^[a-z0-9_]+$/.test(json[locale]?.name ?? "") && typeof json[locale]?.language === "string" && json[locale].language.length >= 2)))
        throw new Error(`${label}.${key}: expected French and English template definitions`);
    }
    if (databaseKeys.has(key) && !/^pglite(?::|$)/.test(item))
      throw new Error(`${label}.${key}: only local PGlite paths belong in configuration`);
    if (target && target !== "local" && localOnlyKeys.has(key))
      throw new Error(`${label}.${key}: local-only setting`);
    if (target === "local" && workerOnlyKeys.has(key))
      throw new Error(`${label}.${key}: Worker-only setting`);
    if (/_ORIGIN$|_URL$|_ENDPOINT$/.test(key) && !databaseKeys.has(key) && item) {
      try {
        const url = new URL(item);
        if (url.username || url.password)
          throw new Error("URL credentials are forbidden");
      }
      catch {
        throw new Error(`${label}.${key}: expected a URL without credentials`);
      }
    }
  }
  if (target && target !== "local" && ((value["RUNTIME"] && value["RUNTIME"] !== "worker") || (value["NODE_ENV"] && value["NODE_ENV"] !== "production") || ["true", "1"].includes(value["AFRICAS_TALKING_SANDBOX"]?.trim().toLowerCase() ?? "")))
    throw new Error(`${label}: deployed profiles require production Worker settings and live SMS`);
  return value;
}
export function validateSmsRoutes(value: unknown, label = "sms_routes") {
  if (!Array.isArray(value) || value.some(route => !route || typeof route !== "object" || Array.isArray(route)
    || Object.keys(route).length !== 2 || !/^\+[1-9]\d{0,14}$/.test(route.prefix)
    || route.provider !== "africas_talking") || new Set(value.map(route => route.prefix)).size !== value.length) {
    throw new Error(`${label}: expected unique international prefixes and registered SMS providers`);
  }
  return value as {
    prefix: string;
    provider: string;
  }[];
}
// Source files contain a native array; process/Worker boundaries contain strings.
export function validateConfig(value: unknown, label = "configuration", target?: string) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label}: expected an object`);
  if ("SMS_ROUTES" in value)
    throw new Error(`${label}: use native sms_routes, not SMS_ROUTES`);
  const { sms_routes, ...settings } = value as Record<string, unknown>;
  validateRuntimeConfig(settings, label, target);
  if (sms_routes !== undefined)
    validateSmsRoutes(sms_routes, `${label}.sms_routes`);
  return value as {
    sms_routes?: {
      prefix: string;
      provider: string;
    }[];
  } & Record<string, unknown>;
}
export function validateSmsCredentials(values: Record<string, string>, label = "SMS configuration") {
  if ((values["PHONE_AUTH_MODE"] ?? "disabled") === "disabled" && values["SMS_TRANSPORT"] !== "router")
    return;
  const routes = JSON.parse(values["SMS_ROUTES"] ?? "[]");
  validateSmsRoutes(routes, label);
  if (!routes.length)
    throw new Error(`${label}: enabled delivery requires sms_routes`);
  for (const key of ["AFRICAS_TALKING_USERNAME", "AFRICAS_TALKING_API_KEY"]) {
    if (typeof values[key] !== "string" || !values[key]!.trim())
      throw new Error(`${label}: ${key} is required`);
  }
  if (["true", "1"].includes(values["AFRICAS_TALKING_SANDBOX"]?.trim().toLowerCase() ?? "") && values["AFRICAS_TALKING_USERNAME"] !== "sandbox")
    throw new Error(`${label}: sandbox username must be sandbox`);
}
export function readConfig(target: string, root = apiRoot): Record<string, string> {
  if (!["local", "staging", "production"].includes(target))
    throw new Error("Expected local, staging, or production configuration");
  const filename = `config.${target}.jsonc`;
  const { sms_routes = [], ...settings } = validateConfig(parseJsonc(readFileSync(resolve(root, filename), "utf8"), filename), filename, target);
  return { ...settings as Record<string, string>, SMS_ROUTES: JSON.stringify(sms_routes) };
}
export function validateSecrets(value: unknown, label = "secrets") {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label}: expected an object`);
  for (const [key, item] of Object.entries(value)) {
    if (!secretKeys.has(key))
      throw new Error(`${label}.${key}: unknown or non-secret key; move configuration to config.<environment>.jsonc`);
    if (typeof item !== "string" || !item.trim())
      throw new Error(`${label}.${key}: expected a nonempty string; omit unused secrets`);
    if (databaseKeys.has(key) && !/^postgres(?:ql)?:\/\//.test(item))
      throw new Error(`${label}.${key}: local PGlite paths belong in config.local.jsonc`);
  }
  return value as Record<string, string>;
}
export function readSecrets(filename: string, { optional = false } = {}) {
  if (optional && !existsSync(filename))
    return {};
  const text = readFileSync(filename, "utf8");
  let parsed;
  try {
    parsed = filename.endsWith(".json") ? JSON.parse(text) : parseDotenv(text);
  }
  catch {
    throw new Error("Secrets file: invalid syntax");
  }
  return validateSecrets(parsed);
}
export function loadConfiguration(target = "local", options: {
  root?: string;
  source?: Record<string, string | undefined>;
  secretsFile?: string;
} = {}): Record<string, string> {
  const root = options.root ?? apiRoot;
  const source = options.source ?? process.env;
  const filename = options.secretsFile ?? (target === "local" ? source["EDAYA_LOCAL_ENV_FILE"] ?? ".env" : ".dev.vars");
  const config = readConfig(target, root);
  const secrets = readSecrets(resolve(root, filename), { optional: true });
  // Parse the file independently even when Bun or a parent process preloaded it.
  // Do not expand secrets: provider keys may legitimately contain dollar signs.
  if (source["PHONE_SMS_ROUTES"] !== undefined)
    throw new Error("PHONE_SMS_ROUTES was removed; use sms_routes in the environment config");
  return { ...config, ...secrets, ...Object.fromEntries(Object.entries(source).filter(([key, value]) => value !== undefined && key !== "sms_routes")) as Record<string, string>, SMS_ROUTES: config["SMS_ROUTES"]! };
}
export function loadLocalConfiguration(source: Record<string, string | undefined> = process.env, root = apiRoot) {
  const values = loadConfiguration("local", { source, root });
  Object.assign(source, values);
  return values;
}
