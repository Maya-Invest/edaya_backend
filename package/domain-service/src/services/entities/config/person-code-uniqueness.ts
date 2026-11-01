import { BusinessRuleViolationError } from '@edaya/core'

export function normalizePersonCode(value: string): string {
  return value.trim().toLowerCase()
}

export async function assertUniquePersonCode(input: {
  code: string | undefined
  schoolId: string
  entityId: string
  errorCode: string
  entityLabel: string
  findCandidates: (code: string) => Promise<readonly { id: string, code?: string }[]>
}): Promise<void> {
  if (!input.code) {
    return
  }

  const normalized = normalizePersonCode(input.code)
  // Candidate narrowing must not replace the established trim/lowercase rule
  // with import matching's stronger Unicode compatibility normalization.
  const existing = await input.findCandidates(input.code)
  const conflict = existing.find((entry) => {
    if (entry.id === input.entityId || !entry.code) {
      return false
    }
    return normalizePersonCode(entry.code) === normalized
  })

  if (conflict) {
    throw new BusinessRuleViolationError(
      input.errorCode,
      `${input.entityLabel} code "${input.code}" is already used in this school`,
    )
  }
}
