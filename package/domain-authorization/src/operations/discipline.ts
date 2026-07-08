import { HomeroomCapability } from '../capabilities/homeroom-capability'
import { TeachingCapability } from '../capabilities/teaching-capability'
import { Permission } from '../permissions/permission'
import { defineOperationFamily } from './define-operation'

const teacherAssignmentGate = {
  anyOf: [
    { capability: TeachingCapability.CreateSubjectDisciplineIncident, target: 'classSubject' as const },
    { capability: HomeroomCapability.CreateClassDisciplineIncident, target: 'classGroup' as const },
  ],
}

export const DisciplineOperations = defineOperationFamily({
  read: {
    id: 'discipline.read',
    staff: { permission: Permission.DISCIPLINE_READ },
    teacher: teacherAssignmentGate,
  },
  create: {
    id: 'discipline.create',
    staff: { permission: Permission.DISCIPLINE_CREATE },
    teacher: {
      anyOf: [
        { capability: TeachingCapability.CreateSubjectDisciplineIncident, target: 'classSubject' },
        { capability: HomeroomCapability.CreateClassDisciplineIncident, target: 'classGroup' },
      ],
    },
  },
  validate: {
    id: 'discipline.validate',
    global: true,
    staff: { permission: Permission.DISCIPLINE_VALIDATE },
  },
})
