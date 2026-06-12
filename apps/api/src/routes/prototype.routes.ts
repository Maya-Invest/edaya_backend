import { SEED_ACTIVITIES } from "@edaya/dev-fixtures";
import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import type { AppRouteHandler } from "@/lib/http/types";
import { unauthorizedResponse } from "@/lib/http/responses";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";
import { schoolApiPath } from "@/lib/school-api/routes/paths";

const prototypeListRequestSchema = z.object({}).openapi("PrototypeListRequest");

const prototypeActivitySchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(["Sport", "Arts", "Science", "Language", "Wellbeing"]),
  coach: z.string(),
  schedule: z.string(),
  participants: z.number(),
  capacity: z.number(),
  description: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  enrollments: z.array(z.object({
    studentId: z.string(),
    status: z.enum(["approved", "pending", "denied"]),
  })),
}).openapi("PrototypeActivity");

export const listPrototypeActivitiesRoute = createRoute({
  method: "post",
  path: schoolApiPath("prototype", "activities", "list"),
  tags: ["Core Prototype"],
  summary: "List extracurricular activities (stub — no domain entity yet)",
  request: {
    body: jsonContent(prototypeListRequestSchema, "Prototype activities list request"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(prototypeActivitySchema).openapi("PrototypeActivitiesListResponse"),
      "Stub extracurricular activities",
    ),
    ...coreRouteErrorResponses,
  },
});

export const listPrototypeActivitiesHandler: AppRouteHandler<typeof listPrototypeActivitiesRoute> = async (c) => {
  if (!c.get("actor")) {
    return unauthorizedResponse(c);
  }

  return c.json(
    SEED_ACTIVITIES.map(activity => ({
      ...activity,
      enrollments: activity.enrollments.map(enrollment => ({ ...enrollment })),
    })),
    HttpStatusCodes.OK,
  );
};
