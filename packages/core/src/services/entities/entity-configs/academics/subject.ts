import type { Subject } from '../../../../entities/academics/subject'
import type { EntityConfigFactory } from '../../../shared/common'
import { directEntityConfig } from '../../../shared/common'

export const subjectConfig: EntityConfigFactory<Subject> = input =>
  directEntityConfig(input, input.repositories.subjects, 'queries.read_class_curriculum', 'academics.manage_curriculum')
