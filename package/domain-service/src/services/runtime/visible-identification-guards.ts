import type { CoreEntityKey, HumanIdentifierGroup } from '@edaya/core'
import type { ManagedEntityServiceConfig } from '../entities/managed-entity-service'
import { BusinessRuleViolationError, shortNameSchema, suggestShortName } from '@edaya/core'

const named = new Set<CoreEntityKey>(['schools', 'gradeLevels', 'academicDisciplines', 'placementStatuses', 'subjectCategories', 'gradeScales', 'activities', 'disciplinaryActions', 'resources', 'staffPermissionProfiles', 'academicYears', 'classGroups', 'academicPeriods', 'periodDefinitions', 'subjects', 'reportModules', 'subjectMatters', 'catalogServices'])
const groups: Partial<Record<CoreEntityKey, HumanIdentifierGroup>> = { students: 'students', teachers: 'teachers', guardians: 'guardians', staffMembers: 'staff' }
interface VisibleEntity { id: string, schoolId: string, identifier?: string, accountKind?: string, data: { name?: string, shortName?: string }, copyWith: (data: Record<string, unknown>) => unknown }

export function withVisibleIdentification<T>(key: CoreEntityKey, config: ManagedEntityServiceConfig<T>): ManagedEntityServiceConfig<T> {
  const group = groups[key]
  if (named.has(key)) {
    config.prepareSave = (value, previous) => {
      const entity = value as VisibleEntity
      const before = previous as VisibleEntity | undefined
      const shortName = entity.data.shortName === undefined ? before?.data.shortName ?? suggestShortName(entity.data.name!) : shortNameSchema.parse(entity.data.shortName)
      return entity.copyWith({ shortName }) as T
    }
  }
  if (!group)
    return config
  const gates = config.gates
  return { ...config, gates: { ...gates, preSave: async (value, previous, repositories) => {
    const entity = value as VisibleEntity
    if (entity.accountKind === 'service' && entity.identifier !== undefined)
      throw new BusinessRuleViolationError('SERVICE_ACCOUNT_IDENTIFIER_FORBIDDEN', 'Service accounts use name and short name')
    if (key === 'students' && entity.identifier) {
      const student = await repositories.students.findOne({ schoolId: entity.schoolId, identifier: entity.identifier })
      if (student && student.id !== entity.id)
        throw new BusinessRuleViolationError('IDENTIFIER_UNAVAILABLE', 'This identifier is unavailable', { field: 'identifier' })
    }
    await gates?.preSave?.(value, previous, repositories)
  } } }
}
