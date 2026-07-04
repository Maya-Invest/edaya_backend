import { resolveDevSeedContext } from "@edaya/fixtures/meta/resolve-dev-seed-context";
import { resolveSeedingApiKeyForSchool } from "@edaya/fixtures/meta/school-profiles";
import type { Environment } from "@/runtime/shared/env/schema";
import { getApiRuntime } from "@/runtime/local/registry";
import { resolveSeedOnStart } from "@/dev/persisted-local-data";

const WIPE_AND_RESEED_HINT
  = "Stop bun dev, run `cd edaya_backend && bun seed:clean --yes`, then restart bun dev.";

export { isPersistedLocalDataDeployment, resolveSeedOnStart } from "@/dev/persisted-local-data";

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

/** Re-links auth, access roles, and profile photos when `.data` already contains fixtures. */
async function runInProcessStartupRepair(env: Environment): Promise<void> {
  const {
    createHandlerAuthProvisioner,
    createInProcessAuthLinkSeedPort,
    createInProcessAccessSeedPort,
    createInProcessProfilePicturesSeedPort,
    logDevSeedResults,
    runDevAccessSeedWithPort,
    runDevAuthLinkWithPort,
    seedDevDemoStaffProfilePictures,
  } = await import("@edaya/seeding");
  const {
    runHttpVerifyDemoStaffGrants,
    waitForApi,
  } = await import("@edaya/seeding/http");
  const { localDevFileStorageHasObjects } = await import("@/runtime/shared/adapters/local-dev-file-storage");
  const { resolveRepoLocalDataPath } = await import("@/runtime/shared/env/repo-root");

  const context = resolveDevSeedContext();
  const runtime = await getApiRuntime(env);
  const application = await runtime.getSchoolApplication();
  const auth = createHandlerAuthProvisioner(runtime.getAuth(), env.BETTER_AUTH_URL);
  const authLinkPort = createInProcessAuthLinkSeedPort(application);
  const accessPort = createInProcessAccessSeedPort(application);

  const authLink = await runDevAuthLinkWithPort(authLinkPort, auth);
  const access = await runDevAccessSeedWithPort(accessPort, {
    auth,
    authLinkPort,
  });

  let profilePhotos: number | null = null;
  const filesDir = resolveRepoLocalDataPath(".data/files");
  const hasPersistedFiles = await localDevFileStorageHasObjects(filesDir);
  if (!hasPersistedFiles) {
    try {
      const profilePicturesPort = createInProcessProfilePicturesSeedPort({
        application,
        apiBaseUrl: env.BETTER_AUTH_URL,
      });
      profilePhotos = await seedDevDemoStaffProfilePictures(profilePicturesPort, context);
    }
    catch (error) {
      // eslint-disable-next-line no-console
      console.warn("SEED_ON_START: demo staff profile photo repair failed:", error);
    }
  }

  logDevSeedResults({
    school: null,
    authProvision: null,
    authLink,
    access,
    profilePhotos,
  });

  await waitForApi(env.BETTER_AUTH_URL);
  const verification = await runHttpVerifyDemoStaffGrants(
    env.BETTER_AUTH_URL,
    resolveLocalSeedAppOrigin(env),
  );
  if (verification.status === "failed") {
    throw new Error(
      `Dev demo staff sign-in check failed for: ${verification.failures.join(", ")}. ${WIPE_AND_RESEED_HINT}`,
    );
  }

  // eslint-disable-next-line no-console
  console.log("SEED_ON_START: all demo staff accounts verified (sign-in + effective-grants).");
}

/** Seeds repo-root `.data/` through the local API (same flow as `bun seed:init`). */
export async function maybeRunLocalStartupSeed(env: Environment): Promise<void> {
  if (!resolveSeedOnStart(env)) {
    return;
  }

  if (await isLocalDataAlreadySeeded(env)) {
    // eslint-disable-next-line no-console
    console.log("SEED_ON_START: local .data already seeded, repairing dev auth/access/photos…");
    await runInProcessStartupRepair(env);
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
