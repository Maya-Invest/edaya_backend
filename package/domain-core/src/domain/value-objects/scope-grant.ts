import type { ScopeType } from '../../capabilities/authorization/permissions/scope-type'
import { z } from 'zod'
import { Permission } from '../../capabilities/authorization/permissions/permission'

export const scopeGrantSchema = z.object({
  permission: z.nativeEnum(Permission),
  scopeType: z.enum([
    'platform',
    'school',
    'academic_year',
    'class_group',
    'subject',
    'course_assignment',
    'session',
    'student',
    'student_group',
  ]) as z.ZodType<ScopeType>,
  scopeEntityIds: z.array(z.string()).readonly(),
})

export type ScopeGrant = z.infer<typeof scopeGrantSchema>
export type ScopeGrantInput = z.input<typeof scopeGrantSchema>
