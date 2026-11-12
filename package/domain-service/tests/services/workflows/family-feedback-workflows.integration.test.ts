import { ActorAssuranceLevel, AuthorizationError, createGuardianActorMetadata, createStaffActorMetadata, createSystemActorMetadata, createTeacherActorMetadata } from '@edaya/authorization'
import { AcademicPeriod, AcademicPeriodType, AcademicYear, ClassGroup, ClassSubject, EnrollmentEndReason, FAMILY_FEEDBACK_FAILURES, FAMILY_FEEDBACK_QUESTION_VERSION, FAMILY_FEEDBACK_RETENTION_MS, FamilyFeedbackCampaignStatus, FamilyFeedbackSlotStatus, GradeLevel, Guardian, GuardianStudentLink, Permission, StaffMember, StaffPermissionAssignment, Student, StudentClassEnrollment, Subject, Teacher, TeacherAssignment, TeacherAssignmentKind, withShortName } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { runCronJobs } from '../../../src/capabilities/scheduling-jobs/cron-job-runner'
import { createCurriculumTestApp as createTestApp } from '../../support/create-test-app'

const SCHOOL = 'school'
const ANSWERS = {
  communication: 5 as const,
  clarity: 4 as const,
  support: 3 as const,
  student_experience: 2 as const,
}

function guardianActor(guardianId: string, subjectId: string) {
  return createGuardianActorMetadata({
    schoolId: SCHOOL,
    guardianId,
    subjectId,
    requestId: `guardian-${guardianId}`,
    authenticatedAt: new Date(),
  })
}

async function seedAssignment(repositories: Awaited<ReturnType<typeof createTestApp>>['schoolRepositories'], studentCount = 1) {
  await repositories.academicYears.save(new AcademicYear(withShortName({
    id: 'ay1',
    schoolId: SCHOOL,
    name: '2025-2026',
    startDate: new Date('2025-09-01'),
    endDate: new Date('2026-06-30'),
    status: 'published',
  })))
  await repositories.academicPeriods.save(new AcademicPeriod(withShortName({
    id: 'per1',
    schoolId: SCHOOL,
    academicYearId: 'ay1',
    name: 'T2',
    type: AcademicPeriodType.Trimester,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-03-31'),
    isPublished: true,
  })))
  await repositories.gradeLevels.save(new GradeLevel(withShortName({ id: 'grade1', schoolId: SCHOOL, name: 'CM1', shortName: 'CM1', order: 1 })))
  await repositories.classGroups.save(new ClassGroup(withShortName({ id: 'cg1', schoolId: SCHOOL, academicYearId: 'ay1', gradeLevelId: 'grade1', name: 'CM1 A' })))
  await repositories.subjects.save(new Subject(withShortName({ categoryId: 'test-category', gradeLevelId: 'grade1', academicYearId: 'ay1', id: 'math', schoolId: SCHOOL, name: 'Mathematics' })))
  await repositories.classSubjects.save(new ClassSubject({ id: 'cs1', classGroupId: 'cg1', subjectId: 'math', coefficient: 1 }))
  await repositories.teachers.save(new Teacher({
    id: 'teacher1',
    schoolId: SCHOOL,
    firstName: 'Marie',
    lastName: 'Curie',
    subjectId: 'teacher-subject',
  }))
  await repositories.teacherAssignments.save(new TeacherAssignment({
    id: 'ta1',
    teacherId: 'teacher1',
    academicYearId: 'ay1',
    kind: TeacherAssignmentKind.Subject,
    classSubjectId: 'cs1',
  }))
  for (let index = 1; index <= studentCount; index += 1) {
    const studentId = `stu${index}`
    const guardianId = `gua${index}`
    await repositories.students.save(new Student({
      id: studentId,
      schoolId: SCHOOL,
      firstName: `Student${index}`,
      lastName: 'Ada',
    }))
    await repositories.enrollments.save(new StudentClassEnrollment({
      id: `enr${index}`,
      studentId,
      classGroupId: 'cg1',
      academicYearId: 'ay1',
      enrollmentIndex: 1,
      enrolledAt: new Date('2025-09-01'),
    }))
    await repositories.guardians.save(new Guardian({
      id: guardianId,
      schoolId: SCHOOL,
      firstName: `Parent${index}`,
      lastName: 'Ada',
      subjectId: `gua-subject-${index}`,
    }))
    await repositories.guardianLinks.save(new GuardianStudentLink({
      id: `link${index}`,
      schoolId: SCHOOL,
      guardianId,
      studentId,
      relationship: 'parent',
    }))
  }
}

describe('FamilyFeedbackServiceWorkflow', () => {
  test('opens a confidential campaign, consumes one slot, and publishes suppressed aggregates', async () => {
    const fixture = await createTestApp()
    await seedAssignment(fixture.schoolRepositories, 2)
    const staff = fixture.app.familyFeedbackWorkflow
    const created = await staff.createFamilyFeedbackCampaign({
      requestId: 'ff-create',
      id: 'camp1',
      academicYearId: 'ay1',
      academicPeriodId: 'per1',
      teacherAssignmentId: 'ta1',
      moderatorStaffId: 'admin',
    })
    expect(created.status).toBe(FamilyFeedbackCampaignStatus.Draft)
    expect(created.questionVersion).toBe(FAMILY_FEEDBACK_QUESTION_VERSION)

    await expect(staff.createFamilyFeedbackCampaign({
      requestId: 'ff-overlap',
      academicYearId: 'ay1',
      academicPeriodId: 'per1',
      teacherAssignmentId: 'ta1',
    })).rejects.toMatchObject({ code: FAMILY_FEEDBACK_FAILURES.LIFECYCLE_INVALID })

    const preview = await staff.previewFamilyFeedbackAudience({
      id: 'camp1',
      academicYearId: 'ay1',
      academicPeriodId: 'per1',
      teacherAssignmentId: 'ta1',
    })
    expect(preview.eligibleCount).toBe(2)
    expect(preview.blockers).toEqual([])

    const opened = await staff.openFamilyFeedbackCampaign({ requestId: 'ff-open', id: 'camp1' })
    expect(opened.status).toBe(FamilyFeedbackCampaignStatus.Open)
    expect(await fixture.schoolRepositories.familyFeedbackSlots.count({ campaignId: 'camp1' })).toBe(2)

    const firstGuardian = fixture.forActor(guardianActor('gua1', 'gua-subject-1')).familyFeedbackWorkflow
    const questionnaire = await firstGuardian.getGuardianFamilyFeedbackQuestionnaire({
      campaignId: 'camp1',
      studentId: 'stu1',
      locale: 'fr',
    })
    expect(questionnaire.slotState).toBe('open')
    expect(questionnaire.instrument?.items).toHaveLength(4)
    expect(questionnaire.instrument?.intro).toContain('Marie Curie')
    expect(questionnaire.context).toEqual({
      studentName: 'Student1 Ada',
      teacherName: 'Marie Curie',
      subjectName: 'Mathematics',
      className: 'CM1 A',
      periodName: 'T2',
    })

    const receipt = await firstGuardian.submitFamilyFeedbackResponse({
      requestId: 'ff-submit-1',
      campaignId: 'camp1',
      studentId: 'stu1',
      answers: ANSWERS,
      comment: 'The messages are clear.',
    })
    expect(receipt).toMatchObject({
      campaignId: 'camp1',
      slotId: 'ffs:camp1:stu1',
      studentId: 'stu1',
      status: 'completed',
      alreadyCompleted: false,
    })
    expect('answers' in receipt).toBe(false)

    const replay = await firstGuardian.submitFamilyFeedbackResponse({
      requestId: 'ff-submit-1',
      campaignId: 'camp1',
      studentId: 'stu1',
      answers: ANSWERS,
      comment: 'The messages are clear.',
    })
    expect(replay.alreadyCompleted).toBe(false)

    await fixture.schoolRepositories.guardians.save(new Guardian({
      id: 'gua1b',
      schoolId: SCHOOL,
      firstName: 'Other',
      lastName: 'Ada',
      subjectId: 'gua-subject-1b',
    }))
    await fixture.schoolRepositories.guardianLinks.save(new GuardianStudentLink({
      id: 'link1b',
      schoolId: SCHOOL,
      guardianId: 'gua1b',
      studentId: 'stu1',
      relationship: 'parent',
    }))

    const otherGuardian = fixture.forActor(guardianActor('gua1b', 'gua-subject-1b')).familyFeedbackWorkflow
    const already = await otherGuardian.submitFamilyFeedbackResponse({
      requestId: 'ff-submit-other',
      campaignId: 'camp1',
      studentId: 'stu1',
      answers: ANSWERS,
    })
    expect(already.alreadyCompleted).toBe(true)
    const otherView = await otherGuardian.getGuardianFamilyFeedbackQuestionnaire({
      campaignId: 'camp1',
      studentId: 'stu1',
      locale: 'en',
    })
    expect(otherView.slotState).toBe('already_completed')
    expect(otherView.instrument).toBeUndefined()
    expect(otherView.receipt?.status).toBe('completed')

    await staff.closeFamilyFeedbackCampaign({ requestId: 'ff-close', id: 'camp1' })
    const comments = await staff.listFamilyFeedbackComments({ id: 'camp1' })
    expect(comments.comments).toEqual([{ id: expect.any(String), comment: 'The messages are clear.' }])
    expect(comments.comments[0]?.id.startsWith('ffs:')).toBe(false)

    await staff.saveFamilyFeedbackThemeDraft({ requestId: 'ff-theme', id: 'camp1', themes: 'Families value timely messages.' })
    const published = await staff.publishFamilyFeedbackCampaign({ requestId: 'ff-publish', id: 'camp1' })
    expect(published.status).toBe(FamilyFeedbackCampaignStatus.Published)
    const review = await staff.getFamilyFeedbackAggregateReview({ id: 'camp1' })
    expect(review.overallSuppressed).toBe(true)
    expect(review.completedSlotCount).toBe(1)
    expect(review.questions.every(question => question.suppressed)).toBe(true)
    expect(review.themes).toBe('Families value timely messages.')

    const teacher = fixture.forActor(createTeacherActorMetadata({
      schoolId: SCHOOL,
      teacherId: 'teacher1',
      subjectId: 'teacher-subject',
      requestId: 'teacher',
      authenticatedAt: new Date(),
    })).familyFeedbackWorkflow
    const results = await teacher.listTeacherFamilyFeedbackResults()
    expect(results).toHaveLength(1)
    expect(results[0]?.campaignId).toBe('camp1')
    expect(results[0]?.themes).toBe('Families value timely messages.')
    await expect(teacher.listFamilyFeedbackComments({ id: 'camp1' })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('denies a conflicted moderator and requires a moderator before open', async () => {
    const fixture = await createTestApp()
    await seedAssignment(fixture.schoolRepositories)
    await fixture.schoolRepositories.staffMembers.save(new StaffMember({
      id: 'conflicted',
      schoolId: SCHOOL,
      firstName: 'Marie',
      lastName: 'Staff',
      subjectId: 'teacher-subject',
    }))
    const staff = fixture.app.familyFeedbackWorkflow
    const created = await staff.createFamilyFeedbackCampaign({
      requestId: 'ff-no-mod',
      id: 'camp-mod',
      academicYearId: 'ay1',
      academicPeriodId: 'per1',
      teacherAssignmentId: 'ta1',
    })
    expect(created.moderatorStaffId).toBeUndefined()
    await expect(staff.openFamilyFeedbackCampaign({ requestId: 'ff-open-denied', id: 'camp-mod' }))
      .rejects
      .toMatchObject({ code: FAMILY_FEEDBACK_FAILURES.MODERATOR_REQUIRED })
    await expect(staff.assignFamilyFeedbackModerator({
      requestId: 'ff-conflict',
      id: 'camp-mod',
      moderatorStaffId: 'conflicted',
    })).rejects.toMatchObject({ code: FAMILY_FEEDBACK_FAILURES.MODERATOR_CONFLICT })
  })

  test('cron opens a scheduled campaign and closes it after cutoff', async () => {
    const fixture = await createTestApp()
    await seedAssignment(fixture.schoolRepositories)
    const staff = fixture.app.familyFeedbackWorkflow
    await staff.createFamilyFeedbackCampaign({
      requestId: 'ff-sched-create',
      id: 'camp-cron',
      academicYearId: 'ay1',
      academicPeriodId: 'per1',
      teacherAssignmentId: 'ta1',
      moderatorStaffId: 'admin',
      opensAt: new Date('2026-04-01T08:00:00Z'),
      closesAt: new Date('2026-04-10T08:00:00Z'),
    })
    await staff.scheduleFamilyFeedbackCampaign({ requestId: 'ff-sched', id: 'camp-cron' })
    await runCronJobs(fixture.application, {
      asOf: new Date('2026-04-01T09:00:00Z'),
      jobKeys: ['advanceFamilyFeedbackCampaigns'],
    })
    expect((await fixture.schoolRepositories.familyFeedbackCampaigns.findById('camp-cron'))?.status)
      .toBe(FamilyFeedbackCampaignStatus.Open)
    await runCronJobs(fixture.application, {
      asOf: new Date('2026-04-10T08:00:00Z'),
      jobKeys: ['advanceFamilyFeedbackCampaigns'],
    })
    expect((await fixture.schoolRepositories.familyFeedbackCampaigns.findById('camp-cron'))?.status)
      .toBe(FamilyFeedbackCampaignStatus.Closed)
  })

  test('publishes per-question scores only when ten distinct guardian subjects scored them', async () => {
    const fixture = await createTestApp()
    await seedAssignment(fixture.schoolRepositories, 10)
    const staff = fixture.app.familyFeedbackWorkflow
    await staff.createFamilyFeedbackCampaign({
      requestId: 'ff-threshold-create',
      id: 'camp-n',
      academicYearId: 'ay1',
      academicPeriodId: 'per1',
      teacherAssignmentId: 'ta1',
      moderatorStaffId: 'admin',
    })
    await staff.openFamilyFeedbackCampaign({ requestId: 'ff-threshold-open', id: 'camp-n' })
    for (let index = 1; index <= 10; index += 1) {
      await fixture.forActor(guardianActor(`gua${index}`, `gua-subject-${index}`)).familyFeedbackWorkflow.submitFamilyFeedbackResponse({
        requestId: `ff-threshold-submit-${index}`,
        campaignId: 'camp-n',
        studentId: `stu${index}`,
        answers: {
          communication: 5,
          clarity: 'cannot_assess',
          support: 4,
          student_experience: 3,
        },
      })
    }
    await staff.closeFamilyFeedbackCampaign({ requestId: 'ff-threshold-close', id: 'camp-n' })
    await staff.publishFamilyFeedbackCampaign({ requestId: 'ff-threshold-publish', id: 'camp-n' })
    const review = await staff.getFamilyFeedbackAggregateReview({ id: 'camp-n' })
    const question = (id: string) => review.questions.find(entry => entry.questionId === id)
    expect(question('communication')?.suppressed).toBe(false)
    expect(question('communication')?.nScored).toBe(10)
    expect(question('clarity')?.suppressed).toBe(true)
    expect(question('clarity')?.nScored).toBe(0)
    expect(question('support')?.suppressed).toBe(false)
    expect(review.overallSuppressed).toBe(true)
  })

  test('non-owner staff needs an explicit grant and cannot read comments unless designated', async () => {
    const fixture = await createTestApp()
    await seedAssignment(fixture.schoolRepositories)
    await fixture.schoolRepositories.staffMembers.save(new StaffMember({
      id: 'reader',
      schoolId: SCHOOL,
      firstName: 'Pat',
      lastName: 'Reader',
      subjectId: 'reader-subject',
    }))
    const readerActor = createStaffActorMetadata({
      schoolId: SCHOOL,
      staffMemberId: 'reader',
      subjectId: 'reader-subject',
      requestId: 'reader',
      authenticatedAt: new Date(),
      assuranceLevel: ActorAssuranceLevel.Verified,
    })
    const reader = fixture.forActor(readerActor).familyFeedbackWorkflow
    await expect(reader.createFamilyFeedbackCampaign({
      requestId: 'ff-denied',
      academicYearId: 'ay1',
      academicPeriodId: 'per1',
      teacherAssignmentId: 'ta1',
    })).rejects.toBeInstanceOf(AuthorizationError)

    await fixture.schoolRepositories.staffPermissionAssignments.save(new StaffPermissionAssignment({
      id: 'grant-read',
      schoolId: SCHOOL,
      staffId: 'reader',
      academicYearId: 'ay1',
      permission: Permission.FAMILY_FEEDBACK_CAMPAIGN_READ,
      scopes: [{ kind: 'school' }],
    }))
    const owner = fixture.app.familyFeedbackWorkflow
    await owner.createFamilyFeedbackCampaign({
      requestId: 'ff-grant-create',
      id: 'camp-grant',
      academicYearId: 'ay1',
      academicPeriodId: 'per1',
      teacherAssignmentId: 'ta1',
      moderatorStaffId: 'admin',
    })
    const listed = await reader.listFamilyFeedbackCampaigns()
    expect(listed.map(campaign => campaign.id)).toContain('camp-grant')
    await expect(reader.listFamilyFeedbackComments({ id: 'camp-grant' })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('fixture-seed can create a draft campaign', async () => {
    const fixture = await createTestApp()
    await seedAssignment(fixture.schoolRepositories)
    const seeder = fixture.forActor(createSystemActorMetadata({
      schoolId: SCHOOL,
      requestId: 'fixture-seed',
      systemId: 'fixture-seed',
      reason: 'Install the selected local development dataset',
    })).familyFeedbackWorkflow
    const created = await seeder.createFamilyFeedbackCampaign({
      requestId: 'ff-seed',
      id: 'camp-seed',
      academicYearId: 'ay1',
      academicPeriodId: 'per1',
      teacherAssignmentId: 'ta1',
      moderatorStaffId: 'admin',
    })
    expect(created.status).toBe(FamilyFeedbackCampaignStatus.Draft)
    expect((await seeder.listFamilyFeedbackCampaigns()).map(campaign => campaign.id)).toContain('camp-seed')
  })

  test('serializes submit against close and denies a withdrawn student', async () => {
    const fixture = await createTestApp()
    await seedAssignment(fixture.schoolRepositories)
    const staff = fixture.app.familyFeedbackWorkflow
    await staff.createFamilyFeedbackCampaign({
      requestId: 'ff-close-create',
      id: 'camp-close',
      academicYearId: 'ay1',
      academicPeriodId: 'per1',
      teacherAssignmentId: 'ta1',
      moderatorStaffId: 'admin',
    })
    await staff.openFamilyFeedbackCampaign({ requestId: 'ff-close-open', id: 'camp-close' })
    await staff.closeFamilyFeedbackCampaign({ requestId: 'ff-close-now', id: 'camp-close' })
    const guardian = fixture.forActor(guardianActor('gua1', 'gua-subject-1')).familyFeedbackWorkflow
    await expect(guardian.submitFamilyFeedbackResponse({
      requestId: 'ff-close-submit',
      campaignId: 'camp-close',
      studentId: 'stu1',
      answers: ANSWERS,
    })).rejects.toMatchObject({ code: FAMILY_FEEDBACK_FAILURES.CLOSED })

    const withdrawn = await createTestApp()
    await seedAssignment(withdrawn.schoolRepositories)
    const withdrawnStaff = withdrawn.app.familyFeedbackWorkflow
    await withdrawnStaff.createFamilyFeedbackCampaign({
      requestId: 'ff-withdraw-create',
      id: 'camp-withdraw',
      academicYearId: 'ay1',
      academicPeriodId: 'per1',
      teacherAssignmentId: 'ta1',
      moderatorStaffId: 'admin',
    })
    await withdrawnStaff.openFamilyFeedbackCampaign({ requestId: 'ff-withdraw-open', id: 'camp-withdraw' })
    const enrollment = await withdrawn.schoolRepositories.enrollments.findById('enr1')
    await withdrawn.schoolRepositories.enrollments.save(enrollment!.close({
      endedAt: new Date('2026-02-01'),
      endReason: EnrollmentEndReason.Withdrawn,
      closedBy: 'admin',
    }))
    const withdrawnGuardian = withdrawn.forActor(guardianActor('gua1', 'gua-subject-1')).familyFeedbackWorkflow
    await expect(withdrawnGuardian.submitFamilyFeedbackResponse({
      requestId: 'ff-withdraw-submit',
      campaignId: 'camp-withdraw',
      studentId: 'stu1',
      answers: ANSWERS,
    })).rejects.toMatchObject({ code: FAMILY_FEEDBACK_FAILURES.ELIGIBILITY_DENIED })
  })

  test('denies the evaluated teacher even with an owner staff profile', async () => {
    const fixture = await createTestApp()
    await seedAssignment(fixture.schoolRepositories)
    await fixture.schoolRepositories.teachers.save(new Teacher({
      id: 'teacher1',
      schoolId: SCHOOL,
      firstName: 'Marie',
      lastName: 'Curie',
      subjectId: 'admin-user',
    }))
    const staff = fixture.app.familyFeedbackWorkflow
    await staff.createFamilyFeedbackCampaign({
      requestId: 'ff-owner-create',
      id: 'camp-owner',
      academicYearId: 'ay1',
      academicPeriodId: 'per1',
      teacherAssignmentId: 'ta1',
    })
    await expect(staff.assignFamilyFeedbackModerator({
      requestId: 'ff-owner-assign',
      id: 'camp-owner',
      moderatorStaffId: 'admin',
    })).rejects.toMatchObject({ code: FAMILY_FEEDBACK_FAILURES.MODERATOR_CONFLICT })
  })

  test('purges raw answers after retention while keeping slot completion and published aggregates', async () => {
    const fixture = await createTestApp()
    await seedAssignment(fixture.schoolRepositories)
    const staff = fixture.app.familyFeedbackWorkflow
    await staff.createFamilyFeedbackCampaign({
      requestId: 'ff-purge-create',
      id: 'camp-purge',
      academicYearId: 'ay1',
      academicPeriodId: 'per1',
      teacherAssignmentId: 'ta1',
      moderatorStaffId: 'admin',
    })
    await staff.openFamilyFeedbackCampaign({ requestId: 'ff-purge-open', id: 'camp-purge' })
    await fixture.forActor(guardianActor('gua1', 'gua-subject-1')).familyFeedbackWorkflow.submitFamilyFeedbackResponse({
      requestId: 'ff-purge-submit',
      campaignId: 'camp-purge',
      studentId: 'stu1',
      answers: ANSWERS,
      comment: 'Please keep this private.',
    })
    const closedAt = new Date('2026-04-01T08:00:00Z')
    await staff.closeFamilyFeedbackCampaign({ requestId: 'ff-purge-close', id: 'camp-purge' }, closedAt)
    await staff.saveFamilyFeedbackThemeDraft({ requestId: 'ff-purge-theme', id: 'camp-purge', themes: 'Families want clearer messages.' })
    await staff.publishFamilyFeedbackCampaign({ requestId: 'ff-purge-publish', id: 'camp-purge' })

    await runCronJobs(fixture.application, {
      asOf: new Date(closedAt.getTime() + FAMILY_FEEDBACK_RETENTION_MS - 24 * 60 * 60 * 1000),
      jobKeys: ['advanceFamilyFeedbackCampaigns'],
    })
    expect((await fixture.schoolRepositories.familyFeedbackResponses.list({ campaignId: 'camp-purge' })).length).toBe(1)

    await runCronJobs(fixture.application, {
      asOf: new Date(closedAt.getTime() + FAMILY_FEEDBACK_RETENTION_MS),
      jobKeys: ['advanceFamilyFeedbackCampaigns'],
    })
    expect((await fixture.schoolRepositories.familyFeedbackResponses.list({ campaignId: 'camp-purge' })).length).toBe(0)
    const slot = await fixture.schoolRepositories.familyFeedbackSlots.findById('ffs:camp-purge:stu1')
    expect(slot?.status).toBe(FamilyFeedbackSlotStatus.Completed)
    expect(slot?.completingGuardianId).toBeUndefined()
    await expect(staff.listFamilyFeedbackComments({ id: 'camp-purge' })).rejects.toMatchObject({ code: FAMILY_FEEDBACK_FAILURES.PURGED })
    const review = await staff.getFamilyFeedbackAggregateReview({ id: 'camp-purge' })
    expect(review.themes).toBe('Families want clearer messages.')
    const guardian = fixture.forActor(guardianActor('gua1', 'gua-subject-1')).familyFeedbackWorkflow
    await expect(guardian.submitFamilyFeedbackResponse({
      requestId: 'ff-purge-resubmit',
      campaignId: 'camp-purge',
      studentId: 'stu1',
      answers: ANSWERS,
    })).rejects.toMatchObject({ code: FAMILY_FEEDBACK_FAILURES.CLOSED })
  })

  test('two guardians racing one slot leave a single completed receipt', async () => {
    const fixture = await createTestApp()
    await seedAssignment(fixture.schoolRepositories)
    await fixture.schoolRepositories.guardians.save(new Guardian({
      id: 'gua1b',
      schoolId: SCHOOL,
      firstName: 'Other',
      lastName: 'Ada',
      subjectId: 'gua-subject-1b',
    }))
    await fixture.schoolRepositories.guardianLinks.save(new GuardianStudentLink({
      id: 'link1b',
      schoolId: SCHOOL,
      guardianId: 'gua1b',
      studentId: 'stu1',
      relationship: 'parent',
    }))
    const staff = fixture.app.familyFeedbackWorkflow
    await staff.createFamilyFeedbackCampaign({
      requestId: 'ff-race-create',
      id: 'camp-race',
      academicYearId: 'ay1',
      academicPeriodId: 'per1',
      teacherAssignmentId: 'ta1',
      moderatorStaffId: 'admin',
    })
    await staff.openFamilyFeedbackCampaign({ requestId: 'ff-race-open', id: 'camp-race' })
    const first = fixture.forActor(guardianActor('gua1', 'gua-subject-1')).familyFeedbackWorkflow
    const second = fixture.forActor(guardianActor('gua1b', 'gua-subject-1b')).familyFeedbackWorkflow
    const [one, two] = await Promise.all([
      first.submitFamilyFeedbackResponse({
        requestId: 'ff-race-a',
        campaignId: 'camp-race',
        studentId: 'stu1',
        answers: ANSWERS,
      }),
      second.submitFamilyFeedbackResponse({
        requestId: 'ff-race-b',
        campaignId: 'camp-race',
        studentId: 'stu1',
        answers: ANSWERS,
      }),
    ])
    expect([one.alreadyCompleted, two.alreadyCompleted].filter(Boolean)).toHaveLength(1)
    expect(await fixture.schoolRepositories.familyFeedbackResponses.count({ campaignId: 'camp-race' })).toBe(1)
  })
})
