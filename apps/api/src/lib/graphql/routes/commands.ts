import {

  GraphQLNonNull,
} from "graphql";
import type { GraphQLFieldConfigMap } from "graphql";
import type { Context } from "hono";
import { coreCommands } from "@/lib/school-api/registry";
import { getOpenApiSchemaName } from "@/lib/school-api/schemas/schema-name";
import type { AppBindings } from "@/http/types";
import { createCommandMutationResolver } from "@/lib/graphql/routes/command-resolvers";
import type { GraphQLTypeRegistry } from "@/lib/graphql/zod-to-graphql";
import {
  resolveGraphQLInputType,
  resolveGraphQLOutputType,
} from "@/lib/graphql/zod-to-graphql";

type GraphQLContext = Context<AppBindings>;

/**
 * Registry-driven GraphQL mirror of `buildCommandRoutes()`.
 */
export function appendGraphQLCommandFields(
  mutationFields: GraphQLFieldConfigMap<unknown, GraphQLContext>,
  typeRegistry: GraphQLTypeRegistry,
) {
  for (const commandConfig of coreCommands) {
    const inputTypeName = `${getOpenApiSchemaName(commandConfig.requestSchema)}Input`;
    const outputTypeName = getOpenApiSchemaName(commandConfig.responseSchema);

    mutationFields[commandConfig.methodName] = {
      type: new GraphQLNonNull(resolveGraphQLOutputType(typeRegistry, commandConfig.responseSchema, outputTypeName)),
      args: {
        input: {
          type: new GraphQLNonNull(resolveGraphQLInputType(typeRegistry, commandConfig.requestSchema, inputTypeName)),
        },
      },
      resolve: createCommandMutationResolver(commandConfig),
    };
  }
}
