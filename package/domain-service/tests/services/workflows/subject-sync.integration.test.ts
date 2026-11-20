import { AcademicDiscipline, AcademicYear, ClassGroup, ClassSubject, ClassSubjectProgress, GradeLevel, LessonSession, Subject, SubjectColor, withShortName } from '@edaya/core'
import { describe, expect, it } from 'bun:test'
import { createCurriculumTestApp as createTestApp } from '../../support/create-test-app'
import { createTestStaffActor } from '../../support/test-actor'

async function createContext(owner = true) {
  const fixture = await createTestApp(createTestStaffActor('sch1', 'user1'), { owner })
  const repositories = fixture.schoolRepositories
  await repositories.academicDisciplines.save(new AcademicDiscipline(withShortName({ id: 'test-discipline', schoolId: 'sch1', shortName: 'TEST', name: 'Test discipline' })))
  await repositories.academicYears.save(new AcademicYear(withShortName({ id: 'ay1', schoolId: 'sch1', name: 'Year', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'published' })))
  await repositories.gradeLevels.save(new GradeLevel(withShortName({ id: 'gl-6', schoolId: 'sch1', name: '6', shortName: '6', order: 6 })))
  return { service: fixture.app, repositories }
}

async function createWorkloadContext(owner = true) {
  const context = await createContext(owner)
  const { repositories } = context
  await repositories.subjects.save(new Subject(withShortName({ categoryId: 'test-category', id: 'subj-math', schoolId: 'sch1', gradeLevelId: 'gl-6', academicYearId: 'ay1', name: 'Math', shortName: 'MATH', coefficient: 2, periodsPerWeek: 3, minPeriodSpan: 1, maxPeriodSpan: 2 })))
  for (const id of ['6a', '6b']) {
    await repositories.classGroups.save(new ClassGroup(withShortName({ id, schoolId: 'sch1', academicYearId: 'ay1', gradeLevelId: 'gl-6', name: id })))
    await repositories.classSubjects.save(new ClassSubject({ id: `cs-${id}`, classGroupId: id, subjectId: 'subj-math', periodsPerWeek: 3, minPeriodSpan: 1, maxPeriodSpan: 2, completedPercentage: 25, isOffered: id === '6a' }))
  }
  await repositories.gradeLevels.save(new GradeLevel(withShortName({ id: 'gl-5', schoolId: 'sch1', name: '5', shortName: '5', order: 5 })))
  await repositories.subjects.save(new Subject(withShortName({ categoryId: 'test-category', id: 'other-math', schoolId: 'sch1', name: 'Math', gradeLevelId: 'gl-5', academicYearId: 'ay1', periodsPerWeek: 7 })))
  return context
}

describe('subject inheritance through native policies', () => {
  it('saves subject details and shared workload together, preserving class state and other allocations', async () => {
    const { service, repositories } = await createWorkloadContext()
    await service.academicsWorkflow.updateSubject({ subjectId: 'subj-math', name: 'Mathematics', color: SubjectColor.Sky, periodsPerWeek: 5, minPeriodSpan: 2, maxPeriodSpan: 3 })
    const subject = await repositories.subjects.findById('subj-math')
    expect(subject?.name).toBe('Mathematics')
    expect(subject?.color).toBe(SubjectColor.Sky)
    expect(subject?.shortName).toBe('MATH')
    expect(subject?.coefficient).toBe(2)
    expect((await repositories.subjects.findById('subj-math'))?.periodsPerWeek).toBe(5)
    expect((await repositories.subjects.findById('other-math'))?.periodsPerWeek).toBe(7)
    for (const id of ['6a', '6b']) {
      const row = await repositories.classSubjects.findById(`cs-${id}`)
      expect(row?.periodsPerWeek).toBe(5)
      expect(row?.minPeriodSpan).toBe(2)
      expect(row?.maxPeriodSpan).toBe(3)
      expect(row?.completedPercentage).toBe(0)
      expect(row?.isOffered).toBe(id === '6a')
    }
    await service.setupWorkflow.createClassGroup({ id: '6c', schoolId: 'sch1', academicYearId: 'ay1', gradeLevelId: 'gl-6', name: '6C' })
    const inherited = await repositories.classSubjects.findOne({ classGroupId: '6c' })
    expect(inherited?.periodsPerWeek).toBe(5)
    expect(inherited?.minPeriodSpan).toBe(2)
    expect(inherited?.maxPeriodSpan).toBe(3)
  })

  it('preserves omitted workload fields and clears explicitly null settings on the subject and classes', async () => {
    const { service, repositories } = await createWorkloadContext()
    await service.academicsWorkflow.updateSubject({ subjectId: 'subj-math', name: 'Maths' })
    expect((await repositories.classSubjects.findById('cs-6a'))?.periodsPerWeek).toBe(3)
    await service.academicsWorkflow.updateSubject({ subjectId: 'subj-math', periodsPerWeek: null, minPeriodSpan: null, maxPeriodSpan: null })
    for (const row of [await repositories.subjects.findById('subj-math'), ...await repositories.classSubjects.list({ subjectId: 'subj-math' })]) {
      expect(row?.periodsPerWeek).toBeUndefined()
      expect(row?.minPeriodSpan).toBeUndefined()
      expect(row?.maxPeriodSpan).toBeUndefined()
    }
  })

  it('rejects invalid workload and rolls back workload when the combined metadata save fails', async () => {
    const { service, repositories } = await createWorkloadContext()
    for (const changes of [{ periodsPerWeek: 0 }, { periodsPerWeek: 1.5 }, { minPeriodSpan: 3, maxPeriodSpan: 1 }, { minPeriodSpan: 3 }]) {
      await expect(service.academicsWorkflow.updateSubject({ subjectId: 'subj-math', name: 'Changed', ...changes })).rejects.toThrow()
    }
    await expect(service.academicsWorkflow.updateSubject({ subjectId: 'subj-math', categoryId: 'missing-category', periodsPerWeek: 5 })).rejects.toThrow()
    const classSubject = (await repositories.classSubjects.findById('cs-6b'))!
    await repositories.classSubjects.save(new ClassSubject({ ...classSubject.data, minPeriodSpan: 2 }))
    await expect(service.academicsWorkflow.updateSubject({ subjectId: 'subj-math', name: 'Changed', maxPeriodSpan: 1 })).rejects.toThrow()
    expect((await repositories.subjects.findById('subj-math'))?.name).toBe('Math')
    expect((await repositories.subjects.findById('subj-math'))?.periodsPerWeek).toBe(3)
    expect((await repositories.classSubjects.findById('cs-6a'))?.periodsPerWeek).toBe(3)
    expect((await repositories.classSubjects.findById('cs-6a'))?.maxPeriodSpan).toBe(2)
  })

  it('denies a combined workload save without curriculum permissions', async () => {
    const { service, repositories } = await createWorkloadContext(false)
    await expect(service.academicsWorkflow.updateSubject({ subjectId: 'subj-math', name: 'Changed', periodsPerWeek: 5 })).rejects.toThrow()
    expect((await repositories.subjects.findById('subj-math'))?.name).toBe('Math')
    expect((await repositories.subjects.findById('subj-math'))?.periodsPerWeek).toBe(3)
  })

  it('creates subjects and chapters before classes, then mirrors them without resetting progress', async () => {
    const { service, repositories } = await createContext()
    await service.academicsWorkflow.configureSubject({ categoryId: 'test-category', disciplineId: 'test-discipline', id: 'subj-math', schoolId: 'sch1', gradeLevelId: 'gl-6', academicYearId: 'ay1', name: 'Math', coefficient: 2.5, periodsPerWeek: 5 })
    await service.academicsWorkflow.configureSubjectMatter({ id: 'chapter', subjectId: 'subj-math', name: 'Algebra', sequenceOrder: 1 })
    expect(await repositories.classSubjects.count()).toBe(0)
    for (const id of ['6a', '6b'])
      await service.setupWorkflow.createClassGroup({ id, schoolId: 'sch1', academicYearId: 'ay1', gradeLevelId: 'gl-6', name: id })
    const offerings = await repositories.classSubjects.list({ subjectId: 'subj-math' })
    expect(offerings).toHaveLength(2)
    expect(offerings.every(row => row.coefficient === 2.5 && row.periodsPerWeek === 5 && row.isOffered)).toBe(true)
    const chapterA = (await repositories.classSubjectMatters.findOne({ classSubjectId: offerings[0]!.id }))!
    await repositories.lessonSessions.save(new LessonSession({ id: 'algebra-lesson', schoolId: 'sch1', classGroupId: offerings[0]!.classGroupId, classSubjectId: chapterA.classSubjectId, displayLabel: 'Math', startsAt: new Date('2026-02-12T09:00:00Z'), endsAt: new Date('2026-02-12T10:00:00Z') }))
    await repositories.classSubjectProgress.save(new ClassSubjectProgress({ id: 'covered', lessonSessionId: 'algebra-lesson', classSubjectMatterId: chapterA.id, completed: false }))
    await service.academicsWorkflow.configureSubjectMatter({ id: 'chapter', subjectId: 'subj-math', name: 'Algebra updated', sequenceOrder: 2 })
    await service.academicsWorkflow.syncSubjectsToClassGroup('6a')
    expect(await repositories.classSubjects.count()).toBe(2)
    expect(await repositories.classSubjectMatters.count()).toBe(2)
    expect((await repositories.classSubjectMatters.findById(chapterA.id))?.completedPercentage).toBe(50)
    expect((await repositories.classSubjectMatters.findOne({ classSubjectId: offerings[1]!.id }))?.completedPercentage).toBe(0)
  })

  it('keeps same-name subjects independent within and across grades and years', async () => {
    const { service, repositories } = await createContext()
    await repositories.gradeLevels.save(new GradeLevel(withShortName({ id: 'gl-5', schoolId: 'sch1', name: '5', shortName: '5', order: 5 })))
    await repositories.academicYears.save(new AcademicYear(withShortName({ id: 'ay2', schoolId: 'sch1', name: 'Next year', startDate: new Date('2027-01-01'), endDate: new Date('2027-12-31'), status: 'draft' })))
    for (const [id, gradeLevelId, academicYearId] of [['first', 'gl-6', 'ay1'], ['second', 'gl-6', 'ay1'], ['other-grade', 'gl-5', 'ay1'], ['other-year', 'gl-6', 'ay2']] as const)
      await service.academicsWorkflow.configureSubject({ categoryId: 'test-category', disciplineId: 'test-discipline', id, schoolId: 'sch1', gradeLevelId, academicYearId, name: 'Math' })
    await service.setupWorkflow.createClassGroup({ id: '6a', schoolId: 'sch1', academicYearId: 'ay1', gradeLevelId: 'gl-6', name: '6A' })
    expect((await repositories.classSubjects.list()).map(row => row.subjectId).sort()).toEqual(['first', 'second'])
    await service.academicsWorkflow.updateSubject({ subjectId: 'first', name: 'Mathematics' })
    expect((await repositories.subjects.findById('second'))?.name).toBe('Math')
    await expect(service.academicsWorkflow.configureSubject({ categoryId: 'test-category', disciplineId: 'test-discipline', id: 'first', schoolId: 'sch1', gradeLevelId: 'gl-5', academicYearId: 'ay1', name: 'Math' })).rejects.toThrow()
  })

  it('defaults optional offerings to disabled and preserves per-class toggles on metadata changes', async () => {
    const { service, repositories } = await createContext()
    await service.academicsWorkflow.configureSubject({ categoryId: 'test-category', disciplineId: 'test-discipline', id: 'optional', schoolId: 'sch1', gradeLevelId: 'gl-6', academicYearId: 'ay1', name: 'German', isOptional: true })
    await service.setupWorkflow.createClassGroup({ id: '6a', schoolId: 'sch1', academicYearId: 'ay1', gradeLevelId: 'gl-6', name: '6A' })
    const offering = (await repositories.classSubjects.findOne({ subjectId: 'optional' }))!
    expect(offering.isOffered).toBe(false)
    await service.academicsWorkflow.setClassSubjectOffered({ classSubjectId: offering.id, expectedParticipationRevision: offering.participationRevision, isOffered: true })
    await service.academicsWorkflow.updateSubject({ subjectId: 'optional', coefficient: 2 })
    expect((await repositories.classSubjects.findById(offering.id))?.isOffered).toBe(true)
    await service.academicsWorkflow.configureClassSubjectTimetable({ classSubjectId: offering.id, periodsPerWeek: 4, minPeriodSpan: 1, maxPeriodSpan: 2 })
    expect((await repositories.classSubjects.findById(offering.id))?.periodsPerWeek).toBe(4)
  })

  it('rejects standalone offerings and deletes unused subjects with their mirrors', async () => {
    const { service, repositories } = await createContext()
    await service.academicsWorkflow.configureSubject({ categoryId: 'test-category', disciplineId: 'test-discipline', id: 'math', schoolId: 'sch1', gradeLevelId: 'gl-6', academicYearId: 'ay1', name: 'Math' })
    await service.academicsWorkflow.configureSubjectMatter({ id: 'chapter', subjectId: 'math', name: 'Core', sequenceOrder: 1 })
    await service.setupWorkflow.createClassGroup({ id: '6a', schoolId: 'sch1', academicYearId: 'ay1', gradeLevelId: 'gl-6', name: '6A' })
    await expect(service.baseService.entities.classSubjects.save(new ClassSubject({ id: 'custom', classGroupId: '6a', subjectId: 'math' }))).rejects.toThrow()
    await service.academicsWorkflow.removeSubject({ subjectId: 'math' })
    expect(await repositories.subjects.count()).toBe(0)
    expect(await repositories.subjectMatters.count()).toBe(0)
    expect(await repositories.classSubjects.count()).toBe(0)
    expect(await repositories.classSubjectMatters.count()).toBe(0)
  })
})
