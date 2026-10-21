import type { Subject } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError } from '@edaya/core'
import { requireSubjectCategory } from '../../../../capabilities/academics/ensure-default-subject-categories'
import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

export const subjectConfig: EntityConfigFactory<Subject> = ({ repositories, atomicExecution }) =>
  config({ repository: repositories.subjects, tenant: directSchoolTenant(), resource: 'subjects', writeLockGroup: 'academic-state', gates: { preSave: validateSubjectSave, preDelete: validateSubjectDelete }, atomicExecution })

export async function validateSubjectSave(subject: Subject, existing: Subject | undefined, repositories: SchoolRepositories): Promise<void> {
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
  await requireSubjectCategory(repositories, subject.schoolId, subject.categoryId)
}

export async function validateSubjectDelete(subject: Subject, repositories: SchoolRepositories): Promise<void> {
  const [offerings, chapters, sections] = await Promise.all([
    repositories.classSubjects.count({ subjectId: subject.id }),
    repositories.subjectMatters.count({ subjectId: subject.id }),
    repositories.sections.count({ subjectId: subject.id }),
  ])
  if (offerings || chapters || sections)
    throw new BusinessRuleViolationError('SUBJECT_HAS_DEPENDENCIES', 'Remove subject through the curriculum command after resolving its dependencies')
}
