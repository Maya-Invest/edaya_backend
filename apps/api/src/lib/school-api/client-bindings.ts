import { coreCommands, coreEntities, coreQueries } from "@/lib/school-api/registry";
import { getOpenApiSchemaName } from "@/lib/school-api/schemas/schema-name";
import type { ClientBindingsDocument } from "@edaya/api-client/openapi-bindings";
import { CLIENT_BINDINGS_OPENAPI_EXTENSION } from "@edaya/api-client/openapi-bindings";

export { CLIENT_BINDINGS_OPENAPI_EXTENSION };

export function buildClientBindings(): ClientBindingsDocument {
  return {
    entities: Object.fromEntries(
      coreEntities.map((entity) => {
        return [
          entity.serviceName,
          {
            publicName: entity.publicName,
            schemaName: getOpenApiSchemaName(entity.responseSchema),
            allowDirectSave: entity.allowDirectSave,
          },
        ];
      }),
    ),
    commands: Object.fromEntries(
      coreCommands.map((command) => {
        return [
          command.methodName,
          {
            publicName: command.publicName,
            requestSchemaName: getOpenApiSchemaName(command.requestSchema),
            responseSchemaName: getOpenApiSchemaName(command.responseSchema),
          },
        ];
      }),
    ),
    queries: Object.fromEntries(
      coreQueries.map((query) => {
        return [
          query.methodName,
          {
            publicName: query.publicName,
            requestSchemaName: getOpenApiSchemaName(query.requestSchema),
            responseSchemaName: getOpenApiSchemaName(query.responseSchema),
          },
        ];
      }),
    ),
  };
}
