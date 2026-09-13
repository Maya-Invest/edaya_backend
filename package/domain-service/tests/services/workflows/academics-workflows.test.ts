import { AuthorizationError } from '@edaya/authorization'
import { AcademicYear, BusinessRuleViolationError, ClassGroup, ClassSubject, ClassSubjectMatter, ClassSubjectMatterStatus, ClassSubjectProgress, GradeLevel, LessonSession, Permission, StaffPermissionAssignment, Subject, SubjectCategory, SubjectColor, SubjectMatter } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { createTestApp } from '../../support/create-test-app'
import { createTestStaffActor } from '../../support/test-actor'

async function createContext({ existingProgress = false, matterCompletedPercentage = 0, matterList, owner = true }: { existingProgress?: boolean, matterCompletedPercentage?: number, matterList?: Array<{ id: string, completedPercentage: number }>, owner?: boolean } = {}) {
  const fixture = await createTestApp(createTestStaffActor('sch1', 'user1'), { owner })
  const repositories = fixture.schoolRepositories
  await repositories.academicYears.save(new AcademicYear({ id: 'ay1', schoolId: 'sch1', name: 'Year', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'published' }))
  await repositories.gradeLevels.save(new GradeLevel({ id: 'gl1', schoolId: 'sch1', name: 'Grade', label: 'G', order: 1 }))
  await repositories.classGroups.save(new ClassGroup({ id: 'cg1', schoolId: 'sch1', gradeLevelId: 'gl1', academicYearId: 'ay1', name: 'Class' }))
  for (const id of ['subj1', 'subj-math']) await repositories.subjects.save(new Subject({ id, schoolId: 'sch1', name: id }))
  await repositories.classSubjects.save(new ClassSubject({ id: 'cs1', classGroupId: 'cg1', subjectId: 'subj1', coefficient: 1, completedPercentage: 0 }))
  const matters = matterList ?? [{ id: 'csm1', completedPercentage: matterCompletedPercentage }, { id: 'other-matter', completedPercentage: 50 }]
  for (const matter of matters) {
    await repositories.subjectMatters.save(new SubjectMatter({ id: `sm-${matter.id}`, subjectId: 'subj1', name: matter.id, sequenceOrder: 1 }))
    await repositories.classSubjectMatters.save(new ClassSubjectMatter({ ...matter, classSubjectId: 'cs1', subjectMatterId: `sm-${matter.id}`, status: ClassSubjectMatterStatus.InProgress }))
  }
  await repositories.lessonSessions.save(new LessonSession({ id: 'sess1', schoolId: 'sch1', classGroupId: 'cg1', classSubjectId: 'cs1', displayLabel: 'Lesson', startsAt: new Date('2026-02-01T09:00:00Z'), endsAt: new Date('2026-02-01T10:00:00Z') }))
  if (existingProgress)
    await repositories.classSubjectProgress.save(new ClassSubjectProgress({ id: 'existing-progress', classSubjectMatterId: 'csm1', lessonSessionId: 'sess1', completedPercentage: 10 }))
  return { ...fixture, service: fixture.app, repositories }
}

describe('SchoolService academics workflows', () => {
  test('recordLessonSessionProgress records progress and updates aggregates through managed services', async () => {
    const { repositories, service } = await createContext()

    const result = await service.academicsWorkflow.recordLessonSessionProgress({
      id: 'csp1',
      classSubjectMatterId: 'csm1',
      lessonSessionId: 'sess1',
      completedPercentage: 100,
      notes: 'Completed',
      recordedAt: new Date('2026-02-01T10:00:00Z'),
    })

    expect(result.id).toBe('csp1')
    expect(result.completedPercentage).toBe(100)
    expect(result.recordedByStaffId).toBe('user1')
    expect((await repositories.classSubjectProgress.findById('csp1'))?.data).toEqual(result.data)
    expect(await repositories.classSubjectMatters.findById('csm1')).toMatchObject({
      completedPercentage: 100,
    })
    expect(await repositories.classSubjects.findById('cs1')).toMatchObject({
      completedPercentage: 75,
    })
  })

  test('recordLessonSessionProgress rejects duplicate progress records', async () => {
    const { service } = await createContext({ existingProgress: true })

    await expect(service.academicsWorkflow.recordLessonSessionProgress({
      id: 'csp1',
      classSubjectMatterId: 'csm1',
      lessonSessionId: 'sess1',
      completedPercentage: 100,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('recordLessonSessionProgress rounds class-subject aggregate across multiple matters', async () => {
    const { repositories, service } = await createContext({
      matterList: [
        { id: 'csm1', completedPercentage: 0 },
        { id: 'csm2', completedPercentage: 0 },
        { id: 'csm3', completedPercentage: 0 },
        { id: 'csm4', completedPercentage: 0 },
      ],
    })

    await service.academicsWorkflow.recordLessonSessionProgress({
      id: 'csp1',
      classSubjectMatterId: 'csm1',
      lessonSessionId: 'sess1',
      completedPercentage: 35,
    })

    expect(await repositories.classSubjects.findById('cs1')).toMatchObject({
      completedPercentage: 9,
    })
  })

  test('recordLessonSessionProgress rejects progress decreases', async () => {
    const { service } = await createContext({ matterCompletedPercentage: 80 })

    await expect(service.academicsWorkflow.recordLessonSessionProgress({
      id: 'csp1',
      classSubjectMatterId: 'csm1',
      lessonSessionId: 'sess1',
      completedPercentage: 60,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('configureSubject and configureSubjectMatter persist school curriculum entities', async () => {
    const { repositories, service } = await createContext()

    const subject = await service.academicsWorkflow.configureSubject({
      id: 'subj-math',
      schoolId: 'sch1',
      name: 'Mathematics',
      category: SubjectCategory.Scientific,
      color: SubjectColor.Sky,
    })
    expect(subject.name).toBe('Mathematics')
    expect((await repositories.subjects.findById(subject.id))?.data).toEqual(subject.data)

    const matter = await service.academicsWorkflow.configureSubjectMatter({
      id: 'sm-algebra',
      subjectId: 'subj-math',
      name: 'Algebra',
      sequenceOrder: 1,
    })
    expect(matter.name).toBe('Algebra')
    expect((await repositories.subjectMatters.findById(matter.id))?.data).toEqual(matter.data)
  })

  test('addCustomClassSubject and setClassSubjectOffered manage class offerings', async () => {
    const { repositories, service } = await createContext()

    const created = await service.academicsWorkflow.addCustomClassSubject({
      id: 'cs-custom',
      classGroupId: 'cg1',
      subjectId: 'subj-math',
      coefficient: 2,
    })
    expect(created.isOffered).toBe(true)

    const updated = await service.academicsWorkflow.setClassSubjectOffered({
      classSubjectId: 'cs1',
      isOffered: false,
    })
    expect(updated.isOffered).toBe(false)
    expect((await repositories.classSubjects.findById('cs1'))?.isOffered).toBe(false)
  })

  test('recordLessonSessionProgress rejects lesson sessions for another class subject', async () => {
    const { repositories, service } = await createContext()
    await repositories.classSubjects.save(new ClassSubject({ id: 'cs-other', classGroupId: 'cg1', subjectId: 'subj-math', coefficient: 1 }))
    const session = (await repositories.lessonSessions.findById('sess1'))!
    await repositories.lessonSessions.save(session.copyWith({ classSubjectId: 'cs-other' }))

    await expect(service.academicsWorkflow.recordLessonSessionProgress({
      id: 'csp1',
      classSubjectMatterId: 'csm1',
      lessonSessionId: 'sess1',
      completedPercentage: 100,
    })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('progress creation uses only its own action scope and immediately observes revocation', async () => {
    const { service, repositories } = await createContext({ owner: false })
    const input = { id: 'progress', classSubjectMatterId: 'csm1', lessonSessionId: 'sess1', completedPercentage: 40 }
    await repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'read', schoolId: 'sch1', academicYearId: 'ay1', staffId: 'user1', permission: Permission.CLASS_LOGBOOK_READ, scopes: [{ kind: 'class_group', classGroupId: 'cg1' }] }))
    await expect(service.academicsWorkflow.recordLessonSessionProgress(input)).rejects.toBeInstanceOf(AuthorizationError)
    await repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'create', schoolId: 'sch1', academicYearId: 'ay1', staffId: 'user1', permission: Permission.CLASS_LOGBOOK_CREATE, scopes: [{ kind: 'class_group', classGroupId: 'cg1' }] }))
    expect((await service.academicsWorkflow.recordLessonSessionProgress(input)).completedPercentage).toBe(40)
    await repositories.staffPermissionAssignments.delete('create')
    await expect(service.academicsWorkflow.recordLessonSessionProgress({ ...input, id: 'revoked', completedPercentage: 60 })).rejects.toBeInstanceOf(AuthorizationError)
    expect(await repositories.classSubjectProgress.count()).toBe(1)
  })

  test('a failed aggregate save rolls back the progress snapshot and matter update', async () => {
    const { service, repositories, failSaveOnAttempt } = await createContext()
    failSaveOnAttempt('classSubjectMatterRepository')
    await expect(service.academicsWorkflow.recordLessonSessionProgress({ id: 'progress', classSubjectMatterId: 'csm1', lessonSessionId: 'sess1', completedPercentage: 100 })).rejects.toThrow('Simulated')
    expect(await repositories.classSubjectProgress.count()).toBe(0)
    expect((await repositories.classSubjectMatters.findById('csm1'))?.completedPercentage).toBe(0)
    expect((await repositories.classSubjects.findById('cs1'))?.completedPercentage).toBe(0)
  })
})
