import {
  executeEntityBatchDelete,
  executeEntityBatchSave,
  executeEntityCount,
  executeEntityDelete,
  executeEntityGet,
  executeEntityList,
  executeEntityOne,
  executeEntitySave,
} from "@/lib/school-api/entities/operations";
import type { CoreEntityConfig } from "@/lib/school-api/registry";
import { normalizeGraphQLFilter } from "@/lib/graphql/normalize-graphql-filter";
import { wrapResolver } from "@/lib/graphql/resolver-utils";

function normalizeFilterArgs(args: { filter?: unknown }) {
  return normalizeGraphQLFilter(args.filter);
}

export function createEntityQueryResolvers(entityConfig: CoreEntityConfig) {
  const { serviceName, displayName } = entityConfig;

  return {
    list: wrapResolver((context, args: { filter?: unknown }) =>
      executeEntityList(context.get("actor"), context.get("schoolApp"), serviceName, normalizeFilterArgs(args))),

    one: wrapResolver((context, args: { filter?: unknown }) =>
      executeEntityOne(context.get("actor"), context.get("schoolApp"), serviceName, displayName, normalizeFilterArgs(args))),

    count: wrapResolver(async (context, args: { filter?: unknown }) => {
      const count = await executeEntityCount(
        context.get("actor"),
        context.get("schoolApp"),
        serviceName,
        normalizeFilterArgs(args),
      );
      return { count };
    }),

    byId: wrapResolver((context, args: { id: string }) =>
      executeEntityGet(context.get("actor"), context.get("schoolApp"), serviceName, displayName, args.id)),
  };
}

export function createEntityMutationResolvers(entityConfig: CoreEntityConfig) {
  const { serviceName } = entityConfig;

  return {
    save: wrapResolver((context, args: { input: unknown }) =>
      executeEntitySave(context.get("actor"), context.get("schoolApp"), entityConfig, args.input)),

    delete: wrapResolver((context, args: { id: string }) =>
      executeEntityDelete(context.get("actor"), context.get("schoolApp"), serviceName, args.id)),

    batchSave: wrapResolver((context, args: { entities: unknown[] }) =>
      executeEntityBatchSave(context.get("actor"), context.get("schoolApp"), entityConfig, { entities: args.entities })),

    batchDelete: wrapResolver((context, args: { ids: string[] }) =>
      executeEntityBatchDelete(context.get("actor"), context.get("schoolApp"), serviceName, args.ids)),
  };
}
