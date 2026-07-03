import type { PlatformScopeType, PortalScopeType, ScopeType, StaffGrantScopeType } from '../permissions/scope-type'

export interface ScopeSegmentBounds {
  readonly min: number
  readonly max: number
}

export function scopeSegmentBounds(scope: StaffGrantScopeType): ScopeSegmentBounds {
  switch (scope) {
    case 'grade_level':
    case 'class_group':
      return { min: 1, max: 1 }
    case 'grade_level_subject':
    case 'class_subject':
      return { min: 2, max: 2 }
    case 'activity':
      return { min: 1, max: 2 }
  }
}

/** Entity scope at `segmentIndex` for a path of `pathLength` under `permissionScope`. */
export function segmentScopeAt(
  permissionScope: ScopeType,
  segmentIndex: number,
  pathLength: number,
): StaffGrantScopeType | PortalScopeType | PlatformScopeType {
  switch (permissionScope) {
    case 'grade_level':
      return segmentIndex === 0 ? 'grade_level' : 'grade_level_subject'
    case 'grade_level_subject':
      return segmentIndex === 0 ? 'grade_level' : 'grade_level_subject'
    case 'class_group':
      return 'class_group'
    case 'class_subject':
      return segmentIndex === 0 ? 'class_group' : 'class_subject'
    case 'activity':
      if (pathLength === 1) {
        return 'activity'
      }
      return segmentIndex === 0 ? 'class_group' : 'activity'
    case 'student':
    case 'platform':
      return permissionScope
  }
}
