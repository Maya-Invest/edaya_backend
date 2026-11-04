import type { AppOpenAPI } from "@/http/types";
import { z } from "@hono/zod-openapi";
import { clientRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { getOpenApiSchemaName } from "@/lib/school-api/schemas/schema-name";
import * as schemas from "./contracts";

/** Documents the existing handler using the shared namespace generator. */
export function registerAuthContract(app: AppOpenAPI) {
  for (const schema of Object.values(schemas)) {
    const publicName = getOpenApiSchemaName(schema);
    app.openAPIRegistry.register(publicName, schema);
  }
  app.openAPIRegistry.registerComponent("securitySchemes", "accountCookie", { type: "apiKey", in: "cookie", name: "__Host-edaya_session" });
  app.openAPIRegistry.registerComponent("securitySchemes", "nativeSession", { type: "http", scheme: "bearer", description: "Native opaque Account session credential; distinct from school access JWTs." });
  const operations = [
    ["terms", "terms", undefined, schemas.AuthTerms, "GET"],
    ["methods", "methods", undefined, schemas.AuthMethods, "GET"],
    ["startOtp", "otp/start", schemas.AuthStart, schemas.PrimaryStatus],
    ["statusOtp", "otp/status", schemas.AuthChallengeInput, schemas.PrimaryStatus],
    ["resendOtp", "otp/resend", schemas.AuthResend, schemas.PrimaryStatus],
    ["completeRegistration", "registration/complete", schemas.RegistrationInput, schemas.AuthOutcome],
    ["teacherCode", "teacher-code", schemas.TeacherCodeLogin, schemas.AuthOutcome],
    ["verifyOtp", "otp/verify", schemas.AuthProof, schemas.AuthOutcome],
    ["verifyTotp", "totp/verify", schemas.AuthProof, schemas.AuthOutcome],
    ["enroll", "totp/enroll", schemas.AuthEnrollmentInput, schemas.Enrollment],
    ["confirmEnrollment", "totp/confirm", schemas.AuthProof, schemas.AuthOutcome],
    ["recover", "recovery", schemas.AuthProof, schemas.Enrollment],
    ["linkIdentifier", "identifiers/start", schemas.AuthStart, schemas.PrimaryStatus],
    ["unlinkIdentifier", "identifiers/unlink", schemas.AuthUnlink, schemas.AuthSuccess],
    ["security", "security", schemas.AuthEmptyInput, schemas.AuthSecurity],
    ["disableTotp", "totp/disable", schemas.AuthEmptyInput, schemas.AuthSuccess],
    ["getSession", "session", schemas.AuthEmptyInput, schemas.AuthSnapshot],
    ["accessToken", "access-token", schemas.AuthResource, schemas.AuthAccessToken],
    ["signOut", "sign-out", schemas.AuthEmptyInput, schemas.AuthSuccess],
    ["signOutAll", "sign-out-all", schemas.AuthEmptyInput, schemas.AuthSuccess],
  ] as const;
  for (const [key, suffix, request, response, method] of operations) {
    const schemaName = (schema: typeof response | NonNullable<typeof request>) => getOpenApiSchemaName(schema);
    const path = `/auth/edaya/${suffix}`;
    const publicOperation = ["teacherCode", "terms", "methods", "startOtp", "statusOtp", "resendOtp", "verifyOtp", "completeRegistration", "verifyTotp", "recover"].includes(key);
    app.openAPIRegistry.registerPath({
      method: method === "GET" ? "get" : "post",
      path,
      tags: ["Authentication"],
      ...clientRouteOperation({ namespace: "auth", clientKey: key, path, basePath: "root", responseSchemaName: schemaName(response), ...(request ? { requestSchemaName: schemaName(request) } : {}) }),
      security: publicOperation ? [] : [{ accountCookie: [] }, { nativeSession: [] }],
      ...(request ? { request: { body: { content: { "application/json": { schema: request } } } } } : {}),
      ...(key === "terms" ? { request: { query: z.object({ locale: z.enum(["fr", "en"]).optional() }) } } : {}),
      responses: { 200: { description: "Account operation result", content: { "application/json": { schema: response } } }, 400: { description: "Invalid input or challenge", content: { "application/json": { schema: schemas.AuthFailure } } }, 409: { description: "Terms version changed", content: { "application/json": { schema: schemas.AuthFailure } } }, 401: { description: "Authentication required" }, 403: { description: "Origin or security policy rejected" }, 413: { description: "Body too large" }, 429: { description: "Rate limited" }, 503: { description: "Authentication unavailable" } },
    });
  }
  app.openAPIRegistry.registerPath({ method: "get", path: "/.well-known/jwks.json", tags: ["Authentication"], security: [], responses: { 200: { description: "Public ES256 signing keys" } } });
  for (const method of ["get", "post"] as const) app.openAPIRegistry.registerPath({ method, path: "/auth/edaya/whatsapp/webhook", tags: ["Authentication"], security: [], responses: { 200: { description: "Provider challenge or authenticated delivery receipt" }, 403: { description: "Provider verification failed or phone unavailable" } } });
}
