import type {
  Incident,
  IncidentInput,
  IncidentInvolvementRole,
} from '../../domain'
import type { BaseSchoolService } from '../base-school-service'
import { permissionAction } from '../../application/entities/entity-config'
import { denyResourceAccess, Permission, resolveAuditActorId } from '../../capabilities/authorization'
import {
  INCIDENT_RECORDED_EVENT_KEY,
  runWorkflowNotifications,
} from '../../capabilities/notifications'
import {
  DisciplinaryActionKind,
  Incident as IncidentEntity,
  IncidentStatus,
  StudentClassEnrollmentStatus,
  StudentDisciplinaryAction,
  StudentDisciplinaryActionStatus,
  StudentIncidentInvolvement,
} from '../../domain'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { BaseServiceWorkflow } from './base-service-workflow'

export interface AddStudentInvolvementInput {
  id: string
  incidentId: string
  studentId: string
  role: IncidentInvolvementRole
  notes?: string
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

export class BehaviorServiceWorkflow extends BaseServiceWorkflow {
  constructor(base: BaseSchoolService) {
    super(base)
  }

  async recordIncident(input: RecordIncidentInput): Promise<Incident> {
    const incident = new IncidentEntity({
      ...input,
      reporterId: input.reporterId ?? resolveAuditActorId(this.baseService.actor),
    })
    await this.baseService.entities.incidents.save(incident)
    return incident
  }

  async addStudentInvolvement({
    id,
    incidentId,
    studentId,
    role,
    notes,
    createdAt,
  }: AddStudentInvolvementInput): Promise<StudentIncidentInvolvement> {
    const incident = await this.requireIncident(incidentId)
    await this.authorize(Permission.DISCIPLINE_CREATE, {
      schoolId: incident.schoolId,
      classGroupId: incident.classGroupId,
      lessonSessionId: incident.lessonSessionId,
      studentId,
    })
    await this.requireStudentInIncidentScope(studentId, incident)
    const existing = (await this.baseService.repositories.studentIncidentInvolvements.list({ incidentId, studentId }))[0]
    if (existing) {
      throw new BusinessRuleViolationError('STUDENT_ALREADY_LINKED_TO_INCIDENT', `Student ${studentId} is already linked to incident ${incidentId}`)
    }
    const involvement = new StudentIncidentInvolvement({ id, incidentId, studentId, role, notes, createdAt })
    await this.baseService.entities.studentIncidentInvolvements.save(involvement, { moduleChecked: true })
    await runWorkflowNotifications(this.baseService, INCIDENT_RECORDED_EVENT_KEY, {
      incident,
      involvement,
    })
    return involvement
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
    const incident = await this.requireIncident(incidentId)
    await this.authorize(Permission.DISCIPLINE_VALIDATE, {
      schoolId: incident.schoolId,
      classGroupId: incident.classGroupId,
      lessonSessionId: incident.lessonSessionId,
      studentId,
    })
    await this.requireStudentInIncidentScope(studentId, incident)
    const [catalogAction, involvement] = await Promise.all([
      this.baseService.repositories.disciplinaryActions.findById(disciplinaryActionId),
      this.baseService.repositories.studentIncidentInvolvements.list({ incidentId, studentId }),
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
    await this.baseService.entities.studentDisciplinaryActions.save(applied, { moduleChecked: true })
    return applied
  }

  async updateStudentDisciplinaryActionStatus({
    studentDisciplinaryActionId,
    actionId,
    status,
  }: UpdateStudentDisciplinaryActionStatusInput): Promise<StudentDisciplinaryAction> {
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
  }

  async resolveIncident({ incidentId, resolutionNotes }: ResolveIncidentInput): Promise<Incident> {
    const existing = await this.requireEntity(this.baseService.entities.incidents, incidentId)
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
    const incident = await this.baseService.repositories.incidents.findById(incidentId)
    if (!incident || incident.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return incident
  }

  private async requireStudentInIncidentScope(studentId: string, incident: Incident): Promise<void> {
    const student = await this.baseService.repositories.students.findById(studentId)
    if (!student || student.schoolId !== incident.schoolId) {
      denyResourceAccess()
    }
    if (incident.classGroupId) {
      const enrollments = await this.baseService.repositories.enrollments.list({
        studentId,
        classGroupId: incident.classGroupId,
        status: StudentClassEnrollmentStatus.Active,
      })
      if (enrollments.length === 0) {
        throw new BusinessRuleViolationError('ACTIVE_ENROLLMENT_REQUIRED', `Student ${studentId} does not have an active enrollment in classGroup ${incident.classGroupId}`)
      }
    }
  }

  private async authorize(
    permission: Permission.DISCIPLINE_CREATE | Permission.DISCIPLINE_VALIDATE,
    resource: {
      schoolId: string
      classGroupId?: string
      lessonSessionId?: string
      studentId?: string
    },
  ): Promise<void> {
    if (resource.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }

    await permissionAction(permission)(this.baseService.actor)

    if (resource.classGroupId) {
      await this.baseService.authorizationPolicy.checkClassGroupAccess(this.baseService.actor, [resource.classGroupId])
    }
    else if (resource.lessonSessionId) {
      await this.baseService.authorizationPolicy.checkLessonSessionAccess(this.baseService.actor, [resource.lessonSessionId])
    }
    if (resource.studentId) {
      await this.baseService.authorizationPolicy.checkStudentAccess(this.baseService.actor, [resource.studentId])
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
