import { GuardianCapability } from '../capabilities/guardian-capability'
import { StudentCapability } from '../capabilities/student-capability'
import { TeachingCapability } from '../capabilities/teaching-capability'
import { Permission } from '../permissions/permission'
import { LOGBOOK_ACCESS_PERMISSIONS } from '../policy/resolvers/permission-sets'
import { defineOperationFamily } from './define-operation'

export const LogbookOperations = defineOperationFamily({
  read: {
    id: 'logbook.read',
    staff: {
      anyOf: LOGBOOK_ACCESS_PERMISSIONS.map(permission => ({ permission })),
    },
    guardian: { capability: GuardianCapability.ReadLogbook, target: 'student' },
    student: { capability: StudentCapability.ReadLogbook },
    teacher: { capability: TeachingCapability.ReadSubjectLogbook, target: 'classSubject' },
  },
  create: {
    id: 'logbook.create',
    requiresContext: ['classSubjectId'],
    staff: { permission: Permission.CLASS_LOGBOOK_CREATE },
    teacher: { capability: TeachingCapability.CreateLogbookEntry, target: 'classSubject' },
  },
  update: {
    id: 'logbook.update',
    requiresContext: ['classSubjectId'],
    staff: { permission: Permission.CLASS_LOGBOOK_UPDATE },
    teacher: { capability: TeachingCapability.UpdateLogbookEntry, target: 'classSubject' },
  },
})
