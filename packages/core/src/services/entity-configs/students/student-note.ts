import type { ActorMetadata } from '../../../authorization'
import type { StudentClassEnrollment } from '../../../entities'
import type { StudentNote } from '../../../entities/students/student-note'
import type { SchoolRepositories } from '../../../ports'
import type { EntityConfigFactory } from '../../../shared/common'
import { denyResourceAccess } from '../../../authorization'
import { StaffRole } from '../../../entities'
import { StudentNoteVisibility } from '../../../entities/students/student-note'
import { dateTime, directEntityConfig, readByIds } from '../../../shared/common'

export const studentNoteConfig: EntityConfigFactory<StudentNote> = (input) => {
  const config = directEntityConfig(
    input,
    input.repositories.studentNotes,
    'queries.read_student_detail',
    'students.manage_notes',
    readByIds((actor, ids) => input.policy.checkStudentNoteAccess(actor, ids)),
  )
  return {
    ...config,
    gates: {
      preSave: validateStudentNoteSave,
    },
  }
}

export async function validateStudentNoteSave(
  note: StudentNote,
  existing: StudentNote | undefined,
  repositories: SchoolRepositories,
  actor: ActorMetadata,
): Promise<void> {
  const student = await repositories.students.findById(note.studentId)
  if (!student || student.schoolId !== note.schoolId) {
    denyResourceAccess()
  }
  const staffActorId = requireStaffActorId(actor)
  if (note.visibility === StudentNoteVisibility.AdminOnly && !await hasFullStudentRecordAccess(actor, repositories)) {
    denyResourceAccess()
  }
  if (existing) {
    if (existing.schoolId !== note.schoolId || existing.studentId !== note.studentId || existing.authorStaffId !== note.authorStaffId) {
      denyResourceAccess()
    }
    if (existing.authorStaffId !== staffActorId && !await hasFullStudentRecordAccess(actor, repositories)) {
      denyResourceAccess()
    }
  }
}

function requireStaffActorId(actor: ActorMetadata): string {
  if (actor.kind !== 'staff') {
    denyResourceAccess()
  }
  return actor.staffMemberId
}

async function hasFullStudentRecordAccess(actor: ActorMetadata, repositories: SchoolRepositories): Promise<boolean> {
  if (actor.kind !== 'staff') {
    return false
  }
  const staffMember = await repositories.staffMembers.findById(actor.staffMemberId)
  return staffMember?.roles.some(role =>
    role === StaffRole.Admin
    || role === StaffRole.Principal
    || role === StaffRole.Coordinator) ?? false
}

export function progressionDecisionChanged(
  entity: StudentClassEnrollment,
  existing: StudentClassEnrollment,
): boolean {
  return entity.progressionDecision !== existing.progressionDecision
    || dateTime(entity.progressionDecidedAt) !== dateTime(existing.progressionDecidedAt)
    || entity.progressionDecidedBy !== existing.progressionDecidedBy
    || entity.progressionNotes !== existing.progressionNotes
}
