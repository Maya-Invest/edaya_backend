import type { DisciplinaryAction, DisciplinaryActionInput, Incident, IncidentInput, IncidentInvolvementRole } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import type { BehaviorWorkflowRepositories } from '../runtime/workflow-repository-catalog'
import { denyResourceAccess, resolveAuditActorId } from '@edaya/authorization'
import { BusinessRuleViolationError, DisciplinaryAction as DisciplinaryActionEntity, DisciplinaryActionKind, Incident as IncidentEntity, IncidentStatus, StudentClassEnrollmentStatus, StudentDisciplinaryAction, StudentDisciplinaryActionStatus, StudentIncidentInvolvement } from '@edaya/core'
import { INCIDENT_RECORDED_EVENT_KEY, runWorkflowNotifications } from '../../capabilities/notifications'

import { pickWorkflowRepositories } from '../runtime/workflow-repository-catalog'
import { BaseServiceWorkflow } from './base-service-workflow'

export interface AddStudentInvolvementInput {
  id: string
  incidentId: string
  studentId: string
  role: IncidentInvolvementRole
  notes?: string | null
  createdAt?: Date
}

export interface ApplyDisciplinaryActionInput {
  id: string
  incidentId: string
  studentId: string
  disciplinaryActionId: string
  startsAt?: Date
  endsAt?: Date
  notes?: string
  createdAt?: Date
}

export type RecordIncidentInput = Omit<IncidentInput, 'reporterId'> & {
  reporterId?: string
}

export interface UpdateStudentDisciplinaryActionStatusInput {
  studentDisciplinaryActionId?: string
  actionId?: string
  status: StudentDisciplinaryActionStatus
}

export interface ResolveIncidentInput {
  incidentId: string
  resolutionNotes?: string
}

export interface ResolveIncidentInvolvementInput {
  id: string
  studentId: string
  role: IncidentInvolvementRole
  notes?: string | null
  createdAt?: Date
}

export interface ResolveIncidentSanctionInput {
  id: string
  studentId: string
  disciplinaryActionId: string
  startsAt?: Date
  endsAt?: Date
  notes?: string
  createdAt?: Date
}

export interface ResolveIncidentWithOutcomesInput {
  incidentId: string
  resolutionNotes?: string
  involvedStudents: ResolveIncidentInvolvementInput[]
  sanctions?: ResolveIncidentSanctionInput[]
}

export interface ResolveIncidentWithOutcomesResult {
  incident: Incident
  involvements: StudentIncidentInvolvement[]
  sanctions: StudentDisciplinaryAction[]
}

export type ConfigureDisciplinaryActionInput = DisciplinaryActionInput & { schoolId?: string }

export class BehaviorServiceWorkflow extends BaseServiceWorkflow {
  private readonly repositories: BehaviorWorkflowRepositories

  constructor(base: BaseSchoolService) {
    super(base)
    this.repositories = pickWorkflowRepositories('behavior', base.repositories)
  }

  async configureDisciplinaryAction(input: DisciplinaryActionInput & { schoolId?: string }): Promise<DisciplinaryAction> {
    return this.baseService.atomicExecution.execute(async () => {
      const schoolId = input.schoolId ?? this.baseService.actor.schoolId
      this.checkActorSchool(schoolId)
      const action = new DisciplinaryActionEntity({ ...input, schoolId })
      await this.baseService.entities.disciplinaryActions.save(action)
      return action
    })
  }

  async recordIncident(input: RecordIncidentInput): Promise<Incident> {
    return this.baseService.atomicExecution.execute(async () => {
      const incident = new IncidentEntity({
        ...input,
        reporterId: input.reporterId ?? resolveAuditActorId(this.baseService.actor),
      })
      await this.baseService.entities.incidents.save(incident)
      return incident
    })
  }

  async addStudentInvolvement({
    id,
    incidentId,
    studentId,
    role,
    notes,
    createdAt,
  }: AddStudentInvolvementInput): Promise<StudentIncidentInvolvement> {
    return this.baseService.atomicExecution.execute(async () => {
      const incident = await this.requireIncident(incidentId)
      await this.baseService.access.discipline.assertAddInvolvement({ incidentId: incident.id, studentId })
      const involvement = await this.persistNewStudentInvolvement({
        id,
        incidentId,
        studentId,
        role,
        notes,
        createdAt,
      }, incident)
      await runWorkflowNotifications(this.baseService, INCIDENT_RECORDED_EVENT_KEY, {
        incident,
        involvement,
      })
      return involvement
    })
  }

  async applyDisciplinaryAction({
    id,
    incidentId,
    studentId,
    disciplinaryActionId,
    startsAt,
    endsAt,
    notes,
    createdAt,
  }: ApplyDisciplinaryActionInput): Promise<StudentDisciplinaryAction> {
    return this.baseService.atomicExecution.execute(async () => {
      const incident = await this.requireIncident(incidentId)
      await this.baseService.access.discipline.assertApplySanction({ incidentId: incident.id, studentId })
      return this.persistDisciplinaryAction({
        id,
        incidentId,
        studentId,
        disciplinaryActionId,
        startsAt,
        endsAt,
        notes,
        createdAt,
      }, incident)
    })
  }

  async updateStudentDisciplinaryActionStatus({
    studentDisciplinaryActionId,
    actionId,
    status,
  }: UpdateStudentDisciplinaryActionStatusInput): Promise<StudentDisciplinaryAction> {
    return this.baseService.atomicExecution.execute(async () => {
      const existing = await this.requireEntity(
        this.baseService.entities.studentDisciplinaryActions,
        studentDisciplinaryActionId ?? actionId ?? '',
      )
      const action = new StudentDisciplinaryAction({
        id: existing.id,
        schoolId: existing.schoolId,
        incidentId: existing.incidentId,
        studentId: existing.studentId,
        disciplinaryActionId: existing.disciplinaryActionId,
        assignedByStaffId: existing.assignedByStaffId,
        startsAt: existing.startsAt,
        endsAt: existing.endsAt,
        status,
        notes: existing.notes,
        createdAt: existing.createdAt,
        updatedAt: new Date(),
      })
      await this.baseService.entities.studentDisciplinaryActions.save(action)
      return action
    })
  }

  async resolveIncident({ incidentId, resolutionNotes }: ResolveIncidentInput): Promise<Incident> {
    return this.baseService.atomicExecution.execute(async () => {
      const existing = await this.baseService.access.discipline.resolutionContext(incidentId)
      return this.persistIncidentResolution(existing, resolutionNotes)
    })
  }

  async resolveIncidentWithOutcomes({
    incidentId,
    resolutionNotes,
    involvedStudents,
    sanctions = [],
  }: ResolveIncidentWithOutcomesInput): Promise<ResolveIncidentWithOutcomesResult> {
    return this.baseService.atomicExecution.execute(async () => {
      const incident = await this.baseService.access.discipline.resolutionContext(incidentId, involvedStudents.map(student => student.studentId))
      if (incident.status === IncidentStatus.Resolved) {
        throw new BusinessRuleViolationError('INCIDENT_ALREADY_RESOLVED', `Incident ${incidentId} is already resolved`)
      }
      this.assertUniqueInvolvedStudents(involvedStudents)
      const involvedStudentIds = new Set(involvedStudents.map(student => student.studentId))
      for (const sanction of sanctions) {
        if (!involvedStudentIds.has(sanction.studentId)) {
          throw new BusinessRuleViolationError(
            'SANCTION_STUDENT_NOT_INVOLVED',
            `Student ${sanction.studentId} must be listed in involvedStudents before applying a sanction`,
          )
        }
      }

      for (const student of involvedStudents) {
        await this.requireStudentInIncidentScope(student.studentId, incident)
      }
      for (const sanction of sanctions) {
        await this.baseService.access.discipline.assertApplySanction({ incidentId: incident.id, studentId: sanction.studentId })
        await this.requireStudentInIncidentScope(sanction.studentId, incident)
      }

      return this.baseService.atomicExecution.execute(async () => {
        const involvements: StudentIncidentInvolvement[] = []
        const createdInvolvements: StudentIncidentInvolvement[] = []
        for (const student of involvedStudents) {
          const result = await this.persistStudentInvolvementUpsert({
            id: student.id,
            incidentId,
            studentId: student.studentId,
            role: student.role,
            notes: student.notes,
            createdAt: student.createdAt,
          }, incident)
          involvements.push(result.involvement)
          if (result.created) {
            createdInvolvements.push(result.involvement)
          }
        }

        const appliedSanctions: StudentDisciplinaryAction[] = []
        for (const sanction of sanctions) {
          appliedSanctions.push(await this.persistDisciplinaryAction({
            id: sanction.id,
            incidentId,
            studentId: sanction.studentId,
            disciplinaryActionId: sanction.disciplinaryActionId,
            startsAt: sanction.startsAt,
            endsAt: sanction.endsAt,
            notes: sanction.notes,
            createdAt: sanction.createdAt,
          }, incident))
        }

        const resolvedIncident = await this.persistIncidentResolution(incident, resolutionNotes)
        for (const involvement of createdInvolvements) {
          await runWorkflowNotifications(this.baseService, INCIDENT_RECORDED_EVENT_KEY, {
            incident: resolvedIncident,
            involvement,
          })
        }

        return {
          incident: resolvedIncident,
          involvements,
          sanctions: appliedSanctions,
        }
      })
    })
  }

  private assertUniqueInvolvedStudents(involvedStudents: ResolveIncidentInvolvementInput[]): void {
    const seen = new Set<string>()
    for (const student of involvedStudents) {
      if (seen.has(student.studentId)) {
        throw new BusinessRuleViolationError(
          'DUPLICATE_STUDENT_IN_RESOLVE',
          `Student ${student.studentId} appears more than once in involvedStudents`,
        )
      }
      seen.add(student.studentId)
    }
  }

  private async persistNewStudentInvolvement(
    { id, incidentId, studentId, role, notes, createdAt }: AddStudentInvolvementInput,
    incident: Incident,
  ): Promise<StudentIncidentInvolvement> {
    await this.requireStudentInIncidentScope(studentId, incident)
    const existing = (await this.repositories.studentIncidentInvolvements.list({ incidentId, studentId }))[0]
    if (existing) {
      throw new BusinessRuleViolationError('STUDENT_ALREADY_LINKED_TO_INCIDENT', `Student ${studentId} is already linked to incident ${incidentId}`)
    }
    const involvement = new StudentIncidentInvolvement({ id, incidentId, studentId, role, notes, createdAt })
    await this.baseService.entities.studentIncidentInvolvements.save(involvement)
    return involvement
  }

  private async persistStudentInvolvementUpsert(
    { id, incidentId, studentId, role, notes, createdAt }: AddStudentInvolvementInput,
    incident: Incident,
  ): Promise<{ involvement: StudentIncidentInvolvement, created: boolean }> {
    await this.requireStudentInIncidentScope(studentId, incident)
    const existing = (await this.repositories.studentIncidentInvolvements.list({ incidentId, studentId }))[0]
    if (existing) {
      const roleChanged = existing.role !== role
      const notesChanged = notes !== undefined && existing.notes !== notes
      if (!roleChanged && !notesChanged) {
        return { involvement: new StudentIncidentInvolvement(existing), created: false }
      }
      const updated = new StudentIncidentInvolvement({
        id: existing.id,
        incidentId: existing.incidentId,
        studentId: existing.studentId,
        role,
        notes: notes === undefined ? existing.notes : notes,
        createdAt: existing.createdAt,
      })
      await this.baseService.entities.studentIncidentInvolvements.save(updated)
      return { involvement: updated, created: false }
    }
    const involvement = new StudentIncidentInvolvement({ id, incidentId, studentId, role, notes, createdAt })
    await this.baseService.entities.studentIncidentInvolvements.save(involvement)
    return { involvement, created: true }
  }

  private async persistDisciplinaryAction(
    { id, incidentId, studentId, disciplinaryActionId, startsAt, endsAt, notes, createdAt }: ApplyDisciplinaryActionInput,
    incident: Incident,
  ): Promise<StudentDisciplinaryAction> {
    await this.requireStudentInIncidentScope(studentId, incident)
    const [catalogAction, involvement] = await Promise.all([
      this.repositories.disciplinaryActions.findById(disciplinaryActionId),
      this.repositories.studentIncidentInvolvements.list({ incidentId, studentId }),
    ])
    if (!catalogAction || catalogAction.schoolId !== incident.schoolId || involvement.length === 0) {
      denyResourceAccess()
    }
    const applied = new StudentDisciplinaryAction({
      id,
      schoolId: incident.schoolId,
      incidentId,
      studentId,
      disciplinaryActionId,
      assignedByStaffId: resolveAuditActorId(this.baseService.actor),
      startsAt,
      endsAt,
      notes,
      createdAt,
    })
    await this.baseService.entities.studentDisciplinaryActions.save(applied)
    return applied
  }

  private async persistIncidentResolution(existing: Incident, resolutionNotes?: string): Promise<Incident> {
    const incident = new IncidentEntity({
      id: existing.id,
      schoolId: existing.schoolId,
      title: existing.title,
      description: existing.description,
      date: existing.date,
      kind: existing.kind,
      reporterId: existing.reporterId,
      classGroupId: existing.classGroupId,
      lessonSessionId: existing.lessonSessionId,
      status: IncidentStatus.Resolved,
      resolutionNotes: resolutionNotes ?? 'Resolved',
      resolvedAt: new Date(),
      resolvedByStaffId: resolveAuditActorId(this.baseService.actor),
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    })
    await this.baseService.entities.incidents.save(incident)
    return incident
  }

  private async requireIncident(incidentId: string): Promise<Incident> {
    const incident = await this.repositories.incidents.findById(incidentId)
    if (!incident || incident.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return incident
  }

  private async requireStudentInIncidentScope(studentId: string, incident: Incident): Promise<void> {
    const student = await this.repositories.students.findById(studentId)
    if (!student || student.schoolId !== incident.schoolId) {
      denyResourceAccess()
    }
    if (incident.classGroupId) {
      const enrollments = await this.repositories.enrollments.list({
        studentId,
        classGroupId: incident.classGroupId,
        status: StudentClassEnrollmentStatus.Active,
      })
      if (enrollments.length === 0) {
        throw new BusinessRuleViolationError('ACTIVE_ENROLLMENT_REQUIRED', `Student ${studentId} does not have an active enrollment in classGroup ${incident.classGroupId}`)
      }
    }
  }

  private async requireEntity<T>(
    managedService: { findById: (id: string) => Promise<T | undefined> },
    id: string,
  ): Promise<T> {
    const entity = await managedService.findById(id)
    if (!entity) {
      denyResourceAccess()
    }
    return entity
  }
}

export { DisciplinaryActionKind, StudentDisciplinaryActionStatus }
