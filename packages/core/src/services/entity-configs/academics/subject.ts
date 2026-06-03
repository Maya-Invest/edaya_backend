import type { Subject } from '../../../entities/academics/subject'
import type { EntityConfigFactory } from '../../../shared'
import { directEntityConfig } from '../../../shared'

export const subjectConfig: EntityConfigFactory<Subject> = input =>
  directEntityConfig(input, input.repositories.subjects, 'queries.read_class_curriculum', 'academics.manage_curriculum')
