import type { ParsedScopePath } from './scope-ids-parse'

function pathCoversResource(grantPath: ParsedScopePath, resourceSegments: readonly string[]): boolean {
  const grantSegments = grantPath.segments

  if (resourceSegments.length === 1 && grantSegments.length >= 1) {
    const leaf = grantSegments[grantSegments.length - 1]
    if (leaf === '*' || leaf === resourceSegments[0]) {
      return true
    }
  }

  if (grantSegments.length > resourceSegments.length) {
    return false
  }

  for (let index = 0; index < grantSegments.length; index++) {
    const grantSegment = grantSegments[index]
    if (grantSegment === '*') {
      return true
    }
    if (grantSegment !== resourceSegments[index]) {
      return false
    }
  }

  if (grantSegments.length < resourceSegments.length) {
    return grantSegments[grantSegments.length - 1] === '*'
  }

  return grantSegments.length === resourceSegments.length
}

export { pathCoversResource }
