import type { ActivityPupilScopes, StaffActivityMembersInput, StaffActivityPupilOptionsInput, StaffActivityPupilsPort } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { activityPupilLabel, staffActivityMember, staffActivityPupilPageSize } from '@edaya/core'
import { inArray, sql } from 'drizzle-orm'
import { compileResourceAccess } from '../lib/resource-access-scope'
import { schoolScope } from '../lib/school-scope'
import { transactionContext } from '../lib/transaction'
import { activityEnrollments, classActivityEnrollments, classGroups, studentClassEnrollments, students } from '../postgres-schema'

interface Executor { execute: (query: SQL) => Promise<{ rows: Record<string, unknown>[] }> }

function linkedClasses(scopes: ActivityPupilScopes, activityId: string, forPicker: boolean) {
  const visible = scopes.candidates ? compileResourceAccess(classGroups, scopes.candidates) : sql`false`
  return sql`select distinct class_groups.id, class_groups.name from ${classActivityEnrollments}
    join ${classGroups} on class_groups.id=class_activity_enrollments.class_group_id
    where activity_id=${activityId} and ${visible} and ${compileResourceAccess(classActivityEnrollments, scopes.placements)}
    ${forPicker ? sql`and ${compileResourceAccess(classActivityEnrollments, scopes.links)}` : sql``}`
}

function eligiblePlacements(scopes: ActivityPupilScopes, extra: SQL) {
  return sql`select distinct on (student_id) student_id, class_group_id, linked.name as class_name
    from ${studentClassEnrollments} join linked on linked.id=class_group_id
    where status='active' and ${schoolScope(studentClassEnrollments, scopes.participants.schoolId)} ${extra}
    order by student_id, student_class_enrollments.id`
}
const identityFields = sql`students.id, first_name as "firstName", last_name as "lastName", identifier, eligible.class_group_id as "classGroupId"`
const membership = staffActivityMember.omit({ student: true })
const limit = staffActivityPupilPageSize + 1

export class PostgresStaffActivityPupils implements StaffActivityPupilsPort {
  constructor(private readonly db: Executor) {}
  private get executor() { return (transactionContext.getStore() as Executor | undefined) ?? this.db }

  async members(scopes: ActivityPupilScopes, input: StaffActivityMembersInput, after?: string) {
    const db = this.executor
    const visible = sql`activity_id=${input.activityId} and ${compileResourceAccess(activityEnrollments, scopes.members)}`
    const fields = sql`select id, student_id as "studentId", status from ${activityEnrollments} where ${visible}`
    const page = await db.execute(sql`${fields} ${after ? sql`and id>${after}` : sql``} order by id limit ${limit}`)
    const members = page.rows.map(row => membership.parse(row))
    const selected = input.selectedId && !members.some(row => row.id === input.selectedId)
      ? (await db.execute(sql`${fields} and id=${input.selectedId}`)).rows.map(row => membership.parse(row))
      : []
    const ids = [...new Set([...members, ...selected].map(row => row.studentId))]
    const labels = new Map<string, ReturnType<typeof activityPupilLabel.parse>>()
    if (ids.length) {
      const result = await db.execute(sql`with linked as (${linkedClasses(scopes, input.activityId, false)}),
        eligible as (${eligiblePlacements(scopes, sql`and ${inArray(studentClassEnrollments.studentId, ids)}`)})
        select ${identityFields} from ${students} left join eligible on eligible.student_id=students.id
        where ${schoolScope(students, scopes.participants.schoolId)} and ${inArray(students.id, ids)}
        and (eligible.student_id is not null or exists (select 1 from ${activityEnrollments}
          where activity_id=${input.activityId} and student_id=students.id and ${compileResourceAccess(activityEnrollments, scopes.participants)}))`)
      for (const row of result.rows) {
        const label = activityPupilLabel.parse(row)
        labels.set(label.id, label)
      }
    }
    const hydrate = (row: ReturnType<typeof membership.parse>) => ({ ...row, student: labels.get(row.studentId) ?? null })
    const items = members.map(hydrate)
    const { total, canAdd } = (await db.execute(sql`select
      (select count(*)::int from ${activityEnrollments} where ${visible}) as total,
      exists (${linkedClasses(scopes, input.activityId, true)}) as "canAdd"`)).rows[0]!
    return {
      items,
      selected: items.find(row => row.id === input.selectedId) ?? (selected[0] ? hydrate(selected[0]) : null),
      total: Number(total),
      canAdd: canAdd === true,
    }
  }

  async options(scopes: ActivityPupilScopes, input: StaffActivityPupilOptionsInput, after?: { name: string, id: string }, afterClass?: string) {
    const db = this.executor
    const linked = linkedClasses(scopes, input.activityId, false)
    const pickerLinks = linkedClasses(scopes, input.activityId, true)
    const name = sql`(students.first_name || ' ' || students.last_name) collate edaya_directory_fr`
    const page = await db.execute(sql`with linked as (${linked}),
      eligible as (${eligiblePlacements(scopes, sql``)})
      select ${identityFields} from eligible join ${students} on students.id=eligible.student_id
      where ${schoolScope(students, scopes.participants.schoolId)}
      and eligible.class_group_id in (select id from (${pickerLinks}) as allowed_classes)
      and not exists (select 1 from ${activityEnrollments} where activity_id=${input.activityId} and student_id=students.id)
      ${input.classGroupId ? sql`and eligible.class_group_id=${input.classGroupId}` : sql``}
      ${input.q ? sql`and strpos(lower(concat_ws(' ',first_name,last_name,concat_ws(' · ',eligible.class_name,nullif(identifier,'')),eligible.class_name,eligible.class_group_id,identifier)),lower(${input.q}))>0` : sql``}
      ${after ? sql`and (${name}, students.id)>(${after.name}, ${after.id})` : sql``}
      order by ${name}, students.id limit ${limit}`)
    const classes = await db.execute(sql`select id from (${pickerLinks}) as allowed_classes
      ${afterClass ? sql`where id>${afterClass}` : sql``} order by id limit ${limit}`)
    return { items: page.rows.map(row => activityPupilLabel.parse(row)), classGroupIds: classes.rows.map(({ id }) => String(id)) }
  }
}
