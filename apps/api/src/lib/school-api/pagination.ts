export const DEFAULT_LIST_LIMIT = 50;

export const MAX_LIST_LIMIT = 500;

export function asListFilterRecord(filter: unknown): Record<string, unknown> {
  if (filter && typeof filter === "object" && !Array.isArray(filter)) {
    return { ...(filter as Record<string, unknown>) };
  }
  return {};
}

export function normalizeListFilter(filter: unknown): Record<string, unknown> {
  const next = asListFilterRecord(filter);
  const rawLimit = next.$limit;

  if (rawLimit === undefined || rawLimit === null) {
    next.$limit = DEFAULT_LIST_LIMIT;
    return next;
  }

  if (typeof rawLimit === "number" && Number.isFinite(rawLimit)) {
    next.$limit = Math.min(Math.max(1, Math.trunc(rawLimit)), MAX_LIST_LIMIT);
  }

  return next;
}
