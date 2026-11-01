import type { AcademicDiscipline, PlacementStatus, StudentAcademicYearProfile, TeacherAcademicYearProfile } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError } from '@edaya/core'
import { placementProfileBillingHooks } from '../../../../capabilities/finance/auto-billing-hooks'
import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

async function validateCode(record: AcademicDiscipline | PlacementStatus, existing: AcademicDiscipline | PlacementStatus | undefined, records: readonly (AcademicDiscipline | PlacementStatus)[]) {
  if (existing && (record.schoolId !== existing.schoolId || record.code !== existing.code))
    throw new BusinessRuleViolationError('CATALOGUE_CODE_IMMUTABLE', 'Catalogue school and code cannot change')
  if (records.some(other => other.id !== record.id && other.code.toLowerCase() === record.code.toLowerCase()))
    throw new BusinessRuleViolationError('CATALOGUE_CODE_TAKEN', 'This code already exists in this school')
}

export const academicDisciplineConfig: EntityConfigFactory<AcademicDiscipline> = ({ repositories, atomicExecution }) => config({
  repository: repositories.academicDisciplines,
  tenant: directSchoolTenant(),
  resource: 'academicDisciplines',
  atomicExecution,
  writeLockGroup: 'academic-state',
  gates: {
    preSave: async (record, existing, repos) => { await validateCode(record, existing, await repos.academicDisciplines.list({ schoolId: record.schoolId })) },
    preDelete: async (record, repos) => {
      if (await repos.subjects.count({ disciplineId: record.id }) || (await repos.teacherAcademicYearProfiles.list({ schoolId: record.schoolId })).some(profile => profile.disciplineIds.includes(record.id)))
        throw new BusinessRuleViolationError('DISCIPLINE_IN_USE', 'Deactivate a discipline that is referenced by subjects or teachers')
    },
  },
})
export const placementStatusConfig: EntityConfigFactory<PlacementStatus> = ({ repositories, atomicExecution }) => config({
  repository: repositories.placementStatuses,
  tenant: directSchoolTenant(),
  resource: 'placementStatuses',
  atomicExecution,
  writeLockGroup: 'academic-state',
  gates: {
    preSave: async (record, existing, repos) => { await validateCode(record, existing, await repos.placementStatuses.list({ schoolId: record.schoolId })) },
    preDelete: async (record, repos) => {
      if (await repos.studentAcademicYearProfiles.count({ placementStatusId: record.id }) || (await repos.catalogServices.list({ schoolId: record.schoolId })).some(fee => fee.autoBilling.mode === 'matching' && fee.autoBilling.placementStatusIds?.includes(record.id)))
        throw new BusinessRuleViolationError('PLACEMENT_STATUS_IN_USE', 'Deactivate a placement status that is referenced by students')
    },
  },
})

async function validateYear(record: StudentAcademicYearProfile | TeacherAcademicYearProfile, existing: StudentAcademicYearProfile | TeacherAcademicYearProfile | undefined, repos: SchoolRepositories) {
  const year = await repos.academicYears.findById(record.academicYearId)
  if (!year || year.schoolId !== record.schoolId)
    denyResourceAccess()
  if (existing && (record.schoolId !== existing.schoolId || record.academicYearId !== existing.academicYearId || ('studentId' in record && 'studentId' in existing ? record.studentId !== existing.studentId : 'teacherId' in record && 'teacherId' in existing && record.teacherId !== existing.teacherId)))
    throw new BusinessRuleViolationError('ANNUAL_PROFILE_IDENTITY_IMMUTABLE', 'An annual profile cannot move between people, schools or years')
}
export const studentAcademicYearProfileConfig: EntityConfigFactory<StudentAcademicYearProfile> = context => config({
  repository: context.repositories.studentAcademicYearProfiles,
  tenant: directSchoolTenant(),
  resource: 'studentAcademicYearProfiles',
  atomicExecution: context.atomicExecution,
  writeLockGroup: 'academic-state',
  hooks: placementProfileBillingHooks(context),
  gates: { preSave: async (record, existing, repos) => {
    await validateYear(record, existing, repos)
    const student = await repos.students.findById(record.studentId)
    if (!student || student.schoolId !== record.schoolId)
      denyResourceAccess()
    const duplicate = await repos.studentAcademicYearProfiles.findOne({ schoolId: record.schoolId, studentId: record.studentId, academicYearId: record.academicYearId })
    if (duplicate && duplicate.id !== record.id)
      throw new BusinessRuleViolationError('ANNUAL_PROFILE_EXISTS', 'An annual profile already exists')
    if (record.placementStatusId) {
      const status = await repos.placementStatuses.findById(record.placementStatusId)
      if (!status || status.schoolId !== record.schoolId)
        denyResourceAccess()
      if (!status.isActive && existing?.placementStatusId !== status.id)
        throw new BusinessRuleViolationError('PLACEMENT_STATUS_INACTIVE', 'Select an active placement status')
    }
  } },
})
export const teacherAcademicYearProfileConfig: EntityConfigFactory<TeacherAcademicYearProfile> = ({ repositories, atomicExecution }) => config({
  repository: repositories.teacherAcademicYearProfiles,
  tenant: directSchoolTenant(),
  resource: 'teacherAcademicYearProfiles',
  atomicExecution,
  writeLockGroup: 'academic-state',
  gates: { preSave: async (record, existing, repos) => {
    await validateYear(record, existing, repos)
    const teacher = await repos.teachers.findById(record.teacherId)
    if (!teacher || teacher.schoolId !== record.schoolId)
      denyResourceAccess()
    const duplicate = await repos.teacherAcademicYearProfiles.findOne({ schoolId: record.schoolId, teacherId: record.teacherId, academicYearId: record.academicYearId })
    if (duplicate && duplicate.id !== record.id)
      throw new BusinessRuleViolationError('ANNUAL_PROFILE_EXISTS', 'An annual profile already exists')
    for (const id of record.disciplineIds) {
      const discipline = await repos.academicDisciplines.findById(id)
      if (!discipline || discipline.schoolId !== record.schoolId)
        denyResourceAccess()
      if (!discipline.isActive && !existing?.disciplineIds.includes(id))
        throw new BusinessRuleViolationError('DISCIPLINE_INACTIVE', 'Select active disciplines')
    }
  } },
})
