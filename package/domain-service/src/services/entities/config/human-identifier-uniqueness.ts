import { BusinessRuleViolationError, normalizeHumanIdentifier } from '@edaya/core'

export function normalizeIdentifier(value: string): string {
  return normalizeHumanIdentifier(value)
}

export async function assertUniqueHumanIdentifier(input: {
  identifier: string | undefined
  schoolId: string
  entityId: string
  errorCode: string
  entityLabel: string
  findCandidates: (identifier: string) => Promise<readonly { id: string, identifier?: string }[]>
}): Promise<void> {
  if (!input.identifier) {
    return
  }

  const normalized = normalizeIdentifier(input.identifier)
  const existing = await input.findCandidates(input.identifier)
  const conflict = existing.find((entry) => {
    if (entry.id === input.entityId || !entry.identifier) {
      return false
    }
    return normalizeIdentifier(entry.identifier) === normalized
  })

  if (conflict) {
    throw new BusinessRuleViolationError(
      input.errorCode,
      'This identifier is unavailable',
      { field: 'identifier' },
    )
  }
}
