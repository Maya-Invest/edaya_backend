import { GuardianCapability } from '../capabilities/guardian-capability'
import { HomeroomCapability } from '../capabilities/homeroom-capability'
import { StudentCapability } from '../capabilities/student-capability'
import { TeachingCapability } from '../capabilities/teaching-capability'
import { Permission } from '../permissions/permission'
import { defineOperationFamily } from './define-operation'

const teacherAssignmentGate = {
  anyOf: [
    { capability: TeachingCapability.ReadSubjectRoster, target: 'classSubject' as const },
    { capability: HomeroomCapability.ReadClassRoster, target: 'classGroup' as const },
  ],
}

export const AttachmentOperations = defineOperationFamily({
  read: {
    id: 'attachments.read',
    staff: { permission: Permission.ATTACHMENT_READ },
    guardian: { capability: GuardianCapability.ReadAttachments },
    student: { capability: StudentCapability.ReadAttachments },
    teacher: teacherAssignmentGate,
  },
  configure: {
    id: 'attachments.configure',
    staff: { permission: Permission.ATTACHMENT_CONFIGURE },
  },
})
