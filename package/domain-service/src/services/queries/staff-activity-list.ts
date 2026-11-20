import type { Activity, StaffActivityListFilter, StaffActivityListInput, StaffActivityListRow } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { AuthorizationError, denyResourceAccess } from '@edaya/authorization'
import { ActivityCategory, DomainValidationError } from '@edaya/core'

import { scopedIdCursor } from './scoped-id-cursor'

const pageSize = 30

function sortActivities(rows: StaffActivityListRow[], sort: StaffActivityListFilter['sort'], sortDir: StaffActivityListFilter['sortDir']) {
  const direction = sortDir === 'desc' ? -1 : 1
  const byName = (a: StaffActivityListRow, b: StaffActivityListRow) => a.name.localeCompare(b.name, 'fr')
  switch (sort) {
    case 'name': return rows.sort((a, b) => direction * byName(a, b))
    case 'category': return rows.sort((a, b) => direction * a.category.localeCompare(b.category, 'fr') || byName(a, b))
    case 'coach': return rows.sort((a, b) => direction * a.coach.localeCompare(b.coach, 'fr') || byName(a, b))
    case 'period': return rows.sort((a, b) => direction * a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate) || byName(a, b))
    case 'enrolled': return rows.sort((a, b) => direction * (a.enrollmentCount - b.enrollmentCount) || byName(a, b))
    default: return rows
  }
}

function summary(activity: Activity): StaffActivityListRow {
  const { id, name, category, coach, schedule, capacity, description, startDate, endDate } = activity.data
  return { id, name, category, coach, schedule, capacity, description, startDate: startDate.toISOString().slice(0, 10), endDate: endDate.toISOString().slice(0, 10), enrollmentCount: 0 }
}

async function activityReaders(base: BaseSchoolService) {
  const actor = base.actor
  if (actor.kind !== 'staff')
    denyResourceAccess()
  const access = base.access.forOperation()
  const [parentScope, memberScope] = await Promise.all([
    access.entity('activities').readScope(),
    access.entity('activityEnrollments').readScope().catch((error: unknown) => {
      if (error instanceof AuthorizationError)
        return undefined
      throw error
    }),
  ])
  return { actor, parentScope, memberScope, parents: base.repositories.activities.forAccess(parentScope) }
}

async function countMembers(base: BaseSchoolService, memberScope: Awaited<ReturnType<typeof activityReaders>>['memberScope'], rows: StaffActivityListRow[]) {
  if (!memberScope || !rows.length)
    return
  const counts = await base.repositories.activityMembershipCounts.forActivities(memberScope, rows.map(row => row.id))
  for (const row of rows)
    row.enrollmentCount = counts.get(row.id) ?? 0
}

async function readActivities(base: BaseSchoolService, input: StaffActivityListInput, paged: boolean) {
  const { actor, parentScope, memberScope, parents } = await activityReaders(base)
  const category = Object.values(ActivityCategory).find(value => value === input.category)
  const q = input.q?.trim().toLowerCase() ?? ''
  const sort = input.sort ?? 'roster'
  const sortDir = input.sortDir ?? 'asc'
  const identity = [actor.subjectId, actor.staffMemberId, actor.schoolId, actor.academicYearId, parentScope, memberScope, input.category ?? '', q, sort, sortDir]
  const cursor = await scopedIdCursor(identity, input.cursor, 'Invalid activity list cursor')
  const after = cursor.after
  if (input.category && input.category !== 'all' && !category)
    return { items: [], total: 0, nextCursor: null }

  const filter = category ? { category } : {}

  let items: StaffActivityListRow[]
  let total: number
  if (paged && !q && sort === 'roster') {
    const [page, count] = await Promise.all([
      parents.list({ ...filter, ...(after ? { id: { $gt: after } } : {}), $limit: pageSize + 1 }),
      parents.count(filter),
    ])
    items = page.map(summary)
    total = count
  }
  else {
    // Use the same French comparisons and literal substring matching as the existing staff UI.
    const parentsInOrder = await parents.list(filter)
    const matches = parentsInOrder.filter(row => !q || [row.name, row.coach, row.description, row.category].some(value => value.toLowerCase().includes(q))).map(summary)
    if (sort === 'enrolled')
      await countMembers(base, memberScope, matches)
    sortActivities(matches, sort, sortDir)
    total = matches.length
    const start = after ? matches.findIndex(row => row.id === after) + 1 : 0
    if (after && !start)
      throw new DomainValidationError('Activity list changed')
    items = paged ? matches.slice(start, start + pageSize + 1) : matches
  }
  const hasMore = paged && items.length > pageSize
  if (hasMore)
    items.pop()
  if (sort !== 'enrolled')
    await countMembers(base, memberScope, items)
  return { items, total, nextCursor: hasMore ? cursor.encode(items[items.length - 1]!.id) : null }
}

export function readStaffActivityList(base: BaseSchoolService, input: StaffActivityListInput) {
  return base.atomicExecution.execute(() => readActivities(base, input, true), { readSnapshot: true })
}

export function exportStaffActivityList(base: BaseSchoolService, input: StaffActivityListFilter) {
  return base.atomicExecution.execute(async () => {
    const { items } = await readActivities(base, input, false)
    return { items }
  }, { readSnapshot: true })
}

export function readStaffActivityProfile(base: BaseSchoolService, activityId: string) {
  return base.atomicExecution.execute(async () => {
    const { parents, memberScope } = await activityReaders(base)
    const row = await parents.findById(activityId)
    if (!row)
      return { activity: null }
    const activity = summary(row)
    await countMembers(base, memberScope, [activity])
    return { activity }
  }, { readSnapshot: true })
}
