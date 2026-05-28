import type { SchoolRepositories } from '../../../ports/school-repositories'
import { AttachmentOwnerKind } from '../../../entities/school/attachment'
import { denyResourceAccess } from '../../authorization'

export interface AttachmentOwnerContext {
  schoolId: string
  studentId?: string
  classGroupId?: string
  sessionId?: string
}

/**
 * Resolves the context of an attachment owner, performing all boundary validation checks.
 * Ensures that the owner and any linked entities belong to the specified schoolId.
 */
export async function resolveAttachmentOwnerContext(
  repositories: SchoolRepositories,
  ownerKind: AttachmentOwnerKind,
  ownerId: string,
  schoolId: string,
): Promise<AttachmentOwnerContext> {
  const requireStudentInSchool = async (studentId: string): Promise<void> => {
    const student = await repositories.students.findById(studentId)
    if (!student || student.schoolId !== schoolId) {
      denyResourceAccess()
    }
  }

  const requireClassGroupInSchool = async (classGroupId: string, academicYearId?: string): Promise<void> => {
    const classGroup = await repositories.classGroups.findById(classGroupId)
    if (
      !classGroup
      || classGroup.schoolId !== schoolId
      || (academicYearId !== undefined && classGroup.academicYearId !== academicYearId)
    ) {
      denyResourceAccess()
    }
  }

  const requireSessionInSchool = async (sessionId: string) => {
    const session = await repositories.sessions.findById(sessionId)
    const classGroup = session ? await repositories.classGroups.findById(session.classGroupId) : undefined
    if (!session || !classGroup || classGroup.schoolId !== schoolId) {
      denyResourceAccess()
    }
    return session
  }

  const resolveStudentAttachmentResource = async (studentId: string): Promise<{ classGroupId?: string, studentId: string }> => {
    await requireStudentInSchool(studentId)
    const activeEnrollment = await repositories.enrollments.findActiveByStudent(studentId)
    return { classGroupId: activeEnrollment?.classGroupId, studentId }
  }

  switch (ownerKind) {
    case AttachmentOwnerKind.Student: {
      const result = await resolveStudentAttachmentResource(ownerId)
      return { schoolId, ...result }
    }
    case AttachmentOwnerKind.Guardian: {
      const guardian = await repositories.guardians.findById(ownerId)
      if (!guardian || guardian.schoolId !== schoolId) {
        denyResourceAccess()
      }
      return { schoolId }
    }
    case AttachmentOwnerKind.StudentHealthProfile: {
      const profile = await repositories.studentHealthProfiles.findById(ownerId)
      if (!profile || profile.schoolId !== schoolId) {
        denyResourceAccess()
      }
      const result = await resolveStudentAttachmentResource(profile.studentId)
      return { schoolId, ...result }
    }
    case AttachmentOwnerKind.StudentClassEnrollment: {
      const enrollment = await repositories.enrollments.findById(ownerId)
      if (!enrollment) {
        denyResourceAccess()
      }
      await requireStudentInSchool(enrollment.studentId)
      await requireClassGroupInSchool(enrollment.classGroupId, enrollment.academicYearId)
      return { schoolId, classGroupId: enrollment.classGroupId, studentId: enrollment.studentId }
    }
    case AttachmentOwnerKind.AttendanceRecord: {
      const record = await repositories.attendance.findById(ownerId)
      if (!record) {
        denyResourceAccess()
      }
      await requireStudentInSchool(record.studentId)
      const session = await requireSessionInSchool(record.sessionId)
      return { schoolId, classGroupId: session.classGroupId, sessionId: session.id, studentId: record.studentId }
    }
    case AttachmentOwnerKind.Incident: {
      const incident = await repositories.incidents.findById(ownerId)
      if (!incident || incident.schoolId !== schoolId) {
        denyResourceAccess()
      }
      return { schoolId, classGroupId: incident.classGroupId, sessionId: incident.sessionId }
    }
    case AttachmentOwnerKind.StudentDisciplinaryAction: {
      const action = await repositories.studentDisciplinaryActions.findById(ownerId)
      if (!action || action.schoolId !== schoolId) {
        denyResourceAccess()
      }
      const result = await resolveStudentAttachmentResource(action.studentId)
      return { schoolId, ...result }
    }
    case AttachmentOwnerKind.AssessmentResult: {
      const result = await repositories.assessmentResults.findById(ownerId)
      if (!result) {
        denyResourceAccess()
      }
      const outcome = await resolveStudentAttachmentResource(result.studentId)
      return { schoolId, ...outcome }
    }
    case AttachmentOwnerKind.ReportCard: {
      const result = await repositories.results.findById(ownerId)
      if (!result) {
        denyResourceAccess()
      }
      const outcome = await resolveStudentAttachmentResource(result.studentId)
      return { schoolId, ...outcome }
    }
    case AttachmentOwnerKind.Payment: {
      const payment = await repositories.payments.findById(ownerId)
      if (!payment) {
        denyResourceAccess()
      }
      const studentFee = await repositories.studentFees.findById(payment.studentFeeId)
      if (!studentFee) {
        denyResourceAccess()
      }
      const result = await resolveStudentAttachmentResource(studentFee.studentId)
      return { schoolId, ...result }
    }
    case AttachmentOwnerKind.Other:
      throw new Error('Attachment owner kind other is not supported by the selected public contract')
  }
}
