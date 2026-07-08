import { GuardianCapability } from '../capabilities/guardian-capability'
import { HomeroomCapability } from '../capabilities/homeroom-capability'
import { StudentCapability } from '../capabilities/student-capability'
import { TeachingCapability } from '../capabilities/teaching-capability'
import { Permission } from '../permissions/permission'
import { defineOperationFamily } from './define-operation'

const teacherAssignmentGate = {
  anyOf: [
    { capability: TeachingCapability.ReadSubjectReportCard, target: 'classSubject' as const },
    { capability: HomeroomCapability.ReadClassGradesOverview, target: 'classGroup' as const },
  ],
}

export const ReportCardOperations = defineOperationFamily({
  read: {
    id: 'report-cards.read',
    staff: {
      anyOf: [
        { permission: Permission.QUERY_REPORT_CARD_DETAIL_READ },
        { permission: Permission.GRADE_READ },
        { permission: Permission.REPORT_CARD_GENERATE },
        { permission: Permission.REPORT_CARD_CONFIGURE },
      ],
    },
    guardian: { capability: GuardianCapability.ReadReportCard, target: 'student' },
    student: { capability: StudentCapability.ReadReportCard },
    teacher: teacherAssignmentGate,
  },
  comment: {
    id: 'report-cards.comment',
    staff: { permission: Permission.REPORT_CARD_PUBLISH },
    teacher: {
      anyOf: [
        { capability: TeachingCapability.WriteSubjectReportComment, target: 'classSubject' },
        { capability: HomeroomCapability.WriteHomeroomReportComment, target: 'classGroup' },
        { capability: HomeroomCapability.WriteGroupReportComment, target: 'classGroup' },
      ],
    },
  },
})
