import type { z } from "@hono/zod-openapi";

export function getOpenApiSchemaName(schema: z.ZodTypeAny): string {
  let current: unknown = schema;

  while (current && typeof current === "object") {
    const def = (current as { _def?: Record<string, unknown> })._def;
    const openapi = def?.openapi as
      | { _internal?: { refId?: string }; metadata?: { refId?: string } }
      | undefined;

    const refId = openapi?._internal?.refId ?? openapi?.metadata?.refId;
    if (typeof refId === "string") {
      return refId;
    }

    if (typeof def?.innerType === "function") {
      current = (def.innerType as () => unknown)();
      continue;
    }

    if (typeof def?.getter === "function") {
      current = (def.getter as () => unknown)();
      continue;
    }

    if (def?.schema) {
      current = def.schema;
      continue;
    }

    break;
  }

  throw new Error("No OpenAPI schema name found on Zod schema");
}
