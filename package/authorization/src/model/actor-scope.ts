/** Active subject-teacher placements (capabilities scoped per classSubjectId). */
export interface TeachingScope {
  readonly classSubjectIds: readonly string[]
}

/** Active homeroom placements (capabilities scoped per classGroupId). */
export interface HomeroomScope {
  readonly classGroupIds: readonly string[]
}

/** Combined teacher session scope. */
export interface TeacherActorScope {
  readonly teaching: TeachingScope
  readonly homeroom: HomeroomScope
}

export const EMPTY_TEACHER_SCOPE: TeacherActorScope = Object.freeze({
  teaching: Object.freeze({ classSubjectIds: Object.freeze([]) }),
  homeroom: Object.freeze({ classGroupIds: Object.freeze([]) }),
})

export interface GuardianScope {
  readonly studentIds: readonly string[]
  readonly classGroupIds: readonly string[]
}

export const EMPTY_GUARDIAN_SCOPE: GuardianScope = Object.freeze({
  studentIds: Object.freeze([]),
  classGroupIds: Object.freeze([]),
})

export interface StudentScope {
  readonly studentId: string
  readonly classGroupId?: string
}

export type PortalActorScope = GuardianScope | StudentScope | TeacherActorScope
