import { describe, expect, it } from 'bun:test'
import { AcademicPeriodType, AnnouncementAudience, AnnouncementTargetKind, SessionKind, StaffMember, StaffRole } from '../../../src/entities'
import { AuthorizationErrorCode, createStaffActorMetadata } from '../../../src/services/authorization'
import { createTestApp } from '../../support/in-memory-school-headless-app'

describe('tenant boundary safeguards', () => {
  it('rejects cross-school setup, staffing, curriculum, and communications references', async () => {
    const { app, forActor, repositories } = createTestApp(createStaffActorMetadata({
      subjectId: 'school-a-admin-user',
      staffMemberId: 'school-a-admin',
      schoolId: 'school-a',
      roles: [StaffRole.Admin],
      requestId: 'school-a-setup',
      authenticatedAt: new Date('2026-09-01T00:00:00Z'),
    }))
    const schoolBApp = forActor(createStaffActorMetadata({
      subjectId: 'school-b-admin-user',
      staffMemberId: 'school-b-admin',
      schoolId: 'school-b',
      roles: [StaffRole.Admin],
      requestId: 'school-b-setup',
      authenticatedAt: new Date('2026-09-01T00:00:00Z'),
    }))
    await repositories.staffMemberRepository.save(new StaffMember({
      id: 'school-b-admin',
      schoolId: 'school-b',
      firstName: 'School B',
      lastName: 'Administrator',
      roles: [StaffRole.Admin],
    }))
    await app.setup.registerSchool({ id: 'school-a', name: 'School A' })
    await schoolBApp.setup.registerSchool({ id: 'school-b', name: 'School B' })
    await app.setup.createAcademicYear({
      id: 'year-a',
      schoolId: 'school-a',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    await app.setup.createGradeLevel({ id: 'level-a', schoolId: 'school-a', name: 'Grade 6', order: 6 })
    await schoolBApp.setup.createAcademicYear({
      id: 'year-b',
      schoolId: 'school-b',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    await schoolBApp.setup.createAcademicPeriod({
      id: 'term-b',
      schoolId: 'school-b',
      academicYearId: 'year-b',
      name: 'Trimester 1',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2026-12-31T23:59:59Z'),
    })
    await schoolBApp.setup.createGradeLevel({ id: 'level-b', schoolId: 'school-b', name: 'Grade 6', order: 6 })
    await expect(app.setup.createAcademicPeriod({
      id: 'invalid-term',
      schoolId: 'school-a',
      academicYearId: 'year-a',
      name: 'Too early',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-08-01T00:00:00Z'),
      endDate: new Date('2026-12-31T23:59:59Z'),
    })).rejects.toThrow('must fit within academic year')
    await expect(app.setup.createClassGroup({
      id: 'invalid-class',
      schoolId: 'school-a',
      academicYearId: 'year-a',
      gradeLevelId: 'level-b',
      name: 'Invalid class',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await app.setup.createClassGroup({
      id: 'class-a',
      schoolId: 'school-a',
      academicYearId: 'year-a',
      gradeLevelId: 'level-a',
      name: 'Grade 6 A',
    })
    await app.academics.createSubject({ id: 'subject-a', schoolId: 'school-a', name: 'Local subject' })
    const classSubject = await app.academics.offerSubjectToClass({
      id: 'class-subject-a',
      classGroupId: 'class-a',
      subjectId: 'subject-a',
    })
    await expect(app.scheduling.createSession({
      id: 'invalid-school-session',
      schoolId: 'school-b',
      classGroupId: 'class-a',
      title: 'Cross-school session',
      kind: SessionKind.Course,
      startsAt: new Date('2026-09-01T08:00:00Z'),
      endsAt: new Date('2026-09-01T09:00:00Z'),
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await schoolBApp.setup.createClassGroup({
      id: 'class-b',
      schoolId: 'school-b',
      academicYearId: 'year-b',
      gradeLevelId: 'level-b',
      name: 'Grade 6 B',
    })
    await schoolBApp.setup.registerStaffMember({
      id: 'staff-b',
      schoolId: 'school-b',
      firstName: 'Outside',
      lastName: 'Teacher',
      roles: [StaffRole.Teacher],
    })
    await expect(app.setup.assignStaffToClass({
      id: 'invalid-assignment',
      staffId: 'staff-b',
      classGroupId: 'class-a',
      role: StaffRole.Teacher,
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    for (const classGroupId of ['missing-class', 'class-b']) {
      await expect(app.setup.assignStaffToClass({
        id: `probe-${classGroupId}`,
        staffId: 'staff-b',
        classGroupId,
        role: StaffRole.Teacher,
      })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    }
    await app.communications.createAnnouncement({
      id: 'school-a-announcement',
      schoolId: 'school-a',
      title: 'School A announcement',
      content: 'Visible within School A only.',
      audience: AnnouncementAudience.Custom,
    })
    await expect(app.communications.addTarget({
      id: 'invalid-target',
      announcementId: 'school-a-announcement',
      targetKind: AnnouncementTargetKind.Staff,
      targetId: 'staff-b',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await schoolBApp.academics.createSubject({ id: 'subject-b', schoolId: 'school-b', name: 'Outside subject' })
    await expect(app.academics.offerSubjectToClass({
      id: 'invalid-course',
      classGroupId: 'class-a',
      subjectId: 'subject-b',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    for (const subjectId of ['missing-subject', 'subject-b']) {
      await expect(app.academics.createSubjectMatter({
        id: `probe-${subjectId}`,
        subjectId,
        name: 'Probe matter',
        sequenceOrder: 1,
      })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    }
    await expect(app.communications.createAnnouncement({
      id: 'invalid-announcement',
      schoolId: 'school-b',
      title: 'Invalid audience',
      content: 'Not visible in another school.',
      audience: AnnouncementAudience.ClassGroup,
      classGroupId: 'class-a',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await schoolBApp.communications.createAnnouncement({
      id: 'school-b-announcement',
      schoolId: 'school-b',
      title: 'School B announcement',
      content: 'Not visible within School A.',
      audience: AnnouncementAudience.Custom,
    })
    for (const announcementId of ['missing-announcement', 'school-b-announcement']) {
      await expect(app.communications.publishAnnouncement({ announcementId }))
        .rejects
        .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    }
    for (const classGroupId of ['missing-class', 'class-b']) {
      await expect(app.queries.listClassGroupTimetable(classGroupId))
        .rejects
        .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
      await expect(app.queries.getAttendanceSessionReview({
        schoolId: 'school-a',
        classGroupId,
        date: new Date('2026-09-01T00:00:00Z'),
      }))
        .rejects
        .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    }
    for (const academicYearId of ['missing-year', 'year-b']) {
      await expect(app.queries.listClassGroups({ schoolId: 'school-a', academicYearId }))
        .rejects
        .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    }
    for (const periodId of ['missing-term', 'term-b']) {
      await expect(app.assessments.listClassSubjectGradesForPeriod({
        classSubjectId: classSubject.id,
        periodId,
      }))
        .rejects
        .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    }
  })
})
