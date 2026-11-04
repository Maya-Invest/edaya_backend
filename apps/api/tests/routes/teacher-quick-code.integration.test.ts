import { createAccountRepository, totpCode } from "@edaya/adaptor-account";
import { ActorAssuranceLevel, createStaffActorMetadata } from "@edaya/authorization";
import { Permission, StaffPermissionAssignment } from "@edaya/core";
import { afterAll, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { createRouter } from "@/http/create-app";
import { createSessionActorDependency } from "@/http/dependencies/session-actor";
import { parseEnv } from "@/identity/env";
import { createIdentityRuntime } from "@/identity/runtime";
import { verifyIdentityToken } from "@/identity/server";
import quickCodes, { mountLocalTeacherReveal } from "@/routes/teacher-quick-code.routes";
import { parseEnv as schoolEnv } from "@/runtime";
import { useNativePolicyApps } from "../support/native-policy-app";

const fixture = useNativePolicyApps();
const origin = "http://localhost:9999";
const identities: Awaited<ReturnType<typeof createIdentityRuntime>>[] = [];
afterAll(async () => {
  for (const identity of identities) await identity.close();
});

test("staff issuance, restricted teacher sign-in and local reveal use the same active credential", async () => {
  const { school, repositories, db } = await fixture();
  await db.exec("INSERT INTO teachers (id, school_id, first_name, last_name, subject_id, is_active, created_at) VALUES ('teacher-a','school-a','A','Teacher','person-a',true,now())");
  const actor = createStaffActorMetadata({ schoolId: "school-a", staffMemberId: "staff-a", subjectId: "person-a", academicYearId: "year-a", requestId: "test", authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Strong });
  const env = schoolEnv({ RUNTIME: "local", NODE_ENV: "development", LOG_LEVEL: "silent", DATABASE_URL: "pglite:memory" });
  let deliveredSms = "";
  const identity = await createIdentityRuntime(parseEnv({ BETTER_AUTH_URL: origin, FIRST_PARTY_API_ORIGINS: origin, AUTH_TERMS_MODE: "off", AUTH_DATABASE_URL: "pglite:memory", BETTER_AUTH_SECRET: "disposable-test-secret-0123456789012", NODE_ENV: "test" }, "test"), { smsRouter: { routes: [], supports: phone => phone.startsWith("+225"), send: async (message) => {
    deliveredSms = message.body;
    return { status: "accepted", providerId: "africas_talking", messageId: "test" };
  } }, teacherEligible: async (target, accountId) => {
    const teacher = await repositories.teachers.findById(target.teacherId);
    return !!teacher?.isActive && teacher.subjectId === accountId && teacher.schoolId === target.schoolId;
  } });
  identities.push(identity);
  const { repository, db: accountDb } = createAccountRepository(identity.db);
  await repository.save({ id: "person-a", status: "active", name: "Teacher", securityVersion: 0, createdAt: 1, identifiers: [{ id: "mail", kind: "email", value: "teacher@example.com", verifiedAt: 1, recoveryEligible: true }, { id: "phone", kind: "phone", value: "+2250700001234", verifiedAt: 1, recoveryEligible: true }] });
  const build = (capture: boolean) => {
    const app = createRouter();
    const runtime = { env, getIdentityRuntime: async () => identity, getIdentityClient: () => ({ directory: { lookupByContact: async () => undefined, resolveBySubjectId: async () => undefined }, verifyAccessToken: (token: string) => verifyIdentityToken(token, { issuer: origin, audience: origin, jwks: identity.keys.jwks }) }), getSchoolApplication: async () => school, close: async () => {} };
    app.use(async (c, next) => {
      c.set("apiRuntime", runtime);
      c.set("schoolApp", school);
      c.set("actor", actor);
      if (c.req.header("Authorization"))
        await createSessionActorDependency(() => runtime.getIdentityClient()).resolve(c);
      await next();
    });
    app.route("/", quickCodes);
    if (capture)
      mountLocalTeacherReveal(app, env);
    app.get("/actor", c => c.json(c.var.actor?.kind));
    return app;
  };
  const app = build(true);
  const path = "/core/teachers/teacher-a/quick-login-code";
  const dev = "/core/dev/teachers/teacher-a/quick-login-code/reveal";
  const post = (body: unknown = {}) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const reveal = async () => {
    const res = await app.request(dev, post(), env);
    expect(res.headers.get("cache-control")).toBe("no-store");
    return (await res.json() as { code: string }).code;
  };
  const issue = (id = crypto.randomUUID(), identifierId = "mail") => app.request(path, post({ requestId: id, expiry: "none", identifierId }), env);
  expect((await issue()).status).toBe(403);
  expect((await app.request(dev, post(), env)).status).toBe(403);
  await repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: "manage", staffId: "staff-a", schoolId: "school-a", academicYearId: "year-a", permission: Permission.ACCESS_CONTROL_MANAGE, scopes: [{ kind: "school" }] }));
  await db.exec("INSERT INTO teachers (id, school_id, first_name, last_name, subject_id, is_active, created_at) VALUES ('teacher-other','school-b','B','Teacher','other',true,now())");
  expect((await app.request("/core/dev/teachers/teacher-other/quick-login-code/reveal", post(), env)).status).toBe(404);
  const id = crypto.randomUUID();
  expect(await (await issue(id)).json() as unknown).toEqual({ status: "active" });
  const code = await reveal();
  expect(code).toMatch(/^[A-Z2-9]{8}$/);
  await issue(id);
  expect(await reveal()).toBe(code);
  expect(await (await app.request(path, {}, env)).text()).not.toContain(code);
  const stored = await accountDb.execute(sql`SELECT row_to_json(q)::text FROM identity.teacher_quick_code q`);
  expect(JSON.stringify(stored)).not.toContain(code);
  const auth = (suffix: string, body: object, token?: string) => identity.auth.handler(new Request(`${origin}/auth/edaya/${suffix}`, { ...post(body), headers: { "content-type": "application/json", "x-edaya-client": "native", ...(token ? { authorization: `Bearer ${token}` } : {}) } }));
  const signIn = (value: string) => auth("teacher-code", { code: value });
  const result = await (await signIn(code.toLowerCase())).json() as { token: string; state: string };
  expect(result.state).toBe("complete");
  expect((await signIn(code)).status).toBe(200);
  const jwt = await (await auth("access-token", { resource: origin }, result.token)).json() as { accessToken: string };
  const headers = { authorization: `Bearer ${jwt.accessToken}` };
  expect(await (await app.request("/actor", { headers }, env)).json() as unknown).toBe("teacher");
  for (const [header, value] of [["x-actor-kind", "staff"], ["x-school-id", "school-b"]] as const)
    expect((await app.request("/actor", { headers: { ...headers, [header]: value } }, env)).status).toBe(403);
  await issue(crypto.randomUUID(), "phone");
  const next = await reveal();
  expect(deliveredSms).toContain(next);
  expect(next).not.toBe(code);
  expect((await signIn(code)).status).toBe(401);
  expect((await auth("session", {}, result.token)).status).toBe(200);
  expect((await build(false).request(dev, post(), env)).status).toBe(404);
  expect((await build(true).request(dev, post(), env)).status).toBe(404);
  expect((await signIn(next)).status).toBe(200);
  const target = { teacherId: "teacher-a", schoolId: "school-a", accountId: "person-a" };
  for (const status of ["failed", "uncertain"] as const) {
    await identity.quickCodes.issue(target, { identifierId: "mail", channel: "email", hint: "***", expiry: null, requestId: crypto.randomUUID() }, async () => status);
    expect((await signIn(next)).status).toBe(200);
  }
  const sms = { identifierId: "phone", channel: "sms", hint: "***1234", expiry: null };
  let announce = () => {};
  let finish = () => {};
  const started = new Promise<void>((resolve) => {
    announce = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const slow = identity.quickCodes.issue(target, { ...sms, requestId: crypto.randomUUID() }, async () => {
    announce();
    await gate;
    return "accepted";
  });
  await started;
  let newest = "";
  expect(await identity.quickCodes.issue(target, { ...sms, requestId: crypto.randomUUID() }, async (value) => {
    newest = value;
    return "accepted";
  })).toBe("active");
  finish();
  expect(await slow).toBe("replaced");
  expect((await signIn(next)).status).toBe(401);
  const enrollment = await identity.accounts.beginEnrollment({ credential: result.token }).catch(e => e.code);
  expect(enrollment).toBe("reauthentication_required");
  const { createAccountSecurity } = await import("@edaya/adaptor-account");
  const { createHash } = await import("node:crypto");
  const keys = createAccountSecurity({ v1: createHash("sha256").update(`local-account-key:${identity.env.BETTER_AUTH_SECRET}`).digest("base64") }, "v1");
  const secret = keys.newSecret();
  await repository.saveSecurity("person-a", { secret: await keys.encrypt(secret), recoveryHashes: [] });
  const pending = await (await signIn(newest)).json() as { state: string; challenge: string };
  expect(pending.state).toBe("totp_required");
  const confirmed = await (await auth("totp/verify", { challenge: pending.challenge, code: totpCode(secret, Math.floor(Date.now() / 30000)) })).json() as { token: string };
  expect((await identity.accounts.getSession(confirmed.token)).session.teacherScope).toEqual({ teacherId: "teacher-a", schoolId: "school-a" });
  await accountDb.execute(sql`UPDATE identity.teacher_quick_code SET expires_at=1 WHERE status='active'`);
  expect((await signIn(newest)).status).toBe(401);
  let response: Response | undefined;
  for (let attempt = 0; attempt < 21; attempt++)
    response = await signIn("INVALID2");
  expect(response?.status).toBe(429);
}, 60000);
