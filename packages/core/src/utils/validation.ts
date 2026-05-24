export class DomainValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DomainValidationError'
  }
}

export function requireNonBlank(value: string, fieldName: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new DomainValidationError(`${fieldName} must not be blank`)
  }
  return trimmed
}

export function requireOptionalNonBlank(
  value: string | null | undefined,
  fieldName: string,
): string | undefined {
  if (value == null) {
    return undefined
  }

  return requireNonBlank(value, fieldName)
}

export function requireNonNegativeNumber(value: number, fieldName: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new DomainValidationError(`${fieldName} must be a finite, non-negative number`)
  }
  return value
}

export function requirePositiveNumber(value: number, fieldName: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new DomainValidationError(`${fieldName} must be a finite, strictly positive number`)
  }
  return value
}

export function requireNonNegativeInt(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new DomainValidationError(`${fieldName} must be a non-negative integer`)
  }
  return value
}

export function requirePositiveInt(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new DomainValidationError(`${fieldName} must be a strictly positive integer`)
  }
  return value
}

export function requireValidDate(value: Date, fieldName: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new DomainValidationError(`${fieldName} must be a valid date`)
  }
  return value
}

export function requireTimeOfDay(value: string, fieldName: string): string {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new DomainValidationError(`${fieldName} must be a valid time in HH:mm format`)
  }
  return value
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
