import type { DisciplinaryAction } from '../../../entities/students/disciplinary-action'
import type { EntityConfigFactory } from '../../../shared'
import { directEntityConfig } from '../../../shared'

export const disciplinaryActionConfig: EntityConfigFactory<DisciplinaryAction> = input =>
  directEntityConfig(input, input.repositories.disciplinaryActions, 'behavior.read_incidents', 'behavior.manage_discipline')
