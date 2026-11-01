export function unwrapDomainEntity(entity: unknown): unknown {
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

export function serializeNestedEntities(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(serializeNestedEntities);
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    const unwrapped = unwrapDomainEntity(value);
    // Only domain instances are unwrapped; retain dates and plain data envelopes.
    return unwrapped === value ? value : serializeNestedEntities(unwrapped);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, serializeNestedEntities(nested)]),
  );
}
