import type { StaffAssignmentArgs } from './staff-assignment'
import { StaffAssignment } from './staff-assignment'

export type ClassStaffAssignmentArgs = Omit<StaffAssignmentArgs, 'classSubjectId' | 'sessionId' | 'groupedSessionId'> & {
  classGroupId: string
}

export class ClassStaffAssignment extends StaffAssignment {
  constructor(args: ClassStaffAssignmentArgs) {
    super({ ...args })
  }
}
