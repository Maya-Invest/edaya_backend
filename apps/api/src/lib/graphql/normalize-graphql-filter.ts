const FILTER_OPERATOR_KEYS = ["eq", "ne", "in", "nin", "exists", "gt", "gte", "lt", "lte"] as const;

const GRAPHQL_TO_REPO_KEY: Record<string, string> = {
  and: "$and",
  or: "$or",
  not: "$not",
  orderBy: "$orderBy",
  limit: "$limit",
  offset: "$offset",
};

function normalizeFieldFilter(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const object = value as Record<string, unknown>;
  const hasOperator = FILTER_OPERATOR_KEYS.some(key => key in object);
  if (!hasOperator) {
    return value;
  }

  const normalized: Record<string, unknown> = {};
  for (const key of FILTER_OPERATOR_KEYS) {
    if (object[key] !== undefined) {
      normalized[`$${key}`] = object[key];
    }
  }
  return normalized;
}

/**
 * Maps GraphQL filter input (camelCase, no $ prefix) to repository query options.
 */
export function normalizeGraphQLFilter(filter: unknown): Record<string, unknown> {
  if (!filter || typeof filter !== "object" || Array.isArray(filter)) {
    return {};
  }

  const input = filter as Record<string, unknown>;
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) {
      continue;
    }

    const repoKey = GRAPHQL_TO_REPO_KEY[key];
    if (repoKey) {
      if (key === "and" || key === "or") {
        output[repoKey] = Array.isArray(value)
          ? value.map(entry => normalizeGraphQLFilter(entry))
          : value;
      }
      else if (key === "not") {
        output[repoKey] = normalizeGraphQLFilter(value);
      }
      else {
        output[repoKey] = value;
      }
      continue;
    }

    output[key] = normalizeFieldFilter(value);
  }

  return output;
}
