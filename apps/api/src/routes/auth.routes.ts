import { loadDemoLoginAccounts } from "@/lib/demo-accounts";
import type { DemoStaffRole } from "@/lib/demo-accounts";
import { shouldAllowDemoLoginAccounts } from "@/lib/runtime/env";
import type { AppRouteHandler } from "@/lib/http/types";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";
import { schoolApiPath } from "@/lib/school-api/routes/paths";
import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

const demoLoginAccountsRequestSchema = z.object({}).openapi("DemoLoginAccountsListRequest");

const demoStaffRoleSchema = z.enum(["directeur", "prof_principal", "professeur", "educateur"]);

const demoLoginAccountSchema = z.object({
  staffId: z.string(),
  email: z.string(),
  name: z.string(),
  role: demoStaffRoleSchema,
  initials: z.string(),
}).openapi("DemoLoginAccount");

const commandMessageSchema = createMessageObjectSchema();

export const listDemoLoginAccountsRoute = createRoute({
  method: "post",
  path: schoolApiPath("auth", "demo-login-accounts", "list"),
  tags: ["Core Auth"],
  summary: "List demo login accounts for the webapp login screen (dev only)",
  request: {
    body: jsonContent(demoLoginAccountsRequestSchema, "Demo login accounts list request"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(demoLoginAccountSchema).openapi("DemoLoginAccountsListResponse"),
      "Demo staff accounts for login UI",
    ),
    [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
      commandMessageSchema,
      "Demo login accounts are disabled outside development",
    ),
    ...coreRouteErrorResponses,
  },
});

export const listDemoLoginAccountsHandler: AppRouteHandler<typeof listDemoLoginAccountsRoute> = async (c) => {
  if (!shouldAllowDemoLoginAccounts(c.env)) {
    return c.json(
      { message: "Demo login accounts are disabled in this environment" },
      HttpStatusCodes.SERVICE_UNAVAILABLE,
    );
  }

  const accounts = await loadDemoLoginAccounts(c.get("schoolApp").repositories);

  return c.json(accounts satisfies Array<{
    staffId: string;
    email: string;
    name: string;
    role: DemoStaffRole;
    initials: string;
  }>, HttpStatusCodes.OK);
};
