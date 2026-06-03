import type { Guardian } from '../../../entities/students/guardian'
import type { EntityConfigFactory } from '../../../shared'
import { directEntityConfig, readByIds } from '../../../shared'

export const guardianConfig: EntityConfigFactory<Guardian> = input =>
  directEntityConfig(
    input,
    input.repositories.guardians,
    'queries.read_guardian_students_admin',
    'students.manage_guardians',
    readByIds((actor, ids) => input.policy.checkGuardianAccess(actor, ids)),
  )
