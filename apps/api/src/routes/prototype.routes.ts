import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { SEED_ACTIVITIES, SEED_DEADLINES } from "@edaya/dev-fixtures";
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

const prototypeDeadlineSchema = z.object({
  id: z.string(),
  classGroupId: z.string(),
  title: z.string(),
  subject: z.string(),
  description: z.string(),
  dueDate: z.string(),
  assignedDate: z.string(),
  type: z.enum(["Homework", "Project", "Reading", "Lab"]),
  attachments: z.array(z.object({
    name: z.string(),
    size: z.string(),
  })),
  submissions: z.array(z.object({
    studentId: z.string(),
    status: z.enum(["submitted", "late", "missing"]),
    date: z.string().optional(),
  })),
}).openapi("PrototypeDeadline");

const prototypeDeadlinesListRequestSchema = z.object({
  classGroupId: z.string().optional(),
}).openapi("PrototypeDeadlinesListRequest");

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

export const listPrototypeDeadlinesRoute = createRoute({
  method: "post",
  path: schoolApiPath("prototype", "deadlines", "list"),
  tags: ["Core Prototype"],
  summary: "List homework deadlines (stub — no domain entity yet)",
  request: {
    body: jsonContent(prototypeDeadlinesListRequestSchema, "Prototype deadlines list request"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(prototypeDeadlineSchema).openapi("PrototypeDeadlinesListResponse"),
      "Stub homework deadlines",
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

export const listPrototypeDeadlinesHandler: AppRouteHandler<typeof listPrototypeDeadlinesRoute> = async (c) => {
  if (!c.get("actor")) {
    return unauthorizedResponse(c);
  }

  const body = c.req.valid("json") as { classGroupId?: string };
  const deadlines = body.classGroupId
    ? SEED_DEADLINES.filter(deadline => deadline.classGroupId === body.classGroupId)
    : SEED_DEADLINES;

  return c.json(
    deadlines.map(deadline => ({
      ...deadline,
      attachments: deadline.attachments.map(attachment => ({ ...attachment })),
      submissions: deadline.submissions.map(submission => ({ ...submission })),
    })),
    HttpStatusCodes.OK,
  );
};
