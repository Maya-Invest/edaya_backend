import type { Subject } from '@edaya/core'
import type { EntityConfigFactory } from '../../entity-config'
import { AcademicsOperations } from '@edaya/authorization'
import { authorizeDeleteByReadAccess, authorizeExistingById, config, noopReadAccess, operationModule, read, write } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/academics/subject.ts (PR3)
export const subjectConfig: EntityConfigFactory<Subject> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.subjects,
    tenant: directSchoolTenant(),
    read: read(operationModule(AcademicsOperations.programRead), noopReadAccess),
    write: write(
      operationModule(AcademicsOperations.programUpdate),
      authorizeExistingById(noopReadAccess),
      authorizeDeleteByReadAccess(noopReadAccess),
    ),
    atomicExecution,
  })
