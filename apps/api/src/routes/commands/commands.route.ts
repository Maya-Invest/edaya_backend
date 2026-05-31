import type { Context } from "hono";
import type { AppBindings, AppRouteHandler } from "@/lib/types";
import { commandIdParamSchema } from "@/validation/route.schemas";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";
import { configCommandEntities, configCommandEntitiesByName } from "./commands.config";

export interface CommandRoutePair {
  route: any;
  handler: any;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

function isAuthorizationError(error: unknown): error is Error & { code?: string } {
  return error instanceof Error && error.name === "AuthorizationError";
}

export async function saveConfigEntity(c: Context<AppBindings>, entityName: string, body: unknown) {
  const actor = c.get("actor");
  if (!actor) {
    return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const entityConfig = configCommandEntitiesByName.get(entityName);
  if (!entityConfig) {
    return c.json({ message: `Entity ${entityName} is not write-supported` }, HttpStatusCodes.BAD_REQUEST);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const writeService = (headlessApp.config as any)[entityName];
  if (!writeService || typeof writeService.save !== "function") {
    return c.json({ message: `Entity ${entityName} is not write-supported` }, HttpStatusCodes.BAD_REQUEST);
  }

  const parsed = entityConfig.requestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ message: "Invalid request body", issues: parsed.error.issues }, HttpStatusCodes.BAD_REQUEST);
  }

  let entityInstance: unknown;
  try {
    entityInstance = entityConfig.createEntity(parsed.data, actor.schoolId);
  }
  catch (error) {
    return c.json({ message: getErrorMessage(error) }, HttpStatusCodes.BAD_REQUEST);
  }

  try {
    await writeService.save(entityInstance);
    return c.json(entityInstance as any, HttpStatusCodes.CREATED);
  }
  catch (error) {
    if (isAuthorizationError(error)) {
      return c.json({ message: error.message, code: error.code }, HttpStatusCodes.FORBIDDEN);
    }
    return c.json({ message: getErrorMessage(error) }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function deleteConfigEntity(c: Context<AppBindings>, entityName: string, id: string) {
  const actor = c.get("actor");
  if (!actor) {
    return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
  }

  if (!configCommandEntitiesByName.has(entityName)) {
    return c.json({ message: `Entity ${entityName} is not delete-supported` }, HttpStatusCodes.BAD_REQUEST);
  }

  const headlessApp = c.get("schoolApp").forActor(actor);
  const writeService = (headlessApp.config as any)[entityName];
  if (!writeService || typeof writeService.delete !== "function") {
    return c.json({ message: `Entity ${entityName} is not delete-supported` }, HttpStatusCodes.BAD_REQUEST);
  }

  try {
    await writeService.delete(id);
    return c.json({ message: `${entityName} with ID ${id} deleted` }, HttpStatusCodes.OK);
  }
  catch (error) {
    if (isAuthorizationError(error)) {
      return c.json({ message: error.message, code: error.code }, HttpStatusCodes.FORBIDDEN);
    }
    return c.json({ message: getErrorMessage(error) }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
}

export const commandRoutePairs: CommandRoutePair[] = [];

configCommandEntities.forEach((entityConfig) => {
  const createConfigRoute = createRoute({
    method: "post",
    path: `/api/commands/config/${entityConfig.name}`,
    tags: ["Config Commands"],
    summary: `Save ${entityConfig.displayName}`,
    description: `Creates or replaces a ${entityConfig.displayName} configuration record using the core ConfigService.`,
    request: {
      body: jsonContent(entityConfig.requestSchema, `${entityConfig.displayName} payload`),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        entityConfig.responseSchema,
        `Successfully saved ${entityConfig.displayName}`,
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        createMessageObjectSchema(),
        "Missing or invalid authorization session",
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        createMessageObjectSchema(),
        "Access denied due to authorization policies",
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        createMessageObjectSchema(),
        "Invalid config command payload",
      ),
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
        createMessageObjectSchema(),
        "Internal server error occurred",
      ),
    },
  });

  const createConfigHandler: AppRouteHandler<typeof createConfigRoute> = async (c) => {
    return saveConfigEntity(c, entityConfig.name, c.req.valid("json"));
  };

  commandRoutePairs.push({ route: createConfigRoute, handler: createConfigHandler });

  const deleteConfigRoute = createRoute({
    method: "delete",
    path: `/api/commands/config/${entityConfig.name}/{id}`,
    tags: ["Config Commands"],
    summary: `Delete ${entityConfig.displayName}`,
    description: `Deletes a ${entityConfig.displayName} configuration record using the core ConfigService.`,
    request: {
      params: commandIdParamSchema,
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        createMessageObjectSchema(),
        `Successfully deleted ${entityConfig.displayName}`,
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        createMessageObjectSchema(),
        "Missing or invalid authorization session",
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        createMessageObjectSchema(),
        "Access denied due to authorization policies",
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        createMessageObjectSchema(),
        "Invalid config command identifier",
      ),
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
        createMessageObjectSchema(),
        "Internal server error occurred",
      ),
    },
  });

  const deleteConfigHandler: AppRouteHandler<typeof deleteConfigRoute> = async (c) => {
    return deleteConfigEntity(c, entityConfig.name, c.req.valid("param").id);
  };

  commandRoutePairs.push({ route: deleteConfigRoute, handler: deleteConfigHandler });
});
