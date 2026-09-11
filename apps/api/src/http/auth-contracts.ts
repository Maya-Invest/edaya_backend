import { z } from "@hono/zod-openapi";
import { jsonContent } from "stoker/openapi/helpers";
import type { AppOpenAPI } from "./types";

/** Contracts for Edaya's auth facade, independently of provider internals. */
export function registerAuthContracts(app: AppOpenAPI): void {
  app.openAPIRegistry.registerComponent("securitySchemes", "FirstPartyAccess", {
    type: "http",
    scheme: "bearer",
    description: "Short-lived Edaya access token from /auth/edaya/access-token. External OAuth tokens and renewal credentials are not accepted.",
  });
  const connectedApp = z.object({
    id: z.string(),
    clientId: z.string(),
    clientName: z.string(),
    purpose: z.string(),
    schoolId: z.string(),
    studentIds: z.array(z.string()),
    scopes: z.array(z.string()),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  }).openapi("ConnectedApp");
  const failure = z.object({ message: z.string() });
  app.openAPIRegistry.registerPath({
    method: "get",
    path: "/auth/edaya/connected-apps",
    operationId: "listConnectedApps",
    tags: ["Connected Apps"],
    summary: "List the signed-in parent's active delegations",
    security: [{ FirstPartyAccess: [] }],
    request: { query: z.object({ cursor: z.string().regex(/^[\w-]{1,100}$/).optional() }) },
    responses: {
      200: jsonContent(z.object({ items: z.array(connectedApp), nextCursor: z.string().nullable() }), "Up to 50 grants in stable ID order. Use nextCursor for the next page."),
      400: jsonContent(failure, "Invalid cursor"),
      401: jsonContent(failure, "Missing or invalid first-party access token"),
    },
  });
  app.openAPIRegistry.registerPath({
    method: "post",
    path: "/auth/edaya/connected-apps/{grantId}/revoke",
    operationId: "revokeConnectedApp",
    tags: ["Connected Apps"],
    summary: "Immediately revoke an owned delegation",
    security: [{ FirstPartyAccess: [] }],
    request: { params: z.object({ grantId: z.string().min(1) }) },
    responses: {
      200: jsonContent(z.object({ success: z.literal(true) }), "Revoked, including an already-revoked owned grant"),
      401: jsonContent(failure, "Missing or invalid first-party access token"),
      404: jsonContent(failure, "Unknown grant or grant owned by another user"),
      429: jsonContent(failure, "Authentication request quota exceeded"),
    },
  });
}
