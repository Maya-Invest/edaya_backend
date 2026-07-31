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
  listBySchool: () => Promise<readonly { id: string, code?: string }[]>
}): Promise<void> {
  if (!input.code) {
    return
  }

  const normalized = normalizePersonCode(input.code)
  const existing = await input.listBySchool()
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
