import type { SchoolRepositories } from '../../ports/school-repositories'
import type { CommandExecution } from '../../services/commands/command-execution'
import { AcademicDiscipline, BusinessRuleViolationError, SubjectCategoryEntity, withShortName } from '@edaya/core'

/** A durable command receipt binds each technical dataset key to its server-assigned ID. */
export async function ensureDatasetCatalog(
  repositories: SchoolRepositories,
  commands: CommandExecution,
  schoolId: string,
  kind: 'subjectCategories' | 'academicDisciplines',
  definitions: readonly { code: string, name: string, shortName?: string }[],
  datasetId = 'local-fixture',
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  for (const definition of definitions) {
    const id = await commands.execute<string, { id: string }>({
      scope: { schoolId, command: 'bindDatasetCatalog', callerId: 'dataset-source', requestId: JSON.stringify([datasetId, kind, definition.code]) },
      input: { kind, sourceKey: definition.code },
      resultMode: 'ordinary',
      lockKeys: [`dataset-catalog:${JSON.stringify([schoolId, kind])}`],
      // Dataset application authorizes curriculum configuration before entering this helper.
      authorize: async () => {
        if (!await repositories.schools.findById(schoolId))
          throw new BusinessRuleViolationError('SCHOOL_NOT_FOUND', 'School does not exist')
      },
      replay: async ({ id }) => {
        const found = await repositories[kind].findById(id)
        if (!found || found.schoolId !== schoolId || ('isActive' in found && !found.isActive))
          throw new BusinessRuleViolationError('STRUCTURE_CATALOG_CONFLICT', 'The bound dataset record is missing or inactive')
        return id
      },
      execute: async () => {
        const input = withShortName({ id: crypto.randomUUID(), schoolId, name: definition.name, shortName: definition.shortName })
        if (kind === 'subjectCategories')
          await repositories.subjectCategories.save(new SubjectCategoryEntity(input))
        else
          await repositories.academicDisciplines.save(new AcademicDiscipline(input))
        return input.id
      },
      persistResult: id => ({ id }),
      audit: id => [{ event: 'catalog.dataset.bound', resourceType: kind, resourceId: id }],
    })
    result.set(definition.code, id)
  }
  return result
}

export async function ensureDatasetSubjectCategories(repositories: SchoolRepositories, schoolId: string, categories: readonly { code: string, name: string, shortName?: string }[], commands: CommandExecution, datasetId = 'local-fixture'): Promise<Map<string, string>> {
  return ensureDatasetCatalog(repositories, commands, schoolId, 'subjectCategories', categories, datasetId)
}

export async function requireSubjectCategory(repositories: SchoolRepositories, schoolId: string, categoryId: string): Promise<void> {
  const category = await repositories.subjectCategories.findById(categoryId)
  if (!category || category.schoolId !== schoolId)
    throw new BusinessRuleViolationError('SUBJECT_CATEGORY_NOT_FOUND', `Subject category ${categoryId} is not in this school`)
}
