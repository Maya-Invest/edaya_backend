import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { SchoolRepositories } from '../../ports'
import { z } from 'zod'
import { directPermissionEntityConfig, readByIds, teacherSelfReadModule } from '../../application/entities/entity-config'
import { Permission } from '../../capabilities/authorization'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { parseDomain, zodDate } from '../shared/utils'

export const teacherSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  firstName: z.string().trim().min(1, 'firstName must not be blank'),
  lastName: z.string().trim().min(1, 'lastName must not be blank'),
  photoUrl: z.string().trim().min(1, 'photoUrl must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  email: z.string().trim().min(1, 'email must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  phone: z.string().trim().min(1, 'phone must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  notificationEmail: z.string().trim().min(1, 'notificationEmail must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  notificationPhone: z.string().trim().min(1, 'notificationPhone must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  subjectId: z.string().trim().min(1, 'subjectId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  isActive: z.boolean().default(true),
  createdAt: zodDate().default(() => new Date()),
})

export type TeacherData = z.infer<typeof teacherSchema>
export type TeacherInput = z.input<typeof teacherSchema>

export const teacherCreateSchema = teacherSchema.omit({ createdAt: true })
export const teacherUpdateSchema = teacherSchema.partial().required({ id: true })

/** Dedicated teacher portal actor — not a staff member. */
export class Teacher {
  readonly data: TeacherData

  constructor(args: TeacherInput) {
    this.data = parseDomain(teacherSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get firstName() { return this.data.firstName }
  get lastName() { return this.data.lastName }
  get photoUrl() { return this.data.photoUrl }
  get email() { return this.data.email }
  get phone() { return this.data.phone }
  get notificationEmail() { return this.data.notificationEmail }
  get notificationPhone() { return this.data.notificationPhone }
  get subjectId() { return this.data.subjectId }
  get isActive() { return this.data.isActive }
  get createdAt() { return this.data.createdAt }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`
  }

  copyWith(changes: Partial<TeacherInput>): Teacher {
    return new Teacher({ ...this.data, ...changes })
  }
}

export const teacherConfig: EntityConfigFactory<Teacher> = (input) => {
  const config = directPermissionEntityConfig(
    input,
    input.repositories.teachers,
    Permission.ACCESS_CONTROL_ASSIGN,
    Permission.ACCESS_CONTROL_ASSIGN,
    readByIds(async (actor, ids) => {
      if (actor.kind === 'teacher' && ids.every(id => id === actor.teacherId)) {
        return
      }
      await input.policy.checkTeacherAccess(actor, ids)
    }),
  )
  config.read.checkModule = teacherSelfReadModule()
  return {
    ...config,
    gates: {
      preDelete: validateTeacherDelete,
    },
  }
}

async function validateTeacherDelete(
  teacher: Teacher,
  repositories: SchoolRepositories,
): Promise<void> {
  const assignments = await repositories.teacherAssignments.list({ teacherId: teacher.id })
  if (assignments.length > 0) {
    throw new BusinessRuleViolationError('TEACHER_HAS_DEPENDENCIES', `Cannot delete teacher ${teacher.id}: dependent records still exist`)
  }
}
