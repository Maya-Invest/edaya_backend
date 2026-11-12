import { z } from 'zod'
import { BusinessRuleViolationError } from './business-rule-error'

export const HUMAN_IDENTIFIER_MAX_LENGTH = 20
export const SHORT_NAME_MAX_LENGTH = 32
export const HUMAN_IDENTIFIER_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/
export type HumanIdentifierGroup = 'students' | 'teachers' | 'guardians' | 'staff'

/** ASCII uppercasing deliberately does not transliterate non-ASCII letters. */
export function normalizeHumanIdentifier(value: string): string {
  return value.normalize('NFKC').trim().replace(/[a-z]/g, letter => letter.toUpperCase())
}

export const humanIdentifierSchema = z.string().transform(normalizeHumanIdentifier).pipe(
  z.string().min(1).max(HUMAN_IDENTIFIER_MAX_LENGTH).regex(HUMAN_IDENTIFIER_PATTERN),
)

export const optionalHumanIdentifierSchema = z.string().nullish().transform(value => value == null ? undefined : normalizeHumanIdentifier(value) || undefined).pipe(humanIdentifierSchema.optional())

const graphemes = new Intl.Segmenter('und', { granularity: 'grapheme' })
const forbiddenDisplayCharacters = /[\p{Cc}\p{Zl}\p{Zp}]/u
const horizontalWhitespace = /[\p{Zs}\t]+/gu

/** Reject controls before normalization, including tabs that would otherwise collapse. */
export function normalizeShortName(value: string): string {
  if (forbiddenDisplayCharacters.test(value)) {
    throw new BusinessRuleViolationError('SHORT_NAME_INVALID', 'Short name must not contain controls or line breaks')
  }
  return value.normalize('NFC').trim().replace(horizontalWhitespace, ' ')
}

export function shortNameLength(value: string): number {
  return Array.from(graphemes.segment(value)).length
}

export const shortNameSchema = z.string()
  .transform((value, context) => {
    if (forbiddenDisplayCharacters.test(value)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Short name must not contain controls or line breaks' })
      return z.NEVER
    }
    return normalizeShortName(value)
  })
  .refine(value => shortNameLength(value) >= 1 && shortNameLength(value) <= SHORT_NAME_MAX_LENGTH, 'Short name must contain 1–32 grapheme clusters')

/** Creation suggestion only: supplied short names must be validated, never truncated. */
export function suggestShortName(name: string, curated?: string): string {
  if (curated !== undefined && curated.trim())
    return shortNameSchema.parse(curated)
  const normalized = normalizeShortName(name)
  const suggestion = Array.from(graphemes.segment(normalized), item => item.segment)
    .slice(0, SHORT_NAME_MAX_LENGTH)
    .join('')
    .trim()
  return shortNameSchema.parse(suggestion)
}

/** Explicit write-time preparation; entity hydration must not generate display values. */
export function withShortName<T extends { name: string, shortName?: string | null }>(input: T): T & { shortName: string } {
  return { ...input, shortName: input.shortName?.trim() ? shortNameSchema.parse(input.shortName) : suggestShortName(input.name) }
}
