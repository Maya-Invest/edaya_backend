import type { Context } from "hono";
import type { AppBindings } from "@/http/types";
import { AccessPolicies } from "@edaya/authorization";
import { createRoute, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { jsonContent } from "stoker/openapi/helpers";
import { createRouter } from "@/http/create-app";
import { createAuthEmailSenders } from "@/identity/email";
import { createAppLogger } from "@/identity/logger";
import { quickCodeExpiries } from "@/identity/quick-code-expiry";
import { clientRouteOperation } from "@/lib/school-api/openapi/client-extensions";

const path = "/core/teachers/{teacherId}/quick-login-code";
const params = z.object({ teacherId: z.string().min(1) });
const policy = z.enum(["week", "month", "period", "year", "none"]);
const input = z.object({ requestId: z.string().uuid(), identifierId: z.string(), expiry: policy }).strict().openapi("TeacherQuickCodeIssue");
const status = z.object({ contacts: z.array(z.object({ id: z.string(), channel: z.enum(["email", "sms"]), hint: z.string() })), expiries: z.record(z.number().nullable()), active: z.object({ channel: z.string(), hint: z.string(), expiry: z.number().nullable() }).nullable() }).openapi("TeacherQuickCodeOptions");
const deliveryStatus = z.object({ status: z.string() }).openapi("TeacherQuickCodeDelivery");
const router = createRouter();
type Capture = Map<string, { id: string; code: string }>;
const local = new WeakMap<object, Capture>();

async function targetContext(c: Context<AppBindings>, teacherId: string) {
  if (c.env.TEACHER_QUICK_LOGIN_ENABLED === false)
    throw new HTTPException(404);
  const actor = c.var.actor;
  if (!actor)
    throw new HTTPException(401);
  if (actor.kind !== "staff" || actor.accountKind === "service")
    throw new HTTPException(403);
  const repos = c.var.schoolApp.repositories;
  const teacher = await repos.teachers.findById(teacherId);
  if (!teacher || teacher.schoolId !== actor.schoolId)
    throw new HTTPException(404);
  try {
    await new AccessPolicies(actor, repos).identities.assertLink("teachers", teacher, teacher);
  }
  catch {
    throw new HTTPException(403);
  }
  if (!teacher.isActive || !teacher.subjectId)
    throw new HTTPException(409, { message: "An active linked teacher is required" });
  const runtime = await c.var.apiRuntime!.getIdentityRuntime!();
  const account = await runtime.accountById(teacher.subjectId);
  if (account?.status !== "active")
    throw new HTTPException(409, { message: "An active account is required" });
  c.header("Cache-Control", "no-store");
  return { repos, runtime, account, target: { accountId: account.id, teacherId, schoolId: teacher.schoolId } };
}
async function options(c: Context<AppBindings>, teacherId: string) {
  const base = await targetContext(c, teacherId);
  const { repos, runtime, target, account } = base;
  const { schoolId } = target;
  const [school, years, periods] = await Promise.all([repos.schools.findById(schoolId), repos.academicYears.list({ schoolId }), repos.academicPeriods.list({ schoolId })]);
  if (!school)
    throw new HTTPException(404);
  const sms = runtime.smsRouter;
  const mail = createAuthEmailSenders(runtime.env, createAppLogger(runtime.env));
  const contacts = account.identifiers.filter(i => i.kind === "email" ? mail.canDeliverEmail || local.has(c.env) : sms.supports(i.value)).map(i => ({
    id: i.id,
    channel: i.kind === "email" ? "email" as const : "sms" as const,
    hint: i.kind === "email" ? `${i.value[0]}***@${i.value.split("@")[1]}` : `***${i.value.slice(-4)}`,
  }));
  return { ...base, sms, mail, contacts, expiries: quickCodeExpiries(Date.now(), school.timeZone, years, periods) };
}
router.openapi(createRoute({ method: "get", path, tags: ["Teacher quick login"], ...clientRouteOperation({ namespace: "authorization", clientKey: "teacherQuickCodeOptions", path: "teachers/{teacherId}/quick-login-code", pathParams: ["teacherId"], responseSchemaName: "TeacherQuickCodeOptions" }), request: { params }, responses: { 200: jsonContent(status, "Quick login options") } }), async (c) => {
  const o = await options(c, c.req.valid("param").teacherId);
  const active = await o.runtime.quickCodes.active(o.target);
  return c.json({ contacts: o.contacts, expiries: o.expiries, active: active ? { channel: active.channel, hint: active.hint, expiry: active.expiry === null ? null : Number(active.expiry) } : null }, 200);
});
router.openapi(createRoute({ method: "post", path, tags: ["Teacher quick login"], ...clientRouteOperation({ namespace: "authorization", clientKey: "issueTeacherQuickCode", path: "teachers/{teacherId}/quick-login-code", pathParams: ["teacherId"], responseSchemaName: "TeacherQuickCodeDelivery", requestSchemaName: "TeacherQuickCodeIssue" }), request: { params, body: jsonContent(input, "Issue a teacher code") }, responses: { 200: jsonContent(deliveryStatus, "Delivery status") } }), async (c) => {
  const o = await options(c, c.req.valid("param").teacherId);
  const body = c.req.valid("json");
  const expiry = o.expiries[body.expiry];
  const contact = o.contacts.find(i => i.id === body.identifierId);
  if (!contact || expiry === undefined)
    throw new HTTPException(409, { message: "Delivery or expiry unavailable" });
  const destination = o.account.identifiers.find(i => i.id === contact.id)!.value;
  const capture = local.get(c.env);
  const result = await o.runtime.quickCodes.issue(o.target, { ...body, ...contact, expiry }, async (code) => {
    const end = expiry === null ? "sans expiration / no expiry" : new Date(expiry).toISOString();
    const message = `EDAYA · Code de connexion enseignant / Teacher sign-in code: ${code}. Expiration / Expiry: ${end}.`;
    if (contact.channel === "email") {
      if (o.mail.canDeliverEmail)
        await o.mail.sendTeacherCode(destination, message);
      else if (!capture)
        return "failed";
      return "accepted";
    }
    const result = await o.sms.send({ attemptId: body.requestId, to: destination, body: message });
    return result.status === "rejected" ? "failed" : result.status;
  }, code => capture?.set(o.target.teacherId, { id: body.requestId, code }));
  return c.json({ status: result }, 200);
});

// Only the loopback launcher invokes this registration.
export function mountLocalTeacherReveal(app: ReturnType<typeof createRouter>, env: object) {
  const capture: Capture = new Map();
  local.set(env, capture);
  app.post("/core/dev/teachers/:teacherId/quick-login-code/reveal", async (c) => {
    if (c.env !== env)
      throw new HTTPException(404);
    const { target, runtime } = await targetContext(c, c.req.param("teacherId"));
    const active = await runtime.quickCodes.active(target);
    const item = capture.get(target.teacherId);
    if (!item || active?.id !== item.id)
      throw new HTTPException(404);
    return c.json({ code: item.code });
  });
}
export default router;
