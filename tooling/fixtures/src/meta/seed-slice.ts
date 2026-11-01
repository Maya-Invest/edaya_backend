import type { FixtureDataset, FixtureDatasetEntities, FixtureDatasetExtensions } from '../datasets/types'
import { demoCiDataset } from '../datasets/demo-ci'
import { demoCiSchoolOwnerStaffId } from '../datasets/demo-ci/people'
import { DEV_AUTH_GUARDIAN_ACCOUNTS } from './dev-auth-fixtures'

export interface SeedSliceSelection {
  entities: readonly (keyof FixtureDatasetEntities)[]
  studentIds?: readonly string[]
  guardianIds?: readonly string[]
  staffIds?: readonly string[]
  /** When false, domain extensions are omitted. Structure slices keep them so period publication stays intact. */
  includeExtensions?: boolean
}

function filterById<T extends { id: string }>(
  rows: readonly T[] | undefined,
  ids: ReadonlySet<string> | undefined,
): readonly T[] | undefined {
  if (!rows || !ids) {
    return rows
  }
  return rows.filter(row => ids.has(row.id))
}

/** Copy of the seed dataset containing only the records a caller asked to persist. */
export function sliceSeedDataset(
  source: FixtureDataset,
  selection: SeedSliceSelection,
): FixtureDataset {
  const allowed = new Set(selection.entities)
  const studentIds = selection.studentIds ? new Set(selection.studentIds) : undefined
  const guardianIds = selection.guardianIds ? new Set(selection.guardianIds) : undefined
  const staffIds = selection.staffIds ? new Set(selection.staffIds) : undefined
  const entities: FixtureDatasetEntities = {}

  for (const key of allowed) {
    const value = source.entities[key]
    if (value !== undefined) {
      Object.assign(entities, { [key]: value })
    }
  }

  entities.students = filterById(entities.students, studentIds)
  entities.guardians = filterById(entities.guardians, guardianIds)
  entities.staffMembers = filterById(entities.staffMembers, staffIds)

  if (entities.enrollments && studentIds) {
    entities.enrollments = entities.enrollments.filter(enrollment => studentIds.has(enrollment.studentId))
  }
  if (entities.guardianLinks && (guardianIds || studentIds)) {
    entities.guardianLinks = entities.guardianLinks.filter(link =>
      (guardianIds ? guardianIds.has(link.guardianId) : true)
      && (studentIds ? studentIds.has(link.studentId) : true),
    )
  }

  const extensions: FixtureDatasetExtensions | undefined = selection.includeExtensions === false
    ? undefined
    : source.extensions

  return {
    purpose: source.purpose,
    schoolId: source.schoolId,
    entities,
    extensions,
  }
}

const ROUTE_ENTITIES = [
  'school',
  'academicYear',
  'academicPeriods',
  'gradeLevels',
  'periodDefinitions',
  'classGroups',
  'staffMembers',
  'students',
  'enrollments',
  'guardians',
  'guardianLinks',
] as const satisfies readonly (keyof FixtureDatasetEntities)[]

/** School, owner, and one guardian. Used by auth bootstrap tests. */
export function bootstrapSeedDataset(): FixtureDataset {
  return sliceSeedDataset(demoCiDataset, {
    entities: ['school', 'staffMembers', 'guardians'],
    staffIds: [demoCiSchoolOwnerStaffId],
    guardianIds: ['ci-g1'],
    includeExtensions: false,
  })
}

/** School structure plus auth-linked guardians and the students they link. */
export function routeSeedDataset(): FixtureDataset {
  const guardianIds = DEV_AUTH_GUARDIAN_ACCOUNTS.map(account => account.guardianId)
  const guardianIdSet = new Set<string>(guardianIds)
  const studentIds = (demoCiDataset.entities.guardianLinks ?? [])
    .filter(link => guardianIdSet.has(link.guardianId))
    .map(link => link.studentId)

  return sliceSeedDataset(demoCiDataset, {
    entities: ROUTE_ENTITIES,
    guardianIds,
    studentIds,
  })
}
