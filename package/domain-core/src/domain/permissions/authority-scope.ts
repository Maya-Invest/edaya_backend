import { z } from 'zod'
import { grantScopeContains, grantScopeSchema } from './grant-scope'

const id = z.string().trim().min(1)

/** Manual grants use GrantScope; assignment authority keeps the exact assigned occurrence. */
export const authorityScopeSchema = z.union([
  grantScopeSchema,
  z.object({ kind: z.literal('lesson_session'), lessonSessionId: id, classGroupId: id, classSubjectId: id }).strict(),
  z.object({ kind: z.literal('activity_session'), activitySessionId: id, classGroupId: id, activityId: id }).strict(),
  z.object({ kind: z.literal('assessment'), assessmentId: id, classGroupId: id, classSubjectId: id, lessonSessionId: id.optional() }).strict(),
])
export type AuthorityScope = z.infer<typeof authorityScopeSchema>

/** Containment of already-validated placements, used only when delegating authority. */
export function authorityScopeContains(held: AuthorityScope, requested: AuthorityScope): boolean {
  if (held.kind === 'school')
    return true
  if (held.kind === 'all') {
    if (held.grain === 'class_group' && 'classGroupId' in requested && requested.classGroupId)
      return true
  }
  if (held.kind === 'class_group' && 'classGroupId' in requested)
    return requested.classGroupId === held.classGroupId
  if (held.kind === 'lesson_session')
    return 'lessonSessionId' in requested && held.lessonSessionId === requested.lessonSessionId
  if (held.kind === 'activity_session')
    return requested.kind === 'activity_session' && held.activitySessionId === requested.activitySessionId
  if (held.kind === 'assessment')
    return requested.kind === 'assessment' && held.assessmentId === requested.assessmentId
  const parsed = grantScopeSchema.safeParse(requested)
  return parsed.success && grantScopeContains(held, parsed.data)
}
