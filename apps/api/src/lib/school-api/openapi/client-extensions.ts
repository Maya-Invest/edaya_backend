import { permitsPublicSave } from "@/lib/school-api/public-operations";
import type { CoreCommandConfig, CoreEntityConfig, CoreQueryConfig } from "@/lib/school-api/registry";
import { getOpenApiSchemaName } from "@/lib/school-api/schemas/schema-name";

export const X_EDAYA_KIND = "x-edaya-kind";
export const X_EDAYA_ENTITY_KEY = "x-edaya-entity-key";
export const X_EDAYA_ENTITY_PUBLIC_NAME = "x-edaya-entity-public-name";
export const X_EDAYA_RESPONSE_SCHEMA = "x-edaya-response-schema";
export const X_EDAYA_ALLOW_DIRECT_SAVE = "x-edaya-allow-direct-save";
export const X_EDAYA_COMMAND_KEY = "x-edaya-command-key";
export const X_EDAYA_COMMAND_PUBLIC_NAME = "x-edaya-command-public-name";
export const X_EDAYA_REQUEST_SCHEMA = "x-edaya-request-schema";
export const X_EDAYA_QUERY_KEY = "x-edaya-query-key";
export const X_EDAYA_QUERY_PUBLIC_NAME = "x-edaya-query-public-name";
export const X_EDAYA_CLIENT_KEY = "x-edaya-client-key";
export const X_EDAYA_CLIENT_PATH = "x-edaya-client-path";
export const X_EDAYA_PATH_PARAMS = "x-edaya-path-params";
export const X_EDAYA_BASE_PATH = "x-edaya-base-path";
export const X_EDAYA_RESPONSE_IS_ARRAY = "x-edaya-response-is-array";

export type ClientRouteNamespace
  = | "auth"
    | "authorization"
    | "onboarding"
    | "files"
    | "serviceAccounts"
    | "platformUsers"
    | "s2sClients"
    | "public";

export type EntityRouteAction
  = | "list"
    | "one"
    | "count"
    | "get"
    | "save"
    | "delete"
    | "batchSave"
    | "batchDelete";

const ENTITY_ACTION_OPERATION_SUFFIX: Record<EntityRouteAction, string> = {
  list: "list",
  one: "one",
  count: "count",
  get: "get",
  save: "save",
  delete: "delete",
  batchSave: "batch-save",
  batchDelete: "batch-delete",
};

export function entityRouteOperation(
  entity: Pick<CoreEntityConfig, "serviceName" | "publicName" | "responseSchema" | "publicOperations">,
  action: EntityRouteAction,
): Record<string, unknown> {
  const operationId = `entities.${entity.serviceName}.${action}`;

  if (action !== "list") {
    return { operationId };
  }

  return {
    operationId,
    [X_EDAYA_KIND]: "entity",
    [X_EDAYA_ENTITY_KEY]: entity.serviceName,
    [X_EDAYA_ENTITY_PUBLIC_NAME]: entity.publicName,
    [X_EDAYA_RESPONSE_SCHEMA]: getOpenApiSchemaName(entity.responseSchema),
    [X_EDAYA_ALLOW_DIRECT_SAVE]: permitsPublicSave(entity.publicOperations),
    "x-edaya-public-operations": entity.publicOperations,
  };
}

export function entityRoutePathSegment(action: EntityRouteAction): string {
  return ENTITY_ACTION_OPERATION_SUFFIX[action];
}

export function commandRouteOperation(
  command: Pick<CoreCommandConfig, "methodName" | "publicName" | "requestSchema" | "responseSchema">,
): Record<string, unknown> {
  return {
    operationId: `commands.${command.methodName}`,
    [X_EDAYA_KIND]: "command",
    [X_EDAYA_COMMAND_KEY]: command.methodName,
    [X_EDAYA_COMMAND_PUBLIC_NAME]: command.publicName,
    [X_EDAYA_REQUEST_SCHEMA]: getOpenApiSchemaName(command.requestSchema),
    [X_EDAYA_RESPONSE_SCHEMA]: getOpenApiSchemaName(command.responseSchema),
  };
}

export function queryRouteOperation(
  query: Pick<CoreQueryConfig, "methodName" | "publicName" | "requestSchema" | "responseSchema">,
): Record<string, unknown> {
  return {
    operationId: `queries.${query.methodName}`,
    [X_EDAYA_KIND]: "query",
    [X_EDAYA_QUERY_KEY]: query.methodName,
    [X_EDAYA_QUERY_PUBLIC_NAME]: query.publicName,
    [X_EDAYA_REQUEST_SCHEMA]: getOpenApiSchemaName(query.requestSchema),
    [X_EDAYA_RESPONSE_SCHEMA]: getOpenApiSchemaName(query.responseSchema),
  };
}

export function clientRouteOperation(config: {
  namespace: ClientRouteNamespace;
  clientKey: string;
  path: string;
  responseSchemaName?: string;
  requestSchemaName?: string;
  pathParams?: string[];
  basePath?: "core" | "root";
  responseIsArray?: boolean;
}): Record<string, unknown> {
  return {
    operationId: `${config.namespace}.${config.clientKey}`,
    [X_EDAYA_KIND]: config.namespace,
    [X_EDAYA_CLIENT_KEY]: config.clientKey,
    [X_EDAYA_CLIENT_PATH]: config.path,
    ...(config.requestSchemaName ? { [X_EDAYA_REQUEST_SCHEMA]: config.requestSchemaName } : {}),
    ...(config.responseSchemaName ? { [X_EDAYA_RESPONSE_SCHEMA]: config.responseSchemaName } : {}),
    ...(config.pathParams?.length ? { [X_EDAYA_PATH_PARAMS]: config.pathParams } : {}),
    ...(config.basePath && config.basePath !== "core" ? { [X_EDAYA_BASE_PATH]: config.basePath } : {}),
    ...(config.responseIsArray ? { [X_EDAYA_RESPONSE_IS_ARRAY]: true } : {}),
  };
}
