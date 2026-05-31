import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";
import { queryableEntities } from "./queries.config";
import type { AppRouteHandler } from "@/lib/types";
import { arraySchema } from "@/validation/utils/schema-fields";
import { countResponseSchema, entityIdParamSchema } from "@/validation/route.schemas";

export interface QueryRoutePair {
  route: any;
  handler: any;
}

export const queryRoutePairs: QueryRoutePair[] = [];

// Register programmatically generated CRUD routes for all entities in the registry
queryableEntities.forEach(({ name, displayName, querySchema, responseSchema }) => {
  // 1. POST /api/queries/:entity/list
  const listRoute = createRoute({
    method: "post",
    path: `/api/queries/${name}/list`,
    tags: ["Queries"],
    summary: `Query and filter ${displayName}`,
    description: `Retrieves a filtered, ordered, and paginated list of ${displayName} records.`,
    request: {
      body: jsonContent(querySchema, `Filters for ${displayName}`),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        arraySchema(responseSchema),
        `Successfully retrieved list of ${displayName}`,
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
        "Invalid query filter options structure",
      ),
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
        createMessageObjectSchema(),
        "Internal server error occurred",
      ),
    },
  });

  const listHandler: AppRouteHandler<typeof listRoute> = async (c) => {
    const actor = c.get("actor");
    if (!actor) {
      return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
    }

    const body = c.req.valid("json");
    const headlessApp = c.get("schoolApp").forActor(actor);
    const readService = (headlessApp.queries as any)[name];

    if (!readService || typeof readService.list !== "function") {
      return c.json({ message: `Entity ${name} is not queryable` }, HttpStatusCodes.BAD_REQUEST);
    }

    try {
      const results = await readService.list(body);
      return c.json(results, HttpStatusCodes.OK);
    }
    catch (err: any) {
      if (err.name === "AuthorizationError") {
        return c.json({ message: err.message }, HttpStatusCodes.FORBIDDEN);
      }
      return c.json({ message: err.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }
  };

  queryRoutePairs.push({ route: listRoute, handler: listHandler });

  // 2. POST /api/queries/:entity/one
  const findOneRoute = createRoute({
    method: "post",
    path: `/api/queries/${name}/one`,
    tags: ["Queries"],
    summary: `Find one ${displayName} record`,
    description: `Retrieves the first ${displayName} record matching the supplied query options.`,
    request: {
      body: jsonContent(querySchema, `Filters for ${displayName}`),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        responseSchema,
        `Successfully retrieved a ${displayName} record`,
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
        "Invalid query filter options structure",
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        createMessageObjectSchema(),
        `No matching ${displayName} record could be found`,
      ),
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
        createMessageObjectSchema(),
        "Internal server error occurred",
      ),
    },
  });

  const findOneHandler: AppRouteHandler<typeof findOneRoute> = async (c) => {
    const actor = c.get("actor");
    if (!actor) {
      return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
    }

    const body = c.req.valid("json");
    const headlessApp = c.get("schoolApp").forActor(actor);
    const readService = (headlessApp.queries as any)[name];

    if (!readService || typeof readService.findOne !== "function") {
      return c.json({ message: `Entity ${name} is not queryable` }, HttpStatusCodes.BAD_REQUEST);
    }

    try {
      const result = await readService.findOne(body);
      if (!result) {
        return c.json({ message: `${displayName} not found` }, HttpStatusCodes.NOT_FOUND);
      }
      return c.json(result, HttpStatusCodes.OK);
    }
    catch (err: any) {
      if (err.name === "AuthorizationError") {
        return c.json({ message: err.message }, HttpStatusCodes.FORBIDDEN);
      }
      return c.json({ message: err.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }
  };

  queryRoutePairs.push({ route: findOneRoute, handler: findOneHandler });

  // 3. POST /api/queries/:entity/count
  const countRoute = createRoute({
    method: "post",
    path: `/api/queries/${name}/count`,
    tags: ["Queries"],
    summary: `Count ${displayName}`,
    description: `Counts ${displayName} records matching the supplied filters.`,
    request: {
      body: jsonContent(querySchema, `Filters for ${displayName}`),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        countResponseSchema,
        `Successfully counted ${displayName}`,
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
        "Invalid query filter options structure",
      ),
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
        createMessageObjectSchema(),
        "Internal server error occurred",
      ),
    },
  });

  const countHandler: AppRouteHandler<typeof countRoute> = async (c) => {
    const actor = c.get("actor");
    if (!actor) {
      return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
    }

    const filter = { ...(c.req.valid("json") as Record<string, unknown>) };
    delete filter.$orderBy;
    delete filter.$limit;
    delete filter.$offset;
    const headlessApp = c.get("schoolApp").forActor(actor);
    const readService = (headlessApp.queries as any)[name];

    if (!readService || typeof readService.count !== "function") {
      return c.json({ message: `Entity ${name} is not queryable` }, HttpStatusCodes.BAD_REQUEST);
    }

    try {
      const count = await readService.count(filter);
      return c.json({ count }, HttpStatusCodes.OK);
    }
    catch (err: any) {
      if (err.name === "AuthorizationError") {
        return c.json({ message: err.message }, HttpStatusCodes.FORBIDDEN);
      }
      return c.json({ message: err.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }
  };

  queryRoutePairs.push({ route: countRoute, handler: countHandler });

  // 4. GET /api/queries/:entity/:id
  const getRoute = createRoute({
    method: "get",
    path: `/api/queries/${name}/{id}`,
    tags: ["Queries"],
    summary: `Get ${displayName} by ID`,
    description: `Retrieves a single ${displayName} record using its unique identifier.`,
    request: {
      params: entityIdParamSchema(displayName),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        responseSchema,
        `Successfully retrieved the ${displayName} record`,
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
        "Invalid query filter options structure",
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        createMessageObjectSchema(),
        `The requested ${displayName} record could not be found`,
      ),
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
        createMessageObjectSchema(),
        "Internal server error occurred",
      ),
    },
  });

  const getHandler: AppRouteHandler<typeof getRoute> = async (c) => {
    const actor = c.get("actor");
    if (!actor) {
      return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
    }

    const { id } = c.req.valid("param");
    const headlessApp = c.get("schoolApp").forActor(actor);
    const readService = (headlessApp.queries as any)[name];

    if (!readService || typeof readService.findById !== "function") {
      return c.json({ message: `Entity ${name} is not queryable` }, HttpStatusCodes.BAD_REQUEST);
    }

    try {
      const result = await readService.findById(id);
      if (!result) {
        return c.json({ message: `${displayName} not found` }, HttpStatusCodes.NOT_FOUND);
      }
      return c.json(result, HttpStatusCodes.OK);
    }
    catch (err: any) {
      if (err.name === "AuthorizationError") {
        return c.json({ message: err.message }, HttpStatusCodes.FORBIDDEN);
      }
      return c.json({ message: err.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }
  };

  queryRoutePairs.push({ route: getRoute, handler: getHandler });
});
