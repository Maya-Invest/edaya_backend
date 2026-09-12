import indexRouter from "@/app-router";
import type { AppBindings } from "@/http/bindings";
import { createDependenciesInjection } from "@/http/dependencies";
import { createSessionActorDependency } from "@/http/dependencies/session-actor";
import type { DependencyModule } from "@/http/dependency-injection";
import type { ApiSchoolApplication } from "@/lib/school-api/application";
import { buildInMemoryApiRuntime } from "@/runtime/in-memory/build-runtime";
import { buildLocalApiRuntime } from "@/runtime/local/build-runtime";
import { resetApiRuntimesForTests } from "@/runtime/local/registry";
import type { Environment } from "@/runtime/shared/env/schema";
import type { ApiRuntime } from "@/runtime/types";
import { ActorAssuranceLevel, ASSIGNMENT_SCOPED_PERMISSIONS, createServiceAccount, createStaffActorMetadata } from "@edaya/authorization";
import type { ServiceAccountPermissionAssignmentInput } from "@edaya/authorization";
import { Permission, StaffPermissionAssignment } from "@edaya/core";
import { resolveDevSeedContext } from "@edaya/fixtures/meta/resolve-dev-seed-context";
import { DEMO_CENTRAL_ACADEMIC_YEAR_ID, SEED_SCHOOL_ID } from "@edaya/fixtures/shared/ids";
import {
  type AuthProvisioner,
  createInProcessAuthLinkSeedPort,
  runDevAccessSeed,
  runDevAuthLinkWithPort,
  runIntegrationLightSchoolSeed,
} from "@edaya/seeding";
import {
  createTestIdentityKeys,
  signTestIdentityToken,
  type TestIdentityKeys,
} from "@maya-invest/edaya-identity-client/testing";
import {
  createDirectoryClient,
  IDENTITY_DIRECTORY_BY_CONTACT_PATH,
  IDENTITY_DIRECTORY_BY_ID_PREFIX,
  type IdentityClient,
  verifyIdentityToken,
} from "@maya-invest/edaya-identity-client";
import { Hono } from "hono";
import { onTestFinished, setDefaultTimeout } from "bun:test";
import { createPgliteTestEnv, pgliteEnv } from "./pglite-env";
import {
  createLocalProfileTestEnv,
  type EmbeddedLocalFilesServer,
  startEmbeddedLocalFilesServer,
  syncProcessEnvLocalFilesUrl,
} from "./embedded-local-files";

// eslint-disable-next-line node/no-process-env -- route tests pin the demo fixture dataset
process.env.SEED_DATASET = process.env.SEED_DATASET ?? "demo";
setDefaultTimeout(120_000);
const identityAccounts = new Map<string, { subjectId: string; name?: string }>();
const activeTestRuntimes = new Set<ApiRuntime>();
let testIdentityKeysPromise: Promise<TestIdentityKeys> | undefined;

function loadTestIdentityKeys(): Promise<TestIdentityKeys> {
  testIdentityKeysPromise ??= createTestIdentityKeys();
  return testIdentityKeysPromise;
}

export { createPgliteTestEnv, pgliteEnv } from "./pglite-env";
export { createSessionActorDependency };
export const apiPgliteEnv = pgliteEnv;
export const createApiPgliteTestEnv = createPgliteTestEnv;
export const TEST_ACADEMIC_YEAR_ID = DEMO_CENTRAL_ACADEMIC_YEAR_ID;

export interface AuthenticatedRouteContext {
  app: Hono<AppBindings>;
  runtime: ApiRuntime;
  application: ApiSchoolApplication;
  env: Environment;
  localFiles?: EmbeddedLocalFilesServer;
}

export interface CoreRouteTestAppOptions {
  sessionActor?: ReturnType<typeof createSessionActorDependency>;
  autoCleanup?: boolean;
  withEmbeddedLocalFiles?: boolean;
  /** `live` verifies JWTs and directory against IDENTITY_ISSUER (needs edaya_identity running). */
  identity?: "test" | "live";
  env?: Record<string, unknown>;
}

function subjectForEmail(email: string): string {
  return identityAccounts.get(email)?.subjectId ?? `identity:${email.toLowerCase()}`;
}

function findIdentityAccountByEmail(email: string) {
  const needle = email.toLowerCase();
  for (const [storedEmail, account] of identityAccounts) {
    if (storedEmail.toLowerCase() === needle) {
      return { email: storedEmail, ...account };
    }
  }
  return undefined;
}

function testDirectoryFetch(input: RequestInfo | URL): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.pathname === IDENTITY_DIRECTORY_BY_CONTACT_PATH) {
    const channel = url.searchParams.get("channel");
    const value = url.searchParams.get("value") ?? "";
    if (channel === "phone") {
      return Promise.resolve(Response.json({ exists: false }));
    }
    const account = findIdentityAccountByEmail(value);
    if (!account) {
      return Promise.resolve(Response.json({ exists: false }));
    }
    return Promise.resolve(Response.json({ exists: true, id: account.subjectId }));
  }
  if (url.pathname.startsWith(IDENTITY_DIRECTORY_BY_ID_PREFIX)) {
    const subjectId = decodeURIComponent(url.pathname.slice(IDENTITY_DIRECTORY_BY_ID_PREFIX.length));
    for (const [email, account] of identityAccounts) {
      if (account.subjectId === subjectId) {
        return Promise.resolve(Response.json({ email }));
      }
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  }
  return Promise.resolve(new Response(null, { status: 404 }));
}

export const testIdentityProvisioner: AuthProvisioner = {
  async ensureUser(account) {
    const subjectId = subjectForEmail(account.email);
    identityAccounts.set(account.email, { subjectId, name: account.name });
    return { subjectId };
  },
  async lookupSubjectIdByEmail(email) {
    return identityAccounts.get(email)?.subjectId;
  },
};

const testIdentityClient: IdentityClient = {
  directory: createDirectoryClient({
    baseUrl: pgliteEnv.IDENTITY_DIRECTORY_URL,
    secret: pgliteEnv.IDENTITY_DIRECTORY_SECRET,
    fetch: testDirectoryFetch as unknown as typeof fetch,
  }),
  async verifyAccessToken(token) {
    const keys = await loadTestIdentityKeys();
    return verifyIdentityToken(token, {
      issuer: pgliteEnv.IDENTITY_ISSUER,
      audience: pgliteEnv.API_ORIGIN,
      jwks: keys.jwks,
    });
  },
};

function registerTestRuntimeCleanup(runtime: ApiRuntime): void {
  activeTestRuntimes.add(runtime);
  onTestFinished(async () => {
    activeTestRuntimes.delete(runtime);
    await runtime.close().catch(() => undefined);
  });
}

export async function resetCoreRouteTestHarness(): Promise<void> {
  await Promise.all([...activeTestRuntimes].map(runtime => runtime.close().catch(() => undefined)));
  activeTestRuntimes.clear();
  identityAccounts.clear();
  await resetApiRuntimesForTests();
}

function createTestIdentityDependency(): DependencyModule<AppBindings> {
  return {
    name: "identityClient",
    resolve(c) {
      c.set("identityClient", testIdentityClient);
    },
  };
}

function createLiveIdentityDependency(runtime: ApiRuntime): DependencyModule<AppBindings> {
  return {
    name: "identityClient",
    resolve(c) {
      c.set("identityClient", runtime.getIdentityClient());
    },
  };
}

function createTestSchoolAppDependency(runtime: ApiRuntime): DependencyModule<AppBindings> {
  return {
    name: "schoolApp",
    async resolve(c) {
      c.set("schoolApp", await runtime.getSchoolApplication());
    },
  };
}

export function createCoreRouteTestDependencies(
  runtime: ApiRuntime,
  sessionActor = createSessionActorDependency(),
  identity: "test" | "live" = "test",
) {
  return createDependenciesInjection([
    createTestSchoolAppDependency(runtime),
    identity === "live" ? createLiveIdentityDependency(runtime) : createTestIdentityDependency(),
    sessionActor,
  ]);
}

export async function createCoreRouteTestApp(
  options: CoreRouteTestAppOptions = {},
): Promise<AuthenticatedRouteContext> {
  let embeddedLocalFiles: EmbeddedLocalFilesServer | undefined;
  let restoreLocalFilesUrl: (() => void) | undefined;
  const identity = options.identity ?? "test";
  const identityEnv = identity === "live"
    ? {
        // eslint-disable-next-line node/no-process-env -- live identity uses the host directory secret
        IDENTITY_DIRECTORY_SECRET: process.env.IDENTITY_DIRECTORY_SECRET ?? "local-directory-secret",
      }
    : {};
  const env = options.withEmbeddedLocalFiles
    ? (() => {
        embeddedLocalFiles = startEmbeddedLocalFilesServer(pgliteEnv.LOCAL_FILES_SECRET!);
        restoreLocalFilesUrl = syncProcessEnvLocalFilesUrl(embeddedLocalFiles.baseUrl);
        const originalStop = embeddedLocalFiles.stop.bind(embeddedLocalFiles);
        embeddedLocalFiles.stop = () => {
          originalStop();
          restoreLocalFilesUrl?.();
        };
        return createLocalProfileTestEnv(embeddedLocalFiles, { ...identityEnv, ...options.env });
      })()
    : createPgliteTestEnv({ DATABASE_URL: "pglite", ...identityEnv, ...options.env });

  if (embeddedLocalFiles && options.autoCleanup !== false) {
    onTestFinished(() => embeddedLocalFiles?.stop());
  }

  const identityClientExtras = identity === "live" ? {} : { identityClient: testIdentityClient };
  const runtime = env.RUNTIME === "local"
    ? await buildLocalApiRuntime(env, identityClientExtras)
    : await buildInMemoryApiRuntime(env, identityClientExtras);
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
    identity,
  ));
  app.route("/", indexRouter);
  return { app, runtime, application, env, ...(embeddedLocalFiles ? { localFiles: embeddedLocalFiles } : {}) };
}

export async function seedDevSchoolAndAuthLinks(application: ApiSchoolApplication, _runtime: ApiRuntime) {
  await runIntegrationLightSchoolSeed(application);
  await runDevAuthLinkWithPort(createInProcessAuthLinkSeedPort(application), testIdentityProvisioner, {
    linkGuardians: false,
  });
  const context = resolveDevSeedContext();
  await runDevAccessSeed(application, {
    auth: testIdentityProvisioner,
    ownerSubjectId: subjectForEmail(context.minimalStaffEmail),
    authLinkPort: createInProcessAuthLinkSeedPort(application),
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
  if (!staff?.subjectId)
    throw new Error(`Staff member ${creatorStaffId} is not linked to an identity subject`);
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

export async function signInDirectorWithBearer(
  app: Hono<AppBindings>,
  email: string = resolveDevSeedContext().minimalStaffEmail,
): Promise<string> {
  return signInWithBearerThroughApp(app, { email });
}

export function createAppRequest(path: string, init?: RequestInit): Request {
  return new Request(`${pgliteEnv.API_ORIGIN}${path}`, init);
}

export function collectSetCookieHeaders(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  return typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : response.headers.get("set-cookie") ? [response.headers.get("set-cookie")!] : [];
}

export async function signInWithBearerThroughApp(
  _app: Hono<AppBindings>,
  input: { email: string; password?: string },
): Promise<string> {
  const keys = await loadTestIdentityKeys();
  return signTestIdentityToken(keys, {
    sub: subjectForEmail(input.email),
    email: input.email,
    email_verified: true,
    iss: pgliteEnv.IDENTITY_ISSUER,
    aud: pgliteEnv.API_ORIGIN,
  });
}

export async function signUpAuthUser(
  _runtime: ApiRuntime,
  input: { email: string; password?: string; name: string },
): Promise<string> {
  const subjectId = subjectForEmail(input.email);
  identityAccounts.set(input.email, { subjectId, name: input.name });
  return subjectId;
}

export function wrapAuthWithVerifiedAssurance(identityClient: IdentityClient): IdentityClient {
  return identityClient;
}

export function withAcademicYearHeaders(headers: Record<string, string> = {}): Record<string, string> {
  return { ...headers, "x-academic-year-id": TEST_ACADEMIC_YEAR_ID };
}

export function buildSchoolWidePermissionAssignments(
  permissions: readonly Permission[],
  academicYearId = TEST_ACADEMIC_YEAR_ID,
): ServiceAccountPermissionAssignmentInput[] {
  return permissions.map(permission => ({ permission, scopeIds: "", academicYearId }));
}

export async function grantServiceAccountCreate(
  application: ApiSchoolApplication,
  staffId: string,
  permissions: readonly Permission[] = [Permission.SERVICE_ACCOUNT_CREATE],
  scopeIds = "",
) {
  await grantStaffPermissionAssignments(application, staffId, permissions, scopeIds);
}

export async function grantAccessControlAssign(application: ApiSchoolApplication, staffId: string) {
  await grantStaffPermissionAssignments(application, staffId, [Permission.ACCESS_CONTROL_ASSIGN]);
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

export { resetApiRuntimesForTests };
