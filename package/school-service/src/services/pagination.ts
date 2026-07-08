export interface PaginationParams {
  limit?: number
  offset?: number
}

export function paginateSlice<T>(items: T[], pagination?: PaginationParams): T[] {
  if (!pagination) {
    return items
  }
  const { limit, offset = 0 } = pagination
  if (limit === undefined) {
    return items.slice(offset)
  }
  return items.slice(offset, offset + limit)
}
