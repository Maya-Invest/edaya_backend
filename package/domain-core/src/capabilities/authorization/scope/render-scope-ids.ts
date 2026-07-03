import type { Permission } from '../permissions/permission'
import type { ScopeType } from '../permissions/scope-type'
import { permissionDefinitions } from '../permissions/permission-definitions'
import { parseScopeIds } from './scope-ids-parse'
import { segmentScopeAt } from './scope-segments'

export interface RenderedScopeSegment {
  readonly id: string
  readonly scope: ScopeType
  readonly label: string
  readonly missing?: boolean
}

export interface RenderedScopeClause {
  readonly raw: string
  readonly label: string
  readonly wildcard: boolean
  readonly segments: readonly RenderedScopeSegment[]
}

export interface RenderedScopeIds {
  readonly scopeIds: string
  readonly permission?: Permission
  readonly tenantWide: boolean
  readonly clauses: readonly RenderedScopeClause[]
}

export type ScopeEntityLabelResolver = (
  scope: ScopeType,
  entityId: string,
) => Promise<string | undefined>

async function renderPath(
  path: { segments: readonly (string | '*')[] },
  catalogScope: ScopeType | undefined,
  resolveLabel: ScopeEntityLabelResolver,
): Promise<{ label: string, segments: RenderedScopeSegment[], wildcard: boolean }> {
  const segments: RenderedScopeSegment[] = []
  let wildcard = false

  for (let index = 0; index < path.segments.length; index++) {
    const segment = path.segments[index]
    if (segment === undefined || segment === '*') {
      if (segment === '*') {
        wildcard = true
      }
      continue
    }
    const scope = catalogScope
      ? segmentScopeAt(catalogScope, index, path.segments.length)
      : 'class_group'
    const label = await resolveLabel(scope, segment)
    segments.push({
      id: segment,
      scope,
      label: label ?? segment,
      ...(label ? {} : { missing: true }),
    })
  }

  return {
    label: segments.map(segment => segment.label).join(' → '),
    segments,
    wildcard,
  }
}

export async function renderScopeIds(
  scopeIds: string,
  args: {
    permission?: Permission
    resolveLabel: ScopeEntityLabelResolver
  },
): Promise<RenderedScopeIds> {
  const catalogScope = args.permission ? permissionDefinitions[args.permission].scope : undefined
  const tenantWide = scopeIds === '' && !catalogScope

  if (scopeIds === '') {
    return {
      scopeIds,
      permission: args.permission,
      tenantWide,
      clauses: [],
    }
  }

  const parsed = parseScopeIds(scopeIds)
  const clauses: RenderedScopeClause[] = []

  for (const clause of parsed.clauses) {
    const raw = clause.paths.map(path => path.segments.join(':')).join(',')
    const renderedPaths: string[] = []
    const allSegments: RenderedScopeSegment[] = []
    let wildcard = false

    for (const path of clause.paths) {
      const rendered = await renderPath(path, catalogScope, args.resolveLabel)
      renderedPaths.push(rendered.label)
      allSegments.push(...rendered.segments)
      wildcard = wildcard || rendered.wildcard
    }

    clauses.push({
      raw,
      label: renderedPaths.join(', '),
      wildcard,
      segments: allSegments,
    })
  }

  return {
    scopeIds,
    permission: args.permission,
    tenantWide,
    clauses,
  }
}
