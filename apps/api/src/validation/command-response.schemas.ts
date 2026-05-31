import { z } from "@hono/zod-openapi";
import {
  attendanceResponseSchema,
  messageDeliveryResponseSchema,
  sessionResponseSchema,
} from "./entities.schemas";

export const commandMessageResponseSchema = z.object({
  message: z.string(),
}).openapi("CommandMessageResponse");

export const sessionCommandListResponseSchema = z.array(sessionResponseSchema).openapi("SessionCommandListResponse");
export const attendanceCommandListResponseSchema = z.array(attendanceResponseSchema).openapi("AttendanceCommandListResponse");
export const messageDeliveryCommandListResponseSchema = z.array(messageDeliveryResponseSchema).openapi("MessageDeliveryCommandListResponse");
