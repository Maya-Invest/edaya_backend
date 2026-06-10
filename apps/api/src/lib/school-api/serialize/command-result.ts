function unwrapDomainEntity(entity: unknown): unknown {
  if (
    entity
    && typeof entity === "object"
    && "data" in entity
    && entity.data
    && typeof entity.data === "object"
  ) {
    return entity.data;
  }

  return entity;
}

export function serializeCommandResult(result: unknown): unknown {
  if (!result || typeof result !== "object") {
    return result;
  }

  if ("kind" in result && "entity" in result) {
    return {
      kind: result.kind,
      entity: unwrapDomainEntity(result.entity),
    };
  }

  return unwrapDomainEntity(result);
}
