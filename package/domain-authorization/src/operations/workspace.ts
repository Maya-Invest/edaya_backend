import { GuardianCapability } from '../capabilities/guardian-capability'
import { HomeroomCapability } from '../capabilities/homeroom-capability'
import { StudentCapability } from '../capabilities/student-capability'
import { TeachingCapability } from '../capabilities/teaching-capability'
import { Permission } from '../permissions/permission'
import { defineOperationFamily } from './define-operation'

export const WorkspaceOperations = defineOperationFamily({
  read: {
    id: 'workspace.read',
    global: true,
    staff: { permission: Permission.QUERY_WORKSPACE_READ },
    teacher: {
      anyOf: [
        { capability: TeachingCapability.ReadSubjectRoster },
        { capability: HomeroomCapability.ReadClassRoster },
      ],
    },
    guardian: { capability: GuardianCapability.ReadWorkspaceShell },
    student: { capability: StudentCapability.ReadWorkspaceShell },
  },
})
