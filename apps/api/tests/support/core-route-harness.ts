import type { PostgresTransactionalDb } from "@edaya/adaptor-postgres";
import type { ServiceAccountPermissionAssignmentInput } from "@edaya/authorization";
import type { GrantScope } from "@edaya/core";
import type { AuthProvisioner } from "@edaya/seeding";
import type { IdentityClient } from "../../src/identity/server/index";
import type { TestIdentityKeys } from "../../src/identity/server/testing";
import type { EmbeddedLocalFilesServer } from "./embedded-local-files";
import type { AppBindings } from "@/http/bindings";
import type { DependencyModule } from "@/http/dependency-injection";
import type { ApiSchoolApplication } from "@/lib/school-api/application";
import type { Environment } from "@/runtime/shared/env/schema";
import type { ApiRuntime } from "@/runtime/types";
import process from "node:process";
import { ActorAssuranceLevel, createServiceAccount, createStaffActorMetadata } from "@edaya/authorization";
import { corePermissionDefinition, Permission, permissionScope, StaffPermissionAssignment } from "@edaya/core";
import { resolveDevSeedContext } from "@edaya/fixtures/meta/resolve-dev-seed-context";
import { DEMO_CI_ACADEMIC_YEAR_ID, SEED_SCHOOL_ID } from "@edaya/fixtures/shared/ids";
import {

  createInProcessAuthLinkSeedPort,
  runDevAccessSeed,
  runDevAuthLinkWithPort,
  runIntegrationLightSchoolSeed,
} from "@edaya/seeding";
import { onTestFinished, setDefaultTimeout } from "bun:test";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import indexRouter from "@/app-router";
import { createDependenciesInjection } from "@/http/dependencies";
import { createSessionActorDependency } from "@/http/dependencies/session-actor";
import { pinoLogger } from "@/http/middleware/logger";
import { buildInMemoryApiRuntime } from "@/runtime/in-memory/build-runtime";
import { buildLocalApiRuntime } from "@/runtime/local/build-runtime";
import { resetApiRuntimesForTests } from "@/runtime/local/registry";
import { createApiRuntime } from "@/runtime/shared/create-api-runtime";
import { runStartupMigrations } from "@/runtime/shared/run-startup-migrations";
import { buildSchoolApplication } from "@/runtime/shared/school-application";
import { createPostgresSchoolDatabase } from "@/runtime/shared/school-database";
import { parseEnv as parseIdentityEnv } from "../../src/identity/env";
import { dispatchAuthentication } from "../../src/identity/http";
import { attachIdentityRuntime } from "../../src/identity/runtime";
import {

  verifyIdentityToken,
} from "../../src/identity/server/index";
import {
  createTestIdentityKeys,
  signTestIdentityToken,
} from "../../src/identity/server/testing";
import { createTestingIdentity } from "../../src/identity/testing/composition";
import {
  createLocalProfileTestEnv,

  startEmbeddedLocalFilesServer,
  syncProcessEnvLocalFilesUrl,
} from "./embedded-local-files";
import { createPgliteTestEnv, pgliteEnv } from "./pglite-env";

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
export const TEST_ACADEMIC_YEAR_ID = DEMO_CI_ACADEMIC_YEAR_ID;

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
  /** `live` composes real Account and provider fixtures in this API runtime. */
  identity?: "test" | "live";
  env?: Record<string, unknown>;
}

function subjectForEmail(email: string): string {
  return identityAccounts.get(email)?.subjectId ?? `identity:${email.toLowerCase()}`;
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
  directory: {
    async lookupByContact(channel, value) {
      const account = channel === "email" ? identityAccounts.get(value.trim().toLowerCase()) : undefined;
      return account ? { exists: true, id: account.subjectId } : { exists: false };
    },
    async resolveBySubjectId(id) {
      for (const [email, account] of identityAccounts) {
        if (account.subjectId === id)
          return { email, identifiers: [{ kind: "email", value: email }] };
      }
      return undefined;
    },
  },
  async verifyAccessToken(token) {
    const keys = await loadTestIdentityKeys();
    return verifyIdentityToken(token, {
      issuer: pgliteEnv.API_ORIGIN,
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
  const identityEnv = {};
  let nativeDatabase: { url: string; drop: () => Promise<void> } | undefined;
  // The test runner creates this loopback cluster; never read a project DATABASE_URL.
  // eslint-disable-next-line node/no-process-env -- Read only disposable native test runner configuration.
  const nativeUrl = process.env.EDAYA_NATIVE_SEED === "1" ? process.env.EDAYA_NATIVE_TEST_URL : undefined;
  if (nativeUrl) {
    if (new URL(nativeUrl).hostname !== "127.0.0.1")
      throw new Error("Native fixtures require the disposable loopback runner");
    const admin = await createPostgresSchoolDatabase(nativeUrl);
    const db = admin.db as { execute: (query: ReturnType<typeof sql>) => Promise<unknown> };
    const name = `fixture_${crypto.randomUUID().replaceAll("-", "")}`;
    await db.execute(sql`CREATE DATABASE ${sql.identifier(name)}`);
    const url = new URL(nativeUrl);
    url.pathname = `/${name}`;
    nativeDatabase = { url: url.toString(), drop: async () => {
      try {
        await db.execute(sql`DROP DATABASE ${sql.identifier(name)} WITH (FORCE)`);
      }
      finally {
        await admin.dispose();
      }
    } };
  }
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

  if (nativeDatabase) {
    env.DATABASE_URL = nativeDatabase.url;
  }
  if (embeddedLocalFiles && options.autoCleanup !== false) {
    onTestFinished(() => embeddedLocalFiles?.stop());
  }

  const authEnv = parseIdentityEnv({ ...env, RUNTIME: "test", BETTER_AUTH_URL: env.API_ORIGIN, FIRST_PARTY_API_ORIGINS: env.API_ORIGIN, BETTER_AUTH_SECRET: "disposable-seed-fixture-secret-32-characters", AUTH_DATABASE_URL: "pglite:memory" }, "test");
  const accountFixture = identity === "live" ? await createTestingIdentity(authEnv) : undefined;
  if (accountFixture)
    attachIdentityRuntime(env, accountFixture.runtime);
  const identityClientExtras = identity === "live" ? {} : { identityClient: testIdentityClient };
  const nativeHandle = nativeDatabase ? await createPostgresSchoolDatabase(nativeDatabase.url) : undefined;
  if (nativeHandle)
    await runStartupMigrations(nativeHandle.db, nativeDatabase!.url);
  const runtime = nativeHandle
    ? await createApiRuntime({
        env,
        ...identityClientExtras,
        resolveSchoolHandle: async () => nativeHandle,
        initSchoolApplication: (db, extras) => buildSchoolApplication(db as PostgresTransactionalDb, {
          databaseUrl: nativeDatabase!.url,
          env,
          identityDirectory: extras.identityClient.directory,
          notifyRuntime: extras.notifyRuntime,
          runMigrations: false,
        }),
      })
    : env.RUNTIME === "local"
      ? await buildLocalApiRuntime(env, identityClientExtras)
      : await buildInMemoryApiRuntime(env, identityClientExtras);
  if (nativeDatabase) {
    const close = runtime.close.bind(runtime);
    let closed = false;
    const { drop } = nativeDatabase;
    runtime.close = async () => {
      if (closed)
        return;
      closed = true;
      try {
        await close();
      }
      finally {
        await drop();
      }
    };
  }
  if (accountFixture) {
    const close = runtime.close.bind(runtime);
    runtime.close = async () => {
      try {
        await close();
      }
      finally {
        await accountFixture.close();
      }
    };
  }
  if (options.autoCleanup !== false) {
    registerTestRuntimeCleanup(runtime);
  }
  const application = await runtime.getSchoolApplication();
  const app = new Hono<AppBindings>();
  app.use(async (c, next) => {
    c.env = env;
    c.set("apiRuntime", runtime);
    if (accountFixture && c.req.path.startsWith("/auth/edaya/testing/"))
      return accountFixture.app.fetch(c.req.raw, authEnv);
    await next();
  });
  app.use(pinoLogger());
  app.use(dispatchAuthentication);
  app.use(createCoreRouteTestDependencies(
    runtime,
    options.sessionActor ?? createSessionActorDependency(),
    identity,
  ));
  app.route("/", indexRouter);
  return { app, runtime, application, env, ...(embeddedLocalFiles ? { localFiles: embeddedLocalFiles } : {}) };
}

export async function seedDevSchoolAndAuthLinks(
  application: ApiSchoolApplication,
  _runtime: ApiRuntime,
  options: { includeAccessSeed?: boolean } = {},
) {
  await runIntegrationLightSchoolSeed(application);
  await runDevAuthLinkWithPort(createInProcessAuthLinkSeedPort(application), testIdentityProvisioner, {
    linkGuardians: false,
  });
  // Owner-only tests and cases that install explicit grants do not need every
  // demo staff preset. Keep those cases focused on their own authority fixture.
  if (options.includeAccessSeed === false)
    return;
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
  const actor = createStaffActorMetadata({
    subjectId: staff.subjectId,
    staffMemberId: creatorStaffId,
    schoolId: SEED_SCHOOL_ID,
    requestId: "service-account-test",
    authenticatedAt: new Date(),
    assuranceLevel: ActorAssuranceLevel.Verified,
    academicYearId: DEMO_CI_ACADEMIC_YEAR_ID,
  });
  return createServiceAccount(application.repositories, actor, input, application.atomicExecution);
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
    iss: pgliteEnv.API_ORIGIN,
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
  return permissions.map((permission) => {
    const policy = corePermissionDefinition(permission).scopePolicy;
    return { permission, scopes: policy.mode === "resources" ? [{ kind: "all" as const, grain: policy.allowedKinds[0]! }] : [], academicYearId };
  });
}

export async function grantServiceAccountCreate(
  application: ApiSchoolApplication,
  staffId: string,
  permissions: readonly Permission[] = [Permission.SERVICE_ACCOUNT_MANAGE],
  scopes: GrantScope[] = [{ kind: "school" }],
) {
  await grantStaffPermissionAssignments(application, staffId, permissions, scopes);
}

export async function grantAccessControlAssign(application: ApiSchoolApplication, staffId: string) {
  await grantStaffPermissionAssignments(application, staffId, [Permission.ACCESS_CONTROL_MANAGE]);
}

async function grantStaffPermissionAssignments(
  application: ApiSchoolApplication,
  staffId: string,
  permissions: readonly Permission[],
  scopes: GrantScope[] = [{ kind: "school" }],
  academicYearId = TEST_ACADEMIC_YEAR_ID,
): Promise<void> {
  for (const [index, permission] of permissions.entries()) {
    const assignmentScoped = permissionScope(permission) !== undefined;
    await application.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({
      id: `spa-grant-${staffId}-${permission}-${index}`,
      staffId,
      schoolId: SEED_SCHOOL_ID,
      academicYearId,
      permission,
      scopes: assignmentScoped ? scopes : [{ kind: "school" }],
      status: "active",
    }));
  }
}

export { resetApiRuntimesForTests };
