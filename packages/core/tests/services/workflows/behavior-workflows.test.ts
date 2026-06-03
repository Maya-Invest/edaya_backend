import {
  describe,
  expect,
  test,
} from 'bun:test'
import { IncidentInvolvementRole } from '../../../src/entities'
import { BusinessRuleViolationError } from '../../../src/shared/business-rule-error'
import {
  actor,
  createBehaviorContext,
} from './workflow-test-context'

describe('SchoolService behavior workflows', () => {
  test('addStudentInvolvement persists eligible students through managed service', async () => {
    const { mockPolicy, mockRepos, service } = createBehaviorContext()

    const result = await service.addStudentInvolvement({
      id: 'involvement1',
      incidentId: 'inc1',
      studentId: 'stu1',
      role: IncidentInvolvementRole.Subject,
      notes: 'Student was involved',
    })

    expect(result.incidentId).toBe('inc1')
    expect(result.studentId).toBe('stu1')
    expect(mockPolicy.checkClassGroupAccess).toHaveBeenCalledWith(actor, ['cg1'])
    expect(mockPolicy.checkStudentAccess).toHaveBeenCalledWith(actor, ['stu1'])
    expect(mockRepos.studentIncidentInvolvements.save).toHaveBeenCalledWith(result)
  })

  test('addStudentInvolvement rejects duplicate student links', async () => {
    const { service } = createBehaviorContext({ existingInvolvement: true })

    await expect(service.addStudentInvolvement({
      id: 'involvement1',
      incidentId: 'inc1',
      studentId: 'stu1',
      role: IncidentInvolvementRole.Subject,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('applyDisciplinaryAction requires an incident involvement and saves through managed service', async () => {
    const { mockPolicy, mockRepos, service } = createBehaviorContext({ existingInvolvement: true })

    const result = await service.applyDisciplinaryAction({
      id: 'sda1',
      incidentId: 'inc1',
      studentId: 'stu1',
      disciplinaryActionId: 'da1',
      startsAt: new Date('2026-05-03T00:00:00Z'),
    })

    expect(result.id).toBe('sda1')
    expect(result.schoolId).toBe('sch1')
    expect(result.assignedByStaffId).toBe('user1')
    expect(mockPolicy.checkClassGroupAccess).toHaveBeenCalledWith(actor, ['cg1'])
    expect(mockPolicy.checkStudentAccess).toHaveBeenCalledWith(actor, ['stu1'])
    expect(mockRepos.studentDisciplinaryActions.save).toHaveBeenCalledWith(result)
  })

  test('applyDisciplinaryAction rejects students without an incident involvement', async () => {
    const { service } = createBehaviorContext()

    await expect(service.applyDisciplinaryAction({
      id: 'sda1',
      incidentId: 'inc1',
      studentId: 'stu1',
      disciplinaryActionId: 'da1',
    })).rejects.toThrow()
  })
})
