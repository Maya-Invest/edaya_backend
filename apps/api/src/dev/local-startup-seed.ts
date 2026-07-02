/* eslint-disable node/no-process-env */
import path from "node:path";
import { resolveDevSeedContext } from "@edaya/fixtures/meta/resolve-dev-seed-context";
import { resolveSeedingApiKeyForSchool } from "@edaya/fixtures/meta/school-profiles";
import type { Environment } from "@/runtime/shared/env/schema";
import { resolveRepoLocalDataPath } from "@/runtime/shared/env/repo-root";
import { getApiRuntime } from "@/runtime/local/registry";

const WIPE_AND_RESEED_HINT
  = "Stop bun dev, run `cd edaya_backend && bun seed:clean --yes`, then restart bun dev.";

function usesRepoLocalDataPath(pathValue: string): boolean {
  if (pathValue === ".data" || pathValue.startsWith(".data/")) {
    return true;
  }

  const repoDataRoot = resolveRepoLocalDataPath(".data");
  const normalized = path.normalize(pathValue);
  return normalized.startsWith(`${repoDataRoot}${path.sep}`)
    || normalized.includes(`${path.sep}.data${path.sep}`)
    || normalized.endsWith(`${path.sep}.data`);
}

/** True when the API uses persisted PGlite + auth SQLite under repo-root `.data/`. */
export function isPersistedLocalDataDeployment(
  env: Pick<Environment, "RUNTIME" | "DATABASE_URL" | "AUTH_DATABASE_PATH">,
): boolean {
  if (env.RUNTIME !== "local") {
    return false;
  }

  if (!env.DATABASE_URL.startsWith("pglite:")) {
    return false;
  }

  const schoolDataDir = env.DATABASE_URL.slice("pglite:".length).trim();
  if (!schoolDataDir || schoolDataDir === "pglite" || !usesRepoLocalDataPath(schoolDataDir)) {
    return false;
  }

  return usesRepoLocalDataPath(env.AUTH_DATABASE_PATH);
}

export function resolveSeedOnStart(
  env: Pick<Environment, "NODE_ENV" | "RUNTIME" | "DATABASE_URL" | "AUTH_DATABASE_PATH">,
): boolean {
  const raw = process.env.SEED_ON_START?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "no") {
    return false;
  }
  if (raw === "true" || raw === "1" || raw === "yes") {
    return isPersistedLocalDataDeployment(env);
  }

  return env.NODE_ENV === "development" && isPersistedLocalDataDeployment(env);
}

async function isLocalDataAlreadySeeded(env: Environment): Promise<boolean> {
  const context = resolveDevSeedContext();
  const runtime = await getApiRuntime(env);
  const application = await runtime.getSchoolApplication();
  const schools = await application.repositories.schools.list();
  const hasDemoSchool = schools.some(school => school.id === context.schoolId);
  if (!hasDemoSchool) {
    return false;
  }

  return (await application.repositories.students.list()).length > 0;
}

async function detectIncompleteLocalSeedState(env: Environment): Promise<string | null> {
  const context = resolveDevSeedContext();
  const runtime = await getApiRuntime(env);
  const application = await runtime.getSchoolApplication();
  const schools = await application.repositories.schools.list();
  const students = await application.repositories.students.list();
  const hasDemoSchool = schools.some(school => school.id === context.schoolId);

  if (hasDemoSchool && students.length > 0) {
    return null;
  }
  if (schools.length === 0 && students.length === 0) {
    const hasDevAuth = await application.hasAuthAccountForEmail(context.minimalStaffEmail);
    if (hasDevAuth) {
      return `Local .data has auth accounts but no school data. ${WIPE_AND_RESEED_HINT}`;
    }
    return null;
  }

  return `Local .data has partial seed data (schools=${schools.length}, students=${students.length}, `
    + `expected school=${context.schoolId}). ${WIPE_AND_RESEED_HINT}`;
}

function resolveLocalSeedAppOrigin(env: Environment): string {
  const firstTrustedOrigin = env.TRUSTED_ORIGINS.split(",")[0]?.trim();
  return firstTrustedOrigin || "http://localhost:5173";
}

async function runHttpStartupSeed(env: Environment): Promise<void> {
  const {
    HttpSeedClient,
    logHttpDevSeedResults,
    runHttpDevSeeds,
    waitForApi,
  } = await import("@edaya/seeding/http");

  const context = resolveDevSeedContext();
  const baseUrl = env.BETTER_AUTH_URL;
  const appOrigin = resolveLocalSeedAppOrigin(env);

  await waitForApi(baseUrl);

  const client = new HttpSeedClient({ baseUrl, appOrigin });
  const results = await runHttpDevSeeds({
    client,
    scope: "all",
    serviceAccountApiKey: resolveSeedingApiKeyForSchool(context.schoolId),
    provisionServiceAccount: true,
  });

  logHttpDevSeedResults(results);
}

/** Re-links Better Auth dev accounts when `.data` already contains school fixtures. */
async function runHttpStartupAuthLinkRepair(env: Environment): Promise<void> {
  const {
    HttpSeedClient,
    logHttpDevSeedResults,
    runHttpDevSeeds,
    waitForApi,
  } = await import("@edaya/seeding/http");

  const context = resolveDevSeedContext();
  const baseUrl = env.BETTER_AUTH_URL;
  const appOrigin = resolveLocalSeedAppOrigin(env);
  const serviceAccountApiKey = resolveSeedingApiKeyForSchool(context.schoolId);

  await waitForApi(baseUrl);

  const client = new HttpSeedClient({ baseUrl, appOrigin });
  const linkResults = await runHttpDevSeeds({
    client,
    scope: "auth:link",
    serviceAccountApiKey,
  });
  logHttpDevSeedResults({ ...linkResults, smoke: null, validation: null });

  const smokeClient = new HttpSeedClient({ baseUrl, appOrigin });
  const smokeResults = await runHttpDevSeeds({
    client: smokeClient,
    scope: "smoke",
    serviceAccountApiKey,
  });
  logHttpDevSeedResults({
    school: null,
    authProvision: null,
    authLink: null,
    access: null,
    smoke: smokeResults.smoke,
    validation: null,
  });

  if (smokeResults.smoke?.status === "failed") {
    throw new Error(
      `Dev staff sign-in check failed for ${context.minimalStaffEmail}: `
      + `${smokeResults.smoke.reason ?? "unknown reason"}. ${WIPE_AND_RESEED_HINT}`,
    );
  }
}

/** Seeds repo-root `.data/` through the local API (same flow as `bun seed:init`). */
export async function maybeRunLocalStartupSeed(env: Environment): Promise<void> {
  if (!resolveSeedOnStart(env)) {
    return;
  }

  if (await isLocalDataAlreadySeeded(env)) {
    // eslint-disable-next-line no-console
    console.log("SEED_ON_START: local .data already seeded, re-linking dev auth accounts…");
    await runHttpStartupAuthLinkRepair(env);
    return;
  }

  const incompleteState = await detectIncompleteLocalSeedState(env);
  if (incompleteState) {
    throw new Error(incompleteState);
  }

  // eslint-disable-next-line no-console
  console.log(`SEED_ON_START: seeding local .data via ${env.BETTER_AUTH_URL}…`);
  await runHttpStartupSeed(env);
}

export { WIPE_AND_RESEED_HINT };
