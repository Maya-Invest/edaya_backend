import { AuthorizationError } from '@edaya/authorization'
import { BusinessRuleViolationError, SubjectCategory, SubjectColor } from '@edaya/core'
import {
  describe,
  expect,
  mock,
  test,
} from 'bun:test'
import {
  actor,
  createContext,
} from './workflow-test-context'

describe('SchoolService academics workflows', () => {
  test('recordLessonSessionProgress records progress and updates aggregates through managed services', async () => {
    const { mockAtomic, mockPolicy, mockRepos, service } = createContext()

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
    expect(mockAtomic.execute).toHaveBeenCalled()
    expect(mockPolicy.checkLessonSessionAccess).toHaveBeenCalledWith(actor, ['sess1'])
    expect(mockRepos.classSubjectProgress.save).toHaveBeenCalledWith(result)
    expect(mockRepos.classSubjectMatters.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'csm1',
      completedPercentage: 100,
    }))
    expect(mockRepos.classSubjects.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'cs1',
      completedPercentage: 75,
    }))
  })

  test('recordLessonSessionProgress rejects duplicate progress records', async () => {
    const { service } = createContext({ existingProgress: { id: 'existing-progress' } })

    await expect(service.academicsWorkflow.recordLessonSessionProgress({
      id: 'csp1',
      classSubjectMatterId: 'csm1',
      lessonSessionId: 'sess1',
      completedPercentage: 100,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('recordLessonSessionProgress rounds class-subject aggregate across multiple matters', async () => {
    const { mockRepos, service } = createContext({
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

    expect(mockRepos.classSubjects.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'cs1',
      completedPercentage: 9,
    }))
  })

  test('recordLessonSessionProgress rejects progress decreases', async () => {
    const { service } = createContext({ matterCompletedPercentage: 80 })

    await expect(service.academicsWorkflow.recordLessonSessionProgress({
      id: 'csp1',
      classSubjectMatterId: 'csm1',
      lessonSessionId: 'sess1',
      completedPercentage: 60,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('configureSubject and configureSubjectMatter persist school curriculum entities', async () => {
    const { mockRepos, service } = createContext()

    const subject = await service.academicsWorkflow.configureSubject({
      id: 'subj-math',
      schoolId: 'sch1',
      name: 'Mathematics',
      category: SubjectCategory.Scientific,
      color: SubjectColor.Sky,
    })
    expect(subject.name).toBe('Mathematics')
    expect(mockRepos.subjects.save).toHaveBeenCalled()

    const matter = await service.academicsWorkflow.configureSubjectMatter({
      id: 'sm-algebra',
      subjectId: 'subj-math',
      name: 'Algebra',
      sequenceOrder: 1,
    })
    expect(matter.name).toBe('Algebra')
    expect(mockRepos.subjectMatters.save).toHaveBeenCalled()
  })

  test('addCustomClassSubject and setClassSubjectOffered manage class offerings', async () => {
    const { mockRepos, service } = createContext()

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
    expect(mockRepos.classSubjects.save).toHaveBeenCalled()
  })

  test('recordLessonSessionProgress rejects lesson sessions for another class subject', async () => {
    const { mockRepos, service } = createContext()
    mockRepos.lessonSessions.findById = mock(async () => ({
      id: 'sess1',
      schoolId: 'sch1',
      classGroupId: 'cg1',
      classSubjectId: 'cs-other',
    })) as unknown as typeof mockRepos.lessonSessions.findById

    await expect(service.academicsWorkflow.recordLessonSessionProgress({
      id: 'csp1',
      classSubjectMatterId: 'csm1',
      lessonSessionId: 'sess1',
      completedPercentage: 100,
    })).rejects.toBeInstanceOf(AuthorizationError)
  })
})
