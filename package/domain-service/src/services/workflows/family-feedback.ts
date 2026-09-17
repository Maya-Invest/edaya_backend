import type { CommandJson, FamilyFeedbackAnswer, FamilyFeedbackAnswers, FamilyFeedbackLocale, FamilyFeedbackScoredRow } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { AuthorizationError, denyResourceAccess, resolveAuditActorId } from '@edaya/authorization'
import { aggregateFamilyFeedback, BusinessRuleViolationError, FAMILY_FEEDBACK_CANNOT_ASSESS, FAMILY_FEEDBACK_COMMENT_MAX_CHARS, FAMILY_FEEDBACK_FAILURES, FAMILY_FEEDBACK_PURGE_WARN_MS, FAMILY_FEEDBACK_QUESTION_IDS, FAMILY_FEEDBACK_QUESTION_VERSION, FAMILY_FEEDBACK_RETENTION_MS, FAMILY_FEEDBACK_SCORED_VALUES, familyFeedbackAnswersSchema, FamilyFeedbackCampaign, FamilyFeedbackCampaignStatus, FamilyFeedbackCommentReadAudit, familyFeedbackInstrumentCopy, familyFeedbackReminderTimes, FamilyFeedbackResponse, FamilyFeedbackSlot, familyFeedbackSlotId, FamilyFeedbackSlotStatus, FamilyFeedbackSnapshot, familyFeedbackSnapshotId, renderFamilyFeedbackInstrument, StudentClassEnrollmentStatus, TeacherAssignmentKind, TeacherAssignmentStatus } from '@edaya/core'
import {
  assertFamilyFeedbackManage,
  assertFamilyFeedbackModerate,
  assertFamilyFeedbackPublish,
  assertFamilyFeedbackRead,
  assertStaffMayBeModerator,
  isFamilyFeedbackSystemActor,
} from '../../capabilities/family-feedback/access'
import {
  cancelFamilyFeedbackCampaignNotifications,
  cancelFamilyFeedbackSlotNotifications,
  notifyFamilyFeedbackOpened,
  notifyFamilyFeedbackPublished,
  notifyFamilyFeedbackPurgeWarning,
  notifyFamilyFeedbackReminder,
  staffIdsWithCampaignManage,
} from '../../capabilities/family-feedback/notifications'
import { requireCurrentGuardianStudentLink } from '../../capabilities/files/profile-photo-access'
import { formatPersonName } from '../../capabilities/notifications/templates/format-notification-variables'
import { schoolCommandScope } from '../commands/school-command-scope'

function fail(code: string, message: string): never {
  throw new BusinessRuleViolationError(code, message)
}

function campaignLock(campaignId: string, extra: readonly string[] = []) {
  return { lockKeys: [`family-feedback-campaign:${campaignId}`, ...extra] }
}

export interface CreateFamilyFeedbackCampaignInput {
  requestId: string
  id?: string
  academicYearId: string
  academicPeriodId: string
  teacherAssignmentId: string
  opensAt?: Date
  closesAt?: Date
  moderatorStaffId?: string
}

export interface UpdateFamilyFeedbackCampaignInput {
  requestId: string
  id: string
  opensAt?: Date
  closesAt?: Date
}

export interface FamilyFeedbackCampaignIdInput {
  requestId: string
  id: string
}

export interface AssignFamilyFeedbackModeratorInput {
  requestId: string
  id: string
  moderatorStaffId: string
}

export interface SubmitFamilyFeedbackResponseInput {
  requestId: string
  campaignId: string
  studentId: string
  answers: FamilyFeedbackAnswers
  comment?: string
}

export interface SaveFamilyFeedbackThemeDraftInput {
  requestId: string
  id: string
  themes: string
}

export interface FamilyFeedbackCampaignProjection {
  id: string
  status: FamilyFeedbackCampaignStatus
  academicYearId: string
  academicPeriodId: string
  classGroupId: string
  classSubjectId: string
  teacherAssignmentId: string
  teacherId: string
  subjectId: string
  questionVersion: typeof FAMILY_FEEDBACK_QUESTION_VERSION
  opensAt?: string
  closesAt?: string
  openedAt?: string
  closedAt?: string
  cancelledAt?: string
  publishedAt?: string
  archivedAt?: string
  answersPurgedAt?: string
  moderatorStaffId?: string
  themeDraft?: string
}

export interface FamilyFeedbackAudiencePreview {
  campaignId: string
  eligibleCount: number
  completedCount: number
  blockers: string[]
}

export interface FamilyFeedbackSubmitReceipt {
  campaignId: string
  slotId: string
  studentId: string
  status: 'completed'
  alreadyCompleted: boolean
}

export interface FamilyFeedbackContextLabels {
  studentName: string
  teacherName: string
  subjectName: string
  className: string
  periodName: string
}

function iso(value: Date | undefined): string | undefined {
  return value?.toISOString()
}

function projectCampaign(campaign: FamilyFeedbackCampaign, includeThemeDraft = false): FamilyFeedbackCampaignProjection {
  return {
    id: campaign.id,
    status: campaign.status,
    academicYearId: campaign.academicYearId,
    academicPeriodId: campaign.academicPeriodId,
    classGroupId: campaign.classGroupId,
    classSubjectId: campaign.classSubjectId,
    teacherAssignmentId: campaign.teacherAssignmentId,
    teacherId: campaign.teacherId,
    subjectId: campaign.subjectId,
    questionVersion: campaign.questionVersion,
    opensAt: iso(campaign.opensAt),
    closesAt: iso(campaign.closesAt),
    openedAt: iso(campaign.openedAt),
    closedAt: iso(campaign.closedAt),
    cancelledAt: iso(campaign.cancelledAt),
    publishedAt: iso(campaign.publishedAt),
    archivedAt: iso(campaign.archivedAt),
    answersPurgedAt: iso(campaign.answersPurgedAt),
    moderatorStaffId: campaign.moderatorStaffId,
    ...(includeThemeDraft && campaign.themeDraft ? { themeDraft: campaign.themeDraft } : {}),
  }
}

export class FamilyFeedbackServiceWorkflow {
  constructor(private readonly baseService: BaseSchoolService) {}

  private schoolId() {
    return this.baseService.actor.schoolId
  }

  private campaigns() {
    return this.baseService.repositories.familyFeedbackCampaigns.forSchool!(this.schoolId())
  }

  private slots() {
    return this.baseService.repositories.familyFeedbackSlots.forSchool!(this.schoolId())
  }

  private responses() {
    return this.baseService.repositories.familyFeedbackResponses.forSchool!(this.schoolId())
  }

  private snapshots() {
    return this.baseService.repositories.familyFeedbackSnapshots.forSchool!(this.schoolId())
  }

  private audit() {
    return this.baseService.repositories.familyFeedbackCommentReadAudit.forSchool!(this.schoolId())
  }

  private async requireCampaign(id: string): Promise<FamilyFeedbackCampaign> {
    const campaign = await this.campaigns().findById(id)
    if (!campaign || campaign.schoolId !== this.schoolId())
      fail(FAMILY_FEEDBACK_FAILURES.NOT_FOUND, 'Family feedback campaign was not found')
    return campaign
  }

  private async run<Result, Stored extends CommandJson>(options: {
    command: string
    requestId: string
    input: unknown
    lockKeys: readonly string[]
    authorize: () => Promise<void>
    execute: () => Promise<Result>
    replay: (stored: Stored) => Promise<Result>
    persistResult: (result: Result) => Stored
    audit: (result: Result) => readonly { event: string, resourceType: string, resourceId: string }[]
    outbox?: (result: Result) => readonly { id: string, kind: string, version: number, resourceType: string, resourceId: string }[]
  }): Promise<Result> {
    return this.baseService.commandExecution.execute({
      scope: await schoolCommandScope(this.baseService.actor, options.command, options.requestId),
      input: options.input,
      resultMode: 'ordinary',
      lockKeys: [...options.lockKeys],
      authorize: options.authorize,
      execute: options.execute,
      replay: options.replay,
      persistResult: options.persistResult,
      audit: options.audit,
      outbox: options.outbox,
    })
  }

  async createFamilyFeedbackCampaign(input: CreateFamilyFeedbackCampaignInput): Promise<FamilyFeedbackCampaignProjection> {
    const id = input.id ?? crypto.randomUUID()
    return this.run({
      command: 'createFamilyFeedbackCampaign',
      requestId: input.requestId,
      input,
      ...campaignLock(id, [`family-feedback-assignment:${input.teacherAssignmentId}:${input.academicPeriodId}`]),
      authorize: () => assertFamilyFeedbackManage(this.baseService),
      execute: async () => {
        const resolved = await this.resolveAssignment(input.academicYearId, input.academicPeriodId, input.teacherAssignmentId)
        if (input.moderatorStaffId)
          await assertStaffMayBeModerator(this.baseService, input.moderatorStaffId, resolved.teacher.id, input.academicYearId)
        await this.assertNoOverlap(resolved.assignment.id, input.academicPeriodId, id)
        const campaign = new FamilyFeedbackCampaign({
          id,
          schoolId: this.schoolId(),
          academicYearId: input.academicYearId,
          academicPeriodId: input.academicPeriodId,
          classGroupId: resolved.classGroup.id,
          classSubjectId: resolved.classSubject.id,
          teacherAssignmentId: resolved.assignment.id,
          teacherId: resolved.teacher.id,
          subjectId: resolved.classSubject.subjectId,
          questionVersion: FAMILY_FEEDBACK_QUESTION_VERSION,
          status: FamilyFeedbackCampaignStatus.Draft,
          opensAt: input.opensAt,
          closesAt: input.closesAt,
          moderatorStaffId: input.moderatorStaffId,
        })
        this.assertScheduleWindow(campaign)
        await this.campaigns().save(campaign)
        return campaign
      },
      replay: async stored => this.requireCampaign((stored as { id: string }).id),
      persistResult: result => ({ id: result.id, status: result.status }),
      audit: result => [{ event: 'family-feedback.created', resourceType: 'family-feedback-campaign', resourceId: result.id }],
    }).then(campaign => projectCampaign(campaign, true))
  }

  async updateFamilyFeedbackCampaign(input: UpdateFamilyFeedbackCampaignInput): Promise<FamilyFeedbackCampaignProjection> {
    return this.run({
      command: 'updateFamilyFeedbackCampaign',
      requestId: input.requestId,
      input,
      ...campaignLock(input.id),
      authorize: () => assertFamilyFeedbackManage(this.baseService),
      execute: async () => {
        const existing = await this.requireCampaign(input.id)
        if (!existing.isMutable)
          fail(FAMILY_FEEDBACK_FAILURES.LIFECYCLE_INVALID, 'Only draft or scheduled campaigns can be updated')
        const campaign = existing.copyWith({
          opensAt: input.opensAt ?? existing.opensAt,
          closesAt: input.closesAt ?? existing.closesAt,
        })
        this.assertScheduleWindow(campaign)
        await this.campaigns().save(campaign)
        return campaign
      },
      replay: async stored => this.requireCampaign((stored as { id: string }).id),
      persistResult: result => ({ id: result.id, status: result.status }),
      audit: result => [{ event: 'family-feedback.updated', resourceType: 'family-feedback-campaign', resourceId: result.id }],
    }).then(campaign => projectCampaign(campaign, true))
  }

  async assignFamilyFeedbackModerator(input: AssignFamilyFeedbackModeratorInput): Promise<FamilyFeedbackCampaignProjection> {
    return this.run({
      command: 'assignFamilyFeedbackModerator',
      requestId: input.requestId,
      input,
      ...campaignLock(input.id),
      authorize: () => assertFamilyFeedbackManage(this.baseService),
      execute: async () => {
        const existing = await this.requireCampaign(input.id)
        if (existing.status === FamilyFeedbackCampaignStatus.Published || existing.status === FamilyFeedbackCampaignStatus.Archived)
          fail(FAMILY_FEEDBACK_FAILURES.LIFECYCLE_INVALID, 'Moderator cannot change after publication')
        await assertStaffMayBeModerator(this.baseService, input.moderatorStaffId, existing.teacherId, existing.academicYearId)
        const campaign = existing.copyWith({ moderatorStaffId: input.moderatorStaffId })
        await this.campaigns().save(campaign)
        return campaign
      },
      replay: async stored => this.requireCampaign((stored as { id: string }).id),
      persistResult: result => ({ id: result.id, moderatorStaffId: result.moderatorStaffId ?? null }),
      audit: result => [{ event: 'family-feedback.moderator-assigned', resourceType: 'family-feedback-campaign', resourceId: result.id }],
    }).then(campaign => projectCampaign(campaign, true))
  }

  async scheduleFamilyFeedbackCampaign(input: FamilyFeedbackCampaignIdInput): Promise<FamilyFeedbackCampaignProjection> {
    return this.transition(input, 'scheduleFamilyFeedbackCampaign', 'family-feedback.scheduled', async (existing) => {
      if (existing.status !== FamilyFeedbackCampaignStatus.Draft)
        fail(FAMILY_FEEDBACK_FAILURES.LIFECYCLE_INVALID, 'Only drafts can be scheduled')
      if (!existing.opensAt || !existing.closesAt)
        fail(FAMILY_FEEDBACK_FAILURES.LIFECYCLE_INVALID, 'A schedule requires opensAt and closesAt')
      this.assertScheduleWindow(existing)
      await this.requireModerator(existing)
      return existing.copyWith({ status: FamilyFeedbackCampaignStatus.Scheduled })
    })
  }

  async openFamilyFeedbackCampaign(input: FamilyFeedbackCampaignIdInput, asOf = new Date()): Promise<FamilyFeedbackCampaignProjection> {
    return this.transition(input, 'openFamilyFeedbackCampaign', 'family-feedback.opened', async (existing, now) => {
      if (existing.status !== FamilyFeedbackCampaignStatus.Draft && existing.status !== FamilyFeedbackCampaignStatus.Scheduled)
        fail(FAMILY_FEEDBACK_FAILURES.LIFECYCLE_INVALID, 'Only draft or scheduled campaigns can open')
      if (existing.closesAt && now >= existing.closesAt)
        fail(FAMILY_FEEDBACK_FAILURES.CLOSED, 'The campaign cutoff has already passed')
      await this.requireModerator(existing)
      const opened = existing.copyWith({
        status: FamilyFeedbackCampaignStatus.Open,
        openedAt: now,
        opensAt: existing.opensAt ?? now,
      })
      const slots = await this.snapshotSlots(opened)
      const labels = await this.campaignLabels(opened)
      await notifyFamilyFeedbackOpened(this.baseService, opened, slots, labels)
      return opened
    }, asOf)
  }

  async closeFamilyFeedbackCampaign(input: FamilyFeedbackCampaignIdInput, asOf = new Date()): Promise<FamilyFeedbackCampaignProjection> {
    return this.transition(input, 'closeFamilyFeedbackCampaign', 'family-feedback.closed', async (existing, now) => {
      if (existing.status !== FamilyFeedbackCampaignStatus.Open)
        fail(FAMILY_FEEDBACK_FAILURES.LIFECYCLE_INVALID, 'Only open campaigns can close')
      const closed = existing.copyWith({ status: FamilyFeedbackCampaignStatus.Closed, closedAt: now })
      const slots = await this.slots().list({ campaignId: closed.id })
      await cancelFamilyFeedbackCampaignNotifications(this.baseService, closed, slots)
      return closed
    }, asOf)
  }

  async cancelFamilyFeedbackCampaign(input: FamilyFeedbackCampaignIdInput): Promise<FamilyFeedbackCampaignProjection> {
    return this.transition(input, 'cancelFamilyFeedbackCampaign', 'family-feedback.cancelled', async (existing, now) => {
      if (!existing.isCancellable)
        fail(FAMILY_FEEDBACK_FAILURES.LIFECYCLE_INVALID, 'This campaign cannot be cancelled')
      const cancelled = existing.copyWith({ status: FamilyFeedbackCampaignStatus.Cancelled, cancelledAt: now })
      const slots = await this.slots().list({ campaignId: cancelled.id })
      await cancelFamilyFeedbackCampaignNotifications(this.baseService, cancelled, slots)
      return cancelled
    })
  }

  async archiveFamilyFeedbackCampaign(input: FamilyFeedbackCampaignIdInput): Promise<FamilyFeedbackCampaignProjection> {
    return this.transition(input, 'archiveFamilyFeedbackCampaign', 'family-feedback.archived', async (existing, now) => {
      if (existing.status !== FamilyFeedbackCampaignStatus.Published && existing.status !== FamilyFeedbackCampaignStatus.Cancelled)
        fail(FAMILY_FEEDBACK_FAILURES.LIFECYCLE_INVALID, 'Only published or cancelled campaigns can be archived')
      return existing.copyWith({ status: FamilyFeedbackCampaignStatus.Archived, archivedAt: now })
    })
  }

  async saveFamilyFeedbackThemeDraft(input: SaveFamilyFeedbackThemeDraftInput): Promise<FamilyFeedbackCampaignProjection> {
    return this.run({
      command: 'saveFamilyFeedbackThemeDraft',
      requestId: input.requestId,
      input,
      ...campaignLock(input.id),
      authorize: async () => {
        const campaign = await this.requireCampaign(input.id)
        await assertFamilyFeedbackModerate(this.baseService, campaign)
      },
      execute: async () => {
        const existing = await this.requireCampaign(input.id)
        if (existing.status !== FamilyFeedbackCampaignStatus.Closed)
          fail(FAMILY_FEEDBACK_FAILURES.LIFECYCLE_INVALID, 'Themes can be drafted after close and before publish')
        if (existing.answersPurgedAt)
          fail(FAMILY_FEEDBACK_FAILURES.PURGED, 'Raw answers have already been deleted')
        const themes = input.themes.trim()
        if (!themes)
          fail(FAMILY_FEEDBACK_FAILURES.ANSWER_INVALID, 'Theme draft must not be blank')
        const campaign = existing.copyWith({ themeDraft: themes })
        await this.campaigns().save(campaign)
        return campaign
      },
      replay: async stored => this.requireCampaign((stored as { id: string }).id),
      persistResult: result => ({ id: result.id }),
      audit: result => [{ event: 'family-feedback.theme-drafted', resourceType: 'family-feedback-campaign', resourceId: result.id }],
    }).then(campaign => projectCampaign(campaign, true))
  }

  async publishFamilyFeedbackCampaign(input: FamilyFeedbackCampaignIdInput): Promise<FamilyFeedbackCampaignProjection> {
    return this.run({
      command: 'publishFamilyFeedbackCampaign',
      requestId: input.requestId,
      input,
      ...campaignLock(input.id),
      authorize: async () => {
        const campaign = await this.requireCampaign(input.id)
        await assertFamilyFeedbackPublish(this.baseService, campaign)
      },
      execute: async () => {
        const existing = await this.requireCampaign(input.id)
        if (existing.status !== FamilyFeedbackCampaignStatus.Closed)
          fail(FAMILY_FEEDBACK_FAILURES.LIFECYCLE_INVALID, 'Only closed campaigns can be published')
        if (existing.answersPurgedAt)
          fail(FAMILY_FEEDBACK_FAILURES.PURGED, 'Raw answers have already been deleted')
        const now = new Date()
        const payload = await this.computeAggregates(existing)
        const snapshot = new FamilyFeedbackSnapshot({
          id: familyFeedbackSnapshotId(existing.id),
          schoolId: existing.schoolId,
          campaignId: existing.id,
          payload: { ...payload, themes: existing.themeDraft },
          publishedAt: now,
          publishedByStaffId: this.baseService.actor.kind === 'staff' ? this.baseService.actor.staffMemberId : 'system',
        })
        await this.snapshots().save(snapshot)
        const published = existing.copyWith({ status: FamilyFeedbackCampaignStatus.Published, publishedAt: now })
        await this.campaigns().save(published)
        await notifyFamilyFeedbackPublished(this.baseService, published, await this.campaignLabels(published))
        return published
      },
      replay: async stored => this.requireCampaign((stored as { id: string }).id),
      persistResult: result => ({ id: result.id, status: result.status }),
      audit: result => [{ event: 'family-feedback.published', resourceType: 'family-feedback-campaign', resourceId: result.id }],
    }).then(campaign => projectCampaign(campaign, true))
  }

  async submitFamilyFeedbackResponse(input: SubmitFamilyFeedbackResponseInput): Promise<FamilyFeedbackSubmitReceipt> {
    if (this.baseService.actor.kind !== 'guardian')
      denyResourceAccess()
    const guardianId = this.baseService.actor.guardianId
    const parsed = familyFeedbackAnswersSchema.safeParse(input.answers)
    if (!parsed.success)
      fail(FAMILY_FEEDBACK_FAILURES.ANSWER_INVALID, 'Each item requires a 1–5 score or cannot_assess')
    if (input.comment !== undefined && input.comment.length > FAMILY_FEEDBACK_COMMENT_MAX_CHARS)
      fail(FAMILY_FEEDBACK_FAILURES.ANSWER_INVALID, `Comments are limited to ${FAMILY_FEEDBACK_COMMENT_MAX_CHARS} characters`)
    const comment = input.comment?.trim() ? input.comment.trim() : undefined
    return this.run({
      command: 'submitFamilyFeedbackResponse',
      requestId: input.requestId,
      input: { requestId: input.requestId, campaignId: input.campaignId, studentId: input.studentId, answers: parsed.data, comment },
      ...campaignLock(input.campaignId),
      authorize: async () => {
        await requireCurrentGuardianStudentLink(this.baseService, guardianId, input.studentId)
      },
      execute: async () => {
        const now = new Date()
        const campaign = await this.requireCampaign(input.campaignId)
        if (campaign.status !== FamilyFeedbackCampaignStatus.Open || (campaign.closesAt && now >= campaign.closesAt))
          fail(FAMILY_FEEDBACK_FAILURES.CLOSED, 'This questionnaire is closed')
        await this.assertCurrentEnrollment(campaign, input.studentId)
        const { guardian } = await requireCurrentGuardianStudentLink(this.baseService, guardianId, input.studentId)
        const slotId = familyFeedbackSlotId(campaign.id, input.studentId)
        const slot = await this.slots().findById(slotId)
        if (!slot)
          fail(FAMILY_FEEDBACK_FAILURES.ELIGIBILITY_DENIED, 'This student was not in the launch snapshot')
        if (slot.isCompleted) {
          return {
            campaignId: campaign.id,
            slotId: slot.id,
            studentId: slot.studentId,
            status: 'completed' as const,
            alreadyCompleted: true,
          }
        }
        const completed = slot.copyWith({
          status: FamilyFeedbackSlotStatus.Completed,
          completingGuardianId: guardian.id,
          completedAt: now,
        })
        const response = new FamilyFeedbackResponse({
          id: crypto.randomUUID(),
          schoolId: campaign.schoolId,
          campaignId: campaign.id,
          slotId: slot.id,
          answers: parsed.data,
          comment,
          createdAt: now,
        })
        await this.slots().save(completed)
        await this.responses().save(response)
        await cancelFamilyFeedbackSlotNotifications(this.baseService, campaign.id, slot.studentId)
        return {
          campaignId: campaign.id,
          slotId: slot.id,
          studentId: slot.studentId,
          status: 'completed' as const,
          alreadyCompleted: false,
        }
      },
      replay: async (stored) => {
        const result = stored as Omit<FamilyFeedbackSubmitReceipt, 'slotId'>
        await requireCurrentGuardianStudentLink(this.baseService, guardianId, result.studentId)
        return {
          ...result,
          slotId: familyFeedbackSlotId(result.campaignId, result.studentId),
        }
      },
      persistResult: result => ({
        campaignId: result.campaignId,
        studentId: result.studentId,
        status: result.status,
        alreadyCompleted: result.alreadyCompleted,
      }),
      audit: result => [{ event: 'family-feedback.submitted', resourceType: 'family-feedback-campaign', resourceId: result.campaignId }],
    })
  }

  async listFamilyFeedbackCampaigns(): Promise<FamilyFeedbackCampaignProjection[]> {
    await assertFamilyFeedbackRead(this.baseService)
    const campaigns = await this.campaigns().list({ $orderBy: [{ field: 'createdAt', direction: 'desc' }] })
    return campaigns.map(campaign => projectCampaign(campaign, true))
  }

  async getFamilyFeedbackCampaign(input: { id: string }): Promise<FamilyFeedbackCampaignProjection> {
    await assertFamilyFeedbackRead(this.baseService)
    return projectCampaign(await this.requireCampaign(input.id), true)
  }

  async previewFamilyFeedbackAudience(input: { id?: string, academicYearId: string, academicPeriodId: string, teacherAssignmentId: string }): Promise<FamilyFeedbackAudiencePreview> {
    await assertFamilyFeedbackManage(this.baseService)
    const blockers: string[] = []
    try {
      await this.resolveAssignment(input.academicYearId, input.academicPeriodId, input.teacherAssignmentId)
    }
    catch (error) {
      if (error instanceof BusinessRuleViolationError)
        blockers.push(error.code)
      else throw error
    }
    const campaign = input.id ? await this.campaigns().findById(input.id) : undefined
    if (campaign && !campaign.moderatorStaffId)
      blockers.push(FAMILY_FEEDBACK_FAILURES.MODERATOR_REQUIRED)
    if (campaign?.moderatorStaffId) {
      try {
        await assertStaffMayBeModerator(this.baseService, campaign.moderatorStaffId, campaign.teacherId, campaign.academicYearId)
      }
      catch (error) {
        if (error instanceof BusinessRuleViolationError)
          blockers.push(error.code)
        else throw error
      }
    }
    const resolved = blockers.includes(FAMILY_FEEDBACK_FAILURES.ASSIGNMENT_INVALID)
      ? undefined
      : await this.resolveAssignment(input.academicYearId, input.academicPeriodId, input.teacherAssignmentId).catch(() => undefined)
    const enrollments = resolved
      ? await this.baseService.repositories.enrollments.forSchool!(this.schoolId()).list({
          classGroupId: resolved.classGroup.id,
          academicYearId: input.academicYearId,
          status: StudentClassEnrollmentStatus.Active,
        })
      : []
    const completedCount = campaign
      ? (await this.slots().list({ campaignId: campaign.id, status: FamilyFeedbackSlotStatus.Completed })).length
      : 0
    return {
      campaignId: campaign?.id ?? '',
      eligibleCount: enrollments.length,
      completedCount,
      blockers,
    }
  }

  getFamilyFeedbackInstrument(input: { locale: FamilyFeedbackLocale }) {
    return familyFeedbackInstrumentCopy(input.locale)
  }

  async listGuardianFamilyFeedbackCampaigns(): Promise<Array<{
    campaignId: string
    studentId: string
    slotState: string
    closesAt?: string
    context: FamilyFeedbackContextLabels
  }>> {
    if (this.baseService.actor.kind !== 'guardian')
      denyResourceAccess()
    const guardianId = this.baseService.actor.guardianId
    const links = await this.baseService.entities.guardianLinks.list({ guardianId })
    const items = []
    for (const link of links) {
      const slots = await this.slots().list({ studentId: link.studentId })
      for (const slot of slots) {
        const campaign = await this.campaigns().findById(slot.campaignId)
        if (!campaign || campaign.status === FamilyFeedbackCampaignStatus.Draft || campaign.status === FamilyFeedbackCampaignStatus.Scheduled)
          continue
        items.push({
          campaignId: campaign.id,
          studentId: slot.studentId,
          slotState: await this.guardianSlotState(campaign, slot, guardianId),
          closesAt: iso(campaign.closesAt),
          context: await this.instrumentVars(campaign, slot.studentId),
        })
      }
    }
    return items
  }

  async getGuardianFamilyFeedbackQuestionnaire(input: { campaignId: string, studentId: string, locale: FamilyFeedbackLocale }) {
    if (this.baseService.actor.kind !== 'guardian')
      denyResourceAccess()
    const guardianId = this.baseService.actor.guardianId
    const campaign = await this.requireCampaign(input.campaignId)
    const slot = await this.slots().findById(familyFeedbackSlotId(campaign.id, input.studentId))
    if (!slot)
      fail(FAMILY_FEEDBACK_FAILURES.ELIGIBILITY_DENIED, 'No questionnaire is available for this student')
    const slotState = await this.guardianSlotState(campaign, slot, guardianId)
    const context = await this.instrumentVars(campaign, input.studentId)
    return {
      campaignId: campaign.id,
      studentId: input.studentId,
      slotId: slot.id,
      slotState,
      closesAt: iso(campaign.closesAt),
      context,
      instrument: slotState === 'open' ? renderFamilyFeedbackInstrument(input.locale, context) : undefined,
      receipt: slotState === 'completed' || slotState === 'already_completed'
        ? { status: 'completed' as const, completedAt: iso(slot.completedAt) }
        : undefined,
    }
  }

  async listFamilyFeedbackComments(input: { id: string }) {
    const campaign = await this.requireCampaign(input.id)
    await assertFamilyFeedbackModerate(this.baseService, campaign)
    if (campaign.answersPurgedAt)
      fail(FAMILY_FEEDBACK_FAILURES.PURGED, 'Raw comments have been deleted')
    const actor = this.baseService.actor
    await this.audit().save(new FamilyFeedbackCommentReadAudit({
      id: crypto.randomUUID(),
      schoolId: campaign.schoolId,
      campaignId: campaign.id,
      actorId: resolveAuditActorId(actor),
      actorKind: actor.kind,
      subjectId: actor.kind === 'staff' ? actor.subjectId : resolveAuditActorId(actor),
    }))
    const responses = await this.responses().list({ campaignId: campaign.id })
    return {
      comments: responses.filter(response => response.comment).map(response => ({ id: response.id, comment: response.comment })),
    }
  }

  async getFamilyFeedbackAggregateReview(input: { id: string }) {
    await assertFamilyFeedbackRead(this.baseService)
    const campaign = await this.requireCampaign(input.id)
    const snapshot = await this.snapshots().findById(familyFeedbackSnapshotId(campaign.id))
    if (snapshot)
      return { campaignId: campaign.id, status: campaign.status, ...snapshot.payload }
    if (campaign.answersPurgedAt)
      fail(FAMILY_FEEDBACK_FAILURES.PURGED, 'Raw answers have already been deleted')
    if (campaign.status !== FamilyFeedbackCampaignStatus.Closed && campaign.status !== FamilyFeedbackCampaignStatus.Open)
      fail(FAMILY_FEEDBACK_FAILURES.LIFECYCLE_INVALID, 'Aggregates are available after launch')
    return { campaignId: campaign.id, status: campaign.status, ...await this.computeAggregates(campaign) }
  }

  async listTeacherFamilyFeedbackResults() {
    if (this.baseService.actor.kind !== 'teacher')
      denyResourceAccess()
    const campaigns = await this.campaigns().list({
      teacherId: this.baseService.actor.teacherId,
      status: FamilyFeedbackCampaignStatus.Published,
    })
    const items = []
    for (const campaign of campaigns) {
      const snapshot = await this.snapshots().findById(familyFeedbackSnapshotId(campaign.id))
      if (!snapshot)
        continue
      items.push({ campaignId: campaign.id, ...snapshot.payload })
    }
    return items
  }

  async getTeacherFamilyFeedbackResult(input: { id: string }) {
    if (this.baseService.actor.kind !== 'teacher')
      denyResourceAccess()
    const campaign = await this.requireCampaign(input.id)
    if (campaign.teacherId !== this.baseService.actor.teacherId || campaign.status !== FamilyFeedbackCampaignStatus.Published)
      denyResourceAccess()
    const snapshot = await this.snapshots().findById(familyFeedbackSnapshotId(campaign.id))
    if (!snapshot)
      fail(FAMILY_FEEDBACK_FAILURES.NOT_FOUND, 'Published results are not available')
    return { campaignId: campaign.id, ...snapshot.payload }
  }

  async advanceFamilyFeedbackCampaigns(asOf: Date): Promise<{ processed: number, skipped: number }> {
    if (!isFamilyFeedbackSystemActor(this.baseService))
      denyResourceAccess()
    let processed = 0
    let skipped = 0
    const campaigns = await this.campaigns().list({})
    for (const campaign of campaigns) {
      try {
        if (campaign.status === FamilyFeedbackCampaignStatus.Scheduled && campaign.opensAt && campaign.opensAt <= asOf) {
          if (campaign.closesAt && campaign.closesAt <= asOf) {
            skipped += 1
            continue
          }
          await this.openFamilyFeedbackCampaign({ requestId: `family-feedback.open:${campaign.id}`, id: campaign.id }, asOf)
          processed += 1
          continue
        }
        if (campaign.status === FamilyFeedbackCampaignStatus.Open && campaign.closesAt && campaign.closesAt <= asOf) {
          await this.closeFamilyFeedbackCampaign({ requestId: `family-feedback.close:${campaign.id}`, id: campaign.id }, asOf)
          processed += 1
          continue
        }
        if (campaign.status === FamilyFeedbackCampaignStatus.Open && campaign.openedAt && campaign.closesAt) {
          await this.dispatchDueReminders(campaign, asOf)
          processed += 1
          continue
        }
        if ((campaign.status === FamilyFeedbackCampaignStatus.Closed || campaign.status === FamilyFeedbackCampaignStatus.Cancelled || campaign.status === FamilyFeedbackCampaignStatus.Published) && campaign.retentionAnchorAt) {
          const cutoff = new Date(campaign.retentionAnchorAt.getTime() + FAMILY_FEEDBACK_RETENTION_MS)
          const warnAt = new Date(cutoff.getTime() - FAMILY_FEEDBACK_PURGE_WARN_MS)
          if (!campaign.answersPurgedAt && asOf >= cutoff) {
            await this.purgeAnswers(campaign)
            processed += 1
            continue
          }
          if (!campaign.answersPurgedAt && asOf >= warnAt && asOf < cutoff) {
            await notifyFamilyFeedbackPurgeWarning(
              this.baseService,
              campaign,
              { ...(await this.campaignLabels(campaign)), purgeAtLabel: cutoff.toISOString().slice(0, 10) },
              await staffIdsWithCampaignManage(this.baseService, campaign.academicYearId),
            )
            processed += 1
            continue
          }
        }
        skipped += 1
      }
      catch (error) {
        if (error instanceof BusinessRuleViolationError || error instanceof AuthorizationError) {
          skipped += 1
          continue
        }
        throw error
      }
    }
    return { processed, skipped }
  }

  private async transition(
    input: FamilyFeedbackCampaignIdInput,
    command: string,
    event: string,
    mutate: (existing: FamilyFeedbackCampaign, now: Date) => Promise<FamilyFeedbackCampaign>,
    now = new Date(),
  ): Promise<FamilyFeedbackCampaignProjection> {
    return this.run({
      command,
      requestId: input.requestId,
      input: { requestId: input.requestId, id: input.id },
      ...campaignLock(input.id),
      authorize: async () => {
        if (!isFamilyFeedbackSystemActor(this.baseService))
          await assertFamilyFeedbackManage(this.baseService)
      },
      execute: async () => {
        const existing = await this.requireCampaign(input.id)
        const campaign = await mutate(existing, now)
        await this.campaigns().save(campaign)
        return campaign
      },
      replay: async stored => this.requireCampaign((stored as { id: string }).id),
      persistResult: result => ({ id: result.id, status: result.status }),
      audit: result => [{ event, resourceType: 'family-feedback-campaign', resourceId: result.id }],
    }).then(campaign => projectCampaign(campaign, true))
  }

  private async snapshotSlots(campaign: FamilyFeedbackCampaign): Promise<FamilyFeedbackSlot[]> {
    const existing = await this.slots().list({ campaignId: campaign.id })
    if (existing.length)
      return existing
    const enrollments = await this.baseService.repositories.enrollments.forSchool!(this.schoolId()).list({
      classGroupId: campaign.classGroupId,
      academicYearId: campaign.academicYearId,
      status: StudentClassEnrollmentStatus.Active,
    })
    const slots = enrollments.map(enrollment => new FamilyFeedbackSlot({
      id: familyFeedbackSlotId(campaign.id, enrollment.studentId),
      schoolId: campaign.schoolId,
      campaignId: campaign.id,
      studentId: enrollment.studentId,
      teacherAssignmentId: campaign.teacherAssignmentId,
      status: FamilyFeedbackSlotStatus.Open,
    }))
    if (slots.length)
      await this.slots().batchSave(slots)
    return slots
  }

  private async dispatchDueReminders(campaign: FamilyFeedbackCampaign, asOf: Date): Promise<void> {
    if (!campaign.openedAt || !campaign.closesAt)
      return
    const labels = await this.campaignLabels(campaign)
    const times = familyFeedbackReminderTimes(campaign.openedAt, campaign.closesAt)
    const slots = await this.slots().list({ campaignId: campaign.id, status: FamilyFeedbackSlotStatus.Open })
    for (const time of times) {
      if (time.at > asOf)
        continue
      for (const slot of slots)
        await notifyFamilyFeedbackReminder(this.baseService, campaign, slot, time.kind, labels)
    }
  }

  private async purgeAnswers(campaign: FamilyFeedbackCampaign): Promise<void> {
    const responses = await this.responses().list({ campaignId: campaign.id })
    if (responses.length)
      await this.responses().batchDelete(responses.map(response => response.id))
    const slots = await this.slots().list({ campaignId: campaign.id })
    for (const slot of slots) {
      if (slot.completingGuardianId)
        await this.slots().save(slot.copyWith({ completingGuardianId: undefined }))
    }
    await this.campaigns().save(campaign.copyWith({ answersPurgedAt: new Date() }))
  }

  private async computeAggregates(campaign: FamilyFeedbackCampaign) {
    const slots = await this.slots().list({ campaignId: campaign.id })
    const responses = await this.responses().list({ campaignId: campaign.id })
    const rows: FamilyFeedbackScoredRow[] = []
    for (const response of responses) {
      const slot = slots.find(item => item.id === response.slotId)
      if (!slot?.completingGuardianId)
        continue
      const guardian = await this.baseService.repositories.guardians.forSchool!(this.schoolId()).findById(slot.completingGuardianId)
      if (!guardian?.subjectId)
        continue
      for (const questionId of FAMILY_FEEDBACK_QUESTION_IDS) {
        const value = response.answers[questionId]
        if (value !== FAMILY_FEEDBACK_CANNOT_ASSESS && !(FAMILY_FEEDBACK_SCORED_VALUES as readonly number[]).includes(value))
          continue
        rows.push({
          questionId,
          value: value as FamilyFeedbackAnswer,
          guardianSubjectId: guardian.subjectId,
        })
      }
    }
    return aggregateFamilyFeedback(rows, slots.length, slots.filter(slot => slot.isCompleted).length, campaign.themeDraft)
  }

  private async guardianSlotState(campaign: FamilyFeedbackCampaign, slot: FamilyFeedbackSlot, guardianId: string): Promise<string> {
    if (slot.isCompleted)
      return slot.completingGuardianId === guardianId ? 'completed' : 'already_completed'
    try {
      await requireCurrentGuardianStudentLink(this.baseService, guardianId, slot.studentId)
      await this.assertCurrentEnrollment(campaign, slot.studentId)
    }
    catch {
      return 'revoked'
    }
    if (campaign.status !== FamilyFeedbackCampaignStatus.Open)
      return 'closed'
    return 'open'
  }

  private async assertCurrentEnrollment(campaign: FamilyFeedbackCampaign, studentId: string): Promise<void> {
    const enrollments = await this.baseService.repositories.enrollments.forSchool!(this.schoolId()).list({
      studentId,
      classGroupId: campaign.classGroupId,
      academicYearId: campaign.academicYearId,
      status: StudentClassEnrollmentStatus.Active,
    })
    if (!enrollments.length)
      fail(FAMILY_FEEDBACK_FAILURES.ELIGIBILITY_DENIED, 'The student is no longer enrolled in this class')
  }

  private async requireModerator(campaign: FamilyFeedbackCampaign): Promise<void> {
    if (!campaign.moderatorStaffId)
      fail(FAMILY_FEEDBACK_FAILURES.MODERATOR_REQUIRED, 'Assign a non-conflicted moderator before opening')
    await assertStaffMayBeModerator(this.baseService, campaign.moderatorStaffId, campaign.teacherId, campaign.academicYearId)
  }

  private assertScheduleWindow(campaign: FamilyFeedbackCampaign): void {
    if (campaign.opensAt && campaign.closesAt && campaign.closesAt <= campaign.opensAt)
      fail(FAMILY_FEEDBACK_FAILURES.LIFECYCLE_INVALID, 'closesAt must be after opensAt')
  }

  private async assertNoOverlap(teacherAssignmentId: string, academicPeriodId: string, campaignId: string): Promise<void> {
    const existing = await this.campaigns().list({ teacherAssignmentId, academicPeriodId })
    if (existing.some(campaign => campaign.id !== campaignId && campaign.status !== FamilyFeedbackCampaignStatus.Cancelled && campaign.status !== FamilyFeedbackCampaignStatus.Archived))
      fail(FAMILY_FEEDBACK_FAILURES.LIFECYCLE_INVALID, 'An active campaign already exists for this assignment and period')
  }

  private async resolveAssignment(academicYearId: string, academicPeriodId: string, teacherAssignmentId: string) {
    const year = await this.baseService.repositories.academicYears.forSchool!(this.schoolId()).findById(academicYearId)
    const period = await this.baseService.repositories.academicPeriods.forSchool!(this.schoolId()).findById(academicPeriodId)
    const assignment = await this.baseService.repositories.teacherAssignments.forSchool!(this.schoolId()).findById(teacherAssignmentId)
    if (!year || !period || !assignment || period.academicYearId !== academicYearId || assignment.academicYearId !== academicYearId)
      fail(FAMILY_FEEDBACK_FAILURES.ASSIGNMENT_INVALID, 'Year, period and assignment must belong together')
    if (assignment.kind !== TeacherAssignmentKind.Subject || !assignment.classSubjectId || assignment.status !== TeacherAssignmentStatus.Active)
      fail(FAMILY_FEEDBACK_FAILURES.ASSIGNMENT_INVALID, 'Family feedback targets an active subject teacher assignment')
    const classSubject = await this.baseService.repositories.classSubjects.forSchool!(this.schoolId()).findById(assignment.classSubjectId)
    const teacher = await this.baseService.repositories.teachers.forSchool!(this.schoolId()).findById(assignment.teacherId)
    if (!classSubject || !teacher)
      fail(FAMILY_FEEDBACK_FAILURES.ASSIGNMENT_INVALID, 'The evaluated assignment is incomplete')
    const classGroup = await this.baseService.repositories.classGroups.forSchool!(this.schoolId()).findById(classSubject.classGroupId)
    if (!classGroup || classGroup.academicYearId !== academicYearId)
      fail(FAMILY_FEEDBACK_FAILURES.ASSIGNMENT_INVALID, 'The class does not belong to this academic year')
    return { year, period, assignment, classSubject, classGroup, teacher }
  }

  private async campaignLabels(campaign: FamilyFeedbackCampaign) {
    const teacher = await this.baseService.repositories.teachers.forSchool!(this.schoolId()).findById(campaign.teacherId)
    const subject = await this.baseService.repositories.subjects.forSchool!(this.schoolId()).findById(campaign.subjectId)
    const classGroup = await this.baseService.repositories.classGroups.forSchool!(this.schoolId()).findById(campaign.classGroupId)
    const period = await this.baseService.repositories.academicPeriods.forSchool!(this.schoolId()).findById(campaign.academicPeriodId)
    return {
      teacherName: teacher ? formatPersonName(teacher.firstName, teacher.lastName) : 'Teacher',
      subjectName: subject?.name ?? 'Subject',
      classGroupName: classGroup?.name ?? 'Class',
      periodName: period?.name ?? 'Period',
      closesAtLabel: campaign.closesAt ? campaign.closesAt.toISOString().slice(0, 10) : '',
    }
  }

  private async instrumentVars(campaign: FamilyFeedbackCampaign, studentId: string) {
    const labels = await this.campaignLabels(campaign)
    const student = await this.baseService.repositories.students.forSchool!(this.schoolId()).findById(studentId)
    return {
      studentName: student ? formatPersonName(student.firstName, student.lastName) : 'Student',
      teacherName: labels.teacherName,
      subjectName: labels.subjectName,
      className: labels.classGroupName,
      periodName: labels.periodName,
    }
  }
}
