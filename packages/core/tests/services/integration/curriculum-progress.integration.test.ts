import { describe, expect, it } from 'bun:test'
import { ClassSubjectMatterStatus, SessionKind } from '../../../src/entities'
import { createTestApp } from '../../support/in-memory-school-headless-app'

async function prepareCurriculum() {
  const { app, repositories } = createTestApp()
  await app.setup.registerSchool({ id: 'school', name: 'Maya School', timeZone: 'UTC' })
  await app.setup.createAcademicYear({
    id: 'year',
    schoolId: 'school',
    name: '2026-2027',
    startDate: new Date('2026-09-01T00:00:00Z'),
    endDate: new Date('2027-06-30T00:00:00Z'),
  })
  await app.setup.createGradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 6', order: 6 })
  await app.setup.createClassGroup({
    id: 'class',
    schoolId: 'school',
    academicYearId: 'year',
    gradeLevelId: 'level',
    name: 'Grade 6 A',
  })
  await app.academics.createSubject({ id: 'math', schoolId: 'school', name: 'Mathematics' })
  const classSubject = await app.academics.offerSubjectToClass({
    id: 'class-math',
    classGroupId: 'class',
    subjectId: 'math',
  })
  await app.academics.createSubjectMatter({ id: 'decimals', subjectId: 'math', name: 'Decimals', sequenceOrder: 2 })
  await app.academics.assignMatterToClassSubject({
    id: 'class-decimals',
    classSubjectId: classSubject.id,
    subjectMatterId: 'decimals',
  })
  await app.academics.createSubjectMatter({ id: 'fractions', subjectId: 'math', name: 'Fractions', sequenceOrder: 1 })
  const classMatter = await app.academics.assignMatterToClassSubject({
    id: 'class-fractions',
    classSubjectId: classSubject.id,
    subjectMatterId: 'fractions',
  })
  return { app, repositories, classSubject, classMatter }
}

describe('curriculum progress journey', () => {
  it('records cumulative progress once per session and updates class aggregates through the public facade', async () => {
    const { app, repositories, classSubject, classMatter } = await prepareCurriculum()
    const endsAt = new Date('2026-09-01T09:00:00Z')
    await app.scheduling.createSession({
      id: 'lesson-1',
      schoolId: 'school',
      classGroupId: 'class',
      classSubjectId: classSubject.id,
      title: 'Fractions introduction',
      kind: SessionKind.Course,
      startsAt: new Date('2026-09-01T08:00:00Z'),
      endsAt,
    })

    await app.academics.recordSessionProgress({
      id: 'progress-1',
      classSubjectMatterId: classMatter.id,
      sessionId: 'lesson-1',
      completedPercentage: 40,
      recordedAt: endsAt,
    })

    expect((await repositories.classSubjectMatterRepository.findById(classMatter.id))?.completedPercentage).toBe(40)
    expect((await repositories.classSubjectMatterRepository.findById(classMatter.id))?.status)
      .toBe(ClassSubjectMatterStatus.InProgress)
    expect((await repositories.classSubjectRepository.findById(classSubject.id))?.completedPercentage).toBe(20)
    expect(await app.academics.listMatterProgress(classMatter.id)).toHaveLength(1)
    const secondEndsAt = new Date('2026-09-02T09:00:00Z')
    await app.scheduling.createSession({
      id: 'lesson-2',
      schoolId: 'school',
      classGroupId: 'class',
      classSubjectId: classSubject.id,
      title: 'Fractions continuation',
      kind: SessionKind.Course,
      startsAt: new Date('2026-09-02T08:00:00Z'),
      endsAt: secondEndsAt,
    })
    await app.academics.recordSessionProgress({
      id: 'progress-2',
      classSubjectMatterId: classMatter.id,
      sessionId: 'lesson-2',
      completedPercentage: 65,
      recordedAt: secondEndsAt,
    })
    const detail = await app.queries.getClassSubjectProgressDetail({ schoolId: 'school', classSubjectId: classSubject.id })
    expect(detail.classGroup.id).toBe('class')
    expect(detail.subject.id).toBe('math')
    expect(detail.matters.map(row => row.subjectMatter.id)).toEqual(['fractions', 'decimals'])
    expect(detail.matters[0]?.classSubjectMatter.completedPercentage).toBe(65)
    expect(detail.matters[0]?.history.map(row => row.progress.id)).toEqual(['progress-1', 'progress-2'])
    expect(detail.matters[0]?.history[0]?.session.id).toBe('lesson-1')
    expect(detail.matters[1]?.history).toEqual([])
    await expect(app.academics.recordSessionProgress({
      id: 'progress-duplicate',
      classSubjectMatterId: classMatter.id,
      sessionId: 'lesson-1',
      completedPercentage: 50,
    })).rejects.toThrow('Progress has already been recorded')
    expect(await app.academics.listMatterProgress(classMatter.id)).toHaveLength(2)
  })

  it('rejects progress that decreases the current cumulative completion', async () => {
    const { app, classSubject, classMatter } = await prepareCurriculum()
    await app.scheduling.createSession({
      id: 'lesson-1',
      schoolId: 'school',
      classGroupId: 'class',
      classSubjectId: classSubject.id,
      title: 'Fractions I',
      kind: SessionKind.Course,
      startsAt: new Date('2026-09-01T08:00:00Z'),
      endsAt: new Date('2026-09-01T09:00:00Z'),
    })
    await app.scheduling.createSession({
      id: 'lesson-2',
      schoolId: 'school',
      classGroupId: 'class',
      classSubjectId: classSubject.id,
      title: 'Fractions II',
      kind: SessionKind.Course,
      startsAt: new Date('2026-09-02T08:00:00Z'),
      endsAt: new Date('2026-09-02T09:00:00Z'),
    })
    await app.academics.recordSessionProgress({
      id: 'progress-1',
      classSubjectMatterId: classMatter.id,
      sessionId: 'lesson-1',
      completedPercentage: 60,
    })

    await expect(app.academics.recordSessionProgress({
      id: 'progress-2',
      classSubjectMatterId: classMatter.id,
      sessionId: 'lesson-2',
      completedPercentage: 30,
    })).rejects.toThrow('completedPercentage must not decrease')
  })
})
