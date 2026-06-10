import { z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

const commandMessageSchema = createMessageObjectSchema();
const businessRuleViolationSchema = z.object({
  message: z.string(),
  code: z.string(),
}).openapi("BusinessRuleViolationResponse");

export const coreRouteErrorResponses = {
  [HttpStatusCodes.UNAUTHORIZED]: jsonContent(commandMessageSchema, "Missing or invalid authorization session"),
  [HttpStatusCodes.BAD_REQUEST]: jsonContent(commandMessageSchema, "Invalid request payload"),
  [HttpStatusCodes.FORBIDDEN]: jsonContent(commandMessageSchema, "Access denied due to authorization policies"),
  [HttpStatusCodes.CONFLICT]: jsonContent(businessRuleViolationSchema, "Business rule violation"),
  [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(commandMessageSchema, "Internal server error occurred"),
};
