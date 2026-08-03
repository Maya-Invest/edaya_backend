import { structureGradeLevelSeedId } from './seed-ids'

/** Same prefixes as the webapp import / manual class creation (`next-class-id.ts`). */
export const GRADE_LEVEL_CLASS_ID_PREFIX: Record<string, string> = {
  'gl-6': '6',
  'gl-5': '5',
  'gl-4': '4',
  'gl-3': '3',
  'gl-2nda': '2nda',
  'gl-2': '2',
  'gl-1era': '1era',
  'gl-1': '1st',
  'gl-1erd': '1erd',
  'gl-tlea': 'tlea',
  'gl-t': 'term',
  'gl-tled': 'tled',
}

function classIdForIndex(prefix: string, index: number): string {
  return index === 0 && prefix === '2' ? '2nd' : `${prefix}${String.fromCharCode(97 + index)}`
}

/**
 * Next mnemonic class group id for onboarding (`6a`, `2nd`, `clsc`, …).
 * `gradeLevelSeedId` is `gl-6`, `gl-t`, etc. (from {@link structureGradeLevelSeedId}).
 */
export function nextClassGroupIdForGradeSeed(
  gradeLevelSeedId: string,
  takenIds: ReadonlySet<string>,
  siblingCountByGrade: Map<string, number>,
): string {
  const prefix = GRADE_LEVEL_CLASS_ID_PREFIX[gradeLevelSeedId] ?? 'cls'
  let index = siblingCountByGrade.get(gradeLevelSeedId) ?? 0
  let id = classIdForIndex(prefix, index)

  while (takenIds.has(id)) {
    index += 1
    id = classIdForIndex(prefix, index)
  }

  siblingCountByGrade.set(gradeLevelSeedId, index + 1)
  return id
}

export function nextOnboardingClassGroupId(
  templateGradeLevelId: string,
  takenIds: ReadonlySet<string>,
  siblingCountByGrade: Map<string, number>,
): string {
  return nextClassGroupIdForGradeSeed(
    structureGradeLevelSeedId(templateGradeLevelId),
    takenIds,
    siblingCountByGrade,
  )
}
