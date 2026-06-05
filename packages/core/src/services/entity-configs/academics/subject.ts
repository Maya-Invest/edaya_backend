import type { Subject } from '../../../entities/academics/subject'
import type { EntityConfigFactory } from '../../../shared'
import { Permission } from '../../../authorization'
import { directPermissionEntityConfig } from '../../../shared'

export const subjectConfig: EntityConfigFactory<Subject> = input =>
  directPermissionEntityConfig(
    input,
    input.repositories.subjects,
    Permission.QUERY_CLASS_CURRICULUM_READ,
    Permission.ACADEMIC_PROGRAM_UPDATE,
  )
