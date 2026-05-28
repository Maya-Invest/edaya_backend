import type { Session } from '../../../entities/scheduling/session'
import type { Attachment } from '../../../entities/school/attachment'
import type { ClassGroup } from '../../../entities/school/class-group'
import type { Resource } from '../../../entities/school/resource'
import type { ResourceAssignment } from '../../../entities/school/resource-assignment'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { ServiceArgs } from '../../school-headless-app'
import { AttachmentOwnerKind } from '../../../entities/school/attachment'
import { denyResourceAccess } from '../../authorization'

export interface ResourceAssignmentDetail {
  assignment: ResourceAssignment
  resource: Resource
  classGroup?: ClassGroup
  session?: Session
}

export interface ResourceDirectory {
  resources: Resource[]
  assignments: ResourceAssignmentDetail[]
}

export interface AttachmentDirectory {
  attachments: Attachment[]
}

export class ResourceReadService {
  constructor(args: ServiceArgs) {
    this.resources = args.repositories.resources
    this.resourceAssignments = args.repositories.resourceAssignments
    this.classGroups = args.repositories.classGroups
    this.sessions = args.repositories.sessions
  }

  private readonly resources: SchoolRepositories['resources']
  private readonly resourceAssignments: SchoolRepositories['resourceAssignments']
  private readonly classGroups: SchoolRepositories['classGroups']
  private readonly sessions: SchoolRepositories['sessions']

  async listResources({ schoolId }: { schoolId: string }): Promise<ResourceDirectory> {
    const resources = (await this.resources.list({ schoolId }))
      .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id))
    const resourceIds = new Set(resources.map(resource => resource.id))
    const assignments = (await this.resourceAssignments.list())
      .filter(assignment => resourceIds.has(assignment.resourceId))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
    return {
      resources,
      assignments: await Promise.all(assignments.map(assignment => this.buildAssignmentDetail(assignment))),
    }
  }

  private async buildAssignmentDetail(assignment: ResourceAssignment): Promise<ResourceAssignmentDetail> {
    const resource = await this.resources.findById(assignment.resourceId)
    if (!resource) {
      denyResourceAccess()
    }
    const classGroup = assignment.classGroupId
      ? await this.classGroups.findById(assignment.classGroupId)
      : undefined
    const session = assignment.sessionId
      ? await this.sessions.findById(assignment.sessionId)
      : undefined
    if ((assignment.classGroupId && (!classGroup || classGroup.schoolId !== resource.schoolId)) || (assignment.sessionId && !session)) {
      denyResourceAccess()
    }
    const sessionClassGroup = session ? await this.classGroups.findById(session.classGroupId) : undefined
    if (session && (!sessionClassGroup || sessionClassGroup.schoolId !== resource.schoolId)) {
      denyResourceAccess()
    }
    return { assignment, resource, classGroup: classGroup ?? sessionClassGroup, session }
  }
}

export class AttachmentReadService {
  constructor(args: ServiceArgs) {
    this.attachments = args.repositories.attachments
    this.attendance = args.repositories.attendance
    this.enrollments = args.repositories.enrollments
    this.guardians = args.repositories.guardians
    this.incidents = args.repositories.incidents
    this.payments = args.repositories.payments
    this.results = args.repositories.results
    this.assessmentResults = args.repositories.assessmentResults
    this.studentFees = args.repositories.studentFees
    this.students = args.repositories.students
    this.studentDisciplinaryActions = args.repositories.studentDisciplinaryActions
    this.studentHealthProfiles = args.repositories.studentHealthProfiles
  }

  private readonly attachments: SchoolRepositories['attachments']
  private readonly attendance: SchoolRepositories['attendance']
  private readonly enrollments: SchoolRepositories['enrollments']
  private readonly guardians: SchoolRepositories['guardians']
  private readonly incidents: SchoolRepositories['incidents']
  private readonly payments: SchoolRepositories['payments']
  private readonly results: SchoolRepositories['results']
  private readonly assessmentResults: SchoolRepositories['assessmentResults']
  private readonly studentFees: SchoolRepositories['studentFees']
  private readonly students: SchoolRepositories['students']
  private readonly studentDisciplinaryActions: SchoolRepositories['studentDisciplinaryActions']
  private readonly studentHealthProfiles: SchoolRepositories['studentHealthProfiles']

  async listAttachments({
    schoolId,
    ownerKind,
    ownerId,
  }: {
    schoolId: string
    ownerKind: AttachmentOwnerKind
    ownerId: string
  }): Promise<AttachmentDirectory> {
    const context = await this.resolveOwnerContext(ownerKind, ownerId)
    if (context.schoolId !== schoolId) {
      denyResourceAccess()
    }
    const attachments = (await this.attachments.list({ schoolId, ownerKind, ownerId }))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
    return { attachments }
  }

  private async resolveOwnerContext(
    ownerKind: AttachmentOwnerKind,
    ownerId: string,
  ): Promise<{ schoolId: string, studentId?: string }> {
    switch (ownerKind) {
      case AttachmentOwnerKind.Student:
        return this.resolveStudentOwner(ownerId)
      case AttachmentOwnerKind.Guardian: {
        const guardian = await this.guardians.findById(ownerId)
        if (!guardian) {
          denyResourceAccess()
        }
        return { schoolId: guardian.schoolId }
      }
      case AttachmentOwnerKind.StudentHealthProfile: {
        const profile = await this.studentHealthProfiles.findById(ownerId)
        if (!profile) {
          denyResourceAccess()
        }
        return { schoolId: profile.schoolId, studentId: profile.studentId }
      }
      case AttachmentOwnerKind.StudentClassEnrollment: {
        const enrollment = await this.enrollments.findById(ownerId)
        if (!enrollment) {
          denyResourceAccess()
        }
        return this.resolveStudentOwner(enrollment.studentId)
      }
      case AttachmentOwnerKind.AttendanceRecord: {
        const record = await this.attendance.findById(ownerId)
        if (!record) {
          denyResourceAccess()
        }
        return this.resolveStudentOwner(record.studentId)
      }
      case AttachmentOwnerKind.Incident: {
        const incident = await this.incidents.findById(ownerId)
        if (!incident) {
          denyResourceAccess()
        }
        return { schoolId: incident.schoolId }
      }
      case AttachmentOwnerKind.StudentDisciplinaryAction: {
        const action = await this.studentDisciplinaryActions.findById(ownerId)
        if (!action) {
          denyResourceAccess()
        }
        return this.resolveStudentOwner(action.studentId)
      }
      case AttachmentOwnerKind.AssessmentResult: {
        const result = await this.assessmentResults.findById(ownerId)
        if (!result) {
          denyResourceAccess()
        }
        return this.resolveStudentOwner(result.studentId)
      }
      case AttachmentOwnerKind.ReportCard: {
        const result = await this.results.findById(ownerId)
        if (!result) {
          denyResourceAccess()
        }
        return this.resolveStudentOwner(result.studentId)
      }
      case AttachmentOwnerKind.Payment: {
        const payment = await this.payments.findById(ownerId)
        if (!payment) {
          denyResourceAccess()
        }
        const studentFee = await this.studentFees.findById(payment.studentFeeId)
        if (!studentFee) {
          denyResourceAccess()
        }
        return this.resolveStudentOwner(studentFee.studentId)
      }
      case AttachmentOwnerKind.Other:
        throw new Error('Attachment owner kind other is not supported by the selected public contract')
    }
  }

  private async resolveStudentOwner(studentId: string): Promise<{ schoolId: string, studentId: string }> {
    const student = await this.students.findById(studentId)
    if (!student) {
      denyResourceAccess()
    }
    return { schoolId: student.schoolId, studentId: student.id }
  }
}
