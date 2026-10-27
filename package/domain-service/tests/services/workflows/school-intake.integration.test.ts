import { ActorAssuranceLevel, createGuardianActorMetadata, createStaffActorMetadata, createStudentActorMetadata, createTeacherActorMetadata } from '@edaya/authorization'
import { AcademicDiscipline, AcademicYear, ClassGroup, Guardian, Permission, StaffMember, StaffPermissionAssignment, Student, Subject, Teacher } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { createStudentTransitionContext } from './student-workflow-context'

describe('school intake profiles', () => {
  test('keeps school/national identifiers and the original name through unrelated edits and graduation', async () => {
    const { service, repositories } = await createStudentTransitionContext()
    await service.studentWorkflow.updateStudentProfile({ studentId: 'stu1', nationalMatricule: '001 234-A', sourceFullName: '  ADA  LOVELACE  ' })
    await service.studentWorkflow.updateStudentProfile({ studentId: 'stu1', nationality: 'IV' })
    const student = await repositories.students.findById('stu1')
    expect(student?.nationalMatricule).toBe('001 234-A')
    expect(student?.sourceFullName).toBe('  ADA  LOVELACE  ')
    expect(student?.matricule).toBeUndefined()
    await service.studentWorkflow.graduateStudent({ enrollmentId: 'enr1', effectiveAt: new Date('2026-06-30') })
    expect((await repositories.students.findById('stu1'))?.nationalMatricule).toBe('001 234-A')
  })

  test('catalogue codes are school-unique and immutable; inactive and used statuses are guarded', async () => {
    const { service } = await createStudentTransitionContext()
    const status = await service.academicsWorkflow.configurePlacementStatus({ id: 'aff', code: ' aff ', label: 'AFF' })
    expect(status.code).toBe('AFF')
    await expect(service.academicsWorkflow.configurePlacementStatus({ id: 'duplicate', code: 'Aff', label: 'Duplicate' })).rejects.toMatchObject({ code: 'CATALOGUE_CODE_TAKEN' })
    await expect(service.academicsWorkflow.configurePlacementStatus({ id: status.id, code: 'NEW', label: 'Changed' })).rejects.toMatchObject({ code: 'CATALOGUE_CODE_IMMUTABLE' })
    await service.academicsWorkflow.upsertStudentAcademicYearProfile({ studentId: 'stu1', academicYearId: 'ay1', placementStatusId: status.id, isRepeating: false })
    await expect(service.baseService.entities.placementStatuses.delete(status.id)).rejects.toMatchObject({ code: 'PLACEMENT_STATUS_IN_USE' })
    await service.academicsWorkflow.configurePlacementStatus({ id: status.id, code: status.code, label: 'Renamed', isActive: false })
    await service.academicsWorkflow.upsertStudentAcademicYearProfile({ studentId: 'stu1', academicYearId: 'ay1', isRepeating: true })
    await expect(service.academicsWorkflow.upsertStudentAcademicYearProfile({ studentId: 'stu1', academicYearId: 'ay2', placementStatusId: status.id })).rejects.toMatchObject({ code: 'PLACEMENT_STATUS_INACTIVE' })
  })

  test('annual upsert retains identity, explicit false, null clearing and year isolation', async () => {
    const { service, repositories } = await createStudentTransitionContext()
    const first = await service.academicsWorkflow.upsertStudentAcademicYearProfile({ studentId: 'stu1', academicYearId: 'ay1', isRepeating: true })
    const second = await service.academicsWorkflow.upsertStudentAcademicYearProfile({ studentId: 'stu1', academicYearId: 'ay1', isRepeating: false })
    expect(second.id).toBe(first.id)
    expect(second.isRepeating).toBe(false)
    const other = await service.academicsWorkflow.upsertStudentAcademicYearProfile({ studentId: 'stu1', academicYearId: 'ay2' })
    expect(other.isRepeating).toBeUndefined()
    const cleared = await service.academicsWorkflow.upsertStudentAcademicYearProfile({ studentId: 'stu1', academicYearId: 'ay1', isRepeating: null })
    expect(cleared.isRepeating).toBeUndefined()
    expect(await repositories.studentAcademicYearProfiles.count({ studentId: 'stu1', academicYearId: 'ay1' })).toBe(1)
    await service.academicsWorkflow.removeStudentAcademicYearProfile({ id: first.id })
    expect(await repositories.students.findById('stu1')).toBeDefined()
    expect(await repositories.enrollments.findById('enr1')).toBeDefined()
  })

  test('teacher declarations retain zero/unknown hours and catalogue references without assignments', async () => {
    const { service, repositories } = await createStudentTransitionContext()
    await repositories.teachers.save(new Teacher({ id: 'teacher', schoolId: 'sch1', firstName: 'Marie', lastName: 'Curie' }))
    const discipline = await service.academicsWorkflow.configureAcademicDiscipline({ id: 'science', code: 'SCI', name: 'Science' })
    const value = await service.academicsWorkflow.upsertTeacherAcademicYearProfile({ teacherId: 'teacher', academicYearId: 'ay1', disciplineIds: [discipline.id], declaredHours: 0 })
    expect(value.disciplineIds).toEqual([discipline.id])
    await expect(service.academicsWorkflow.upsertTeacherAcademicYearProfile({ teacherId: 'teacher', academicYearId: 'ay1', disciplineIds: [discipline.id, discipline.id] })).rejects.toBeDefined()
    expect(value.declaredHours).toBe(0)
    expect(value.hoursPeriod).toBe('unspecified')
    const updated = await service.academicsWorkflow.upsertTeacherAcademicYearProfile({ teacherId: 'teacher', academicYearId: 'ay1', declaredHours: 12.5 })
    expect(updated.disciplineIds).toEqual([discipline.id])
    expect(updated.id).toBe(value.id)
    expect(await repositories.teacherAssignments.count({ teacherId: 'teacher' })).toBe(0)
    await expect(service.baseService.entities.academicDisciplines.delete(discipline.id)).rejects.toMatchObject({ code: 'DISCIPLINE_IN_USE' })
    await expect(service.academicsWorkflow.upsertTeacherAcademicYearProfile({ teacherId: 'teacher', academicYearId: 'ay1', declaredHours: -1 })).rejects.toBeDefined()
  })

  test('rejects foreign person, year and discipline references', async () => {
    const { service, repositories } = await createStudentTransitionContext()
    await repositories.students.save(new Student({ id: 'foreign', schoolId: 'other', firstName: 'Test', lastName: 'Person' }))
    await repositories.academicYears.save(new AcademicYear({ id: 'foreign-year', schoolId: 'other', name: 'Foreign', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') }))
    await expect(service.academicsWorkflow.upsertStudentAcademicYearProfile({ studentId: 'foreign', academicYearId: 'ay1' })).rejects.toBeDefined()
    await expect(service.academicsWorkflow.upsertStudentAcademicYearProfile({ studentId: 'stu1', academicYearId: 'foreign-year' })).rejects.toBeDefined()
    await repositories.teachers.save(new Teacher({ id: 'teacher', schoolId: 'sch1', firstName: 'Test', lastName: 'Teacher' }))
    await repositories.academicDisciplines.save(new AcademicDiscipline({ id: 'foreign-discipline', schoolId: 'other', code: 'F', name: 'Foreign' }))
    await expect(service.academicsWorkflow.upsertTeacherAcademicYearProfile({ teacherId: 'teacher', academicYearId: 'ay1', disciplineIds: ['foreign-discipline'] })).rejects.toBeDefined()
  })

  test('guardian occupation and original name survive contact updates', async () => {
    const { service, repositories } = await createStudentTransitionContext()
    await repositories.guardians.save(new Guardian({ id: 'guardian', schoolId: 'sch1', firstName: 'Test', lastName: 'Guardian', occupation: 'Engineer', sourceFullName: '  ORIGINAL NAME ', phone: '001', alternativePhone: '002', smsNotificationsEnabled: false }))
    await service.studentWorkflow.updateGuardianProfile({ guardianId: 'guardian', firstName: 'Changed' })
    const guardian = await repositories.guardians.findById('guardian')
    expect(guardian?.occupation).toBe('Engineer')
    expect(guardian?.sourceFullName).toBe('  ORIGINAL NAME ')
    expect(guardian?.phone).toBe('+1')
    expect(guardian?.alternativePhone).toBe('+2')
    expect(guardian?.smsNotificationsEnabled).toBe(false)
  })
  test('subjects share the teacher catalogue and preserve unmapped legacy subjects', async () => {
    const { service, repositories } = await createStudentTransitionContext()
    const input = { id: 'new-subject', schoolId: 'sch1', academicYearId: 'ay1', gradeLevelId: 'grade1', name: 'Test subject' }
    await expect(service.academicsWorkflow.configureSubject(input)).rejects.toMatchObject({ code: 'SUBJECT_DISCIPLINE_REQUIRED' })
    const discipline = await service.academicsWorkflow.configureAcademicDiscipline({ id: 'discipline', code: 'TEST', name: 'Reviewed discipline' })
    await service.academicsWorkflow.configureSubject({ ...input, disciplineId: discipline.id })
    await expect(service.academicsWorkflow.updateSubject({ subjectId: input.id, disciplineId: null })).rejects.toMatchObject({ code: 'SUBJECT_DISCIPLINE_REQUIRED' })
    await repositories.teachers.save(new Teacher({ id: 'teacher', schoolId: 'sch1', firstName: 'Test', lastName: 'Teacher' }))
    await service.academicsWorkflow.upsertTeacherAcademicYearProfile({ teacherId: 'teacher', academicYearId: 'ay1', disciplineIds: [discipline.id] })
    await service.academicsWorkflow.configureAcademicDiscipline({ ...discipline.data, isActive: false })
    await service.academicsWorkflow.updateSubject({ subjectId: input.id, shortName: 'Short' })
    await service.academicsWorkflow.upsertTeacherAcademicYearProfile({ teacherId: 'teacher', academicYearId: 'ay1', declaredHours: 0.5 })
    await expect(service.academicsWorkflow.configureSubject({ ...input, id: 'another', disciplineId: discipline.id })).rejects.toMatchObject({ code: 'DISCIPLINE_INACTIVE' })
    await expect(service.baseService.entities.academicDisciplines.delete(discipline.id)).rejects.toMatchObject({ code: 'DISCIPLINE_IN_USE' })
    await repositories.subjects.save(new Subject({ ...input, id: 'legacy' }))
    await service.academicsWorkflow.updateSubject({ subjectId: 'legacy', name: 'Unrelated edit' })
    expect((await repositories.subjects.findById('legacy'))?.disciplineId).toBeUndefined()
  })

  test('serializes natural-key upserts and retains annual facts on transfer', async () => {
    const { service, repositories } = await createStudentTransitionContext()
    const profiles = await Promise.all([true, false, true].map(isRepeating => service.academicsWorkflow.upsertStudentAcademicYearProfile({ studentId: 'stu1', academicYearId: 'ay1', isRepeating })))
    expect(new Set(profiles.map(row => row.id)).size).toBe(1)
    expect(await repositories.studentAcademicYearProfiles.count()).toBe(1)
    await repositories.classGroups.save(new ClassGroup({ id: 'transfer-class', schoolId: 'sch1', academicYearId: 'ay1', gradeLevelId: 'grade1', name: 'Transfer class' }))
    await service.studentWorkflow.transferStudent({ enrollmentId: 'enr1', nextEnrollmentId: 'transferred', nextClassGroupId: 'transfer-class', effectiveAt: new Date('2026-01-15') })
    expect((await repositories.studentAcademicYearProfiles.findById(profiles[0]!.id))?.isRepeating).toBe(true)
    expect(await repositories.studentAcademicYearProfiles.count({ academicYearId: 'ay2' })).toBe(0)
  })

  test('scopes annual reads and writes before pagination and denies portals', async () => {
    const fixture = await createStudentTransitionContext()
    const { repositories, service, forActor } = fixture
    await repositories.students.save(new Student({ id: 'other', schoolId: 'sch1', firstName: 'Other', lastName: 'Student' }))
    for (const studentId of ['stu1', 'other']) await service.academicsWorkflow.upsertStudentAcademicYearProfile({ studentId, academicYearId: 'ay1', isRepeating: false })
    await repositories.staffMembers.save(new StaffMember({ id: 'scoped', schoolId: 'sch1', subjectId: 'scoped-user', firstName: 'Scoped', lastName: 'Staff' }))
    for (const permission of [Permission.STUDENT_READ, Permission.STUDENT_MANAGE]) await repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: `grant-${permission}`, staffId: 'scoped', schoolId: 'sch1', academicYearId: 'ay1', permission, scopes: [{ kind: 'student', studentId: 'stu1' }] }))
    const identity = { schoolId: 'sch1', subjectId: 'scoped-user', requestId: 'scoped', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Strong }
    const scoped = forActor(createStaffActorMetadata({ ...identity, staffMemberId: 'scoped' }))
    expect(await scoped.baseService.entities.studentAcademicYearProfiles.count()).toBe(1)
    expect((await scoped.baseService.entities.studentAcademicYearProfiles.list({ $limit: 1 }))[0]?.studentId).toBe('stu1')
    await expect(scoped.academicsWorkflow.upsertStudentAcademicYearProfile({ studentId: 'other', academicYearId: 'ay1', isRepeating: true })).rejects.toBeDefined()
    const hidden = await repositories.studentAcademicYearProfiles.findOne({ studentId: 'other' })
    expect(await scoped.baseService.entities.studentAcademicYearProfiles.findById(hidden!.id)).toBeUndefined()
    for (const actor of [createStudentActorMetadata({ ...identity, studentId: 'stu1' }), createGuardianActorMetadata({ ...identity, guardianId: 'guardian' }), createTeacherActorMetadata({ ...identity, teacherId: 'teacher' })]) {
      const portal = forActor(actor)
      await expect(portal.baseService.entities.studentAcademicYearProfiles.list()).rejects.toBeDefined()
      await expect(portal.baseService.entities.teacherAcademicYearProfiles.list()).rejects.toBeDefined()
    }
  })
})
