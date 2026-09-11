import { ClassSubject, ClassSubjectMatter, ClassSubjectMatterStatus, DayOfWeek, Schedule, Subject, SubjectMatter } from '@edaya/core'
import { expect, it } from 'bun:test'
import { describeWithSeededSchool } from '../support/seeded-route-test-context'

describeWithSeededSchool('generic class subject deletion', (getContext) => {
  it('preserves inherited and used allocations, preflights the entire batch, and allows an unused custom allocation', async () => {
    const { application, app, authHeaders } = getContext()
    const repositories = application.repositories
    const inherited = (await repositories.classSubjects.list({ $limit: 100 })).find(subject => subject.gradeLevelSubjectId)
    expect(inherited).toBeDefined()
    const classGroup = await repositories.classGroups.findById(inherited!.classGroupId)
    expect(classGroup).toBeDefined()
    for (const suffix of ['unused', 'used']) {
      await repositories.subjects.save(new Subject({ id: `delete-subject-${suffix}`, schoolId: classGroup!.schoolId, name: `Delete test ${suffix}` }))
      await repositories.classSubjects.save(new ClassSubject({ id: `delete-allocation-${suffix}`, classGroupId: classGroup!.id, subjectId: `delete-subject-${suffix}` }))
    }
    await repositories.subjectMatters.save(new SubjectMatter({ id: 'delete-matter', subjectId: 'delete-subject-used', name: 'Preserve curriculum', sequenceOrder: 1 }))
    await repositories.classSubjectMatters.save(new ClassSubjectMatter({ id: 'delete-allocation-matter', classSubjectId: 'delete-allocation-used', subjectMatterId: 'delete-matter', status: ClassSubjectMatterStatus.NotStarted, completedPercentage: 0 }))
    const headers = await authHeaders()
    const remove = (operation: string, body: unknown) => app.request(`/core/entities/class-subjects/${operation}`, { method: 'POST', headers, body: JSON.stringify(body) })

    const inheritedResponse = await remove('delete', { id: inherited!.id })
    expect(inheritedResponse.status).toBe(409)
    expect(await inheritedResponse.text()).toContain('CLASS_SUBJECT_MANAGED_AT_GRADE_LEVEL')
    expect(await repositories.classSubjects.findById(inherited!.id)).toBeDefined()

    const batchResponse = await remove('batch-delete', { ids: ['delete-allocation-unused', 'delete-allocation-used'] })
    expect(batchResponse.status).toBe(409)
    expect(await batchResponse.text()).toContain('CLASS_SUBJECT_HAS_DEPENDENCIES')
    expect(await repositories.classSubjects.findById('delete-allocation-unused')).toBeDefined()
    expect(await repositories.classSubjects.findById('delete-allocation-used')).toBeDefined()
    expect(await repositories.classSubjectMatters.findById('delete-allocation-matter')).toBeDefined()

    await repositories.schedules.save(new Schedule({ id: 'delete-schedule', schoolId: classGroup!.schoolId, classGroupId: classGroup!.id, classSubjectId: 'delete-allocation-unused', title: 'Future lesson', isRecurring: true, dayOfWeek: DayOfWeek.Monday, startTime: '08:00', endTime: '09:00' }))
    const scheduledResponse = await remove('delete', { id: 'delete-allocation-unused' })
    expect(scheduledResponse.status).toBe(409)
    expect(await scheduledResponse.text()).toContain('CLASS_SUBJECT_HAS_DEPENDENCIES')
    expect(await repositories.classSubjects.findById('delete-allocation-unused')).toBeDefined()
    expect(await repositories.schedules.findById('delete-schedule')).toBeDefined()
    await repositories.schedules.delete('delete-schedule')

    const unusedResponse = await remove('delete', { id: 'delete-allocation-unused' })
    expect(unusedResponse.status).toBe(200)
    expect(await repositories.classSubjects.findById('delete-allocation-unused')).toBeUndefined()
  })
}, { isolate: true })
