import type { Subject } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError } from '@edaya/core'
import { requireSubjectCategory } from '../../../../capabilities/academics/dataset-subject-categories'
import { subjectParticipationHooks } from '../../../../capabilities/subject-enrollment/mutation-hooks'
import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

export const subjectConfig: EntityConfigFactory<Subject> = ({ repositories, atomicExecution }) =>
  config({ repository: repositories.subjects, tenant: directSchoolTenant(), resource: 'subjects', writeLockGroup: 'academic-state', gates: { preSave: validateSubjectSave, preDelete: validateSubjectDelete }, hooks: subjectParticipationHooks, atomicExecution })

export async function validateSubjectSave(subject: Subject, existing: Subject | undefined, repositories: SchoolRepositories, policyCommand = false): Promise<void> {
  if (existing && subject.isOptional !== existing.isOptional && !policyCommand)
    throw new BusinessRuleViolationError('SUBJECT_POLICY_COMMAND_REQUIRED', 'Change optional status through the curriculum command with expected participation revisions')
  const [grade, year] = await Promise.all([
    repositories.gradeLevels.findById(subject.gradeLevelId),
    repositories.academicYears.findById(subject.academicYearId),
  ])
  if (!grade || !year || grade.schoolId !== subject.schoolId || year.schoolId !== subject.schoolId)
    denyResourceAccess()
  if (existing && (existing.schoolId !== subject.schoolId || existing.gradeLevelId !== subject.gradeLevelId || existing.academicYearId !== subject.academicYearId))
    throw new BusinessRuleViolationError('SUBJECT_IDENTITY_IMMUTABLE', 'A subject cannot move to another school, grade or academic year')
  if ((!existing || existing.disciplineId) && !subject.disciplineId)
    throw new BusinessRuleViolationError('SUBJECT_DISCIPLINE_REQUIRED', 'Select an academic discipline for new subjects')
  if (subject.disciplineId) {
    const discipline = await repositories.academicDisciplines.findById(subject.disciplineId)
    if (!discipline || discipline.schoolId !== subject.schoolId)
      denyResourceAccess()
    if (!discipline.isActive && existing?.disciplineId !== discipline.id)
      throw new BusinessRuleViolationError('DISCIPLINE_INACTIVE', 'Select an active academic discipline')
  }
  if (subject.reportModuleId) {
    const module = await repositories.reportModules.findById(subject.reportModuleId)
    if (!module || module.schoolId !== subject.schoolId || module.gradeLevelId !== subject.gradeLevelId || module.academicYearId !== subject.academicYearId)
      denyResourceAccess()
  }
  await requireSubjectCategory(repositories, subject.schoolId, subject.categoryId)
}

export async function validateSubjectDelete(subject: Subject, repositories: SchoolRepositories): Promise<void> {
  const [offerings, chapters] = await Promise.all([
    repositories.classSubjects.count({ subjectId: subject.id }),
    repositories.subjectMatters.count({ subjectId: subject.id }),
  ])
  if (offerings || chapters)
    throw new BusinessRuleViolationError('SUBJECT_HAS_DEPENDENCIES', 'Remove subject through the curriculum command after resolving its dependencies')
}
