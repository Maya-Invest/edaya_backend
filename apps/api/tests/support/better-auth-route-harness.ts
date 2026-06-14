import indexRouter from "@/app-router";
import { dependenciesInjection } from "@/lib/http/dependencies";
import type { AppBindings } from "@/lib/http/types";
import type { ApiSchoolApplication } from "@/lib/school-api/application";
import { getApiRuntime, resetApiRuntimesForTests } from "@/lib/runtime/registry";
import type { ApiRuntime } from "@/lib/runtime/types";
import { DEV_AUTH_PASSWORD, SEED_SCHOOL_ID } from "@edaya/dev-fixtures";
import {
  AccessRole,
  Permission,
  StaffRoleAssignment,
} from "@edaya/core";
import { Hono } from "hono";
import { pgliteEnv } from "./pglite-env";

export { createPgliteTestEnv, pgliteEnv } from "./pglite-env";

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

export async function createCoreRouteTestApp(): Promise<AuthenticatedRouteContext> {
  await resetApiRuntimesForTests();
  const runtime = await getApiRuntime(pgliteEnv);
  const application = await runtime.getSchoolApplication();

  const app = new Hono<AppBindings>();
  app.use(async (c, next) => {
    c.env = pgliteEnv;
    await next();
  });
  app.use(dependenciesInjection);
  app.route("/", indexRouter);

  return { app, runtime, application };
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
