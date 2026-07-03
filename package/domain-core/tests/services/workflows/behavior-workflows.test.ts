import {
  describe,
  expect,
  test,
} from 'bun:test'
import { RecordingNotificationGateway } from '../../../src/adapters'
import { INCIDENT_RECORDED_EVENT_KEY } from '../../../src/capabilities/notifications'
import { IncidentInvolvementRole, IncidentStatus } from '../../../src/domain'
import { BusinessRuleViolationError } from '../../../src/domain/shared/business-rule-error'
import {
  actor,
  createBehaviorContext,
} from './workflow-test-context'

describe('SchoolService behavior workflows', () => {
  test('addStudentInvolvement persists eligible students through managed service', async () => {
    const { mockPolicy, mockRepos, service } = createBehaviorContext()

    const result = await service.behaviorWorkflow.addStudentInvolvement({
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

  test('addStudentInvolvement enqueues guardian notifications', async () => {
    const gateway = new RecordingNotificationGateway()
    const { service } = createBehaviorContext({ notificationGateway: gateway })

    await service.behaviorWorkflow.addStudentInvolvement({
      id: 'involvement1',
      incidentId: 'inc1',
      studentId: 'stu1',
      role: IncidentInvolvementRole.Subject,
    })

    expect(gateway.enqueued).toHaveLength(1)
    expect(gateway.enqueued[0]).toMatchObject({
      idempotencyKey: `delivery:${INCIDENT_RECORDED_EVENT_KEY}:inc1:stu1:subject:gua1`,
      schoolId: 'sch1',
      kind: 'event',
      eventKey: INCIDENT_RECORDED_EVENT_KEY,
      recipients: [{ kind: 'guardian', id: 'gua1' }],
    })
  })

  test('addStudentInvolvement rejects duplicate student links', async () => {
    const { service } = createBehaviorContext({ existingInvolvement: true })

    await expect(service.behaviorWorkflow.addStudentInvolvement({
      id: 'involvement1',
      incidentId: 'inc1',
      studentId: 'stu1',
      role: IncidentInvolvementRole.Subject,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('applyDisciplinaryAction requires an incident involvement and saves through managed service', async () => {
    const { mockPolicy, mockRepos, service } = createBehaviorContext({ existingInvolvement: true })

    const result = await service.behaviorWorkflow.applyDisciplinaryAction({
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

    await expect(service.behaviorWorkflow.applyDisciplinaryAction({
      id: 'sda1',
      incidentId: 'inc1',
      studentId: 'stu1',
      disciplinaryActionId: 'da1',
    })).rejects.toThrow()
  })

  test('resolveIncidentWithOutcomes atomically links students, applies sanctions, and resolves', async () => {
    const gateway = new RecordingNotificationGateway()
    const { incidents, involvements, mockAtomic, mockPolicy, mockRepos, service } = createBehaviorContext({
      notificationGateway: gateway,
    })

    const result = await service.behaviorWorkflow.resolveIncidentWithOutcomes({
      incidentId: 'inc1',
      resolutionNotes: 'Handled in class',
      involvedStudents: [{
        id: 'involvement1',
        studentId: 'stu1',
        role: IncidentInvolvementRole.Subject,
        notes: 'Primary subject',
      }],
      sanctions: [{
        id: 'sda1',
        studentId: 'stu1',
        disciplinaryActionId: 'da1',
        startsAt: new Date('2026-05-03T00:00:00Z'),
      }],
    })

    expect(mockAtomic.execute).toHaveBeenCalled()
    expect(result.incident.status).toBe(IncidentStatus.Resolved)
    expect(result.incident.resolutionNotes).toBe('Handled in class')
    expect(result.involvements).toHaveLength(1)
    expect(result.involvements[0]?.studentId).toBe('stu1')
    expect(result.sanctions).toHaveLength(1)
    expect(result.sanctions[0]?.disciplinaryActionId).toBe('da1')
    expect(incidents.get('inc1')?.status).toBe(IncidentStatus.Resolved)
    expect([...involvements.values()]).toHaveLength(1)
    expect(mockPolicy.checkClassGroupAccess).toHaveBeenCalledWith(actor, ['cg1'])
    expect(mockPolicy.checkStudentAccess).toHaveBeenCalledWith(actor, ['stu1'])
    expect(mockRepos.studentDisciplinaryActions.save).toHaveBeenCalledWith(result.sanctions[0])
    expect(gateway.enqueued).toHaveLength(1)
  })

  test('resolveIncidentWithOutcomes upserts existing involvements without duplicate errors', async () => {
    const { involvements, service } = createBehaviorContext({ existingInvolvement: true })

    const result = await service.behaviorWorkflow.resolveIncidentWithOutcomes({
      incidentId: 'inc1',
      involvedStudents: [{
        id: 'involvement-new',
        studentId: 'stu1',
        role: IncidentInvolvementRole.Witness,
      }],
    })

    expect(result.involvements).toHaveLength(1)
    expect(result.involvements[0]?.role).toBe(IncidentInvolvementRole.Witness)
    expect([...involvements.values()]).toHaveLength(1)
  })

  test('resolveIncidentWithOutcomes rejects sanctions for students not listed as involved', async () => {
    const { service } = createBehaviorContext()

    await expect(service.behaviorWorkflow.resolveIncidentWithOutcomes({
      incidentId: 'inc1',
      involvedStudents: [{
        id: 'involvement1',
        studentId: 'stu1',
        role: IncidentInvolvementRole.Subject,
      }],
      sanctions: [{
        id: 'sda1',
        studentId: 'stu2',
        disciplinaryActionId: 'da1',
      }],
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('resolveIncidentWithOutcomes rejects already resolved incidents', async () => {
    const { service } = createBehaviorContext({ incidentStatus: IncidentStatus.Resolved })

    await expect(service.behaviorWorkflow.resolveIncidentWithOutcomes({
      incidentId: 'inc1',
      involvedStudents: [{
        id: 'involvement1',
        studentId: 'stu1',
        role: IncidentInvolvementRole.Subject,
      }],
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })
})
