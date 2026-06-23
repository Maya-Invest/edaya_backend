import {
  describe,
  expect,
  test,
} from 'bun:test'
import { BusinessRuleViolationError } from '../../../src/shared/business-rule-error'
import {
  actor,
  createContext,
} from './workflow-test-context'

describe('SchoolService academics workflows', () => {
  test('recordSessionProgress records progress and updates aggregates through managed services', async () => {
    const { mockAtomic, mockPolicy, mockRepos, service } = createContext()

    const result = await service.academicsWorkflow.recordSessionProgress({
      id: 'csp1',
      classSubjectMatterId: 'csm1',
      sessionId: 'sess1',
      completedPercentage: 100,
      notes: 'Completed',
      recordedAt: new Date('2026-02-01T10:00:00Z'),
    })

    expect(result.id).toBe('csp1')
    expect(result.completedPercentage).toBe(100)
    expect(result.recordedByStaffId).toBe('user1')
    expect(mockAtomic.execute).toHaveBeenCalled()
    expect(mockPolicy.checkSessionAccess).toHaveBeenCalledWith(actor, ['sess1'])
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

  test('recordSessionProgress rejects duplicate progress records', async () => {
    const { service } = createContext({ existingProgress: { id: 'existing-progress' } })

    await expect(service.academicsWorkflow.recordSessionProgress({
      id: 'csp1',
      classSubjectMatterId: 'csm1',
      sessionId: 'sess1',
      completedPercentage: 100,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('recordSessionProgress rejects progress decreases', async () => {
    const { service } = createContext({ matterCompletedPercentage: 80 })

    await expect(service.academicsWorkflow.recordSessionProgress({
      id: 'csp1',
      classSubjectMatterId: 'csm1',
      sessionId: 'sess1',
      completedPercentage: 60,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })
})
