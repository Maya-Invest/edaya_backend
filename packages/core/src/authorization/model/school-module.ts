/** Coarse school feature areas used for portal module gating at workflow entry points. */
export type SchoolModule =
  | 'setup'
  | 'students'
  | 'academics'
  | 'assessments'
  | 'scheduling'
  | 'attendance'
  | 'finance'
  | 'communications'
  | 'behavior'

/** Portal actors may only enter workflows for these modules before finer permission checks. */
export const PORTAL_ACCESSIBLE_MODULES: ReadonlySet<SchoolModule> = new Set([
  'attendance',
  'finance',
  'academics',
  'assessments',
])
