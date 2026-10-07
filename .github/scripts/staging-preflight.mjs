import { mergeWorkerSecrets } from "./merge-worker-secrets.mjs";
import { spawnSync } from "node:child_process";
import { createPrivateKey } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { assertHyperdrive, releaseOptions, staging } from "./staging-target.mjs";

const required = ["CLOUDFLARE_API_TOKEN", "STAGING_DATABASE_URL", "STAGING_AUTH_DATABASE_URL", "STAGING_API_SECRETS", "STAGING_IDENTITY_SECRETS", "STAGING_NEON_TARGET_CONFIRMED", "IDENTITY_CHECKOUT_TOKEN", "ANDROID_SIGNING_BUNDLE"];
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const nonempty = value => typeof value === "string" && value.trim().length > 0;
const base64 = value => nonempty(value) && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);

export function configurationPreflight(env) {
  const { errors } = validateConfiguration(env);
  const report = { target: "staging", phase: "configuration", endpoint: staging.databaseHost, status: errors.length ? "blocked" : "passed", checked: [], errors, createdAt: new Date().toISOString() };
  if (env.RELEASE_ROOT) {
    const output = resolve(env.RELEASE_ROOT, "release");
    mkdirSync(output, { recursive: true });
    writeFileSync(resolve(output, "preflight.json"), `${JSON.stringify(report, null, 2)}\n`);
  }
  if (errors.length) throw new Error(`Staging configuration blocked:\n${errors.join("\n")}`);
  return report;
}

// Errors name fields and resources only. Never include URLs, payloads or provider diagnostics.
export function validateConfiguration(env) {
  const errors = [];
  for (const name of required) if (!nonempty(env[name])) errors.push(`${name}: missing`);
  if (env.STAGING_NEON_TARGET_CONFIRMED !== staging.databaseHost) errors.push("STAGING_NEON_TARGET_CONFIRMED: endpoint ownership must be verified");
  for (const [name, database] of [["STAGING_DATABASE_URL", staging.schoolDatabase], ["STAGING_AUTH_DATABASE_URL", staging.identityDatabase]]) {
    try {
      releaseOptions({ ...env, STAGING_DATABASE_URL: name === "STAGING_DATABASE_URL" ? env[name] : `postgres://school:placeholder@${staging.databaseHost}/neondb?sslmode=require`, STAGING_AUTH_DATABASE_URL: name === "STAGING_AUTH_DATABASE_URL" ? env[name] : `postgres://edaya_identity:placeholder@${staging.databaseHost}/edaya_identity?sslmode=require` });
    } catch { errors.push(`${name}: invalid target, role, TLS or release options`); }
  }
  if (env.VALIDATE_ONLY !== undefined && !["true", "false"].includes(env.VALIDATE_ONLY)) errors.push("VALIDATE_ONLY: expected true or false");
  const parse = (name, value) => {
    try { const parsed = JSON.parse(value); if (!object(parsed)) throw new Error(); return parsed; }
    catch { errors.push(`${name}: invalid JSON object`); return {}; }
  };
  const api = parse("STAGING_API_SECRETS", env.STAGING_API_SECRETS);
  const identity = parse("STAGING_IDENTITY_SECRETS", env.STAGING_IDENTITY_SECRETS);
  for (const [name, secrets] of [["STAGING_API_SECRETS", api], ["STAGING_IDENTITY_SECRETS", identity]]) {
    for (const [field, value] of Object.entries(secrets)) if (!nonempty(value)) errors.push(`${name}.${field}: expected nonempty string`);
    for (const field of ["DATABASE_URL", "AUTH_DATABASE_URL", "TEST_OTP_ACCESS", "PHONE_AUTH_MODE", "NODE_ENV", "RUNTIME", "STAGING_MAINTENANCE", "STAGING_PAUSE_JOBS", "API_ORIGIN", "BETTER_AUTH_URL", "FIRST_PARTY_API_ORIGINS"]) if (field in secrets) errors.push(`${name}.${field}: reserved configuration must not be supplied as a secret`);
  }
  for (const field of ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "FCM_SERVICE_ACCOUNT_JSON"]) if (!nonempty(api[field])) errors.push(`STAGING_API_SECRETS.${field}: missing`);
  if (!nonempty(identity.BETTER_AUTH_SECRET) || identity.BETTER_AUTH_SECRET.length < 32) errors.push("STAGING_IDENTITY_SECRETS.BETTER_AUTH_SECRET: minimum 32 characters required");
  let combined;
  try { combined = mergeWorkerSecrets(api, identity); } catch (error) { errors.push(error.message); }
  const keys = parse("STAGING_IDENTITY_SECRETS.ACCOUNT_SECURITY_KEYS", identity.ACCOUNT_SECURITY_KEYS);
  const active = identity.ACCOUNT_SECURITY_KEY_VERSION || "v1";
  if (!keys[active] || !/^[a-zA-Z0-9_-]+$/.test(active)) errors.push("ACCOUNT_SECURITY_KEY_VERSION: missing or invalid key version");
  for (const [version, key] of Object.entries(keys)) if (!/^[a-zA-Z0-9_-]+$/.test(version) || !base64(key) || Buffer.from(key, "base64").length !== 32) errors.push("ACCOUNT_SECURITY_KEYS: each version must contain a 32-byte base64 key");
  try { if (new URL(api.R2_ENDPOINT).protocol !== "https:") throw new Error(); } catch { errors.push("STAGING_API_SECRETS.R2_ENDPOINT: HTTPS required"); }
  const fcm = parse("STAGING_API_SECRETS.FCM_SERVICE_ACCOUNT_JSON", api.FCM_SERVICE_ACCOUNT_JSON);
  if (!nonempty(fcm.project_id) || !nonempty(fcm.client_email)) errors.push("FCM_SERVICE_ACCOUNT_JSON: project_id and client_email required");
  try { createPrivateKey(fcm.private_key); } catch { errors.push("FCM_SERVICE_ACCOUNT_JSON.private_key: invalid private key"); }
  const signing = parse("ANDROID_SIGNING_BUNDLE", env.ANDROID_SIGNING_BUNDLE);
  if (!base64(signing.keystore) || Buffer.from(signing.keystore || "", "base64").length === 0) errors.push("ANDROID_SIGNING_BUNDLE.keystore: invalid base64");
  for (const [app, applicationId] of [["guardian", "ca.mayainvest.edaya.guardian"], ["teacher", "ca.mayainvest.edaya.staff"]]) {
    const config = signing.apps?.[app];
    for (const field of ["keyAlias", "keyPassword", "storePassword"]) if (!nonempty(config?.[field]) || /[\r\n\\]/.test(config[field])) errors.push(`ANDROID_SIGNING_BUNDLE.apps.${app}.${field}: missing or invalid`);
    const firebase = config?.firebase;
    if (!object(firebase) || firebase.project_info?.project_id !== fcm.project_id || !firebase.client?.some(client => client.client_info?.android_client_info?.package_name === applicationId)) errors.push(`ANDROID_SIGNING_BUNDLE.apps.${app}.firebase: Firebase project or application ID mismatch`);
  }
  return { errors: [...new Set(errors)], api, identity, combined, signing };
}

export async function runPreflight(env, { request = fetch, databaseCheck, signingCheck } = {}) {
  const config = validateConfiguration(env);
  const errors = [...config.errors];
  const checked = [];
  if (!errors.length) {
    const check = async (name, action) => { try { await action(); checked.push(name); } catch { errors.push(`${name}: verification failed`); } };
    const cloud = async path => {
      const response = await request(`https://api.cloudflare.com/client/v4/accounts/${staging.account}${path}`, { method: "GET", headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` }, signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error();
      return data.result;
    };
    await check("Cloudflare.apiDomain", async () => {
      const response = await request(`https://api.cloudflare.com/client/v4/zones?name=${staging.zoneName}&account.id=${staging.account}`, { method: "GET", headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` }, signal: AbortSignal.timeout(15000) });
      const payload = await response.json();
      const zone = payload.result?.find(value => value.name === staging.zoneName && value.account?.id === staging.account && value.status === "active");
      if (!response.ok || !payload.success || !zone) throw new Error();
      const hostname = new URL(staging.urls.api).hostname;
      const domains = await cloud("/workers/domains");
      const domain = domains.find(value => value.hostname === hostname);
      if (domain && (domain.service !== staging.apiWorker || domain.zone_id !== zone.id)) throw new Error();
      const zoneGet = async path => {
        const reply = await request(`https://api.cloudflare.com/client/v4/zones/${zone.id}${path}`, { method: "GET", headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` }, signal: AbortSignal.timeout(15000) });
        const data = await reply.json();
        if (!reply.ok || !data.success) throw new Error();
        return data.result;
      };
      if (!domain && (await zoneGet(`/dns_records?name=${hostname}`)).length) throw new Error();
      for (const route of await zoneGet("/workers/routes")) {
        const hostPattern = route.pattern.replace(/^https?:\/\//, "").split("/")[0];
        const pattern = hostPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*");
        if (route.script && route.script !== staging.apiWorker && new RegExp(`^${pattern}$`).test(hostname)) throw new Error();
      }
    });
    await check("Cloudflare.schoolHyperdrive", async () => assertHyperdrive(await cloud(`/hyperdrive/configs/${staging.schoolHyperdrive}`), staging.schoolDatabase));
    await check("Cloudflare.identityHyperdrive", async () => {
      const drive = await cloud(`/hyperdrive/configs/${staging.identityHyperdrive}`);
      assertHyperdrive(drive, staging.identityDatabase, "edaya_identity");
    });
    await check("Cloudflare.authKv", () => cloud(`/storage/kv/namespaces/${staging.authKv}/keys?limit=1`));
    await check("Cloudflare.filesBucket", () => cloud(`/r2/buckets/${staging.bucket}`));
    await check("Cloudflare.cronQueue", async () => { if (!(await cloud("/queues?per_page=100")).some(queue => queue.queue_name === staging.queue)) throw new Error(); });
    for (const repository of ["edaya_web", "edaya_mobile"]) await check(`GitHub.${repository}.checkout`, async () => {
      const response = await request(`https://api.github.com/repos/Maya-Invest/${repository}`, { method: "GET", headers: { Authorization: `Bearer ${env.IDENTITY_CHECKOUT_TOKEN}`, Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(15000) });
      if (!response.ok || (await response.json()).permissions?.pull !== true) throw new Error();
    });
    await check("Database.identities", databaseCheck || (() => {
      const result = spawnSync("bun", ["tooling/repo/db/school/staging-preflight.ts"], { cwd: resolve(env.RELEASE_ROOT || "..", "edaya_backend"), env, stdio: "pipe", timeout: 30000 });
      if (result.status !== 0) throw new Error();
    }));
    await check("Android.signing", signingCheck || (() => {
      const directory = mkdtempSync(resolve(tmpdir(), "edaya-signing-preflight-"));
      try {
        const file = resolve(directory, "upload.jks");
        writeFileSync(file, Buffer.from(config.signing.keystore, "base64"), { mode: 0o600 });
        for (const app of ["guardian", "teacher"]) {
          const material = config.signing.apps[app];
          const result = spawnSync("keytool", ["-certreq", "-keystore", file, "-alias", material.keyAlias, "-storepass:env", "EDAYA_PREFLIGHT_STORE_PASSWORD", "-keypass:env", "EDAYA_PREFLIGHT_KEY_PASSWORD"], { env: { ...env, EDAYA_PREFLIGHT_STORE_PASSWORD: material.storePassword, EDAYA_PREFLIGHT_KEY_PASSWORD: material.keyPassword }, stdio: "pipe", timeout: 15000 });
          if (result.status !== 0) throw new Error();
        }
      } finally { rmSync(directory, { recursive: true, force: true }); }
    }));
  }
  const report = { target: "staging", endpoint: staging.databaseHost, status: errors.length ? "blocked" : "passed", checked, errors, createdAt: new Date().toISOString() };
  if (env.RELEASE_ROOT) { const output = resolve(env.RELEASE_ROOT, "release"); mkdirSync(output, { recursive: true }); writeFileSync(resolve(output, "preflight.json"), `${JSON.stringify(report, null, 2)}\n`); }
  if (errors.length) throw new Error(`Staging preflight blocked:\n${errors.join("\n")}`);
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.includes("--configuration-only")) {
      configurationPreflight(process.env);
      console.log("Staging configuration preflight passed");
    } else {
      await runPreflight(process.env);
      console.log("Read-only staging preflight passed");
    }
  }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
