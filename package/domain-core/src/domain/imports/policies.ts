import type { ImportCell, ImportExistingMode, ImportRecord } from './contracts'
import { BusinessRuleViolationError } from '../shared/business-rule-error'

export function isBlankImportValue(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && !value.trim())
}
export function resolveImportExistingMode(value: ImportCell | undefined, fallback: ImportExistingMode = 'M'): ImportExistingMode {
  if (isBlankImportValue(value))
    return fallback
  const normalized = String(value).trim().toUpperCase()
  if (normalized === 'S' || normalized === 'M' || normalized === 'O')
    return normalized
  throw new BusinessRuleViolationError('IMPORT_ON_EXISTING_INVALID', 'on_existing must be S, M or O')
}
/** Missing columns preserve, including in O. false and zero are never blanks. */
export function applyImportScalars(current: ImportRecord, supplied: ImportRecord, mode: ImportExistingMode, nullable: ReadonlySet<string>): ImportRecord {
  if (mode === 'S')
    return { ...current }
  const result = { ...current }
  for (const [key, value] of Object.entries(supplied)) {
    if (isBlankImportValue(value)) {
      if (mode === 'M')
        continue
      if (!nullable.has(key))
        throw new BusinessRuleViolationError('IMPORT_REQUIRED_BLANK', `Required field ${key} cannot be cleared`)
      result[key] = null
    }
    else {
      result[key] = value
    }
  }
  return result
}
/** Keyed union, with explicitly supplied child values taking precedence. */
export function applyImportCollection<T>(current: readonly T[], incoming: readonly T[] | undefined, mode: ImportExistingMode, complete: boolean, key: (item: T) => string): T[] {
  if (incoming === undefined || mode === 'S')
    return [...current]
  const values = new Map((mode === 'O' && complete ? [] : current).map(item => [key(item), item]))
  for (const item of incoming)
    values.set(key(item), item)
  return [...values.values()]
}
export function normalizeImportKey(value: unknown): string {
  return String(value ?? '').trim().normalize('NFKC').toLocaleLowerCase('en-US')
}
export function normalizeImportHeader(value: string): string {
  return value.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[\s-]+/g, '_').toLowerCase()
}
/** ISO civil dates only; Date.parse alone accepts impossible dates by rolling forward. */
export function parseImportDate(value: ImportCell, birthDate = false, today = new Date()): string {
  const text = String(value).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text))
    throw new BusinessRuleViolationError('IMPORT_DATE_FORMAT', 'Use YYYY-MM-DD')
  const date = new Date(`${text}T00:00:00.000Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== text)
    throw new BusinessRuleViolationError('IMPORT_DATE_INVALID', 'Date does not exist')
  if (birthDate && text > today.toISOString().slice(0, 10))
    throw new BusinessRuleViolationError('IMPORT_BIRTH_DATE_FUTURE', 'Birth date cannot be in the future')
  return text
}
