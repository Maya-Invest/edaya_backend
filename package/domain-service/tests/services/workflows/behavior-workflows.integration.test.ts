import type { NotificationGatewayPort } from '@edaya/core'
import { BusinessRuleViolationError, ClassSubject, DisciplinaryAction, DisciplinaryActionKind, Guardian, GuardianStudentLink, Incident, IncidentInvolvementRole, IncidentKind, IncidentStatus, LessonSession, noOpNotificationGateway, RecordingNotificationGateway, StudentDisciplinaryActionStatus, StudentIncidentInvolvement, Subject, withShortName } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { INCIDENT_RECORDED_EVENT_KEY } from '../../../src/capabilities/notifications'
import { createStudentTransitionContext } from './student-workflow-context'

async function createBehaviorContext({ existingInvolvement = false, activeEnrollment = true, incidentStatus = IncidentStatus.Open, catalogActionSchoolId = 'sch1', lessonSessionScope = false, notificationGateway = noOpNotificationGateway }: { existingInvolvement?: boolean, activeEnrollment?: boolean, incidentStatus?: IncidentStatus, catalogActionSchoolId?: string, lessonSessionScope?: boolean, notificationGateway?: NotificationGatewayPort } = {}) {
  const fixture = await createStudentTransitionContext({ notificationGateway, activeEnrollmentId: activeEnrollment ? 'enr1' : '' })
  const { repositories } = fixture
  await repositories.subjects.save(new Subject(withShortName({ categoryId: 'test-category', gradeLevelId: 'grade1', academicYearId: 'ay1', id: 'subject', schoolId: 'sch1', name: 'Math' })))
  await repositories.classSubjects.save(new ClassSubject({ id: 'cs1', classGroupId: 'cg1', subjectId: 'subject' }))
  await repositories.lessonSessions.save(new LessonSession({ id: 'sess1', schoolId: 'sch1', classGroupId: 'cg1', classSubjectId: 'cs1', displayLabel: 'Math', startsAt: new Date('2026-05-01T09:00:00Z'), endsAt: new Date('2026-05-01T10:00:00Z') }))
  await repositories.guardians.save(new Guardian({ id: 'gua1', schoolId: 'sch1', firstName: 'Grace', lastName: 'Hopper', subjectId: 'subject:gua1' }))
  await repositories.guardianLinks.save(new GuardianStudentLink({ id: 'link', schoolId: 'sch1', studentId: 'stu1', guardianId: 'gua1', relationship: 'parent' }))
  await repositories.disciplinaryActions.save(new DisciplinaryAction(withShortName({ id: 'da1', schoolId: catalogActionSchoolId, name: 'Detention' })))
  await repositories.incidents.save(new Incident({ id: 'inc1', schoolId: 'sch1', title: 'Hall incident', description: 'Incident description', date: new Date('2026-05-01T10:00:00Z'), kind: IncidentKind.MinorInfraction, reporterId: 'user1', classGroupId: lessonSessionScope ? undefined : 'cg1', lessonSessionId: lessonSessionScope ? 'sess1' : undefined, status: incidentStatus, resolvedAt: incidentStatus === IncidentStatus.Resolved ? new Date('2026-05-01T11:00:00Z') : undefined, resolvedByStaffId: incidentStatus === IncidentStatus.Resolved ? 'user1' : undefined }))
  if (existingInvolvement)
    await repositories.studentIncidentInvolvements.save(new StudentIncidentInvolvement({ id: 'involvement-existing', incidentId: 'inc1', studentId: 'stu1', role: IncidentInvolvementRole.Subject }))
  return { ...fixture, incidents: repositories.incidents, involvements: repositories.studentIncidentInvolvements, disciplinaryActions: repositories.studentDisciplinaryActions }
}

describe('SchoolService behavior workflows', () => {
  test('addStudentInvolvement persists eligible students through managed service', async () => {
    const { repositories, service } = await createBehaviorContext()

    const result = await service.behaviorWorkflow.addStudentInvolvement({
      id: 'involvement1',
      incidentId: 'inc1',
      studentId: 'stu1',
      role: IncidentInvolvementRole.Subject,
      notes: 'Student was involved',
    })

    expect(result.incidentId).toBe('inc1')
    expect(result.studentId).toBe('stu1')
    expect((await repositories.studentIncidentInvolvements.findById(result.id))?.data).toEqual(result.data)
  })

  test('addStudentInvolvement enqueues guardian notifications', async () => {
    const gateway = new RecordingNotificationGateway()
    const { service } = await createBehaviorContext({ notificationGateway: gateway })

    await service.behaviorWorkflow.addStudentInvolvement({
      id: 'involvement1',
      incidentId: 'inc1',
      studentId: 'stu1',
      role: IncidentInvolvementRole.Subject,
    })

    expect(gateway.enqueued).toHaveLength(1)
    expect(gateway.enqueued[0]).toMatchObject({
      schoolId: 'sch1',
      kind: 'event',
      eventKey: INCIDENT_RECORDED_EVENT_KEY,
      recipients: [{ kind: 'guardian', id: 'gua1' }],
    })
  })

  test('addStudentInvolvement rejects duplicate student links', async () => {
    const { service } = await createBehaviorContext({ existingInvolvement: true })

    await expect(service.behaviorWorkflow.addStudentInvolvement({
      id: 'involvement1',
      incidentId: 'inc1',
      studentId: 'stu1',
      role: IncidentInvolvementRole.Subject,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('applyDisciplinaryAction requires an incident involvement and saves through managed service', async () => {
    const { repositories, service } = await createBehaviorContext({ existingInvolvement: true })

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
    expect((await repositories.studentDisciplinaryActions.findById(result.id))?.data).toEqual(result.data)
  })

  test('applyDisciplinaryAction rejects students without an incident involvement', async () => {
    const { service } = await createBehaviorContext()

    await expect(service.behaviorWorkflow.applyDisciplinaryAction({
      id: 'sda1',
      incidentId: 'inc1',
      studentId: 'stu1',
      disciplinaryActionId: 'da1',
    })).rejects.toThrow()
  })

  test('resolveIncidentWithOutcomes atomically links students, applies sanctions, and resolves', async () => {
    const gateway = new RecordingNotificationGateway()
    const { incidents, involvements, repositories, service } = await createBehaviorContext({
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

    expect(result.incident.status).toBe(IncidentStatus.Resolved)
    expect(result.incident.resolutionNotes).toBe('Handled in class')
    expect(result.involvements).toHaveLength(1)
    expect(result.involvements[0]?.studentId).toBe('stu1')
    expect(result.sanctions).toHaveLength(1)
    expect(result.sanctions[0]?.disciplinaryActionId).toBe('da1')
    expect((await incidents.findById('inc1'))?.status).toBe(IncidentStatus.Resolved)
    expect(await involvements.list()).toHaveLength(1)
    expect((await repositories.studentDisciplinaryActions.findById('sda1'))?.data).toEqual(result.sanctions[0]?.data)
    expect(gateway.enqueued).toHaveLength(1)
  })

  test('resolveIncidentWithOutcomes upserts existing involvements without duplicate errors', async () => {
    const { involvements, service } = await createBehaviorContext({ existingInvolvement: true })

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
    expect(await involvements.list()).toHaveLength(1)
  })

  test('resolveIncidentWithOutcomes rejects sanctions for students not listed as involved', async () => {
    const { service } = await createBehaviorContext()

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
    const { service } = await createBehaviorContext({ incidentStatus: IncidentStatus.Resolved })

    await expect(service.behaviorWorkflow.resolveIncidentWithOutcomes({
      incidentId: 'inc1',
      involvedStudents: [{
        id: 'involvement1',
        studentId: 'stu1',
        role: IncidentInvolvementRole.Subject,
      }],
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('configureDisciplinaryAction and recordIncident persist catalog and incident records', async () => {
    const { repositories, service } = await createBehaviorContext()

    const catalogAction = await service.behaviorWorkflow.configureDisciplinaryAction({
      id: 'da-catalog',
      schoolId: 'sch1',
      name: 'Detention',
      kind: DisciplinaryActionKind.Sanction,
    })
    expect(catalogAction.name).toBe('Detention')
    expect(await repositories.disciplinaryActions.findById('da-catalog')).toBeDefined()

    const incident = await service.behaviorWorkflow.recordIncident({
      id: 'inc-new',
      schoolId: 'sch1',
      title: 'Noise in hallway',
      description: 'Students were loud during break',
      date: new Date('2026-05-02T12:00:00Z'),
      kind: IncidentKind.MinorInfraction,
      classGroupId: 'cg1',
    })
    expect(incident.reporterId).toBe('user1')
    expect(await repositories.incidents.findById('inc-new')).toBeDefined()
  })

  test('resolveIncident marks an open incident as resolved', async () => {
    const { incidents, service } = await createBehaviorContext()

    const result = await service.behaviorWorkflow.resolveIncident({
      incidentId: 'inc1',
      resolutionNotes: 'Discussed expectations',
    })

    expect(result.status).toBe(IncidentStatus.Resolved)
    expect((await incidents.findById('inc1'))?.resolutionNotes).toBe('Discussed expectations')
  })

  test('updateStudentDisciplinaryActionStatus updates sanction status', async () => {
    const { disciplinaryActions, service } = await createBehaviorContext({ existingInvolvement: true })

    await service.behaviorWorkflow.applyDisciplinaryAction({
      id: 'sda1',
      incidentId: 'inc1',
      studentId: 'stu1',
      disciplinaryActionId: 'da1',
    })

    const updated = await service.behaviorWorkflow.updateStudentDisciplinaryActionStatus({
      studentDisciplinaryActionId: 'sda1',
      status: StudentDisciplinaryActionStatus.Completed,
    })

    expect(updated.status).toBe(StudentDisciplinaryActionStatus.Completed)
    expect((await disciplinaryActions.findById('sda1'))?.status).toBe(StudentDisciplinaryActionStatus.Completed)
  })

  test('resolveIncidentWithOutcomes rejects duplicate students in involvedStudents', async () => {
    const { service } = await createBehaviorContext()

    await expect(service.behaviorWorkflow.resolveIncidentWithOutcomes({
      incidentId: 'inc1',
      involvedStudents: [
        { id: 'inv1', studentId: 'stu1', role: IncidentInvolvementRole.Subject },
        { id: 'inv2', studentId: 'stu1', role: IncidentInvolvementRole.Witness },
      ],
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('addStudentInvolvement rejects students without active class enrollment', async () => {
    const { service } = await createBehaviorContext({ activeEnrollment: false })

    await expect(service.behaviorWorkflow.addStudentInvolvement({
      id: 'involvement1',
      incidentId: 'inc1',
      studentId: 'stu1',
      role: IncidentInvolvementRole.Subject,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('addStudentInvolvement authorizes lesson-session scoped incidents', async () => {
    const { repositories, service } = await createBehaviorContext({ lessonSessionScope: true })

    await service.behaviorWorkflow.addStudentInvolvement({
      id: 'involvement1',
      incidentId: 'inc1',
      studentId: 'stu1',
      role: IncidentInvolvementRole.Subject,
    })
    expect(await repositories.studentIncidentInvolvements.findById('involvement1')).toBeDefined()
  })
})
