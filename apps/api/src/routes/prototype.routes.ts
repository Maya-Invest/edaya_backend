import { DEV_AUTH_STAFF_ACCOUNTS, SEED_ACTIVITIES, SEED_DEADLINES, SEED_TEACHING_LOG_ENTRIES } from "@edaya/dev-fixtures";
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

const prototypeTeachingLogListRequestSchema = z.object({
  classGroupId: z.string().optional(),
  subjectName: z.string().optional(),
}).openapi("PrototypeTeachingLogListRequest");

const prototypeTeachingLogEntrySchema = z.object({
  id: z.string(),
  classGroupId: z.string(),
  subjectId: z.string(),
  subjectName: z.string(),
  teacher: z.string(),
  date: z.string(),
  chapter: z.string(),
  content: z.string(),
  objectives: z.array(z.string()),
  homework: z.string().optional(),
  attachments: z.array(z.string()).optional(),
  progress: z.number(),
}).openapi("PrototypeTeachingLogEntry");

const demoStaffRoleSchema = z.enum(["directeur", "prof_principal", "professeur", "educateur"]);

const prototypeDemoAccountSchema = z.object({
  staffId: z.string(),
  email: z.string(),
  name: z.string(),
  role: demoStaffRoleSchema,
  initials: z.string(),
}).openapi("PrototypeDemoAccount");

const LOGIN_DEMO_STAFF_IDS = ["st5", "st3", "st1", "st7"] as const;

const DEMO_STAFF_ROLES: Record<string, z.infer<typeof demoStaffRoleSchema>> = {
  st5: "directeur",
  st3: "prof_principal",
  st7: "educateur",
  st1: "professeur",
  st2: "professeur",
};

function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
}

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

export const listPrototypeDemoAccountsRoute = createRoute({
  method: "post",
  path: schoolApiPath("prototype", "demo-accounts", "list"),
  tags: ["Core Prototype"],
  summary: "List demo login accounts for the webapp login screen",
  request: {
    body: jsonContent(prototypeListRequestSchema, "Prototype demo accounts list request"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(prototypeDemoAccountSchema).openapi("PrototypeDemoAccountsListResponse"),
      "Demo staff accounts for login UI",
    ),
    ...coreRouteErrorResponses,
  },
});

export const listPrototypeTeachingLogRoute = createRoute({
  method: "post",
  path: schoolApiPath("prototype", "teaching-log", "list"),
  tags: ["Core Prototype"],
  summary: "List teaching journal entries (stub — no domain entity yet)",
  request: {
    body: jsonContent(prototypeTeachingLogListRequestSchema, "Prototype teaching log list request"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(prototypeTeachingLogEntrySchema).openapi("PrototypeTeachingLogListResponse"),
      "Stub teaching journal entries",
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

export const listPrototypeDemoAccountsHandler: AppRouteHandler<typeof listPrototypeDemoAccountsRoute> = async (c) => {
  const accounts = DEV_AUTH_STAFF_ACCOUNTS
    .filter(account => LOGIN_DEMO_STAFF_IDS.includes(account.staffId as typeof LOGIN_DEMO_STAFF_IDS[number]))
    .map(account => ({
      staffId: account.staffId,
      email: account.email,
      name: account.name,
      role: DEMO_STAFF_ROLES[account.staffId] ?? "professeur",
      initials: initialsForName(account.name),
    }));

  return c.json(accounts, HttpStatusCodes.OK);
};

export const listPrototypeTeachingLogHandler: AppRouteHandler<typeof listPrototypeTeachingLogRoute> = async (c) => {
  if (!c.get("actor")) {
    return unauthorizedResponse(c);
  }

  const body = c.req.valid("json") as { classGroupId?: string; subjectName?: string };
  let entries = SEED_TEACHING_LOG_ENTRIES;
  if (body.classGroupId) {
    entries = entries.filter(entry => entry.classGroupId === body.classGroupId);
  }
  if (body.subjectName) {
    entries = entries.filter(entry => entry.subjectName === body.subjectName);
  }

  return c.json(
    entries.map(entry => ({
      ...entry,
      objectives: [...entry.objectives],
      attachments: entry.attachments ? [...entry.attachments] : undefined,
    })),
    HttpStatusCodes.OK,
  );
};
