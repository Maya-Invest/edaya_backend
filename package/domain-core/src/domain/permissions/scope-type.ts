import type { GrantScope } from './grant-scope'

/** Scope grain declared on the canonical action catalog. */
export type ScopeType = Exclude<GrantScope['kind'], 'school' | 'all'> | 'platform'
