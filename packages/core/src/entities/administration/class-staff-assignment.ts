import type { StaffAssignmentArgs } from './staff-assignment'
import { StaffAssignment } from './staff-assignment'

export type ClassStaffAssignmentArgs = Omit<StaffAssignmentArgs, 'moduleId' | 'sessionId' | 'groupedSessionId'> & {
  classroomId: string
}

export class ClassStaffAssignment extends StaffAssignment {
  constructor(args: ClassStaffAssignmentArgs) {
    super({ ...args })
  }
}
