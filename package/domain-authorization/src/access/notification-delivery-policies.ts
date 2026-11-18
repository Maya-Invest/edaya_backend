import type { CoreEntityKey, MessageDelivery, NotificationDispatchRequest } from '@edaya/core'
import type { AccessPolicies } from './access-policies'
import { AssessmentKind, CalendarEventKind, MessageDeliveryStatus, Permission, resourceAccessScope } from '@edaya/core'
import { activityReminderStudentIds } from './activity-reminder-students'
import { AccessFacts, denied } from './facts'

/** Durable dispatch binds personal communications to the exact persisted recipient and source. */
export class NotificationDeliveryAccessPolicy {
  constructor(private readonly access: AccessPolicies) {}

  async recipient(request: NotificationDispatchRequest) {
    const actor = this.access.actor
    if (actor.kind !== 'system' || actor.systemId !== 'notify-adapter' || actor.schoolId !== request.schoolId)
      return denied('Only the notification dispatcher may resolve a delivery recipient')
    const scope = await this.access.scope(Permission.PERSONAL_COMMUNICATIONS_READ, 'messageDeliveries')
    const delivery = await this.access.repositories.messageDeliveries.forAccess(scope).findById(request.deliveryId)
    if (!delivery || delivery.subjectId !== request.subjectId || !delivery.recipientKind || !delivery.recipientId
      || delivery.status === MessageDeliveryStatus.Cancelled
      || request.eventKey !== (delivery.announcementId ? 'announcement.published' : delivery.eventKey)) {
      return denied('Delivery identity or event does not match')
    }
    const facts = new AccessFacts(actor, this.access.repositories)
    const resources = { staff: 'staffMembers', guardian: 'guardians', student: 'students', teacher: 'teachers' } as const
    const profile = await facts.one(resources[delivery.recipientKind], delivery.recipientId)
    if (profile.subjectId !== delivery.subjectId || ('isActive' in profile && !profile.isActive)
      || ('accountKind' in profile && profile.accountKind !== 'human')
      || ('hasAccess' in profile && !profile.hasAccess) || ('status' in profile && profile.status !== 'active')) {
      return denied('Delivery profile is no longer active or linked to this login')
    }
    await this.assertSource(facts, delivery, request)
    // Preserve the discriminated profile type for contact projection in the service.
    switch (delivery.recipientKind) {
      case 'staff': return { kind: 'staff' as const, profile: await facts.one('staffMembers', delivery.recipientId) }
      case 'guardian': return { kind: 'guardian' as const, profile: await facts.one('guardians', delivery.recipientId), links: await facts.list('guardianLinks', { guardianId: delivery.recipientId }) }
      case 'student': return { kind: 'student' as const, profile: await facts.one('students', delivery.recipientId) }
      case 'teacher': return { kind: 'teacher' as const, profile: await facts.one('teachers', delivery.recipientId) }
      default: return denied('Unknown recipient profile')
    }
  }

  private async assertSource(facts: AccessFacts, delivery: MessageDelivery, request: NotificationDispatchRequest) {
    const { assessmentResultId, marksRevision, reportCardResultId, studentId, anchorKey, status, incidentId, assessmentId, activityId, calendarEventId, campaignId, reminderKind, teacherId } = request.metadata
    if (delivery.announcementId) {
      const scope = resourceAccessScope(delivery.schoolId, 'announcements', [{ target: await facts.communicationAudience(delivery.recipientKind!, delivery.recipientId!) }])
      if (delivery.sourceKey !== delivery.announcementId || !await this.access.repositories.announcements.forAccess(scope).findById(delivery.announcementId))
        return denied('Announcement is no longer published to this recipient')
      return
    }
    const requireSource = (...parts: Array<string | undefined>) => {
      if (parts.some(part => !part) || delivery.sourceKey !== [request.eventKey, ...parts].join(':'))
        denied('Notification source metadata does not match its persisted source')
    }
    switch (request.eventKey) {
      case 'conversation.message': {
        const { conversationId, sequence } = request.metadata
        requireSource(conversationId, sequence)
        return
      }
      case 'assessment.result_recorded': {
        requireSource(assessmentResultId, marksRevision)
        const result = await facts.one('assessmentResults', assessmentResultId!)
        const sheet = await facts.one('assessments', result.assessmentId)
        if (sheet.id !== assessmentId || sheet.marksStatus !== 'submitted' || String(result.revision) !== marksRevision)
          denied('Marks are no longer submitted at this revision')
        await this.assertStudentSource(facts, delivery, result.studentId, 'academic')
        await this.assertVisibleStudentRecord(facts, 'assessmentResults', result.id, result.studentId)
        return
      }
      case 'report_card.published': {
        requireSource(reportCardResultId)
        const result = await facts.one('results', reportCardResultId!)
        await this.assertStudentSource(facts, delivery, result.studentId, 'academic')
        await this.assertVisibleStudentRecord(facts, 'results', result.id, result.studentId, true)
        return
      }
      case 'attendance.recorded': {
        requireSource(studentId, anchorKey, status)
        await this.assertStudentSource(facts, delivery, studentId!, 'attendance')
        const records = await facts.list('attendance', { studentId: studentId! })
        const record = records.find(row => row.anchorKey === anchorKey && row.status === status)
        if (!record)
          return denied('Attendance was removed or corrected')
        await this.assertVisibleStudentRecord(facts, 'attendance', record.id, record.studentId)
        return
      }
      case 'incident.recorded': {
        requireSource(incidentId, studentId)
        await this.assertStudentSource(facts, delivery, studentId!, 'general')
        const involvement = await facts.repository('studentIncidentInvolvements').findOne({ incidentId: incidentId!, studentId: studentId! })
        if (!involvement)
          return denied('Student is no longer involved in this incident')
        await this.assertVisibleStudentRecord(facts, 'incidents', incidentId!, studentId!)
        return
      }
      case 'assessment.due_soon': {
        requireSource(assessmentId)
        const assessment = await facts.one('assessments', assessmentId!)
        if (delivery.recipientKind !== 'student' || assessment.kind !== AssessmentKind.Homework || assessment.completedAt || !assessment.dueAt || assessment.dueAt <= facts.now)
          return denied('Homework reminder is no longer due')
        await this.assertStudentSource(facts, delivery, delivery.recipientId!, 'general')
        await this.assertVisibleStudentRecord(facts, 'assessments', assessment.id, delivery.recipientId!)
        return
      }
      case 'activity.reminder': {
        requireSource(activityId)
        const activity = await facts.one('activities', activityId!)
        if (activity.endDate < facts.now)
          return denied('Activity has ended')
        const students = await this.linkedRecipientStudents(facts, delivery)
        if (!(await activityReminderStudentIds(facts, activity.id, students)).length)
          return denied('Recipient is no longer enrolled or linked to an enrolled student')
        return
      }
      case 'calendar.event_reminder': {
        requireSource(calendarEventId)
        const event = await facts.one('calendarEvents', calendarEventId!)
        if (event.kind !== CalendarEventKind.Event || event.endDate < facts.now || event.academicYearId !== await facts.academicYear())
          return denied('Calendar reminder has expired')
        const audience = await facts.communicationAudience(delivery.recipientKind!, delivery.recipientId!)
        const scope = resourceAccessScope(delivery.schoolId, 'calendarEvents', audience.classGroupIds.map(classGroupId => ({ target: { kind: 'class_group', classGroupId }, academicYearId: event.academicYearId, calendarAncestors: true })))
        if (!await this.access.repositories.calendarEvents.forAccess(scope).findById(event.id))
          return denied('Calendar event no longer affects this recipient')
        return
      }
      case 'family_feedback.opened': {
        requireSource(campaignId, studentId)
        await this.assertStudentSource(facts, delivery, studentId!, 'general')
        return
      }
      case 'family_feedback.reminder': {
        requireSource(campaignId, studentId, reminderKind)
        await this.assertStudentSource(facts, delivery, studentId!, 'general')
        return
      }
      case 'family_feedback.published': {
        requireSource(campaignId)
        if (delivery.recipientKind !== 'teacher' || delivery.recipientId !== teacherId)
          return denied('Published family feedback is only for the evaluated teacher')
        return
      }
      case 'family_feedback.purge_reminder': {
        requireSource(campaignId)
        if (delivery.recipientKind !== 'staff')
          return denied('Purge reminders are staff-only')
        return
      }
      default: return denied('Unknown notification source')
    }
  }

  private async linkedRecipientStudents(facts: AccessFacts, delivery: MessageDelivery): Promise<string[]> {
    if (delivery.recipientKind === 'student')
      return [delivery.recipientId!]
    if (delivery.recipientKind === 'guardian')
      return (await facts.list('guardianLinks', { guardianId: delivery.recipientId! })).map(link => link.studentId)
    return []
  }

  private async assertStudentSource(facts: AccessFacts, delivery: MessageDelivery, studentId: string, kind: 'academic' | 'attendance' | 'general') {
    const student = await facts.one('students', studentId)
    if (student.status !== 'active')
      return denied('Student is no longer active')
    if (delivery.recipientKind === 'student' && delivery.recipientId === studentId && kind !== 'attendance')
      return
    if (delivery.recipientKind === 'guardian') {
      const links = await facts.list('guardianLinks', { guardianId: delivery.recipientId!, studentId })
      if (links.some(link => kind === 'academic' ? link.receivesAcademicReports : kind === 'attendance' ? link.receivesAttendanceAlerts : true))
        return
    }
    return denied('Recipient relationship or notification preference no longer permits this student notice')
  }

  private async assertVisibleStudentRecord(facts: AccessFacts, resource: CoreEntityKey, id: string, studentId: string, publishedOnly = false) {
    const academicYearId = await facts.academicYear()
    if (!academicYearId)
      return denied('No current academic year')
    const scope = resourceAccessScope(this.access.actor.schoolId, resource, [{ target: { kind: 'student', studentId }, academicYearId, publishedOnly }])
    if (!await this.access.repositories[resource].forAccess(scope).findById(id))
      return denied('Notification source is no longer visible for this student and academic year')
  }
}
