import type { BaseRepositoryInterface, FamilyFeedbackCampaign, FamilyFeedbackSlot, StaffFeedbackOptionScopes, StaffFeedbackOptionsInput, TeacherFeedbackSelection } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import type { FamilyFeedbackCampaignProjection } from '../workflows/family-feedback'
import { AuthorizationError, denyResourceAccess } from '@edaya/authorization'
import { FamilyFeedbackCampaignStatus, familyFeedbackSnapshotId, StudentClassEnrollmentStatus, TeacherAssignmentKind, TeacherAssignmentStatus } from '@edaya/core'
import { assertFamilyFeedbackManage } from '../../capabilities/family-feedback/access'
import { formatPersonName } from '../../capabilities/notifications/templates/format-notification-variables'
import { groupByKey, loadInBatches } from '../../capabilities/shared/bounded-reads'

async function labelsById<T extends { id: string }>(store: BaseRepositoryInterface<T>, ids: string[], label: (row: T) => string) {
  const rows = await loadInBatches(ids, batch => store.findByIds(batch))
  return new Map(rows.map(row => [row.id, label(row)]))
}

export function feedbackSlotState(campaign: FamilyFeedbackCampaign, slot: FamilyFeedbackSlot, guardianId: string, eligible: boolean) {
  if (slot.isCompleted)
    return slot.completingGuardianId === guardianId ? 'completed' : 'already_completed'
  if (!eligible)
    return 'revoked'
  return campaign.status === FamilyFeedbackCampaignStatus.Open ? 'open' : 'closed'
}

export async function readGuardianFeedbackCampaigns(base: BaseSchoolService, studentId?: string) {
  const actor = base.actor
  if (actor.kind !== 'guardian')
    denyResourceAccess()
  return base.atomicExecution.execute(async () => {
    const access = base.access.forOperation()
    const links = await base.entities.guardianLinks.list({ guardianId: actor.guardianId, ...(studentId ? { studentId } : {}) }, access)
    const pupilIds = links.filter(link => link.schoolId === actor.schoolId).map(link => link.studentId)
    if (studentId && !pupilIds.length)
      denyResourceAccess()
    if (!pupilIds.length)
      return []
    const repo = base.repositories
    const slots = await loadInBatches(pupilIds, ids => repo.familyFeedbackSlots.forSchool!(actor.schoolId).list({ studentId: { $in: ids } }))
    const campaigns = await loadInBatches(slots.map(slot => slot.campaignId), ids => repo.familyFeedbackCampaigns.forSchool!(actor.schoolId).findByIds(ids))
    const visible = campaigns.filter(row => row.status !== FamilyFeedbackCampaignStatus.Draft && row.status !== FamilyFeedbackCampaignStatus.Scheduled)
    if (!visible.length)
      return []

    const [guardian, students, placements, teacherNames, subjectNames, classNames, periodNames] = await Promise.all([
      base.entities.guardians.findById(actor.guardianId, access),
      loadInBatches(pupilIds, ids => base.entities.students.list({ id: { $in: ids } }, access)),
      loadInBatches(pupilIds, ids => repo.enrollments.forSchool!(actor.schoolId).list({
        studentId: { $in: ids },
        status: StudentClassEnrollmentStatus.Active,
      })),
      labelsById(repo.teachers.forSchool!(actor.schoolId), visible.map(row => row.teacherId), row => formatPersonName(row.firstName, row.lastName)),
      labelsById(repo.subjects.forSchool!(actor.schoolId), visible.map(row => row.subjectId), row => row.name),
      labelsById(repo.classGroups.forSchool!(actor.schoolId), visible.map(row => row.classGroupId), row => row.name),
      labelsById(repo.academicPeriods.forSchool!(actor.schoolId), visible.map(row => row.academicPeriodId), row => row.name),
    ])
    if (!guardian?.hasAccess || guardian.schoolId !== actor.schoolId)
      denyResourceAccess()
    const activePlacements = new Set(placements.map(row => JSON.stringify([row.studentId, row.classGroupId, row.academicYearId])))
    const byCampaign = new Map(visible.map(row => [row.id, row]))
    const byStudent = new Map(students.filter(row => row.schoolId === actor.schoolId).map(row => [row.id, row]))
    const slotsByStudent = groupByKey(slots, row => row.studentId)
    const items = []
    for (const pupil of pupilIds) {
      const student = byStudent.get(pupil)
      if (!student)
        continue
      for (const slot of slotsByStudent.get(pupil) ?? []) {
        const campaign = byCampaign.get(slot.campaignId)
        if (!campaign)
          continue
        const eligible = activePlacements.has(JSON.stringify([pupil, campaign.classGroupId, campaign.academicYearId]))
        items.push({
          campaignId: campaign.id,
          studentId: pupil,
          slotState: feedbackSlotState(campaign, slot, guardian.id, eligible),
          closesAt: campaign.closesAt?.toISOString(),
          context: {
            studentName: formatPersonName(student.firstName, student.lastName),
            teacherName: teacherNames.get(campaign.teacherId) ?? 'Teacher',
            subjectName: subjectNames.get(campaign.subjectId) ?? 'Subject',
            className: classNames.get(campaign.classGroupId) ?? 'Class',
            periodName: periodNames.get(campaign.academicPeriodId) ?? 'Period',
          },
        })
      }
    }
    return items
  }, { readSnapshot: true })
}

export async function readTeacherFeedbackResults(base: BaseSchoolService) {
  const actor = base.actor
  if (actor.kind !== 'teacher')
    denyResourceAccess()
  return base.atomicExecution.execute(async () => {
    const campaigns = await base.repositories.familyFeedbackCampaigns.forSchool!(actor.schoolId).list({
      teacherId: actor.teacherId,
      status: FamilyFeedbackCampaignStatus.Published,
    })
    const store = base.repositories.familyFeedbackSnapshots.forSchool!(actor.schoolId)
    const rows = await loadInBatches(campaigns.map(row => familyFeedbackSnapshotId(row.id)), ids => store.findByIds(ids))
    const snapshots = new Map(rows.map(row => [row.id, row]))
    return campaigns.flatMap((campaign) => {
      const snapshot = snapshots.get(familyFeedbackSnapshotId(campaign.id))
      return snapshot
        ? [{ ...snapshot.payload, campaignId: campaign.id, academicYearId: campaign.academicYearId, academicPeriodId: campaign.academicPeriodId, classGroupId: campaign.classGroupId, classSubjectId: campaign.classSubjectId }]
        : []
    })
  }, { readSnapshot: true })
}

export function readTeacherFeedbackSummaries(base: BaseSchoolService, selection: TeacherFeedbackSelection) {
  if (base.actor.kind !== 'teacher')
    denyResourceAccess()
  return base.repositories.teacherFeedbackSummaries.list(base.actor.schoolId, base.actor.teacherId, selection)
}

async function optionalLabels<T>(read: Promise<T[]>): Promise<T[]> {
  try {
    return await read
  }
  catch (error) {
    if (error instanceof AuthorizationError)
      return []
    throw error
  }
}

// Each label uses the same entity permission as the corresponding staff picker.
export async function decorateStaffFeedbackCampaigns(base: BaseSchoolService, rows: FamilyFeedbackCampaignProjection[], year?: string) {
  if (!rows.length || !year)
    return rows
  const access = base.access.forOperation()
  const entities = base.entities
  const [assignments, staff] = await Promise.all([
    optionalLabels(loadInBatches(rows.map(r => r.teacherAssignmentId), ids => entities.teacherAssignments.list({
      id: { $in: ids },
      academicYearId: year,
      kind: TeacherAssignmentKind.Subject,
      status: TeacherAssignmentStatus.Active,
    }, access))),
    optionalLabels(loadInBatches(rows.flatMap(r => r.moderatorStaffId ? [r.moderatorStaffId] : []), ids => entities.staffMembers.list({ id: { $in: ids }, accountKind: 'human' }, access))),
  ])
  const active = assignments.filter(a => a.classSubjectId)
  const [teachers, offerings] = await Promise.all([
    optionalLabels(loadInBatches(active.map(a => a.teacherId), ids => entities.teachers.findByIds(ids, access))),
    optionalLabels(loadInBatches(active.map(a => a.classSubjectId!), ids => entities.classSubjects.findByIds(ids, access))),
  ])
  const subjects = await optionalLabels(loadInBatches(offerings.map(o => o.subjectId), ids => entities.subjects.findByIds(ids, access)))
  const subjectNames = new Map(subjects.map(s => [s.id, s.name]))
  const teacherNames = new Map(teachers.map(t => [t.id, formatPersonName(t.firstName, t.lastName)]))
  const moderatorNames = new Map(staff.map(s => [s.id, `${s.firstName} ${s.lastName}`]))
  const offeringById = new Map(offerings.map(o => [o.id, o]))
  const assignmentsById = new Map(active.map((a) => {
    const offering = offeringById.get(a.classSubjectId!)
    return [a.id, {
      teacherName: teacherNames.get(a.teacherId),
      subjectName: offering && subjectNames.get(offering.subjectId),
      classGroupId: a.classGroupId ?? offering?.classGroupId,
    }]
  }))
  return rows.map(row => ({
    ...row,
    assignment: assignmentsById.get(row.teacherAssignmentId),
    moderatorName: row.moderatorStaffId ? moderatorNames.get(row.moderatorStaffId) : undefined,
  }))
}

export async function feedbackLabelScopes(base: BaseSchoolService, resources: (keyof StaffFeedbackOptionScopes)[]) {
  const access = base.access.forOperation()
  const entries = await Promise.all(resources.map(async (key) => {
    try {
      return [key, await access.entity(key).readScope()] as const
    }
    catch (error) {
      if (!(error instanceof AuthorizationError))
        throw error
      return [key, undefined] as const
    }
  }))
  return Object.fromEntries(entries) as StaffFeedbackOptionScopes
}

export async function readStaffFeedbackOptions(base: BaseSchoolService, input: StaffFeedbackOptionsInput) {
  return base.atomicExecution.execute(async () => {
    await assertFamilyFeedbackManage(base)
    const resources: (keyof StaffFeedbackOptionScopes)[] = []
    if (input.picker !== 'moderators') {
      resources.push('teacherAssignments', 'teachers', 'classSubjects', 'subjects')
      if (input.q)
        resources.push('classGroups')
    }
    if (input.picker !== 'assignments')
      resources.push('staffMembers')
    const scopes = await feedbackLabelScopes(base, resources)
    return base.repositories.staffFeedbackOptions.page(base.actor.schoolId, input, scopes)
  }, { readSnapshot: true })
}
