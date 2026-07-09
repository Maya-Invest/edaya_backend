import type { ZodError, ZodType } from 'zod'

import { z } from 'zod'

export class DomainValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DomainValidationError'
  }
}

export function normalizeDate(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

export function isSameDate(left: Date, right: Date): boolean {
  return (
    left.getUTCFullYear() === right.getUTCFullYear()
    && left.getUTCMonth() === right.getUTCMonth()
    && left.getUTCDate() === right.getUTCDate()
  )
}

export function roundTo2(value: number): number {
  return Math.round(value * 100) / 100
}

export function formatZodError(error: ZodError): string {
  return error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
}

/** Parse domain input through a Zod schema; throws `DomainValidationError` on failure. */
export function parseDomain<TSchema extends ZodType>(
  schema: TSchema,
  input: unknown,
): z.infer<TSchema> {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw new DomainValidationError(formatZodError(result.error))
  }
  return result.data
}

export function zodDate() {
  return z.preprocess(
    (val) => {
      if (val === null)
        return undefined
      if (typeof val === 'string') {
        const parsed = new Date(val)
        if (!Number.isNaN(parsed.getTime()))
          return parsed
      }
      return val
    },
    z.custom<Date>(val => val instanceof Date && !Number.isNaN(val.getTime()), {
      message: 'must be a valid date',
    }),
  )
}
