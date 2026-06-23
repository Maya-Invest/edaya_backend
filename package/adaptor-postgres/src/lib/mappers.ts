/** DB row → constructor args (`null` becomes `undefined`). Pair with `new Entity(args)` so Zod runs on read. */
export function rowToConstructorArgs(row: Record<string, unknown>): Record<string, unknown> {
  const args: Record<string, unknown> = {}
  for (const key of Object.keys(row)) {
    args[key] = row[key] === null ? undefined : row[key]
  }
  return args
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/

export function deserializeJsonb(value: any): any {
  if (value === null || value === undefined) {
    return value
  }
  return JSON.parse(JSON.stringify(value), (_key, val) => {
    if (typeof val === 'string' && ISO_DATE_RE.test(val)) {
      const date = new Date(val)
      if (!Number.isNaN(date.getTime())) {
        return date
      }
    }
    return val
  })
}

export function createDefaultMappers<T extends { readonly id: string }>(
  Ctor: new (args: any) => T,
): {
  toRow: (entity: T) => any
  toDomain: (row: any) => T
} {
  return {
    toRow: (entity: T): any => {
      const row: any = {}
      const dataSource = (entity && typeof entity === 'object' && 'data' in entity && entity.data && typeof entity.data === 'object') ? entity.data : entity
      for (const key of Object.keys(dataSource)) {
        const val = (dataSource as any)[key]
        row[key] = val === undefined ? null : val
      }
      return row
    },
    toDomain: (row: any): T => new Ctor(rowToConstructorArgs(row)),
  }
}
