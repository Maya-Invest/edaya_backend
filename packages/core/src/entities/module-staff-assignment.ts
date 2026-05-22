import type { StaffAssignmentArgs } from './staff-assignment'
import { StaffAssignment } from './staff-assignment'

export type ModuleStaffAssignmentArgs = Omit<StaffAssignmentArgs, 'classroomId' | 'sessionId' | 'groupedSessionId'> & {
  moduleId: string
}

export class ModuleStaffAssignment extends StaffAssignment {
  constructor(args: ModuleStaffAssignmentArgs) {
    super({ ...args })
  }
}
