import { GuardianCapability } from '../capabilities/guardian-capability'
import { HomeroomCapability } from '../capabilities/homeroom-capability'
import { StudentCapability } from '../capabilities/student-capability'
import { TeachingCapability } from '../capabilities/teaching-capability'
import { Permission } from '../permissions/permission'
import { ASSESSMENT_ACCESS_PERMISSIONS } from '../policy/resolvers/permission-sets'
import { defineOperationFamily } from './define-operation'

export const AssessmentOperations = defineOperationFamily({
  read: {
    id: 'assessments.read',
    staff: {
      anyOf: ASSESSMENT_ACCESS_PERMISSIONS.map(permission => ({ permission })),
    },
    teacher: {
      anyOf: [
        { capability: TeachingCapability.ReadSubjectGrades, target: 'classSubject' },
        { capability: TeachingCapability.ReadSubjectAssessments, target: 'classSubject' },
        { capability: HomeroomCapability.ReadClassGradesOverview, target: 'classGroup' },
      ],
    },
    guardian: { capability: GuardianCapability.ReadGrades, target: 'student' },
    student: { capability: StudentCapability.ReadGrades },
  },
  create: {
    id: 'assessments.create',
    requiresContext: ['classSubjectId'],
    staff: { permission: Permission.GRADE_INPUT },
    teacher: { capability: TeachingCapability.CreateSubjectAssessment, target: 'classSubject' },
  },
  update: {
    id: 'assessments.update',
    requiresContext: ['classSubjectId'],
    staff: { permission: Permission.GRADE_INPUT },
    teacher: { capability: TeachingCapability.UpdateSubjectAssessment, target: 'classSubject' },
  },
})
