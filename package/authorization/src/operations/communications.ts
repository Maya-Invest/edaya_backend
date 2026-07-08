import { GuardianCapability } from '../capabilities/guardian-capability'
import { StudentCapability } from '../capabilities/student-capability'
import { Permission } from '../permissions/permission'
import { defineOperationFamily } from './define-operation'

export const CommunicationsOperations = defineOperationFamily({
  read: {
    id: 'communications.read',
    global: true,
    staff: { permission: Permission.QUERY_COMMUNICATIONS_READ },
    guardian: { capability: GuardianCapability.ReadCommunications },
    student: { capability: StudentCapability.ReadCommunications },
  },
  create: {
    id: 'communications.create',
    global: true,
    staff: { permission: Permission.COMMUNICATION_CREATE },
  },
})
