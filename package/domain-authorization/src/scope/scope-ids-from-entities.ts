/** Serializes opaque entity ids into a `scopeIds` clause (comma-separated single-segment paths). */
export function scopeIdsFromEntityIds(entityIds: readonly string[]): string {
  const unique = [...new Set(entityIds.map(id => id.trim()).filter(Boolean))]
  if (unique.length === 0) {
    return ''
  }
  return unique.join(',')
}
