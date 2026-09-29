import { AcademicYear, ClassGroup, ClassSubject, GradeLevel, GradeLevelSubject, Subject, SubjectCategory, SubjectColor, SubjectMatter } from '@edaya/core'
import { describe, expect, it } from 'bun:test'
import { createTestApp } from '../../support/create-test-app'
import { createTestStaffActor } from '../../support/test-actor'

async function createContext() {
  const fixture = await createTestApp(createTestStaffActor('sch1', 'user1'), { owner: true })
  const repositories = fixture.schoolRepositories
  await repositories.academicYears.save(new AcademicYear({ id: 'ay1', schoolId: 'sch1', name: 'Year', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'published' }))
  await repositories.gradeLevels.save(new GradeLevel({ id: 'gl-6', schoolId: 'sch1', name: '6', label: '6', order: 6 }))
  return { service: fixture.app, repositories }
}

describe('grade level subject inheritance through native policies', () => {
  it('mirrors grade level subjects to every class in the grade and new classes', async () => {
    const { service, repositories } = await createContext()
    await repositories.gradeLevels.save(new GradeLevel({
      id: 'gl-6',
      schoolId: 'sch1',
      name: '6ème',
      label: '6ème',
      order: 1,
    }))
    await repositories.subjects.save(new Subject({
      id: 'subj-math',
      schoolId: 'sch1',
      name: 'Math',
      category: SubjectCategory.Scientific,
      color: SubjectColor.Mint,
    }))
    await repositories.subjectMatters.save(new SubjectMatter({
      id: 'sm-math',
      subjectId: 'subj-math',
      name: 'Core',
      sequenceOrder: 1,
    }))
    await repositories.classGroups.save(new ClassGroup({
      id: '6a',
      schoolId: 'sch1',
      academicYearId: 'ay1',
      gradeLevelId: 'gl-6',
      name: '6A',
    }))
    await repositories.classGroups.save(new ClassGroup({
      id: '6b',
      schoolId: 'sch1',
      academicYearId: 'ay1',
      gradeLevelId: 'gl-6',
      name: '6B',
    }))

    const gradeLevelSubject = await service.academicsWorkflow.offerSubjectToGradeLevel({
      id: 'gls-math',
      gradeLevelId: 'gl-6',
      academicYearId: 'ay1',
      subjectId: 'subj-math',
      coefficient: 3,
      periodsPerWeek: 5,
      classSubjectIdsByClassGroupId: {
        '6a': 'cs-6a-math',
        '6b': 'cs-6b-math',
      },
    })

    await service.academicsWorkflow.assignMatterToGradeLevelSubject({
      id: 'glsm-math',
      gradeLevelSubjectId: gradeLevelSubject.id,
      subjectMatterId: 'sm-math',
      classSubjectMatterIdsByClassGroupId: {
        '6a': 'csm-6a-math',
        '6b': 'csm-6b-math',
      },
    })

    expect((await repositories.classSubjects.list())).toHaveLength(2)
    expect((await repositories.classSubjects.list()).every(entry => entry.gradeLevelSubjectId === 'gls-math')).toBe(true)
    expect((await repositories.classSubjectMatters.list())).toHaveLength(2)

    await service.setupWorkflow.createClassGroup({
      id: '6c',
      schoolId: 'sch1',
      academicYearId: 'ay1',
      gradeLevelId: 'gl-6',
      name: '6C',
    })

    expect((await repositories.classSubjects.list())).toHaveLength(3)
    expect((await repositories.classSubjectMatters.list())).toHaveLength(3)
    expect((await repositories.classSubjects.findById('cs-6a-math'))?.coefficient).toBe(3)
    expect((await repositories.classSubjects.findById('cs-6a-math'))?.periodsPerWeek).toBe(5)
    expect((await repositories.classSubjects.findById('cs-6a-math'))?.isOffered).toBe(true)

    await service.baseService.entities.subjectMatters.delete('sm-math')
    expect(await repositories.gradeLevelSubjectMatters.list()).toHaveLength(0)
    expect(await repositories.classSubjectMatters.list()).toHaveLength(0)
    await service.setupWorkflow.createClassGroup({
      id: '6d',
      schoolId: 'sch1',
      academicYearId: 'ay1',
      gradeLevelId: 'gl-6',
      name: '6D',
    })
    expect(await repositories.classSubjects.list()).toHaveLength(4)
    expect(await repositories.classSubjectMatters.list()).toHaveLength(0)
  })

  it('defaults optional grade level subjects to isOffered false on sync', async () => {
    const { service, repositories } = await createContext()
    await repositories.gradeLevels.save(new GradeLevel({
      id: 'gl-6',
      schoolId: 'sch1',
      name: '6e',
      label: '6e',
      order: 6,
    }))
    await repositories.subjects.save(new Subject({
      id: 'subj-de',
      schoolId: 'sch1',
      name: 'Allemand',
      code: 'ALL',
      category: SubjectCategory.Languages,
      color: SubjectColor.Sky,
    }))
    await repositories.classGroups.save(new ClassGroup({
      id: '6a',
      schoolId: 'sch1',
      academicYearId: 'ay1',
      gradeLevelId: 'gl-6',
      name: '6A',
    }))

    await service.academicsWorkflow.offerSubjectToGradeLevel({
      id: 'gls-de',
      gradeLevelId: 'gl-6',
      academicYearId: 'ay1',
      subjectId: 'subj-de',
      isOptional: true,
      classSubjectIdsByClassGroupId: { '6a': 'cs-6a-de' },
    })

    expect((await repositories.classSubjects.findById('cs-6a-de'))?.isOffered).toBe(false)
  })

  it('propagates isOptional changes to mirrored class subject isOffered defaults', async () => {
    const { service, repositories } = await createContext()
    await repositories.gradeLevels.save(new GradeLevel({
      id: 'gl-6',
      schoolId: 'sch1',
      name: '6e',
      label: '6e',
      order: 6,
    }))
    await repositories.subjects.save(new Subject({
      id: 'subj-es',
      schoolId: 'sch1',
      name: 'Espagnol',
      code: 'ESP',
      category: SubjectCategory.Languages,
      color: SubjectColor.Sky,
    }))
    await repositories.classGroups.save(new ClassGroup({
      id: '6a',
      schoolId: 'sch1',
      academicYearId: 'ay1',
      gradeLevelId: 'gl-6',
      name: '6A',
    }))

    await service.academicsWorkflow.offerSubjectToGradeLevel({
      id: 'gls-es',
      gradeLevelId: 'gl-6',
      academicYearId: 'ay1',
      subjectId: 'subj-es',
      classSubjectIdsByClassGroupId: { '6a': 'cs-6a-es' },
    })
    expect((await repositories.classSubjects.findById('cs-6a-es'))?.isOffered).toBe(true)

    await service.academicsWorkflow.setClassSubjectOffered({
      classSubjectId: 'cs-6a-es',
      isOffered: false,
    })
    expect((await repositories.classSubjects.findById('cs-6a-es'))?.isOffered).toBe(false)

    await service.academicsWorkflow.updateGradeLevelSubject({
      gradeLevelSubjectId: 'gls-es',
      coefficient: 2,
    })
    expect((await repositories.classSubjects.findById('cs-6a-es'))?.isOffered).toBe(false)
    expect((await repositories.classSubjects.findById('cs-6a-es'))?.coefficient).toBe(2)

    await service.academicsWorkflow.updateGradeLevelSubject({
      gradeLevelSubjectId: 'gls-es',
      isOptional: true,
    })
    expect((await repositories.classSubjects.findById('cs-6a-es'))?.isOffered).toBe(false)
    expect((await repositories.gradeLevelSubjects.findById('gls-es'))?.isOptional).toBe(true)

    await service.academicsWorkflow.updateGradeLevelSubject({
      gradeLevelSubjectId: 'gls-es',
      isOptional: false,
    })
    expect((await repositories.classSubjects.findById('cs-6a-es'))?.isOffered).toBe(true)
  })

  it('mirrors the same subjectId in every class for report card section resolution', async () => {
    const { service, repositories } = await createContext()
    await repositories.gradeLevels.save(new GradeLevel({
      id: 'gl-6',
      schoolId: 'sch1',
      name: '6ème',
      label: '6ème',
      order: 1,
    }))
    await repositories.subjects.save(new Subject({
      id: 'subj-math',
      schoolId: 'sch1',
      name: 'Math',
      category: SubjectCategory.Scientific,
      color: SubjectColor.Mint,
    }))
    for (const classId of ['6a', '6b']) {
      await repositories.classGroups.save(new ClassGroup({
        id: classId,
        schoolId: 'sch1',
        academicYearId: 'ay1',
        gradeLevelId: 'gl-6',
        name: classId.toUpperCase(),
      }))
    }

    await service.academicsWorkflow.offerSubjectToGradeLevel({
      id: 'gls-math',
      gradeLevelId: 'gl-6',
      academicYearId: 'ay1',
      subjectId: 'subj-math',
      coefficient: 3,
    })

    for (const classId of ['6a', '6b']) {
      const mirrored = (await repositories.classSubjects.list()).filter(entry => entry.classGroupId === classId)
      const bySubjectId = new Map(mirrored.map(entry => [entry.subjectId, entry]))
      expect(bySubjectId.get('subj-math')?.gradeLevelSubjectId).toBe('gls-math')
    }
  })

  it('addCustomClassSubject creates a class-only subject without gradeLevelSubjectId', async () => {
    const { service, repositories } = await createContext()
    await repositories.classGroups.save(new ClassGroup({
      id: '6a',
      schoolId: 'sch1',
      academicYearId: 'ay1',
      gradeLevelId: 'gl-6',
      name: '6A',
    }))
    await repositories.subjects.save(new Subject({
      id: 'subj-remedial',
      schoolId: 'sch1',
      name: 'Remedial Math',
      category: SubjectCategory.Scientific,
      color: SubjectColor.Mint,
    }))

    const classSubject = await service.academicsWorkflow.addCustomClassSubject({
      id: 'cs-remedial',
      classGroupId: '6a',
      subjectId: 'subj-remedial',
      coefficient: 1,
    })

    expect(classSubject.gradeLevelSubjectId).toBeUndefined()
    expect(classSubject.isOffered).toBe(true)
    expect((await repositories.classSubjects.findById('cs-remedial'))?.subjectId).toBe('subj-remedial')
  })

  it('setClassSubjectOffered toggles isOffered without changing other fields', async () => {
    const { service, repositories } = await createContext()
    await repositories.classGroups.save(new ClassGroup({
      id: '6a',
      schoolId: 'sch1',
      academicYearId: 'ay1',
      gradeLevelId: 'gl-6',
      name: '6A',
    }))

    await repositories.subjects.save(new Subject({ id: 'subj-math', schoolId: 'sch1', name: 'Math' }))
    await repositories.gradeLevelSubjects.save(new GradeLevelSubject({ id: 'gls-math', gradeLevelId: 'gl-6', academicYearId: 'ay1', subjectId: 'subj-math', coefficient: 2 }))

    await repositories.classSubjects.save(new ClassSubject({
      id: 'cs-1',
      classGroupId: '6a',
      subjectId: 'subj-math',
      gradeLevelSubjectId: 'gls-math',
      coefficient: 2,
      isOffered: true,
    }))

    const disabled = await service.academicsWorkflow.setClassSubjectOffered({
      classSubjectId: 'cs-1',
      isOffered: false,
    })

    expect(disabled.isOffered).toBe(false)
    expect(disabled.coefficient).toBe(2)
    expect(disabled.gradeLevelSubjectId).toBe('gls-math')
    expect((await repositories.classSubjects.findById('cs-1'))?.isOffered).toBe(false)
  })

  it('configureClassSubjectTimetable updates inherited class subject span fields', async () => {
    const { service, repositories } = await createContext()
    await repositories.classGroups.save(new ClassGroup({
      id: '6a',
      schoolId: 'sch1',
      academicYearId: 'ay1',
      gradeLevelId: 'gl-6',
      name: '6A',
    }))

    await repositories.subjects.save(new Subject({ id: 'subj-math', schoolId: 'sch1', name: 'Math' }))
    await repositories.gradeLevelSubjects.save(new GradeLevelSubject({ id: 'gls-math', gradeLevelId: 'gl-6', academicYearId: 'ay1', subjectId: 'subj-math', coefficient: 2 }))

    await repositories.classSubjects.save(new ClassSubject({
      id: 'cs-1',
      classGroupId: '6a',
      subjectId: 'subj-math',
      gradeLevelSubjectId: 'gls-math',
      coefficient: 2,
      periodsPerWeek: 3,
      isOffered: true,
    }))

    const updated = await service.academicsWorkflow.configureClassSubjectTimetable({
      classSubjectId: 'cs-1',
      periodsPerWeek: 4,
      minPeriodSpan: 1,
      maxPeriodSpan: 2,
    })

    expect(updated.periodsPerWeek).toBe(4)
    expect(updated.minPeriodSpan).toBe(1)
    expect(updated.maxPeriodSpan).toBe(2)
    expect(updated.gradeLevelSubjectId).toBe('gls-math')
    expect((await repositories.classSubjects.findById('cs-1'))).toMatchObject({
      periodsPerWeek: 4,
      minPeriodSpan: 1,
      maxPeriodSpan: 2,
    })
  })
})
