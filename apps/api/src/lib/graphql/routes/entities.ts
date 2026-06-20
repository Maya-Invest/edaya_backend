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
import { appendGraphQLCommandFields } from "@/lib/graphql/routes/commands";
import { createEntityMutationResolvers, createEntityQueryResolvers } from "@/lib/graphql/routes/entity-resolvers";
import { appendGraphQLCoreQueryFields } from "@/lib/graphql/routes/queries";
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
import { GraphQLJSON } from "@/lib/graphql/scalars/json";

type GraphQLContext = Context<AppBindings>;

const idArg: GraphQLFieldConfigArgumentMap = {
  id: { type: new GraphQLNonNull(GraphQLString) },
};

function appendGraphQLEntityFields(
  queryFields: GraphQLFieldConfigMap<unknown, GraphQLContext>,
  mutationFields: GraphQLFieldConfigMap<unknown, GraphQLContext>,
  typeRegistry: GraphQLTypeRegistry,
  filterRegistry: GraphQLFilterTypeRegistry,
) {
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
}

/**
 * Registry-driven GraphQL mirror of `buildCoreRoutes()` (entities, queries, commands).
 * Manual routes (auth, onboarding, service accounts, effective grants) are excluded.
 */
export function buildGraphQLSchema(): GraphQLSchema {
  const typeRegistry = new GraphQLTypeRegistry();
  const filterRegistry = new GraphQLFilterTypeRegistry();
  const queryFields: GraphQLFieldConfigMap<unknown, GraphQLContext> = {};
  const mutationFields: GraphQLFieldConfigMap<unknown, GraphQLContext> = {};

  appendGraphQLEntityFields(queryFields, mutationFields, typeRegistry, filterRegistry);
  appendGraphQLCoreQueryFields(queryFields, typeRegistry);
  appendGraphQLCommandFields(mutationFields, typeRegistry);

  return new GraphQLSchema({
    types: [
      ...typeRegistry.allTypes(),
      ...filterRegistry.allTypes(),
      ...getSharedGraphQLFilterTypes(),
      GraphQLSortDirectionEnum,
      GraphQLBatchSaveResultType,
      GraphQLCountResultType,
      GraphQLDeleteResultType,
      GraphQLJSON,
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

/** @deprecated Use `buildGraphQLSchema()` */
export function buildGraphQLEntitySchema(): GraphQLSchema {
  return buildGraphQLSchema();
}
