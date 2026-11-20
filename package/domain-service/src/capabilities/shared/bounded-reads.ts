/** Bounded database predicates; empty input never becomes an unrestricted list. */
export async function loadInBatches<T>(ids: readonly string[], load: (ids: string[]) => Promise<T[]>): Promise<T[]> {
  const unique = [...new Set(ids)]
  const rows: T[] = []
  for (let start = 0; start < unique.length; start += 500) rows.push(...await load(unique.slice(start, start + 500)))
  return rows
}
export function groupByKey<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const value = key(row)
    const group = groups.get(value) ?? []
    group.push(row)
    groups.set(value, group)
  }
  return groups
}
