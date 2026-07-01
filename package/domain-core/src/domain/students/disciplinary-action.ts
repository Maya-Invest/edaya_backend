import type { EntityConfigFactory } from '../../application/entities/entity-config'
import { z } from 'zod'
import { directPermissionEntityConfig } from '../../application/entities/entity-config'
import { Permission } from '../../capabilities/authorization'
import { parseDomain, zodDate } from '../shared/utils'

export enum DisciplinaryActionKind {
  Sanction = 'sanction',
  Reward = 'reward',
}

export const disciplinaryActionBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  kind: z.nativeEnum(DisciplinaryActionKind).default(DisciplinaryActionKind.Sanction),
  severity: z.number().finite().positive('severity must be a finite, strictly positive number').nullable().optional().transform(v => v === null ? undefined : v),
  defaultDurationDays: z.number().int().positive('defaultDurationDays must be a strictly positive integer').nullable().optional().transform(v => v === null ? undefined : v),
  description: z.string().trim().min(1, 'description must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

export const disciplinaryActionSchema = disciplinaryActionBaseSchema

export type DisciplinaryActionData = z.infer<typeof disciplinaryActionSchema>
export type DisciplinaryActionInput = z.input<typeof disciplinaryActionSchema>

export const disciplinaryActionCreateSchema = disciplinaryActionBaseSchema.omit({ createdAt: true })
export const disciplinaryActionUpdateSchema = disciplinaryActionBaseSchema.partial().required({ id: true })

/**
 * Defines a standardized disciplinary action in the school's catalog.
 * Used to formalize possible sanctions (warning, detention, suspension)
 * and rewards (merit badge, commendation) applied to students via incidents.
 */
export class DisciplinaryAction {
  readonly data: DisciplinaryActionData

  constructor(args: DisciplinaryActionInput) {
    this.data = parseDomain(disciplinaryActionSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get name() { return this.data.name }
  get kind() { return this.data.kind }
  get severity() { return this.data.severity }
  get defaultDurationDays() { return this.data.defaultDurationDays }
  get description() { return this.data.description }
  get createdAt() { return this.data.createdAt }
}

export const disciplinaryActionConfig: EntityConfigFactory<DisciplinaryAction> = input =>
  directPermissionEntityConfig(
    input,
    input.repositories.disciplinaryActions,
    Permission.DISCIPLINE_READ,
    Permission.DISCIPLINE_VALIDATE,
  )
