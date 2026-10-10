import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseJsonc, readConfig } from "../../apps/api/configuration/index.mjs";

// Resource bindings and application origins already have canonical configuration files.
// Database destinations come only from CI secrets; no second endpoint allowlist is maintained.
export function loadStagingTarget(worker, app, web = {}) {
  const binding = (list, name, field = "binding") => {
    const matches = (list || []).filter(item => item[field] === name);
    if (matches.length !== 1) throw new Error(`Staging requires exactly one ${name} binding`);
    return matches[0];
  };
  const queue = binding(worker.queues?.producers, "CRON_JOBS").queue;
  if (!(worker.queues?.consumers || []).some(item => item.queue === queue)) throw new Error("Staging queue producer and consumer differ");
  const urls = { api: app.API_ORIGIN, webapp: app.WEBAPP_ORIGIN };
  const webWorkers = [];
  for (const [name, config] of Object.entries(web)) {
    const domains = (config.routes || []).filter(route => route.custom_domain);
    if (domains.length !== 1 || !config.name) throw new Error(`Staging ${name} needs one Custom Domain and Worker name`);
    const origin = `https://${domains[0].pattern}`;
    if (name === "webapp" && origin !== urls.webapp) throw new Error("Web Worker domain differs from the API application origin");
    if (config.vars?.PUBLIC_API_URL !== urls.api) throw new Error("Web Worker API origin differs from the API application configuration");
    urls[name] = origin;
    webWorkers.push(config.name);
  }
  for (const value of Object.values(urls)) {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.origin !== value || url.username || url.password) throw new Error("Staging origins must be HTTPS origins without credentials");
  }
  return Object.freeze({ apiWorker: worker.name,
    schoolHyperdrive: binding(worker.hyperdrive, "HYPERDRIVE").id,
    identityHyperdrive: binding(worker.hyperdrive, "HYPERDRIVE_AUTH").id,
    authKv: binding(worker.kv_namespaces, "AUTH_KV").id,
    queue, bucket: app.R2_BUCKET_NAME, urls: Object.freeze(urls), webWorkers: Object.freeze(webWorkers),
  });
}
const readWorker = file => parseJsonc(readFileSync(file, "utf8")).env.staging;
const web = {};
// The configuration-only CI step precedes consumer checkout. Full preflight requires both.
for (const name of ["webapp", "webadmin"]) {
  const file = new URL(`../../../edaya_frontend/apps/${name}/wrangler.jsonc`, import.meta.url);
  if (existsSync(file)) web[name] = readWorker(file);
}
export const staging = loadStagingTarget(
  readWorker(new URL("../../apps/api/wrangler.jsonc", import.meta.url)), readConfig("staging"), web,
);

export function databaseTarget(value) {
  try {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.hostname.includes("-pooler")
      || !url.username || !url.password || !decodeURIComponent(url.pathname.slice(1)) || url.hash
      || (url.port && url.port !== "5432") || !["require", "verify-full"].includes(url.searchParams.get("sslmode"))) throw new Error();
    // Decode now so malformed credentials/identifiers cannot escape into diagnostics later.
    decodeURIComponent(url.username); decodeURIComponent(url.password);
    return url;
  } catch { throw new Error("Staging database secrets require direct PostgreSQL connections, credentials, database names and TLS"); }
}

export function releaseOptions(env, resources = staging) {
  if (env.RELEASE_TARGET !== "staging") throw new Error("Only staging releases are allowed");
  if (!["false", "true"].includes(env.RESET_DATA)) throw new Error("RESET_DATA must be explicit true or false");
  if (!/^[a-f0-9]{32}$/.test(env.CLOUDFLARE_ACCOUNT_ID || "")) throw new Error("CLOUDFLARE_ACCOUNT_ID: missing or invalid staging environment variable");
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(env.STAGING_ZONE_NAME || "")) throw new Error("STAGING_ZONE_NAME: missing or invalid staging environment variable");
  const school = databaseTarget(env.STAGING_DATABASE_URL);
  const identity = databaseTarget(env.STAGING_AUTH_DATABASE_URL);
  if (school.hostname !== identity.hostname) throw new Error("Staging database secrets must select the same direct endpoint");
  const schoolDatabase = decodeURIComponent(school.pathname.slice(1));
  const identityDatabase = decodeURIComponent(identity.pathname.slice(1));
  const schoolRole = decodeURIComponent(school.username), identityRole = decodeURIComponent(identity.username);
  if (schoolDatabase === identityDatabase || schoolRole === identityRole) throw new Error("Identity must use a separate database and dedicated role");
  const zoneName = env.STAGING_ZONE_NAME;
  for (const origin of Object.values(resources.urls)) {
    const host = new URL(origin).hostname;
    if (host !== zoneName && !host.endsWith(`.${zoneName}`)) throw new Error("Staging origins must belong to the configured zone");
  }
  const target = Object.freeze({ ...resources, account: env.CLOUDFLARE_ACCOUNT_ID, zoneName,
    databaseHost: school.hostname, schoolDatabase, identityDatabase, schoolRole, identityRole });
  return { reset: env.RESET_DATA === "true", school, identity, target };
}

export function assertHyperdrive(config, database, role, target) {
  if (config?.origin?.host !== target.databaseHost || config.origin.database !== database
    || config.origin.user !== role || config.caching?.disabled !== true) {
    throw new Error("Hyperdrive must match the staging CI database secret and have caching disabled");
  }
}

// The auth binding may still share the school database before the first identity transition.
export function assertInitialIdentityHyperdrive(config, schoolRole, target) {
  if (config?.origin?.database === target.identityDatabase) {
    assertHyperdrive(config, target.identityDatabase, target.identityRole, target);
  } else {
    if (!schoolRole) throw new Error("School role is required for the legacy identity binding");
    assertHyperdrive(config, target.schoolDatabase, schoolRole, target);
  }
}

export function assertStagingConfiguration(config) {
  if (config.R2_BUCKET_NAME !== staging.bucket) throw new Error("Staging bucket differs between application configuration and release target");
  if (config.API_ORIGIN !== staging.urls.api || config.WEBAPP_ORIGIN !== staging.urls.webapp)
    throw new Error("Staging application origins differ from release targets");
  if (config.PHONE_AUTH_MODE !== "disabled") throw new Error("Staging phone authentication must remain disabled");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv[2] === "--github-env") {
    if (!process.env.GITHUB_ENV) throw new Error("GITHUB_ENV is required");
    appendFileSync(process.env.GITHUB_ENV, `PUBLIC_API_URL=${staging.urls.api}\n`);
  }
  if (process.argv[2] === "--api-origin") console.log(staging.urls.api);
}
