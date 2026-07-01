import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { SchoolRepositories } from '../../ports/repositories/school-repositories'
import { z } from 'zod'
import { directPermissionEntityConfig } from '../../application/entities/entity-config'
import { Permission } from '../../capabilities/authorization'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { parseDomain, zodDate } from '../shared/utils'

export enum ActivityCategory {
  Sport = 'Sport',
  Arts = 'Arts',
  Science = 'Science',
  Language = 'Language',
  Wellbeing = 'Wellbeing',
}

export const activityBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  category: z.nativeEnum(ActivityCategory),
  coach: z.string().trim().min(1, 'coach must not be blank'),
  schedule: z.string().trim().min(1, 'schedule must not be blank'),
  participants: z.number().int().nonnegative(),
  capacity: z.number().int().positive(),
  description: z.string().trim().min(1, 'description must not be blank'),
  startDate: zodDate(),
  endDate: zodDate(),
  createdAt: zodDate().default(() => new Date()),
})

function refineActivity(
  data: { startDate?: Date, endDate?: Date, participants?: number, capacity?: number },
  ctx: z.RefinementCtx,
) {
  if (data.startDate && data.endDate && data.startDate.getTime() > data.endDate.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'startDate must not be after endDate',
    })
  }
  if (data.participants !== undefined && data.capacity !== undefined && data.participants > data.capacity) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'participants must not exceed capacity',
    })
  }
}

export const activitySchema = activityBaseSchema.superRefine(refineActivity)

export type ActivityData = z.infer<typeof activitySchema>
export type ActivityInput = z.input<typeof activitySchema>

export const activityCreateSchema = activityBaseSchema
  .omit({ createdAt: true })
  .superRefine(refineActivity)
export const activityUpdateSchema = activityBaseSchema
  .partial()
  .required({ id: true })
  .superRefine(refineActivity)

/**
 * School activity offered outside regular class hours (clubs, sports, workshops).
 */
export class Activity {
  readonly data: ActivityData

  constructor(args: ActivityInput) {
    this.data = parseDomain(activitySchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get name() { return this.data.name }
  get category() { return this.data.category }
  get coach() { return this.data.coach }
  get schedule() { return this.data.schedule }
  get participants() { return this.data.participants }
  get capacity() { return this.data.capacity }
  get description() { return this.data.description }
  get startDate() { return this.data.startDate }
  get endDate() { return this.data.endDate }
  get createdAt() { return this.data.createdAt }
}

export const activityConfig: EntityConfigFactory<Activity> = (input) => {
  const config = directPermissionEntityConfig(
    input,
    input.repositories.activities,
    Permission.QUERY_CALENDAR_READ,
    Permission.DISCIPLINE_CREATE,
  )
  return {
    ...config,
    gates: {
      preDelete: validateActivityDelete,
    },
  }
}

async function validateActivityDelete(
  activity: Activity,
  repositories: SchoolRepositories,
): Promise<void> {
  const enrollments = await repositories.activityEnrollments.list({ activityId: activity.id })
  if (enrollments.length > 0) {
    throw new BusinessRuleViolationError(
      'ACTIVITY_HAS_DEPENDENCIES',
      `Cannot delete activity ${activity.id}: enrollments still exist`,
    )
  }
}
