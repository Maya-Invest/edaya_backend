import { requireNonBlank, requireOptionalNonBlank } from '../utils'

export enum SchoolType {
  Primary = 'primary',
  Secondary = 'secondary',
  K12 = 'k12',
  Vocational = 'vocational',
  Other = 'other',
}

export interface SchoolArgs {
  id: string
  name: string
  timeZone: string
  type?: SchoolType | null
  country?: string | null
  city?: string | null
  createdAt?: Date
}

/**
 * Represents the primary educational institution entity.
 * Serves as the root boundary for all other domain entities.
 */
export class School {
  readonly id: string
  readonly name: string
  readonly timeZone: string
  readonly type?: SchoolType
  readonly country?: string
  readonly city?: string
  readonly createdAt: Date

  constructor({ id, name, timeZone, type, country, city, createdAt }: SchoolArgs) {
    this.id = requireNonBlank(id, 'id')
    this.name = requireNonBlank(name, 'name')
    this.timeZone = requireTimeZone(timeZone)
    this.type = type ?? undefined
    this.country = requireOptionalNonBlank(country, 'country')
    this.city = requireOptionalNonBlank(city, 'city')
    this.createdAt = createdAt ?? new Date()
  }

  get location(): string | undefined {
    const parts = [this.city, this.country].filter((value): value is string => Boolean(value))
    return parts.length > 0 ? parts.join(', ') : undefined
  }
}

function requireTimeZone(value: string): string {
  const timeZone = requireNonBlank(value, 'timeZone')
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format()
  }
  catch {
    throw new Error(`Invalid IANA time zone: ${timeZone}`)
  }
  return timeZone
}
