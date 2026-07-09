import { HomeroomCapability } from '../capabilities/homeroom-capability'
import { TeachingCapability } from '../capabilities/teaching-capability'
import { Permission } from '../permissions/permission'
import { defineOperationFamily } from './define-operation'

const staffStructureAdminRead = {
  anyOf: [
    { permission: Permission.ACCESS_CONTROL_ASSIGN },
    { permission: Permission.SCHOOL_STRUCTURE_CONFIGURE },
  ],
}

export const TeacherOperations = defineOperationFamily({
  selfRead: {
    id: 'teacher.self-read',
    global: true,
    staff: staffStructureAdminRead,
    teacher: { allow: true },
  },
  assignmentRead: {
    id: 'teacher.assignments.read',
    global: true,
    staff: staffStructureAdminRead,
    teacher: {
      anyOf: [
        { capability: TeachingCapability.ReadSubjectRoster, target: 'classSubject' },
        { capability: HomeroomCapability.ReadClassRoster, target: 'classGroup' },
      ],
    },
  },
})
