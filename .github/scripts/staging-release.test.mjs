import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { candidateRepositories, candidateCommits, assertReleaseMutationAllowed } from "./staging-candidate.mjs";
import { clientName, publicationStatus, candidatePublicationRecord } from "./client-publication.mjs";
import { recordClient } from "./record-client.mjs";
import { reusableApks } from "./staging-apk-provenance.mjs";
import { validateConfiguration, runPreflight, configurationPreflight } from "./staging-preflight.mjs";
import { staging } from "./staging-target.mjs";
const temps = [];
const temporary = () => { const path = mkdtempSync(resolve(tmpdir(), "edaya-release-test-")); temps.push(path); return path; };
afterEach(() => { for (const path of temps.splice(0)) rmSync(path, { recursive: true, force: true }); });
const commits = { backend: "a".repeat(40), frontend: "b".repeat(40), mobile: "c".repeat(40) };
const candidate = () => ({ repositories: commits, flutter: "3.44.8", apiUrl: staging.urls.api, firebase: { guardian: "g", teacher: "t" } });
const saved = () => ({ schemaVersion: 3, candidate: candidate(), apks: { guardian: "d".repeat(64), teacher: "e".repeat(64) } });
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
function environment() {
  const firebase = app => ({ project_info: { project_id: "fixture-project" }, client: [{ client_info: { android_client_info: { package_name: app === "guardian" ? "ca.mayainvest.edaya.guardian" : "ca.mayainvest.edaya.staff" } } }] });
  return { RELEASE_TARGET: "staging", RESET_DATA: "false", VALIDATE_ONLY: "true", CLOUDFLARE_ACCOUNT_ID: staging.account, CLOUDFLARE_API_TOKEN: "private-token", IDENTITY_CHECKOUT_TOKEN: "private-checkout-token", STAGING_NEON_TARGET_CONFIRMED: staging.databaseHost,
    STAGING_DATABASE_URL: `postgres://school:secret@${staging.databaseHost}/neondb?sslmode=require`, STAGING_AUTH_DATABASE_URL: `postgres://edaya_identity:secret@${staging.databaseHost}/edaya_identity?sslmode=require`,
    STAGING_API_SECRETS: JSON.stringify({ IDENTITY_DIRECTORY_SECRET: "shared-private", R2_ACCESS_KEY_ID: "key", R2_SECRET_ACCESS_KEY: "secret", FCM_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: "fixture-project", client_email: "fixture@example.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) }) }),
    STAGING_IDENTITY_SECRETS: JSON.stringify({ IDENTITY_DIRECTORY_SECRET: "shared-private", BETTER_AUTH_SECRET: "s".repeat(32), ACCOUNT_SECURITY_KEYS: JSON.stringify({ v1: Buffer.alloc(32, 1).toString("base64") }) }),
    ANDROID_SIGNING_BUNDLE: JSON.stringify({ keystore: Buffer.from("fixture").toString("base64"), apps: Object.fromEntries(["guardian", "teacher"].map(app => [app, { keyAlias: "fixture", keyPassword: "private", storePassword: "private", firebase: firebase(app) }])) }),
  };
}
describe("three-repository candidate and APK retries", () => {
  test("resolves only backend, frontend and mobile with redacted remotes", () => {
    const calls = [];
    const repositories = candidateRepositories("/fixture", (args, directory) => { calls.push(directory); return args[0] === "rev-parse" ? commits[directory.split("edaya_")[1]] : "https://private@github.com/fixture.git"; });
    expect(candidateCommits(repositories)).toEqual(commits);
    expect(calls).toHaveLength(6);
    expect(JSON.stringify(repositories)).not.toContain("private@");
  });
  test("matching provenance is reusable", () => { const artifact = saved(); expect(reusableApks(artifact, candidate(), app => artifact.apks[app])).toBe(true); });
  for (const field of ["repositories", "flutter", "apiUrl", "firebase"]) test(`changed ${field} invalidates cache`, () => {
    const changed = candidate(); changed[field] = field === "repositories" ? { ...commits, backend: "f".repeat(40) } : "different";
    expect(reusableApks(saved(), changed, () => { throw new Error("must not inspect unrelated cache"); })).toBe(false);
  });
  test("unversioned and four-repository provenance require rebuild", () => {
    const artifact = saved(); delete artifact.schemaVersion; expect(reusableApks(artifact, candidate(), () => "")).toBe(false);
    const legacy = saved(); legacy.candidate.repositories = { ...commits, identity: "f".repeat(40) }; expect(reusableApks(legacy, candidate(), () => "")).toBe(false);
  });
  test("checksum corruption fails instead of reusing artifacts", () => { expect(() => reusableApks(saved(), candidate(), () => "f".repeat(64))).toThrow("checksum mismatch"); });
  test("manifest generation needs only three checkouts and records one unified contract and Worker", () => {
    const root = temporary();
    for (const name of Object.keys(commits)) {
      const repo = resolve(root, `edaya_${name}`); mkdirSync(repo);
      const git = args => execFileSync("git", args, { cwd: repo, stdio: "pipe" });
      git(["init"]); git(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.com", "commit", "--allow-empty", "-m", "fixture"]); git(["remote", "add", "origin", "https://github.com/fixture.git"]);
      writeFileSync(resolve(repo, name === "mobile" ? "pubspec.lock" : "bun.lock"), name);
    }
    const spec = resolve(root, "edaya_backend/tooling/repo/fixtures"); mkdirSync(spec, { recursive: true }); writeFileSync(resolve(spec, "openapi.json"), "unified-spec");
    const api = resolve(root, "edaya_backend/apps/api"); mkdirSync(api, { recursive: true }); writeFileSync(resolve(api, "wrangler.jsonc"), "unified-worker");
    const bin = resolve(root, "bin"); mkdirSync(bin); writeFileSync(resolve(bin, "flutter"), '#!/bin/sh\nprintf \'{"frameworkVersion":"3.44.8"}\\n\'\n', { mode: 0o755 });
    execFileSync("node", [resolve(import.meta.dir, "staging-manifest.mjs")], { env: { ...process.env, RELEASE_ROOT: root, PATH: `${bin}:${process.env.PATH}` }, stdio: "pipe" });
    const manifest = JSON.parse(readFileSync(resolve(root, "release/manifest.json"), "utf8"));
    expect(manifest.schemaVersion).toBe(4); expect(Object.keys(manifest.repositories)).toEqual(["backend", "frontend", "mobile"]);
    expect(Object.keys(manifest.clients)).toEqual(["api"]); expect(manifest.dependencies.openapiSha256).toMatch(/^[a-f0-9]{64}$/); expect(manifest.backendWorker.name).toBe("edaya-api-staging");
    expect(Object.keys(manifest.dependencies.lockSha256)).toHaveLength(3);
    expect(manifest.backendWorker.configurationSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.clientPublication.api).toMatchObject({ sourceSha: manifest.repositories.backend.sha, status: "unverified" });
  });
});
describe("single client publication", () => {
  test("validation records the sole client's candidate source without claiming publication", () => {
    expect(candidatePublicationRecord(undefined, commits.backend)).toEqual({ api: { version: `0.0.0-staging.${commits.backend}`, sourceSha: commits.backend, status: "unverified", verifiedAt: null } });
  });
  test("manifest accepts a matching immutable API publication", () => {
    const saved = { api: { version: `0.0.0-staging.${commits.backend}`, sourceSha: commits.backend, status: "reused", verifiedAt: "fixture" } };
    expect(candidatePublicationRecord(saved, commits.backend)).toEqual(saved);
  });
  test("manifest rejects legacy or mismatched publication evidence", () => {
    const api = { version: `0.0.0-staging.${commits.backend}`, sourceSha: commits.backend, status: "published" };
    for (const saved of [{ api, identity: api }, { api: { ...api, sourceSha: commits.mobile } }, { api: { ...api, version: "stale" } }]) expect(() => candidatePublicationRecord(saved, commits.backend)).toThrow("backend candidate");
  });
  test("package names identify distinct records", () => { expect(clientName("@maya-invest/edaya-api-client")).toBe("api"); expect(() => clientName("@maya-invest/edaya-identity-client")).toThrow(); expect(() => clientName("unknown")).toThrow(); });
  test("immutable versions may only reuse the exact source commit", () => { expect(publicationStatus(commits.backend, commits.backend)).toBe("reused"); expect(publicationStatus(undefined, commits.backend)).toBe("published"); expect(() => publicationStatus(commits.mobile, commits.backend)).toThrow("candidate commit"); });
  test("rejects obsolete publication records", () => {
    expect(() => recordClient("identity", "version", commits.backend, "reused")).toThrow("Only the unified API client");
  });
});
describe("read-only staging preflight", () => {
  test("valid payloads pass static validation", () => { expect(validateConfiguration(environment()).errors).toEqual([]); });
  for (const field of ["CLOUDFLARE_API_TOKEN", "STAGING_AUTH_DATABASE_URL", "STAGING_NEON_TARGET_CONFIRMED", "ANDROID_SIGNING_BUNDLE", "IDENTITY_CHECKOUT_TOKEN"]) test(`missing ${field} fails without exposing values`, () => { const env = environment(); delete env[field]; const errors = validateConfiguration(env).errors.join("\n"); expect(errors).toContain(field); expect(errors).not.toContain("private-token"); expect(errors).not.toContain("secret@"); });
  for (const url of [`postgres://edaya_identity:secret@other.neon.tech/edaya_identity?sslmode=require`, `postgres://edaya_identity:secret@${staging.databaseHost}/edaya_identity?sslmode=disable`, `postgres://school:secret@${staging.databaseHost}/neondb?sslmode=require`]) test(`rejects incorrect Identity target ${url.split('?')[1]}`, () => { expect(validateConfiguration({ ...environment(), STAGING_AUTH_DATABASE_URL: url }).errors).toContain("STAGING_AUTH_DATABASE_URL: invalid target, role, TLS or release options"); });
  test("invalid and mismatched secrets fail", () => {
    const env = environment(); env.STAGING_IDENTITY_SECRETS = JSON.stringify({ BETTER_AUTH_SECRET: "short", IDENTITY_DIRECTORY_SECRET: "different", ACCOUNT_SECURITY_KEYS: '{"v1":"bad"}', PHONE_AUTH_MODE: "live" });
    expect(validateConfiguration(env).combined?.IDENTITY_DIRECTORY_SECRET).toBeUndefined(); expect(validateConfiguration(env).errors.join("\n")).toContain("ACCOUNT_SECURITY_KEYS");
    expect(validateConfiguration({ ...env, STAGING_API_SECRETS: "[]" }).errors).toContain("STAGING_API_SECRETS: invalid JSON object");
  });
  test("missing configuration cannot reach network, databases or signing", async () => { let touched = false; await expect(runPreflight({}, { request: () => { touched = true; }, databaseCheck: () => { touched = true; }, signingCheck: () => { touched = true; } })).rejects.toThrow("blocked"); expect(touched).toBe(false); });
  test("external checks use GET only and preserve sanitized errors", async () => {
    const requests = [];
    const request = async (url, options) => {
      requests.push(options.method); let result = [];
      if (url.includes("hyperdrive")) result = { origin: { host: staging.databaseHost, database: url.includes(staging.schoolHyperdrive) ? staging.schoolDatabase : staging.identityDatabase, user: "edaya_identity" }, caching: { disabled: true } };
      if (url.includes('/zones?')) result = [{ id: 'zone', name: staging.zoneName, status: 'active', account: { id: staging.account } }];
      if (url.includes("/queues?")) result = [{ queue_name: staging.queue }];
      return { ok: true, json: async () => url.includes("api.github") ? { permissions: { pull: true } } : { success: true, result } };
    };
    expect((await runPreflight(environment(), { request, databaseCheck: () => {}, signingCheck: () => {} })).status).toBe("passed"); expect(requests.every(method => method === "GET")).toBe(true);
    await expect(runPreflight(environment(), { request, databaseCheck: () => { throw new Error("private-password"); }, signingCheck: () => {} })).rejects.toThrow("Database.identities: verification failed");
  });
});
describe("validation cannot mutate staging", () => {
  test("direct publication and deployment fail before any operations", () => {
    for (const script of ["publish-client.mjs", "staging-deploy.mjs"]) {
      const result = spawnSync("node", [resolve(import.meta.dir, script)], { env: { ...process.env, VALIDATE_ONLY: "true", RELEASE_ROOT: temporary() }, encoding: "utf8" });
      expect(result.status).toBe(1); expect(result.stderr).toContain("VALIDATE_ONLY forbids publication, deployment and live data changes");
    }
    expect(() => assertReleaseMutationAllowed({ VALIDATE_ONLY: "TRUE" })).toThrow();
  });
  test("workflow forwards validation and gates every publication and live deployment step", () => {
    const workflow = readFileSync(resolve(import.meta.dir, "../workflows/release-staging.yml"), "utf8");
    expect(workflow.match(/validate_only:/g)).toHaveLength(2);
    for (const name of ["Publish or reuse matching API client", "Deploy, bootstrap, smoke-test, and observe staging"]) expect(workflow).toContain(`- name: ${name}\n        if: \${{ !inputs.validate_only }}`);
    expect(readFileSync(resolve(import.meta.dir, "../workflows/deploy_push.yml"), "utf8")).toContain("validate_only: ${{ inputs.validate_only }}");
    const dispatch = Bun.YAML.parse(readFileSync(resolve(import.meta.dir, "../workflows/deploy_push.yml"), "utf8"));
    expect(dispatch.jobs["publish-api-client"].needs).toContain("qualification");
    expect(dispatch.jobs["publish-api-client"].if).toContain("'production'");
    expect(dispatch.jobs.qualification.needs).toEqual(["gate", "verify", "integration"]);
    expect(readFileSync(resolve(import.meta.dir, "../workflows/push.yml"), "utf8")).not.toContain("publish-api-client:");
  });
});

import { assertStagingMutationAllowed } from '../../tooling/repo/db/lib/staging-validation';
test('validation rejects live migration/reset and allows only a marked loopback rehearsal', () => {
  for (const value of [environment().STAGING_DATABASE_URL, environment().STAGING_AUTH_DATABASE_URL, 'invalid']) {
    expect(() => assertStagingMutationAllowed(value, { VALIDATE_ONLY: 'true', EDAYA_DISPOSABLE_POSTGRES: 'true' })).toThrow('live database migration and reset');
  }
  expect(() => assertStagingMutationAllowed('postgres://fixture@127.0.0.1/neondb', { VALIDATE_ONLY: 'true' })).toThrow();
  expect(() => assertStagingMutationAllowed('postgres://fixture@127.0.0.1/neondb', { VALIDATE_ONLY: 'true', EDAYA_DISPOSABLE_POSTGRES: 'true' })).not.toThrow();
});

test('coordinator publishes the single API package, reuses immutable versions and rejects mismatched checkout sources', () => {
  const root = temporary();
  for (const name of ['backend', 'frontend', 'mobile']) {
    const directory = resolve(root, `edaya_${name}`); mkdirSync(directory);
    const git = args => execFileSync('git', args, { cwd: directory, stdio: 'pipe' });
    git(['init']); git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', 'commit', '--allow-empty', '-m', name]); git(['remote', 'add', 'origin', 'https://github.com/fixture.git']);
  }
  const backend = resolve(root, 'edaya_backend');
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: backend, encoding: 'utf8' }).trim();
  const bin = resolve(root, 'bin'); mkdirSync(bin);
  writeFileSync(resolve(bin, 'npm'), `#!/bin/sh
if [ "$1" = view ]; then
  if [ -n "$MOCK_PUBLISHED_SOURCE" ]; then printf '"%s"\\n' "$MOCK_PUBLISHED_SOURCE"; else echo E404 >&2; exit 1; fi
else
  echo publish >> "$MOCK_OPERATIONS"
fi
`, { mode: 0o755 });
  const env = { ...process.env, VALIDATE_ONLY: 'false', RELEASE_ROOT: root, PATH: `${bin}:${process.env.PATH}`, MOCK_OPERATIONS: resolve(root, 'operations') };
  const publish = (directory, extra = {}) => spawnSync('node', [resolve(import.meta.dir, 'publish-client.mjs'), directory, 'staging'], { env: { ...env, ...extra }, encoding: 'utf8' });
  for (const name of ['api']) {
    const directory = resolve(backend, `package/${name}-client`); mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, 'package.json'), JSON.stringify({ name: `@maya-invest/edaya-${name}-client`, version: '0.0.0' }));
    expect(publish(directory).status).toBe(0);
    expect(publish(directory, { MOCK_PUBLISHED_SOURCE: sha }).status).toBe(0);
    const mismatch = publish(directory, { MOCK_PUBLISHED_SOURCE: commits.mobile });
    expect(mismatch.status).toBe(1); expect(mismatch.stderr).toContain('does not match the candidate commit');
  }
  expect(readFileSync(resolve(root, 'operations'), 'utf8').trim().split('\n')).toHaveLength(1);
  const records = JSON.parse(readFileSync(resolve(root, 'release/client-publication.json'), 'utf8'));
  expect(records.api).toMatchObject({ sourceSha: sha, status: 'reused' }); expect(Object.keys(records)).toEqual(['api']);
  const foreign = resolve(root, 'edaya_mobile/client'); mkdirSync(foreign);
  writeFileSync(resolve(foreign, 'package.json'), JSON.stringify({ name: '@maya-invest/edaya-api-client', version: '0.0.0' }));
  const rejected = publish(foreign); expect(rejected.status).toBe(1); expect(rejected.stderr).toContain('must match the backend candidate');
});

import { mergeWorkerSecrets } from './merge-worker-secrets.mjs';
test('single Worker secrets retain keys, discard directory fields and reject conflicts', () => {
  expect(mergeWorkerSecrets({ AFRICAS_TALKING_API_KEY: 'same', IDENTITY_DIRECTORY_SECRET: 'old-a' }, { AFRICAS_TALKING_API_KEY: 'same', IDENTITY_DIRECTORY_SECRET: 'old-b', BETTER_AUTH_SECRET: 'signing', ACCOUNT_SECURITY_KEYS: 'keyring' })).toEqual({ AFRICAS_TALKING_API_KEY: 'same', BETTER_AUTH_SECRET: 'signing', ACCOUNT_SECURITY_KEYS: 'keyring' });
  expect(() => mergeWorkerSecrets({ SECRET: 'first' }, { SECRET: 'second' })).toThrow('SECRET: conflicting duplicate field');
  const env = environment(); env.STAGING_API_SECRETS = JSON.stringify({ ...JSON.parse(env.STAGING_API_SECRETS), BETTER_AUTH_SECRET: 'different' });
  expect(validateConfiguration(env).errors.join('\n')).toContain('BETTER_AUTH_SECRET: conflicting duplicate field');
});
test('schema 2 APKs with separate auth origins are cache misses', () => {
  const legacy = { ...saved(), schemaVersion: 2 }; expect(reusableApks(legacy, candidate(), () => { throw new Error('must rebuild'); })).toBe(false);
});
test('hostname owned by another Worker blocks read-only readiness', async () => {
  const request = async url => ({ ok: true, json: async () => ({ success: true, result: url.includes('/zones?') ? [{ id: 'zone', name: staging.zoneName, status: 'active', account: { id: staging.account } }] : url.includes('/workers/domains') ? [{ hostname: new URL(staging.urls.api).hostname, service: 'another-worker', zone_id: 'zone' }] : [] }) });
  await expect(runPreflight(environment(), { request, databaseCheck: () => {}, signingCheck: () => {} })).rejects.toThrow('Cloudflare.apiDomain: verification failed');
});

test('unclaimed Custom Domain is eligible while scheme and wildcard routes owned elsewhere block', async () => {
  for (const pattern of [undefined, 'https://staging.api.edayaplus.com/auth/*', '*.api.edayaplus.com/*']) {
    const request = async url => {
      let result = [];
      if (url.includes('/zones?')) result = [{ id: 'zone', name: staging.zoneName, status: 'active', account: { id: staging.account } }];
      else if (url.includes('/workers/routes')) result = pattern ? [{ pattern, script: 'foreign-worker' }] : [];
      else if (url.includes('/hyperdrive/configs/')) result = { origin: { host: staging.databaseHost, database: url.endsWith(staging.identityHyperdrive) ? staging.identityDatabase : staging.schoolDatabase, user: 'edaya_identity' }, caching: { disabled: true } };
      else if (url.includes('/queues?')) result = [{ queue_name: staging.queue }];
      return { ok: true, json: async () => url.includes('api.github.com') ? { permissions: { pull: true } } : { success: true, result } };
    };
    const action = runPreflight(environment(), { request, databaseCheck: () => {}, signingCheck: () => {} });
    if (pattern) await expect(action).rejects.toThrow('Cloudflare.apiDomain: verification failed');
    else expect((await action).checked).toContain('Cloudflare.apiDomain');
  }
});

test('configuration failures preserve sanitized evidence before consumer checkouts or toolchains exist', () => {
  const root = temporary();
  expect(() => configurationPreflight({ RELEASE_ROOT: root, STAGING_API_SECRETS: '{"private":"never-upload-this"}' })).toThrow('STAGING_AUTH_DATABASE_URL');
  const evidence = readFileSync(resolve(root, 'release/preflight.json'), 'utf8');
  const report = JSON.parse(evidence);
  expect(report.phase).toBe('configuration');
  expect(report.status).toBe('blocked');
  expect(evidence).not.toContain('never-upload-this');
  expect(evidence).not.toContain('private-token');
});
