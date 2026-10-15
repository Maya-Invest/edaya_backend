import { AcademicYear, ClassGroup, ClassSubject, GradeLevel, GradeLevelSubject, Subject, SubjectCategory, SubjectColor, SubjectMatter } from '@edaya/core'
import { describe, expect, it } from 'bun:test'
import { createTestApp } from '../../support/create-test-app'
import { createTestStaffActor } from '../../support/test-actor'

async function createContext(owner = true) {
  const fixture = await createTestApp(createTestStaffActor('sch1', 'user1'), { owner })
  const repositories = fixture.schoolRepositories
  await repositories.academicYears.save(new AcademicYear({ id: 'ay1', schoolId: 'sch1', name: 'Year', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'published' }))
  await repositories.gradeLevels.save(new GradeLevel({ id: 'gl-6', schoolId: 'sch1', name: '6', label: '6', order: 6 }))
  return { service: fixture.app, repositories }
}

async function createWorkloadContext(owner = true) {
  const context = await createContext(owner)
  const { repositories } = context
  await repositories.subjects.save(new Subject({ id: 'subj-math', schoolId: 'sch1', name: 'Math', code: 'MATH', defaultCoefficient: 2 }))
  await repositories.gradeLevelSubjects.save(new GradeLevelSubject({ id: 'gls-math', gradeLevelId: 'gl-6', academicYearId: 'ay1', subjectId: 'subj-math', periodsPerWeek: 3, minPeriodSpan: 1, maxPeriodSpan: 2 }))
  for (const id of ['6a', '6b']) {
    await repositories.classGroups.save(new ClassGroup({ id, schoolId: 'sch1', academicYearId: 'ay1', gradeLevelId: 'gl-6', name: id }))
    await repositories.classSubjects.save(new ClassSubject({ id: `cs-${id}`, classGroupId: id, subjectId: 'subj-math', gradeLevelSubjectId: 'gls-math', periodsPerWeek: 3, minPeriodSpan: 1, maxPeriodSpan: 2, completedPercentage: 25, isOffered: id === '6a' }))
  }
  await repositories.gradeLevels.save(new GradeLevel({ id: 'gl-5', schoolId: 'sch1', name: '5', label: '5', order: 5 }))
  await repositories.gradeLevelSubjects.save(new GradeLevelSubject({ id: 'gls-other', gradeLevelId: 'gl-5', academicYearId: 'ay1', subjectId: 'subj-math', periodsPerWeek: 7 }))
  return context
}

describe('grade level subject inheritance through native policies', () => {
  it('saves subject details and shared workload together, preserving class state and other allocations', async () => {
    const { service, repositories } = await createWorkloadContext()
    await service.academicsWorkflow.updateGradeLevelSubject({ gradeLevelSubjectId: 'gls-math', name: 'Mathematics', color: SubjectColor.Sky, periodsPerWeek: 5, minPeriodSpan: 2, maxPeriodSpan: 3 })
    const subject = await repositories.subjects.findById('subj-math')
    expect(subject?.name).toBe('Mathematics')
    expect(subject?.color).toBe(SubjectColor.Sky)
    expect(subject?.code).toBe('MATH')
    expect(subject?.defaultCoefficient).toBe(2)
    expect((await repositories.gradeLevelSubjects.findById('gls-math'))?.periodsPerWeek).toBe(5)
    expect((await repositories.gradeLevelSubjects.findById('gls-other'))?.periodsPerWeek).toBe(7)
    for (const id of ['6a', '6b']) {
      const row = await repositories.classSubjects.findById(`cs-${id}`)
      expect(row?.periodsPerWeek).toBe(5)
      expect(row?.minPeriodSpan).toBe(2)
      expect(row?.maxPeriodSpan).toBe(3)
      expect(row?.completedPercentage).toBe(25)
      expect(row?.isOffered).toBe(id === '6a')
    }
    await service.setupWorkflow.createClassGroup({ id: '6c', schoolId: 'sch1', academicYearId: 'ay1', gradeLevelId: 'gl-6', name: '6C' })
    const inherited = await repositories.classSubjects.findOne({ classGroupId: '6c', gradeLevelSubjectId: 'gls-math' })
    expect(inherited?.periodsPerWeek).toBe(5)
    expect(inherited?.minPeriodSpan).toBe(2)
    expect(inherited?.maxPeriodSpan).toBe(3)
  })

  it('preserves omitted workload fields and clears explicitly null settings on the subject and classes', async () => {
    const { service, repositories } = await createWorkloadContext()
    await service.academicsWorkflow.updateGradeLevelSubject({ gradeLevelSubjectId: 'gls-math', name: 'Maths' })
    expect((await repositories.classSubjects.findById('cs-6a'))?.periodsPerWeek).toBe(3)
    await service.academicsWorkflow.updateGradeLevelSubject({ gradeLevelSubjectId: 'gls-math', periodsPerWeek: null, minPeriodSpan: null, maxPeriodSpan: null })
    for (const row of [await repositories.gradeLevelSubjects.findById('gls-math'), ...await repositories.classSubjects.list({ gradeLevelSubjectId: 'gls-math' })]) {
      expect(row?.periodsPerWeek).toBeUndefined()
      expect(row?.minPeriodSpan).toBeUndefined()
      expect(row?.maxPeriodSpan).toBeUndefined()
    }
  })

  it('rejects invalid workload and rolls back workload when the combined metadata save fails', async () => {
    const { service, repositories } = await createWorkloadContext()
    for (const changes of [{ periodsPerWeek: 0 }, { periodsPerWeek: 1.5 }, { minPeriodSpan: 3, maxPeriodSpan: 1 }, { minPeriodSpan: 3 }]) {
      await expect(service.academicsWorkflow.updateGradeLevelSubject({ gradeLevelSubjectId: 'gls-math', name: 'Changed', ...changes })).rejects.toThrow()
    }
    await expect(service.academicsWorkflow.updateGradeLevelSubject({ gradeLevelSubjectId: 'gls-math', categoryId: 'missing-category', periodsPerWeek: 5 })).rejects.toThrow()
    const classSubject = (await repositories.classSubjects.findById('cs-6b'))!
    await repositories.classSubjects.save(new ClassSubject({ ...classSubject.data, minPeriodSpan: 2 }))
    await expect(service.academicsWorkflow.updateGradeLevelSubject({ gradeLevelSubjectId: 'gls-math', name: 'Changed', maxPeriodSpan: 1 })).rejects.toThrow()
    expect((await repositories.subjects.findById('subj-math'))?.name).toBe('Math')
    expect((await repositories.gradeLevelSubjects.findById('gls-math'))?.periodsPerWeek).toBe(3)
    expect((await repositories.classSubjects.findById('cs-6a'))?.periodsPerWeek).toBe(3)
    expect((await repositories.classSubjects.findById('cs-6a'))?.maxPeriodSpan).toBe(2)
  })

  it('denies a combined workload save without curriculum permissions', async () => {
    const { service, repositories } = await createWorkloadContext(false)
    await expect(service.academicsWorkflow.updateGradeLevelSubject({ gradeLevelSubjectId: 'gls-math', name: 'Changed', periodsPerWeek: 5 })).rejects.toThrow()
    expect((await repositories.subjects.findById('subj-math'))?.name).toBe('Math')
    expect((await repositories.gradeLevelSubjects.findById('gls-math'))?.periodsPerWeek).toBe(3)
  })

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
