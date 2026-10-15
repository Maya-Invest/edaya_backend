import type { AppRouteHandler } from "@/http/types";
import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import {
  CHILDREN_AI_RESOLVE_SECRET_HEADER,
  resolveGuardianForChildrenAi,
} from "@edaya/service";
import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

const commandMessageSchema = createMessageObjectSchema();

const resolveGuardianRequestSchema = z.object({
  subjectId: z.string().trim().min(1),
}).openapi("ChildrenAiResolveGuardianRequest");

const resolveGuardianResponseSchema = z.object({
  schoolId: z.string(),
  displayName: z.string(),
  children: z.array(z.object({
    studentId: z.string(),
    schoolId: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    classLabel: z.string().min(1).optional(),
    grade: z.enum(["6e", "5e", "4e", "3e"]).optional(),
  })),
}).openapi("ChildrenAiResolveGuardianResponse");

export const childrenAiResolveGuardianRoute = createRoute({
  method: "post",
  path: "/internal/children-ai/resolve-guardian",
  tags: ["Internal"],
  summary: "Resolve a guardian and linked students for Children AI (sibling secret)",
  request: {
    body: jsonContent(resolveGuardianRequestSchema, "Identity subject to resolve"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(resolveGuardianResponseSchema, "Guardian school and children"),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(commandMessageSchema, "Invalid resolve secret"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(commandMessageSchema, "Invalid request"),
  },
});

export const childrenAiResolveGuardianHandler: AppRouteHandler<typeof childrenAiResolveGuardianRoute> = async (c) => {
  if (!resolveSecretMatches(c.req.header(CHILDREN_AI_RESOLVE_SECRET_HEADER), c.env.CHILDREN_AI_RESOLVE_SECRET)) {
    return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const body = c.req.valid("json");
  const listing = await resolveGuardianForChildrenAi(c.var.schoolApp.repositories, body.subjectId);
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
