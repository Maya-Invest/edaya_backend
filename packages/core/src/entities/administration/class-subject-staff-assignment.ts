import type { StaffAssignmentArgs } from './staff-assignment'
import { StaffAssignment } from './staff-assignment'

export type ClassSubjectStaffAssignmentArgs = Omit<StaffAssignmentArgs, 'classGroupId' | 'sessionId' | 'groupedSessionId'> & {
  classSubjectId: string
}

export class ClassSubjectStaffAssignment extends StaffAssignment {
  constructor(args: ClassSubjectStaffAssignmentArgs) {
    super({ ...args })
  }
}
