import { GuardianCapability } from '../capabilities/guardian-capability'
import { HomeroomCapability } from '../capabilities/homeroom-capability'
import { StudentCapability } from '../capabilities/student-capability'
import { TeachingCapability } from '../capabilities/teaching-capability'
import { Permission } from '../permissions/permission'
import { CLASS_GROUP_ACCESS_PERMISSIONS } from '../policy/resolvers/permission-sets'
import { defineOperationFamily } from './define-operation'

const classGroupTeacherRead = {
  anyOf: [
    { capability: TeachingCapability.ReadSubjectRoster, target: 'classSubject' as const },
    { capability: HomeroomCapability.ReadClassRoster, target: 'classGroup' as const },
    { capability: TeachingCapability.ReadSubjectGrades, target: 'classSubject' as const },
    { capability: HomeroomCapability.ReadClassGradesOverview, target: 'classGroup' as const },
    { capability: TeachingCapability.ReadSubjectAttendance, target: 'classSubject' as const },
    { capability: HomeroomCapability.ReadClassAttendance, target: 'classGroup' as const },
    { capability: TeachingCapability.ReadSubjectLogbook, target: 'classSubject' as const },
    { capability: HomeroomCapability.ReadClassLogbook, target: 'classGroup' as const },
    { capability: TeachingCapability.CreateSubjectDisciplineIncident, target: 'classSubject' as const },
    { capability: HomeroomCapability.CreateClassDisciplineIncident, target: 'classGroup' as const },
    { capability: TeachingCapability.InputGrade, target: 'classSubject' as const },
    { capability: TeachingCapability.CreateLogbookEntry, target: 'classSubject' as const },
    { capability: TeachingCapability.UpdateLogbookEntry, target: 'classSubject' as const },
    { capability: TeachingCapability.RecordSessionAttendance, target: 'classSubject' as const },
    { capability: HomeroomCapability.RecordDailyAttendance, target: 'classGroup' as const },
  ],
}

export const SchoolStructureOperations = defineOperationFamily({
  classGroupRead: {
    id: 'school-structure.class-group.read',
    staff: {
      anyOf: CLASS_GROUP_ACCESS_PERMISSIONS.map(permission => ({ permission })),
    },
    guardian: { capability: GuardianCapability.ReadWorkspaceShell },
    student: { capability: StudentCapability.ReadWorkspaceShell },
    teacher: classGroupTeacherRead,
  },
  staffRead: {
    id: 'school-structure.staff.read',
    staff: {
      anyOf: [
        { permission: Permission.QUERY_WORKSPACE_READ },
        { permission: Permission.SCHOOL_STRUCTURE_CONFIGURE },
        { permission: Permission.STAFF_READ },
      ],
    },
  },
  configure: {
    id: 'school-structure.configure',
    global: true,
    staff: { permission: Permission.SCHOOL_STRUCTURE_CONFIGURE },
  },
  lifecycleManage: {
    id: 'school-structure.lifecycle.manage',
    global: true,
    staff: { permission: Permission.SCHOOL_LIFECYCLE_MANAGE },
  },
})
