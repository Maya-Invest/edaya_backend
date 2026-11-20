export const INTERACTIVE_ACTOR_KIND_HEADER = 'x-actor-kind'
export const INTERACTIVE_ACTOR_ID_HEADER = 'x-actor-id'
export const INTERACTIVE_SCHOOL_ID_HEADER = 'x-school-id'

export type InteractiveActorKind = 'staff' | 'guardian' | 'student' | 'teacher' | 'platform'

export const INTERACTIVE_ACTOR_KINDS: readonly InteractiveActorKind[] = [
  'staff',
  'guardian',
  'student',
  'teacher',
  'platform',
]

export function parseInteractiveActorKind(value: string | undefined): InteractiveActorKind | undefined {
  const normalized = value?.trim().toLowerCase()
  if (
    normalized === 'staff'
    || normalized === 'guardian'
    || normalized === 'student'
    || normalized === 'teacher'
    || normalized === 'platform'
  ) {
    return normalized
  }
  return undefined
}
