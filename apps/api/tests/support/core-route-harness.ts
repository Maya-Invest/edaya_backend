import indexRouter from "@/app-router";
import type { AppBindings } from "@/http/bindings";
import { createDependenciesInjection } from "@/http/dependencies";
import { isBetterAuthPath } from "@/http/dependencies/utils";
import type { DependencyModule } from "@/http/dependency-injection";
import {

  createSessionActorDependency,
} from "@/http/dependencies/session-actor";
import type { AuthSessionProvider } from "@/http/dependencies/session-actor";
import type { Environment } from "@/runtime/shared/env/schema";
import { buildInMemoryApiRuntime } from "@/runtime/in-memory/build-runtime";
import { buildLocalApiRuntime } from "@/runtime/local/build-runtime";
import type { ApiSchoolApplication } from "@/lib/school-api/application";
import type { ApiRuntime } from "@/runtime/types";
import { resetApiRuntimesForTests } from "@/runtime/local/registry";
import {
  createHandlerAuthProvisioner,
  createInProcessAuthLinkSeedPort,
  runDevAccessSeed,
  runDevAuthLinkWithPort,
  runIntegrationLightSchoolSeed,
} from "@edaya/seeding";
import { DEV_AUTH_PASSWORD } from "@edaya/fixtures/demo-login";
import { resolveDevSeedContext } from "@edaya/fixtures/meta/resolve-dev-seed-context";
import { DEMO_CENTRAL_ACADEMIC_YEAR_ID, SEED_SCHOOL_ID } from "@edaya/fixtures/shared/ids";
import {
  ActorAssuranceLevel,
  ASSIGNMENT_SCOPED_PERMISSIONS,
  createServiceAccount,
  createStaffActorMetadata,
  Permission,

  StaffPermissionAssignment,
} from "@edaya/core";
import type { ServiceAccountPermissionAssignmentInput } from "@edaya/core";
import { Hono } from "hono";
import { onTestFinished, setDefaultTimeout } from "bun:test";
import { createPgliteTestEnv, pgliteEnv } from "./pglite-env";
import {
  createLocalProfileTestEnv,

  startEmbeddedLocalFilesServer,
  syncProcessEnvLocalFilesUrl,
} from "./embedded-local-files";
import type { EmbeddedLocalFilesServer } from "./embedded-local-files";

const ROUTE_INTEGRATION_TEST_TIMEOUT_MS = 120_000;
setDefaultTimeout(ROUTE_INTEGRATION_TEST_TIMEOUT_MS);

// Route integration tests seed `demoDataset` (sch-edaya-central / st*), not the dev default.
// eslint-disable-next-line node/no-process-env -- test harness pins dataset for route integration tests
process.env.SEED_DATASET = process.env.SEED_DATASET ?? "demo";

export { createPgliteTestEnv, pgliteEnv } from "./pglite-env";
export { createSessionActorDependency } from "@/http/dependencies/session-actor";

/** Backward-compatible aliases used by integration-tests. */
export const apiPgliteEnv = pgliteEnv;
export const createApiPgliteTestEnv = createPgliteTestEnv;

export function collectSetCookieHeaders(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

export interface AuthenticatedRouteContext {
  app: Hono<AppBindings>;
  runtime: ApiRuntime;
  application: ApiSchoolApplication;
  env: Environment;
  /** Present when `withEmbeddedLocalFiles` is true; stop via `stop()` when using `autoCleanup: false`. */
  localFiles?: EmbeddedLocalFilesServer;
}

const activeTestRuntimes = new Set<ApiRuntime>();

function createIsolatedPgliteTestEnv(): Environment {
  return createPgliteTestEnv({
    DATABASE_URL: "pglite",
  });
}

function registerTestRuntimeCleanup(runtime: ApiRuntime): void {
  activeTestRuntimes.add(runtime);

  onTestFinished(async () => {
    activeTestRuntimes.delete(runtime);

    try {
      await runtime.close();
    }
    catch {
      // Ignore teardown errors in tests.
    }
  });
}

/** Clears any runtimes still tracked by the harness (e.g. aborted tests). */
export async function resetCoreRouteTestHarness(): Promise<void> {
  await Promise.all(
    [...activeTestRuntimes].map(async (runtime) => {
      try {
        await runtime.close();
      }
      catch {
        // Ignore teardown errors in tests.
      }
    }),
  );
  activeTestRuntimes.clear();

  await resetApiRuntimesForTests();
}

export interface CoreRouteTestAppOptions {
  sessionActor?: ReturnType<typeof createSessionActorDependency>;
  /** When false, caller must close the runtime (e.g. shared beforeAll fixtures). */
  autoCleanup?: boolean;
  /**
   * Use RUNTIME=local with an embedded local-files server (for HTTP upload integration tests).
   * Default: in-memory runtime.
   */
  withEmbeddedLocalFiles?: boolean;
}

export function wrapAuthWithVerifiedAssurance(auth: AuthSessionProvider): AuthSessionProvider {
  const original = auth.api.getSession.bind(auth.api);
  return {
    api: {
      getSession: async (args) => {
        const session = await original(args);
        if (!session?.session) {
          return session;
        }

        return {
          ...session,
          session: {
            ...session.session,
            assuranceLevel: ActorAssuranceLevel.Verified,
          },
        };
      },
    },
  };
}

function createTestAuthDependency(runtime: ApiRuntime): DependencyModule<AppBindings> {
  return {
    name: "auth",
    async resolve(c) {
      if (isBetterAuthPath(c)) {
        c.set("auth", runtime.getAuth());
        return;
      }

      c.set("auth", runtime.getAuth());
    },
  };
}

function createTestSchoolAppDependency(runtime: ApiRuntime): DependencyModule<AppBindings> {
  return {
    name: "schoolApp",
    async resolve(c) {
      if (isBetterAuthPath(c)) {
        return;
      }

      c.set("schoolApp", await runtime.getSchoolApplication());
    },
  };
}

export function createCoreRouteTestDependencies(
  runtime: ApiRuntime,
  sessionActor = createSessionActorDependency(),
) {
  return createDependenciesInjection([
    createTestSchoolAppDependency(runtime),
    createTestAuthDependency(runtime),
    sessionActor,
  ]);
}

export async function createCoreRouteTestApp(
  options: CoreRouteTestAppOptions = {},
): Promise<AuthenticatedRouteContext> {
  let embeddedLocalFiles: ReturnType<typeof startEmbeddedLocalFilesServer> | undefined;
  let restoreLocalFilesUrl: (() => void) | undefined;
  const env = options.withEmbeddedLocalFiles
    ? (() => {
        embeddedLocalFiles = startEmbeddedLocalFilesServer(pgliteEnv.BETTER_AUTH_SECRET);
        restoreLocalFilesUrl = syncProcessEnvLocalFilesUrl(embeddedLocalFiles.baseUrl);
        const originalStop = embeddedLocalFiles.stop.bind(embeddedLocalFiles);
        embeddedLocalFiles.stop = () => {
          originalStop();
          restoreLocalFilesUrl?.();
          restoreLocalFilesUrl = undefined;
        };
        return createLocalProfileTestEnv(embeddedLocalFiles);
      })()
    : createIsolatedPgliteTestEnv();

  if (embeddedLocalFiles && options.autoCleanup !== false) {
    onTestFinished(async () => {
      embeddedLocalFiles?.stop();
    });
  }

  const runtime = env.RUNTIME === "local"
    ? await buildLocalApiRuntime(env)
    : await buildInMemoryApiRuntime(env);
  if (options.autoCleanup !== false) {
    registerTestRuntimeCleanup(runtime);
  }
  const application = await runtime.getSchoolApplication();

  const app = new Hono<AppBindings>();
  app.use(async (c, next) => {
    c.env = env;
    await next();
  });
  app.use(createCoreRouteTestDependencies(
    runtime,
    options.sessionActor ?? createSessionActorDependency(),
  ));
  app.route("/", indexRouter);

  return { app, runtime, application, env, localFiles: embeddedLocalFiles };
}

export async function seedDevSchoolAndAuthLinks(application: ApiSchoolApplication, runtime: ApiRuntime) {
  const auth = createHandlerAuthProvisioner(runtime.getAuth(), pgliteEnv.BETTER_AUTH_URL);
  await runIntegrationLightSchoolSeed(application);
  await runDevAuthLinkWithPort(createInProcessAuthLinkSeedPort(application), auth, {
    linkGuardians: false,
  });
  await runDevAccessSeed(application, {
    includeClassSubjectStaffAssignments: false,
  });
}

export async function provisionServiceAccountForTests(
  application: ApiSchoolApplication,
  input: {
    serviceId: string;
    displayName: string;
    permissionAssignments?: readonly ServiceAccountPermissionAssignmentInput[];
    elevated?: boolean;
    creatorStaffId?: string;
    apiKey?: string;
  },
) {
  const context = resolveDevSeedContext();
  const creatorStaffId = input.creatorStaffId ?? context.minimalStaffId;
  const staff = await application.repositories.staffMembers.findById(creatorStaffId);
  if (!staff?.subjectId) {
    throw new Error(`Staff member ${creatorStaffId} is not linked to an auth subject`);
  }

  const grants = await application.repositories.authorization.resolveEffectiveGrants({
    staffMemberId: creatorStaffId,
    schoolId: SEED_SCHOOL_ID,
    academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID,
  });

  const actor = createStaffActorMetadata({
    subjectId: staff.subjectId,
    staffMemberId: creatorStaffId,
    schoolId: SEED_SCHOOL_ID,
    requestId: "service-account-test",
    authenticatedAt: new Date(),
    assuranceLevel: ActorAssuranceLevel.Verified,
    effectiveGrants: grants,
  });

  return createServiceAccount(application.repositories, actor, input);
}

export async function signInDirector(
  app: Hono<AppBindings>,
  email: string = resolveDevSeedContext().minimalStaffEmail,
): Promise<string[]> {
  return signInThroughApp(app, { email });
}

export async function grantAccessControlAssign(application: ApiSchoolApplication, staffId: string) {
  await grantStaffPermissionAssignments(application, staffId, [Permission.ACCESS_CONTROL_ASSIGN]);
}

export async function grantServiceAccountCreate(
  application: ApiSchoolApplication,
  staffId: string,
  permissions: readonly Permission[] = [Permission.SERVICE_ACCOUNT_CREATE],
  scopeIds = "",
) {
  await grantStaffPermissionAssignments(application, staffId, permissions, scopeIds);
}

export function createAppRequest(path: string, init?: RequestInit): Request {
  return new Request(`${pgliteEnv.BETTER_AUTH_URL}${path}`, init);
}

export async function signInThroughApp(
  app: Hono<AppBindings>,
  input: { email: string; password?: string },
): Promise<string[]> {
  const response = await app.request(createAppRequest("/auth/sign-in/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      password: input.password ?? DEV_AUTH_PASSWORD,
    }),
  }));

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Sign-in failed for ${input.email}: ${response.status} ${message}`);
  }

  return collectSetCookieHeaders(response);
}

export async function signUpAuthUser(
  runtime: ApiRuntime,
  input: { email: string; password?: string; name: string },
): Promise<string> {
  const response = await runtime.getAuth().handler(new Request(`${pgliteEnv.BETTER_AUTH_URL}/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      password: input.password ?? DEV_AUTH_PASSWORD,
      name: input.name,
    }),
  }));

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Sign-up failed for ${input.email}: ${response.status} ${message}`);
  }

  const body = await response.json() as { user?: { id?: string } };
  if (!body.user?.id) {
    throw new Error(`Sign-up for ${input.email} did not return a user id`);
  }

  return body.user.id;
}

export { resetApiRuntimesForTests };

export const TEST_ACADEMIC_YEAR_ID = DEMO_CENTRAL_ACADEMIC_YEAR_ID;

export function withAcademicYearHeaders(headers: Record<string, string> = {}): Record<string, string> {
  return {
    ...headers,
    "x-academic-year-id": TEST_ACADEMIC_YEAR_ID,
  };
}

export function buildSchoolWidePermissionAssignments(
  permissions: readonly Permission[],
  academicYearId = TEST_ACADEMIC_YEAR_ID,
): ServiceAccountPermissionAssignmentInput[] {
  return permissions.map(permission => ({
    permission,
    scopeIds: "",
    academicYearId,
  }));
}

async function grantStaffPermissionAssignments(
  application: ApiSchoolApplication,
  staffId: string,
  permissions: readonly Permission[],
  scopeIds = "",
  academicYearId = TEST_ACADEMIC_YEAR_ID,
): Promise<void> {
  for (const [index, permission] of permissions.entries()) {
    const assignmentScoped = ASSIGNMENT_SCOPED_PERMISSIONS.includes(permission);
    await application.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({
      id: `spa-grant-${staffId}-${permission}-${index}`,
      staffId,
      schoolId: SEED_SCHOOL_ID,
      academicYearId,
      permission,
      scopeIds: assignmentScoped ? scopeIds : "",
      status: "active",
    }));
  }
}
