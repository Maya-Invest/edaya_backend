import type { AcademicDisciplineInput, PlacementStatusInput, StudentAcademicYearProfileInput, TeacherAcademicYearProfileInput } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { randomUUID } from 'node:crypto'
import { AcademicDiscipline, PlacementStatus, StudentAcademicYearProfile, TeacherAcademicYearProfile } from '@edaya/core'
import { academicStateLock } from '../../capabilities/academics/marks-state'

export type ConfigureAcademicDisciplineInput = Omit<AcademicDisciplineInput, 'schoolId' | 'createdAt' | 'updatedAt'>
export type ConfigurePlacementStatusInput = Omit<PlacementStatusInput, 'schoolId' | 'createdAt' | 'updatedAt'>
export type UpsertStudentAcademicYearProfileInput = Omit<StudentAcademicYearProfileInput, 'id' | 'schoolId' | 'createdAt' | 'updatedAt'>
export type UpsertTeacherAcademicYearProfileInput = Partial<Omit<TeacherAcademicYearProfileInput, 'id' | 'schoolId' | 'createdAt' | 'updatedAt'>> & Pick<TeacherAcademicYearProfileInput, 'teacherId' | 'academicYearId'>
export interface RemoveAcademicYearProfileInput { id: string }
function patch<T extends object>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as T
}
export async function configureAcademicDiscipline(base: BaseSchoolService, input: ConfigureAcademicDisciplineInput) {
  return base.atomicExecution.execute(async () => {
    const existing = await base.entities.academicDisciplines.findById(input.id)
    const record = new AcademicDiscipline({ ...existing?.data, ...patch(input), schoolId: base.actor.schoolId, updatedAt: new Date() })
    await base.entities.academicDisciplines.save(record)
    return record
  }, { lockKeys: [academicStateLock(base.actor.schoolId)] })
}
export async function configurePlacementStatus(base: BaseSchoolService, input: ConfigurePlacementStatusInput) {
  return base.atomicExecution.execute(async () => {
    const existing = await base.entities.placementStatuses.findById(input.id)
    const record = new PlacementStatus({ ...existing?.data, ...patch(input), schoolId: base.actor.schoolId, updatedAt: new Date() })
    await base.entities.placementStatuses.save(record)
    return record
  }, { lockKeys: [academicStateLock(base.actor.schoolId)] })
}
export async function upsertStudentAcademicYearProfile(base: BaseSchoolService, input: UpsertStudentAcademicYearProfileInput) {
  return base.atomicExecution.execute(async () => {
    const existing = await base.repositories.studentAcademicYearProfiles.forSchool!(base.actor.schoolId).findOne({ schoolId: base.actor.schoolId, studentId: input.studentId, academicYearId: input.academicYearId })
    const record = new StudentAcademicYearProfile({ ...existing?.data, ...patch(input), id: existing?.id ?? randomUUID(), schoolId: base.actor.schoolId, updatedAt: new Date() })
    await base.entities.studentAcademicYearProfiles.save(record)
    return record
  }, { lockKeys: [academicStateLock(base.actor.schoolId)] })
}
export async function upsertTeacherAcademicYearProfile(base: BaseSchoolService, input: UpsertTeacherAcademicYearProfileInput) {
  return base.atomicExecution.execute(async () => {
    const existing = await base.repositories.teacherAcademicYearProfiles.forSchool!(base.actor.schoolId).findOne({ schoolId: base.actor.schoolId, teacherId: input.teacherId, academicYearId: input.academicYearId })
    const record = new TeacherAcademicYearProfile({ ...existing?.data, ...patch(input), id: existing?.id ?? randomUUID(), schoolId: base.actor.schoolId, updatedAt: new Date() })
    await base.entities.teacherAcademicYearProfiles.save(record)
    return record
  }, { lockKeys: [academicStateLock(base.actor.schoolId)] })
}
export async function removeStudentAcademicYearProfile(base: BaseSchoolService, input: RemoveAcademicYearProfileInput) {
  return base.atomicExecution.execute(async () => {
    await base.entities.studentAcademicYearProfiles.delete(input.id)
    return { id: input.id }
  }, { lockKeys: [academicStateLock(base.actor.schoolId)] })
}
export async function removeTeacherAcademicYearProfile(base: BaseSchoolService, input: RemoveAcademicYearProfileInput) {
  return base.atomicExecution.execute(async () => {
    await base.entities.teacherAcademicYearProfiles.delete(input.id)
    return { id: input.id }
  }, { lockKeys: [academicStateLock(base.actor.schoolId)] })
}
