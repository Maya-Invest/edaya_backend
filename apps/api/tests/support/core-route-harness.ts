import indexRouter from "@/app-router";
import type { AppBindings } from "@/context/bindings";
import { authDependency } from "@/http/dependencies/auth";
import { envDependency } from "@/http/dependencies/env";
import { createDependenciesInjection } from "@/http/dependencies";
import { createSchoolAppDependency } from "@/http/dependencies/school-app";
import {
  type AuthSessionProvider,
  createSessionActorDependency,
} from "@/http/dependencies/session-actor";
import type { ApiSchoolApplication } from "@/lib/school-api/application";
import { type ApiRuntime, getApiRuntime, resetApiRuntimesForTests } from "@/runtime";
import { createHandlerAuthProvisioner, runDevAccessSeed, runDevAuthLink, runDevSchoolSeed } from "@edaya/seeding";
import {
  DEV_AUTH_PASSWORD,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  MINIMAL_AUTH_FIXTURE_STAFF_ID,
  SEED_SCHOOL_ID,
} from "@edaya/dev-fixtures";
import {
  AccessRole,
  ActorAssuranceLevel,
  createServiceAccount,
  createStaffActorMetadata,
  Permission,
  StaffRoleAssignment,
} from "@edaya/core";
import { Hono } from "hono";
import { createPgliteTestEnv, pgliteEnv } from "./pglite-env";

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
}

export interface CoreRouteTestAppOptions {
  sessionActor?: ReturnType<typeof createSessionActorDependency>;
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

export function createCoreRouteTestDependencies(
  sessionActor = createSessionActorDependency(),
) {
  return createDependenciesInjection([
    envDependency,
    createSchoolAppDependency(),
    authDependency,
    sessionActor,
  ]);
}

export async function createCoreRouteTestApp(
  options: CoreRouteTestAppOptions = {},
): Promise<AuthenticatedRouteContext> {
  await resetApiRuntimesForTests();
  const runtime = await getApiRuntime(pgliteEnv);
  const application = await runtime.getSchoolApplication();

  const app = new Hono<AppBindings>();
  app.use(async (c, next) => {
    c.env = pgliteEnv;
    await next();
  });
  app.use(createCoreRouteTestDependencies(
    options.sessionActor ?? createSessionActorDependency(),
  ));
  app.route("/", indexRouter);

  return { app, runtime, application };
}

/** @deprecated Use createCoreRouteTestDependencies() when customizing middleware. */
export const dependenciesInjection = createCoreRouteTestDependencies();

export async function seedDevSchoolAndAuthLinks(application: ApiSchoolApplication, runtime: ApiRuntime) {
  const auth = createHandlerAuthProvisioner(runtime.getAuth(), pgliteEnv.BETTER_AUTH_URL);
  await runDevSchoolSeed(application);
  await runDevAuthLink(application, auth);
  await runDevAccessSeed(application);
}

export async function provisionServiceAccountForTests(
  application: ApiSchoolApplication,
  input: {
    serviceId: string;
    displayName: string;
    roleIds: readonly string[];
    elevated?: boolean;
    creatorStaffId?: string;
  },
) {
  const creatorStaffId = input.creatorStaffId ?? MINIMAL_AUTH_FIXTURE_STAFF_ID;
  const staff = await application.repositories.staffMembers.findById(creatorStaffId);
  if (!staff?.subjectId) {
    throw new Error(`Staff member ${creatorStaffId} is not linked to an auth subject`);
  }

  const grants = await application.repositories.authorization.resolveEffectiveGrants({
    staffMemberId: creatorStaffId,
    schoolId: SEED_SCHOOL_ID,
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
  email: string = MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
): Promise<string[]> {
  return signInThroughApp(app, { email });
}

export async function grantAccessControlAssign(application: ApiSchoolApplication, staffId: string) {
  await application.repositories.accessRoles.save(new AccessRole({
    id: `role-access-control-${staffId}`,
    schoolId: SEED_SCHOOL_ID,
    name: "Access control admin",
    permissions: [Permission.ACCESS_CONTROL_ASSIGN],
  }));

  await application.repositories.staffRoleAssignments.save(new StaffRoleAssignment({
    id: `assignment-access-control-${staffId}`,
    staffId,
    schoolId: SEED_SCHOOL_ID,
    roleIds: [`role-access-control-${staffId}`],
    scopeGrants: [],
    status: "active",
  }));
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
