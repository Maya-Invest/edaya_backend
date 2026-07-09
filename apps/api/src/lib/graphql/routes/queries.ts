import {

  GraphQLNonNull,
} from "graphql";
import type { GraphQLFieldConfigMap } from "graphql";
import type { Context } from "hono";
import { coreQueries } from "@/lib/school-api/registry";
import { getOpenApiSchemaName } from "@/lib/school-api/schemas/schema-name";
import type { AppBindings } from "@/http/types";
import { createCoreQueryResolver } from "@/lib/graphql/routes/query-resolvers";
import type { GraphQLTypeRegistry } from "@/lib/graphql/zod-to-graphql";
import {
  GraphQLCountResultType,
  resolveGraphQLInputType,
  resolveGraphQLOutputType,
} from "@/lib/graphql/zod-to-graphql";

type GraphQLContext = Context<AppBindings>;

/**
 * Registry-driven GraphQL mirror of `buildQueryRoutes()`.
 */
export function appendGraphQLCoreQueryFields(
  queryFields: GraphQLFieldConfigMap<unknown, GraphQLContext>,
  typeRegistry: GraphQLTypeRegistry,
) {
  for (const queryConfig of coreQueries) {
    const inputTypeName = `${getOpenApiSchemaName(queryConfig.requestSchema)}Input`;
    const outputType = queryConfig.responseShape === "count"
      ? GraphQLCountResultType
      : resolveGraphQLOutputType(
          typeRegistry,
          queryConfig.responseSchema,
          getOpenApiSchemaName(queryConfig.responseSchema),
        );

    queryFields[queryConfig.methodName] = {
      type: new GraphQLNonNull(outputType),
      args: {
        input: {
          type: new GraphQLNonNull(resolveGraphQLInputType(typeRegistry, queryConfig.requestSchema, inputTypeName)),
        },
      },
      resolve: createCoreQueryResolver(queryConfig),
    };
  }
}
