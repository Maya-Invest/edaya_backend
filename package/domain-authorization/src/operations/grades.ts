import { GuardianCapability } from '../capabilities/guardian-capability'
import { HomeroomCapability } from '../capabilities/homeroom-capability'
import { StudentCapability } from '../capabilities/student-capability'
import { TeachingCapability } from '../capabilities/teaching-capability'
import { Permission } from '../permissions/permission'
import { defineOperationFamily } from './define-operation'

export const GradeOperations = defineOperationFamily({
  read: {
    id: 'grades.read',
    staff: { permission: Permission.GRADE_READ },
    teacher: {
      anyOf: [
        { capability: TeachingCapability.ReadSubjectGrades, target: 'classSubject' },
        { capability: HomeroomCapability.ReadClassGradesOverview, target: 'classGroup' },
      ],
    },
    guardian: { capability: GuardianCapability.ReadGrades, target: 'student' },
    student: { capability: StudentCapability.ReadGrades },
  },
  input: {
    id: 'grades.input',
    requiresContext: ['classSubjectId'],
    staff: { permission: Permission.GRADE_INPUT },
    teacher: { capability: TeachingCapability.InputGrade, target: 'classSubject' },
  },
})
