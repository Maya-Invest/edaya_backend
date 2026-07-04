import type { ScopeGrant } from '../model/scope-grant'
import type { Permission } from '../permissions/permission'
import { permissionDefinitions } from '../permissions/permission-definitions'
import { parseScopeIds } from '../scope/scope-ids-parse'
import { mergeScopeGrants } from './scope-grant-covers'

function collectStudentEntityIds(scopeIds: string): string[] {
  const ids = new Set<string>()
  const parsed = parseScopeIds(scopeIds)

  for (const clause of parsed.clauses) {
    for (const path of clause.paths) {
      const id = path.segments[0]
      if (id && id !== '*') {
        ids.add(id)
      }
    }
  }

  return [...ids]
}

function collectClassGroupEntityIds(scopeIds: string): string[] {
  const ids = new Set<string>()
  const parsed = parseScopeIds(scopeIds)

  for (const clause of parsed.clauses) {
    for (const path of clause.paths) {
      const root = path.segments[0]
      if (root && root !== '*') {
        ids.add(root)
      }
    }
  }

  return [...ids]
}

function collectClassSubjectEntityIds(scopeIds: string): {
  classSubjectIds: string[]
  classGroupIds: string[]
} {
  const classSubjectIds = new Set<string>()
  const classGroupIds = new Set<string>()
  const parsed = parseScopeIds(scopeIds)

  for (const clause of parsed.clauses) {
    for (const path of clause.paths) {
      const segments = path.segments
      if (segments.length >= 2 && segments[1] === '*') {
        const classGroupId = segments[0]
        if (classGroupId && classGroupId !== '*') {
          classGroupIds.add(classGroupId)
        }
        continue
      }

      const leaf = segments.at(-1)
      if (leaf && leaf !== '*') {
        classSubjectIds.add(leaf)
      }
    }
  }

  return {
    classSubjectIds: [...classSubjectIds],
    classGroupIds: [...classGroupIds],
  }
}

/**
 * Best-effort bridge from path-based `scopeIdsByPermission` to legacy `scopeGrants`
 * for API consumers (mobile) that still parse `scopeType` + `scopeEntityIds`.
 */
export function legacyScopeGrantsFromScopeIdsByPermission(
  scopeIdsByPermission: Readonly<Partial<Record<Permission, string>>> | undefined,
): ScopeGrant[] {
  if (!scopeIdsByPermission) {
    return []
  }

  const grants: ScopeGrant[] = []

  for (const [permission, scopeIds] of Object.entries(scopeIdsByPermission) as [Permission, string][]) {
    if (!scopeIds) {
      continue
    }

    const catalogScope = permissionDefinitions[permission]?.scope
    if (!catalogScope) {
      continue
    }

    if (catalogScope === 'student') {
      const scopeEntityIds = collectStudentEntityIds(scopeIds)
      if (scopeEntityIds.length > 0) {
        grants.push({
          permission,
          scopeType: 'student',
          scopeEntityIds,
        })
      }
      continue
    }

    if (catalogScope === 'class_group') {
      const scopeEntityIds = collectClassGroupEntityIds(scopeIds)
      if (scopeEntityIds.length > 0) {
        grants.push({
          permission,
          scopeType: 'class_group',
          scopeEntityIds,
        })
      }
      continue
    }

    if (catalogScope === 'class_subject') {
      const { classSubjectIds, classGroupIds } = collectClassSubjectEntityIds(scopeIds)
      if (classSubjectIds.length > 0) {
        grants.push({
          permission,
          scopeType: 'course_assignment',
          scopeEntityIds: classSubjectIds,
        })
      }
      if (classGroupIds.length > 0) {
        grants.push({
          permission,
          scopeType: 'class_group',
          scopeEntityIds: classGroupIds,
        })
      }
    }
  }

  return mergeScopeGrants(grants)
}
