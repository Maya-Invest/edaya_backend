import {
  type GraphQLFieldConfigArgumentMap,
  type GraphQLFieldConfigMap,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from "graphql";
import type { Context } from "hono";
import { coreEntities } from "@/lib/school-api/registry";
import { getOpenApiSchemaName } from "@/lib/school-api/schemas/schema-name";
import type { AppBindings } from "@/http/types";
import { entityFieldNames } from "@/lib/graphql/utils/naming";
import {
  buildEntityGraphQLTypes,
  GraphQLBatchSaveResultType,
  GraphQLCountResultType,
  GraphQLDeleteResultType,
  GraphQLTypeRegistry,
} from "@/lib/graphql/zod-to-graphql";
import {
  getSharedGraphQLFilterTypes,
  GraphQLFilterTypeRegistry,
  GraphQLSortDirectionEnum,
} from "@/lib/graphql/zod-filter-to-graphql";
import { createEntityMutationResolvers, createEntityQueryResolvers } from "@/lib/graphql/routes/entity-resolvers";

type GraphQLContext = Context<AppBindings>;

const idArg: GraphQLFieldConfigArgumentMap = {
  id: { type: new GraphQLNonNull(GraphQLString) },
};

/**
 * Registry-driven GraphQL mirror of `buildEntityRoutes()`.
 * Exposes core entity reads and direct writes only — no command routes.
 */
export function buildGraphQLEntitySchema(): GraphQLSchema {
  const typeRegistry = new GraphQLTypeRegistry();
  const filterRegistry = new GraphQLFilterTypeRegistry();
  const queryFields: GraphQLFieldConfigMap<unknown, GraphQLContext> = {};
  const mutationFields: GraphQLFieldConfigMap<unknown, GraphQLContext> = {};

  for (const entityConfig of coreEntities) {
    const typeName = getOpenApiSchemaName(entityConfig.responseSchema);
    const names = entityFieldNames(typeName, entityConfig.serviceName);
    const filterType = filterRegistry.getOrCreateEntityFilterType(typeName, entityConfig.querySchema);
    const filterArg: GraphQLFieldConfigArgumentMap = {
      filter: { type: filterType },
    };
    const { outputType, inputType } = buildEntityGraphQLTypes(
      typeRegistry,
      typeName,
      entityConfig.responseSchema,
      entityConfig.saveSchema,
    );
    const queryResolvers = createEntityQueryResolvers(entityConfig);
    const mutationResolvers = createEntityMutationResolvers(entityConfig);

    queryFields[names.list] = {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(outputType))),
      args: filterArg,
      resolve: queryResolvers.list,
    };
    queryFields[names.one] = {
      type: outputType,
      args: filterArg,
      resolve: queryResolvers.one,
    };
    queryFields[names.count] = {
      type: new GraphQLNonNull(GraphQLCountResultType),
      args: filterArg,
      resolve: queryResolvers.count,
    };
    queryFields[names.byId] = {
      type: outputType,
      args: idArg,
      resolve: queryResolvers.byId,
    };

    if (entityConfig.allowDirectSave) {
      mutationFields[names.save] = {
        type: new GraphQLNonNull(outputType),
        args: {
          input: { type: new GraphQLNonNull(inputType) },
        },
        resolve: mutationResolvers.save,
      };
      mutationFields[names.batchSave] = {
        type: new GraphQLNonNull(GraphQLBatchSaveResultType),
        args: {
          entities: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(inputType))) },
        },
        resolve: mutationResolvers.batchSave,
      };
    }

    mutationFields[names.delete] = {
      type: new GraphQLNonNull(GraphQLDeleteResultType),
      args: idArg,
      resolve: mutationResolvers.delete,
    };
    mutationFields[names.batchDelete] = {
      type: new GraphQLNonNull(GraphQLDeleteResultType),
      args: {
        ids: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))) },
      },
      resolve: mutationResolvers.batchDelete,
    };
  }

  return new GraphQLSchema({
    types: [
      ...typeRegistry.allTypes(),
      ...filterRegistry.allTypes(),
      ...getSharedGraphQLFilterTypes(),
      GraphQLSortDirectionEnum,
      GraphQLBatchSaveResultType,
      GraphQLCountResultType,
      GraphQLDeleteResultType,
    ],
    query: new GraphQLObjectType({
      name: "Query",
      fields: queryFields,
    }),
    mutation: new GraphQLObjectType({
      name: "Mutation",
      fields: mutationFields,
    }),
  });
}
