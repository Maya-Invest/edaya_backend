import type { StaffActivityMembersInput, StaffActivityPupilOptionsInput } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { AuthorizationError, denyResourceAccess } from '@edaya/authorization'
import { DomainValidationError, resourceAccessScope, staffActivityPupilPageSize } from '@edaya/core'
import { scopedIdCursor } from './scoped-id-cursor'

async function pupilAccess(base: BaseSchoolService, activityId: string) {
  const actor = base.actor
  if (actor.kind !== 'staff')
    denyResourceAccess()
  const access = base.access.forOperation()
  const roster = await access.activityRoster.context(activityId)
  async function membershipScope(resource: 'activityEnrollments' | 'classActivityEnrollments') {
    try {
      return await access.entity(resource).readScope()
    }
    catch (error) {
      if (error instanceof AuthorizationError)
        return resourceAccessScope(actor.schoolId, resource, [])
      throw error
    }
  }
  const members = await membershipScope('activityEnrollments')
  const links = await membershipScope('classActivityEnrollments')
  const scopes = { participants: roster.participantScope, placements: roster.placementScope, candidates: roster.candidateScope, members, links }
  return { scopes, identity: [actor.subjectId, actor.staffMemberId, actor.schoolId, actor.academicYearId, activityId, scopes] }
}

export function readStaffActivityMembers(base: BaseSchoolService, input: StaffActivityMembersInput) {
  return base.atomicExecution.execute(async () => {
    const { identity, scopes } = await pupilAccess(base, input.activityId)
    const cursor = await scopedIdCursor([...identity, 'members'], input.cursor, 'Invalid activity membership cursor')
    const result = await base.repositories.staffActivityPupils.members(scopes, input, cursor.after)
    const items = result.items.slice(0, staffActivityPupilPageSize)
    return { ...result, items, nextCursor: result.items.length > items.length ? cursor.encode(items[items.length - 1]!.id) : null }
  }, { readSnapshot: true })
}

function pupilSortPosition(value?: string) {
  if (value === undefined)
    return undefined
  try {
    const pair: unknown = JSON.parse(value)
    if (Array.isArray(pair) && pair.length === 2 && typeof pair[0] === 'string' && typeof pair[1] === 'string')
      return { name: pair[0], id: pair[1] }
  }
  catch {}
  throw new DomainValidationError('Invalid activity pupil cursor')
}

export function readStaffActivityPupilOptions(base: BaseSchoolService, input: StaffActivityPupilOptionsInput) {
  return base.atomicExecution.execute(async () => {
    const { identity, scopes } = await pupilAccess(base, input.activityId)
    const cursor = await scopedIdCursor([...identity, 'pupils', input.q ?? '', input.classGroupId ?? ''], input.cursor, 'Invalid activity pupil cursor')
    const classes = await scopedIdCursor([...identity, 'classes'], input.classCursor, 'Invalid activity class cursor')
    const result = await base.repositories.staffActivityPupils.options(scopes, input, pupilSortPosition(cursor.after), classes.after)
    const items = result.items.slice(0, staffActivityPupilPageSize)
    const last = items.at(-1)
    const classGroupIds = result.classGroupIds.slice(0, staffActivityPupilPageSize)
    return {
      items,
      classGroupIds,
      nextCursor: last && result.items.length > items.length ? cursor.encode(JSON.stringify([`${last.firstName} ${last.lastName}`, last.id])) : null,
      nextClassCursor: result.classGroupIds.length > classGroupIds.length ? classes.encode(classGroupIds[classGroupIds.length - 1]!) : null,
    }
  }, { readSnapshot: true })
}
