import type { Subject } from '@edaya/core'
import type { EntityConfigFactory } from '../../entity-config'

import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/academics/subject.ts (PR3)
export const subjectConfig: EntityConfigFactory<Subject> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.subjects,
    tenant: directSchoolTenant(),
    resource: 'subjects',

    atomicExecution,
  })
