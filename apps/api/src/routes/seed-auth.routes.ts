import type { AppRouteHandler } from "@/http/types";
import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";
import { isSeedAuthProvisionRequest, SEED_AUTH_PROVISION_HEADER } from "@/runtime/shared/adapters/seed-auth-provision";

const commandMessageSchema = createMessageObjectSchema();

const markEmailVerifiedBodySchema = z.object({
  email: z.string().email().optional(),
  subjectId: z.string().min(1).optional(),
}).refine(value => Boolean(value.email || value.subjectId), {
  message: "email or subjectId is required",
});

export const markSeedEmailVerifiedRoute = createRoute({
  method: "post",
  path: "/dev/seed/mark-email-verified",
  tags: ["Dev Seed"],
  summary: "Mark a Better Auth user email-verified (seed / local only)",
  request: {
    body: jsonContent(markEmailVerifiedBodySchema, "User to mark verified"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({ ok: z.literal(true) }),
      "User marked email-verified",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(commandMessageSchema, "Missing seed provision header or body"),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(commandMessageSchema, "Not available in production Workers"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(commandMessageSchema, "User not found"),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(commandMessageSchema, "Failed to update user"),
  },
});

export const markSeedEmailVerifiedHandler: AppRouteHandler<typeof markSeedEmailVerifiedRoute> = async (c) => {
  if (c.env.RUNTIME === "worker" || !["development", "test"].includes(c.env.NODE_ENV)) {
    // Verified fixture creation is limited to local development and tests.
    return c.json({ message: "Seed mark-email-verified is local-only" }, HttpStatusCodes.FORBIDDEN);
  }

  if (!isSeedAuthProvisionRequest(c.req.raw.headers)) {
    return c.json(
      { message: `Missing ${SEED_AUTH_PROVISION_HEADER} header` },
      HttpStatusCodes.BAD_REQUEST,
    );
  }

  const body = c.req.valid("json");
  const auth = c.var.auth;
  if (!auth.$context) {
    return c.json({ message: "Auth context unavailable" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  try {
    const context = await auth.$context;
    if (body.subjectId) {
      await context.internalAdapter.updateUser(body.subjectId, { emailVerified: true });
      return c.json({ ok: true as const }, HttpStatusCodes.OK);
    }

    const email = body.email!;
    const existing = await context.internalAdapter.findUserByEmail(email);
    if (!existing) {
      return c.json({ message: `No auth user for ${email}` }, HttpStatusCodes.NOT_FOUND);
    }

    await context.internalAdapter.updateUserByEmail(email, { emailVerified: true });
    return c.json({ ok: true as const }, HttpStatusCodes.OK);
  }
  catch (error) {
    return c.json(
      { message: error instanceof Error ? error.message : String(error) },
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};
