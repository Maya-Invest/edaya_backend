import type { DisciplinaryAction } from '../../../entities/students/disciplinary-action'
import type { EntityConfigFactory } from '../../../shared'
import { Permission } from '../../../authorization'
import { directPermissionEntityConfig } from '../../../shared'

export const disciplinaryActionConfig: EntityConfigFactory<DisciplinaryAction> = input =>
  directPermissionEntityConfig(
    input,
    input.repositories.disciplinaryActions,
    Permission.DISCIPLINE_READ,
    Permission.DISCIPLINE_VALIDATE,
  )
