import type { AppRouteHandler } from "@/http/types";
import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import {
  EDAYA_SPARK_RESOLVE_SECRET_HEADER,
  resolveGuardianForEdayaSpark,
} from "@edaya/service";
import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

const commandMessageSchema = createMessageObjectSchema();

const resolveGuardianChildSchema = z.object({
  studentId: z.string(),
  schoolId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  classLabel: z.string().min(1).optional(),
  gradeLevel: z.object({
    id: z.string(),
    name: z.string(),
    label: z.string(),
    order: z.number().int(),
    cycle: z.string().optional(),
  }).optional(),
});

const resolveGuardianRequestSchema = z.object({
  subjectId: z.string().trim().min(1),
  email: z.string().trim().min(1).max(320).optional(),
}).openapi("EdayaSparkResolveGuardianRequest");

const resolveGuardianResponseSchema = z.object({
  schoolId: z.string(),
  displayName: z.string(),
  children: z.array(resolveGuardianChildSchema),
  schools: z.array(z.object({
    schoolId: z.string(),
    schoolName: z.string(),
    children: z.array(resolveGuardianChildSchema),
  })),
}).openapi("EdayaSparkResolveGuardianResponse");

export const edayaSparkResolveGuardianRoute = createRoute({
  method: "post",
  path: "/internal/edaya-spark/resolve-guardian",
  tags: ["Internal"],
  summary: "Resolve a guardian and linked students for Edaya Spark (sibling secret)",
  request: {
    body: jsonContent(resolveGuardianRequestSchema, "Identity subject to resolve"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(resolveGuardianResponseSchema, "Guardian school and children"),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(commandMessageSchema, "Invalid resolve secret"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(commandMessageSchema, "Invalid request"),
  },
});

export const edayaSparkResolveGuardianHandler: AppRouteHandler<typeof edayaSparkResolveGuardianRoute> = async (c) => {
  if (!resolveSecretMatches(c.req.header(EDAYA_SPARK_RESOLVE_SECRET_HEADER), c.env.EDAYA_SPARK_RESOLVE_SECRET)) {
    return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const body = c.req.valid("json");
  const listing = await resolveGuardianForEdayaSpark(
    c.var.schoolApp.repositories,
    body.subjectId,
    body.email,
  );
  return c.json(listing, HttpStatusCodes.OK);
};

function resolveSecretMatches(provided: string | undefined, expected: string | undefined): boolean {
  if (!provided || !expected) {
    return false;
  }
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}
