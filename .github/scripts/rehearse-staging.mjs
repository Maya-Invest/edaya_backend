// Rehearse the complete bootstrap on a cluster created and destroyed by this process.
// No project DATABASE_URL, cloud credential, or existing local server is used.
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, openSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const root = resolve(process.env.RELEASE_ROOT || "..");
const backend = resolve(root, "edaya_backend");
const directory = mkdtempSync(resolve(tmpdir(), "edaya-staging-rehearsal-"));
mkdirSync(resolve(root, "release"), { recursive: true });
const children = [];
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/SECRET|TOKEN|PASSWORD|DATABASE_URL|SIGNING_BUNDLE|^SEED_|^PG/.test(key)));
const run = (program, args, cwd = backend, extra = {}, input) => {
  const result = spawnSync(program, args, { cwd, env: { ...env, ...extra }, input, encoding: "utf8", stdio: input ? ["pipe", "inherit", "inherit"] : "inherit" });
  if (result.status !== 0) throw new Error(`Rehearsal command failed: ${program} ${args[0]}`);
};
const port = () => new Promise((done, reject) => {
  const server = createServer(); server.on("error", reject);
  server.listen(0, "127.0.0.1", () => { const value = server.address().port; server.close(() => done(value)); });
});
const wait = async url => {
  for (let count = 0; count < 120; count++) {
    if (children.some(child => child.exitCode !== null)) throw new Error("A rehearsal server exited");
    try { if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).status < 400) return; } catch {}
    await new Promise(done => setTimeout(done, 1000));
  }
  throw new Error("Rehearsal server did not become ready");
};
const start = (name, cwd, args, extra) => {
  const log = openSync(resolve(directory, `${name}.log`), "w", 0o600);
  children.push(spawn("bun", args, { cwd, env: { ...env, ...extra }, stdio: ["ignore", log, log], detached: true }));
};
let started = false;
let succeeded = false;
try {
  const pgPort = await port(), apiPort = await port(), filePort = await port();
  run("initdb", ["-D", resolve(directory, "postgres"), "-A", "trust", "-U", "edaya_rehearsal", "--no-locale", "--encoding=UTF8"]);
  run("pg_ctl", ["-D", resolve(directory, "postgres"), "-l", resolve(directory, "postgres.log"), "-o", `-h 127.0.0.1 -p ${pgPort} -k ${directory}`, "-w", "start"]);
  started = true;
  const pgEnv = { PGHOST: "127.0.0.1", PGPORT: String(pgPort), PGUSER: "edaya_rehearsal", PGDATABASE: "postgres" };
  run("psql", ["-v", "ON_ERROR_STOP=1"], backend, pgEnv, "CREATE ROLE identity_rehearsal LOGIN PASSWORD 'rehearsal-only';\nCREATE DATABASE identity_rehearsal OWNER identity_rehearsal;\nCREATE DATABASE school_rehearsal;\n");
  const schoolDb = `postgres://edaya_rehearsal@127.0.0.1:${pgPort}/school_rehearsal`;
  const authDb = `postgres://identity_rehearsal:rehearsal-only@127.0.0.1:${pgPort}/identity_rehearsal`;
  const apiUrl = `http://127.0.0.1:${apiPort}`, filesUrl = `http://127.0.0.1:${filePort}`;
  const common = { NODE_ENV: "development", RUNTIME: "local", LOG_LEVEL: "silent", EMAIL_TRANSPORT: "log", SMS_TRANSPORT: "log", PHONE_AUTH_MODE: "disabled", LOCAL_OTP_CAPTURE: "true", TRUSTED_ORIGINS: "http://localhost:4173", WEBAPP_ORIGIN: "http://localhost:4173" };
  const schoolEnv = { ...common, PORT: String(apiPort), DATABASE_URL: schoolDb, AUTH_DATABASE_URL: authDb, BETTER_AUTH_SECRET: "disposable-account-secret-for-rehearsal-only", API_ORIGIN: apiUrl, LOCAL_FILES_URL: filesUrl, LOCAL_FILES_PORT: String(filePort), LOCAL_FILES_ROOT: resolve(directory, "files"), LOCAL_FILES_SECRET: "disposable-file-secret", RUN_MIGRATIONS_ON_STARTUP: "false", ALLOW_PUBLIC_SCHOOL_REGISTRATION: "true" };
  const releaseEnv = { EDAYA_DISPOSABLE_POSTGRES: "true", RELEASE_TARGET: "staging", RESET_DATA: "true", STAGING_MAINTENANCE_CONFIRMED: "true", STAGING_DATABASE_HOST: "127.0.0.1", STAGING_SCHOOL_DATABASE: "school_rehearsal", STAGING_IDENTITY_DATABASE: "identity_rehearsal", STAGING_IDENTITY_ROLE: "identity_rehearsal", STAGING_DATABASE_URL: schoolDb, STAGING_AUTH_DATABASE_URL: authDb };
  run("bun", ["tooling/repo/db/school/staging-release.ts"], backend, { ...schoolEnv, ...releaseEnv });
  run("bun", ["tooling/repo/db/identity/staging-release.ts"], backend, { ...schoolEnv, ...releaseEnv });
  const accounts = resolve(directory, "accounts.json");
  run("bun", ["tooling/seeding/scripts/export-identity-fixtures.ts", accounts], backend);
  run("bun", ["apps/api/src/identity/entries/staging-fixtures.ts", "staging", accounts, `${accounts}.sessions.json`], backend, { ...schoolEnv, API_ORIGIN: apiUrl.replace("http:", "https:"), STAGING_AUTH_DATABASE_URL: authDb, STAGING_DATABASE_HOST: "127.0.0.1", STAGING_SCHOOL_DATABASE: "school_rehearsal", STAGING_IDENTITY_DATABASE: "identity_rehearsal", STAGING_IDENTITY_ROLE: "identity_rehearsal" });
  start("school", resolve(backend, "apps/api"), ["tests/support/native-bootstrap-server.ts"], { ...schoolEnv, STAGING_SCHOOL_DATABASE: releaseEnv.STAGING_SCHOOL_DATABASE, EDAYA_DISPOSABLE_POSTGRES: "true" });
  start("files", backend, ["tooling/repo/dev/local-files.ts"], schoolEnv);
  await wait(`${apiUrl}/reference`);
  run("bun", ["repo", "seed"], backend, { ...schoolEnv, SEED_API_URL: apiUrl, SEED_APP_ORIGIN: "http://localhost:4173", SEED_PROVISIONED_IDENTITY: "true", SEED_AUTH_SESSIONS_FILE: `${accounts}.sessions.json` });
  // Prove a no-reset retry leaves both databases byte-for-byte equivalent at the data level.
  const dataSnapshot = (database, schemas) => {
    const result = spawnSync("pg_dump", ["--data-only", "--inserts", "--no-owner", "--no-privileges", ...schemas.flatMap(schema => ["--schema", schema])], { env: { ...env, ...pgEnv, PGDATABASE: database }, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    if (result.status !== 0) throw new Error("Could not snapshot rehearsal data");
    // PostgreSQL 17+ adds a fresh random psql restriction token to each dump.
    const stable = result.stdout.split("\n").filter(line => !line.startsWith("--") && !line.startsWith("\\restrict ") && !line.startsWith("\\unrestrict ")).join("\n");
    return createHash("sha256").update(stable).digest("hex");
  };
  const before = [dataSnapshot("school_rehearsal", ["school", "notify"]), dataSnapshot("identity_rehearsal", ["auth", "identity"])];
  run("bun", ["tooling/repo/db/school/staging-release.ts"], backend, { ...schoolEnv, ...releaseEnv, RESET_DATA: "false" });
  run("bun", ["tooling/repo/db/identity/staging-release.ts"], backend, { ...schoolEnv, ...releaseEnv, RESET_DATA: "false" });
  run("bun", ["apps/api/src/identity/entries/staging-fixtures.ts", "staging", accounts], backend, { ...schoolEnv, API_ORIGIN: apiUrl.replace("http:", "https:"), ...releaseEnv });
  const after = [dataSnapshot("school_rehearsal", ["school", "notify"]), dataSnapshot("identity_rehearsal", ["auth", "identity"])];
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("No-reset retry changed existing fixture data");
  writeFileSync(resolve(root, "release/bootstrap-rehearsal.json"), JSON.stringify({ passed: true, at: new Date().toISOString(), databases: "disposable native PostgreSQL", separateIdentityRole: true, emailVerificationRequired: true, provisionedIdentityOnly: true, attachments: true, documentFixtures: true, explicitResetScripts: true, noResetPreservesData: true, idempotentIdentityFixtures: true }, null, 2));
  succeeded = true;
} finally {
  for (const child of children) { try { process.kill(-child.pid, "SIGTERM"); } catch {} }
  await Promise.all(children.map(child => child.exitCode !== null ? Promise.resolve() : new Promise(done => child.once("exit", done))));
  if (started) run("pg_ctl", ["-D", resolve(directory, "postgres"), "-m", "immediate", "-w", "stop"]);
  if (succeeded) rmSync(directory, { recursive: true, force: true });
  else console.error(`Rehearsal diagnostics retained at ${directory}`);
}
