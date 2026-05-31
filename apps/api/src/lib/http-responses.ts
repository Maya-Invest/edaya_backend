import type { Context } from "hono";
import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppBindings } from "@/lib/types";

type ResponseDetails = Record<string, unknown>;

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

export function isAuthorizationError(error: unknown): error is Error & { code?: string } {
  return error instanceof Error && error.name === "AuthorizationError";
}

export function unauthorizedResponse(c: Context<AppBindings>) {
  return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
}

export function badRequestResponse(c: Context<AppBindings>, message: string, details: ResponseDetails = {}) {
  return c.json({ message, ...details }, HttpStatusCodes.BAD_REQUEST);
}

export function forbiddenResponse(c: Context<AppBindings>, error: Error & { code?: string }) {
  return c.json({
    message: error.message,
    ...(error.code ? { code: error.code } : {}),
  }, HttpStatusCodes.FORBIDDEN);
}

export function notFoundResponse(c: Context<AppBindings>, message: string) {
  return c.json({ message }, HttpStatusCodes.NOT_FOUND);
}

export function routeErrorResponse(c: Context<AppBindings>, error: unknown) {
  if (isAuthorizationError(error)) {
    return forbiddenResponse(c, error);
  }

  c.var.logger?.error({ err: error }, "Unhandled API route error");
  return c.json({ message: "Internal server error occurred" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
}
