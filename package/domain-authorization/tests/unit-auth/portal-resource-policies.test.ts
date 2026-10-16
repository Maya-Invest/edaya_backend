import { AccessPolicies, createGuardianActorMetadata, createStudentActorMetadata, createTeacherActorMetadata } from '@edaya/authorization'
import { Attachment, AttachmentOwnerKind, AttendanceSummary, CatalogService, CatalogServiceCategory, CatalogServiceStatus, ChargeStatus, GradeScale, Payment, PaymentKind, PaymentMethod, Permission, ReportCardDefinition, ReportCardDefinitionSectionKind, ReportCardResult, ReportCardResultSection, ReportCardResultStatus, StudentCharge, StudentServiceEnrollment, StudentYearAccount, studentYearAccountId, TeacherAssignment, TeacherAssignmentKind } from '@edaya/core'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createAuthorizationDatabase, seedAuthorizationRelationships } from '../../../adaptor-postgres/tests/support/authorization-database'

describe('portal actions use current relationships and publication', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  const identity = { schoolId: 'school-a', subjectId: 'person-a', requestId: 'portal', authenticatedAt: new Date() }
  const guardian = createGuardianActorMetadata({ ...identity, guardianId: 'guardian-a' })
  const student = createStudentActorMetadata({ ...identity, studentId: 'student-a' })
  const teacher = createTeacherActorMetadata({ ...identity, teacherId: 'teacher-a' })
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
    await seedAuthorizationRelationships(fixture.db)
    await fixture.db.exec('UPDATE students SET subject_id = \'person-a\' WHERE id = \'student-a\'')
  })
  afterEach(async () => {
    await fixture.db.close()
  })

  async function finance() {
    for (const [id, studentId] of [['linked', 'student-a'], ['unlinked', 'student-other'], ['unused', undefined]] as const) {
      await fixture.repositories.catalogServices.save(new CatalogService({
        id,
        schoolId: 'school-a',
        academicYearId: 'year-a',
        name: id,
        defaultPrice: 1000,
        currency: 'XOF',
        billingTerms: { kind: 'one_time', installments: [] },
        status: CatalogServiceStatus.Active,
      }))
      if (studentId) {
        const accountId = studentYearAccountId('school-a', studentId, 'year-a', 'XOF')
        await fixture.repositories.studentServiceEnrollments.save(new StudentServiceEnrollment({
          id: `enr-${id}`,
          schoolId: 'school-a',
          studentId,
          catalogServiceId: id,
          academicYearId: 'year-a',
          acceptedTerms: {
            catalogServiceId: id,
            name: id,
            category: CatalogServiceCategory.Tuition,
            currency: 'XOF',
            price: 1000,
            billingKind: 'one_time',
            billingTerms: { kind: 'one_time', installments: [] },
          },
        }))
        await fixture.repositories.studentCharges.save(new StudentCharge({
          id: `enr-${id}`,
          schoolId: 'school-a',
          studentId,
          enrollmentId: `enr-${id}`,
          academicYearId: 'year-a',
          label: id,
          expectedAmount: 1000,
          allocatedAmount: 100,
          currency: 'XOF',
          status: ChargeStatus.Partial,
        }))
        await fixture.repositories.studentYearAccounts.save(new StudentYearAccount({
          id: accountId,
          schoolId: 'school-a',
          studentId,
          academicYearId: 'year-a',
          currency: 'XOF',
          availableBalance: 0,
        }))
        await fixture.repositories.payments.save(new Payment({
          id: `payment-${id}`,
          schoolId: 'school-a',
          accountId,
          academicYearId: 'year-a',
          kind: PaymentKind.Receipt,
          amount: 100,
          currency: 'XOF',
          method: PaymentMethod.Cash,
          paymentDate: new Date(),
        }))
      }
    }
  }

  test.each([guardian, student])('$kind finance reads constrain catalog, balances, payments, pagination and counts to linked students', async (actor) => {
    await finance()
    const access = new AccessPolicies(actor, fixture.repositories)
    for (const resource of ['catalogServices', 'studentCharges', 'payments'] as const) {
      const repository = fixture.repositories[resource].forAccess(await access.entity(resource).readScope())
      const expectedId = resource === 'catalogServices' ? 'linked' : resource === 'studentCharges' ? 'enr-linked' : 'payment-linked'
      const deniedId = resource === 'catalogServices' ? 'unlinked' : resource === 'studentCharges' ? 'enr-unlinked' : 'payment-unlinked'
      expect((await repository.list()).map(row => row.id)).toEqual([expectedId])
      expect(await repository.count()).toBe(1)
      expect(await repository.list({ $offset: 1, $limit: 1 })).toEqual([])
      expect(await repository.findById(deniedId)).toBeUndefined()
    }
    await expect(access.assertSchool(Permission.PAYMENT_RECORD)).rejects.toThrow()
    const linkedAccountId = studentYearAccountId('school-a', 'student-a', 'year-a', 'XOF')
    const unlinkedAccountId = studentYearAccountId('school-a', 'student-other', 'year-a', 'XOF')
    await expect(access.finance.assertReadStudent('student-a')).resolves.toBeDefined()
    await expect(access.finance.assertReadAccount(linkedAccountId)).resolves.toMatchObject({ id: linkedAccountId })
    await expect(access.finance.assertReadAccount(unlinkedAccountId)).rejects.toThrow()
    if (actor.kind === 'guardian') {
      await fixture.repositories.guardianLinks.delete('guardian-link')
      expect(await fixture.repositories.payments.forAccess(await access.entity('payments').readScope()).count()).toBe(0)
    }
    else {
      expect(await fixture.repositories.payments.forAccess(await new AccessPolicies({ ...actor, academicYearId: 'year-old' }, fixture.repositories).entity('payments').readScope()).count()).toBe(0)
    }
  })

  async function reportCards() {
    await fixture.repositories.gradeScales.save(new GradeScale({ id: 'scale', schoolId: 'school-a', name: 'Scale', minScore: 0, maxScore: 20, ranges: [{ letter: 'A', minScore: 0, maxScore: 20 }] }))
    await fixture.repositories.definitions.save(new ReportCardDefinition({ id: 'definition', schoolId: 'school-a', academicYearId: 'year-a', gradeLevelId: 'level-a', gradeScaleId: 'scale', name: 'Term' }))
    for (const [id, studentId, classGroupId] of [['card', 'student-a', 'class-a'], ['unrelated-card', 'student-other', 'class-other']] as const) {
      await fixture.repositories.results.save(new ReportCardResult({ id, reportCardDefinitionId: 'definition', studentId, classGroupId, periodId: 'period-a', sectionResults: sections(), attendanceSummary: new AttendanceSummary({ presentCount: 1, absenceCount: 0, lateCount: 0 }), assessmentResultCount: 2, overallAverage: 11 }))
    }
    return (await fixture.repositories.results.findById('card'))!
  }

  function sections(mathComment?: string, frenchComment?: string, groupComment?: string) {
    return [new ReportCardResultSection({ sectionId: 'group', sectionKind: ReportCardDefinitionSectionKind.Group, name: 'Subjects', average: 11, weight: 1, comment: groupComment, subResults: [
      new ReportCardResultSection({ sectionId: 'math-section', sectionKind: ReportCardDefinitionSectionKind.Subject, name: 'Math', average: 10, weight: 1, classSubjectId: 'math-a', comment: mathComment }),
      new ReportCardResultSection({ sectionId: 'french-section', sectionKind: ReportCardDefinitionSectionKind.Subject, name: 'French', average: 12, weight: 1, classSubjectId: 'french-a', comment: frenchComment }),
    ] })]
  }

  test.each([guardian, student])('$kind sees approved grades and published linked cards, including their attachments', async (actor) => {
    const card = await reportCards()
    const access = new AccessPolicies(actor, fixture.repositories)
    for (const [id, ownerKind, ownerId] of [['card-file', AttachmentOwnerKind.ReportCard, 'card'], ['grade-file', AttachmentOwnerKind.AssessmentResult, '1-math'], ['unrelated-file', AttachmentOwnerKind.AssessmentResult, '3-other']] as const)
      await fixture.repositories.attachments.save(new Attachment({ id, schoolId: 'school-a', ownerKind, ownerId, fileName: id, storageKey: id }))
    expect(await fixture.repositories.results.forAccess(await access.entity('results').readScope()).count()).toBe(0)
    expect(await fixture.repositories.assessmentResults.forAccess(await access.grades.readScope()).count()).toBe(0)
    const unpublishedFiles = fixture.repositories.attachments.forAccess(await access.entity('attachments').readScope())
    expect((await unpublishedFiles.list({ $orderBy: [{ field: 'id', direction: 'asc' }] })).map(row => row.id)).toEqual([])
    await fixture.db.exec('UPDATE assessments SET marks_status = \'submitted\'')
    expect(await fixture.repositories.assessmentResults.forAccess(await access.grades.readScope()).count()).toBe(2)
    expect((await unpublishedFiles.list()).map(row => row.id)).toEqual(['grade-file'])
    await fixture.repositories.results.save(card.copyWith({ status: ReportCardResultStatus.Published, publishedAt: new Date() }))
    const unrelated = (await fixture.repositories.results.findById('unrelated-card'))!
    await fixture.repositories.results.save(unrelated.copyWith({ status: ReportCardResultStatus.Published, publishedAt: new Date() }))
    expect((await fixture.repositories.results.forAccess(await access.entity('results').readScope()).list()).map(row => row.id)).toEqual(['card'])
    expect(await fixture.repositories.assessmentResults.forAccess(await access.grades.readScope()).count()).toBe(2)
    const files = fixture.repositories.attachments.forAccess(await access.entity('attachments').readScope())
    expect((await files.list({ $orderBy: [{ field: 'id', direction: 'asc' }] })).map(row => row.id)).toEqual(['card-file', 'grade-file'])
    expect(await files.findById('unrelated-file')).toBeUndefined()
    await fixture.repositories.results.save(card)
    expect((await fixture.repositories.attachments.forAccess(await access.entity('attachments').readScope()).list()).map(row => row.id)).toEqual(['grade-file'])
  })

  test('guardian attachments include own profile and linked payments but exclude staff and unspecified owners', async () => {
    await finance()
    for (const [id, ownerKind, ownerId] of [
      ['own', AttachmentOwnerKind.Guardian, 'guardian-a'],
      ['paid', AttachmentOwnerKind.Payment, 'payment-linked'],
      ['unrelated', AttachmentOwnerKind.Payment, 'payment-unlinked'],
      ['staff', AttachmentOwnerKind.Staff, 'staff-a'],
      ['other', AttachmentOwnerKind.Other, 'anything'],
      ['missing', AttachmentOwnerKind.Payment, 'missing'],
    ] as const) await fixture.repositories.attachments.save(new Attachment({ id, schoolId: 'school-a', ownerKind, ownerId, fileName: id, storageKey: id }))
    const access = new AccessPolicies(guardian, fixture.repositories)
    expect((await fixture.repositories.attachments.forAccess(await access.entity('attachments').readScope()).list()).map(row => row.id).sort()).toEqual(['own', 'paid'])
    await fixture.repositories.guardianLinks.delete('guardian-link')
    expect((await fixture.repositories.attachments.forAccess(await access.entity('attachments').readScope()).list()).map(row => row.id)).toEqual(['own'])
  })

  test('subject and homeroom report comments remain distinct and never permit grades or publication changes', async () => {
    const before = await reportCards()
    const access = new AccessPolicies(teacher, fixture.repositories)
    const subjectComment = new ReportCardResult({ ...before.data, sectionResults: sections('Math progress') })
    await access.entity('results').assertSave(subjectComment, before)
    for (const after of [
      new ReportCardResult({ ...before.data, sectionResults: sections(undefined, 'French progress') }),
      new ReportCardResult({ ...before.data, sectionResults: sections(), teacherComment: 'Class summary' }),
      new ReportCardResult({ ...before.data, sectionResults: sections(), principalComment: 'Principal summary' }),
      new ReportCardResult({ ...before.data, sectionResults: sections(), overallAverage: 20 }),
      before.copyWith({ status: ReportCardResultStatus.Published, publishedAt: new Date() }),
    ]) await expect(access.entity('results').assertSave(after, before)).rejects.toThrow()
    await fixture.repositories.teacherAssignments.delete('teaching')
    await fixture.repositories.teacherAssignments.save(new TeacherAssignment({ id: 'homeroom', teacherId: 'teacher-a', academicYearId: 'year-a', kind: TeacherAssignmentKind.Homeroom, classGroupId: 'class-a' }))
    await access.entity('results').assertSave(new ReportCardResult({ ...before.data, sectionResults: sections(undefined, undefined, 'Group summary'), teacherComment: 'Class summary' }), before)
    await expect(access.entity('results').assertSave(subjectComment, before)).rejects.toThrow()
    await expect(access.entity('results').assertSave(before)).rejects.toThrow()
    const published = before.copyWith({ status: ReportCardResultStatus.Published, publishedAt: new Date() })
    await expect(access.entity('results').assertSave(published, published)).rejects.toThrow()
  })

  test('ended and future teaching assignments grant no class access; teacher self records remain visible', async () => {
    const access = new AccessPolicies(teacher, fixture.repositories)
    const original = (await fixture.repositories.teacherAssignments.findById('teaching'))!
    for (const dates of [{ endsAt: new Date('2000-01-01') }, { startsAt: new Date('2999-01-01') }]) {
      await fixture.repositories.teacherAssignments.save(new TeacherAssignment({ ...original.data, ...dates }))
      expect(await fixture.repositories.students.forAccess(await access.entity('students').readScope()).count()).toBe(0)
      await expect(access.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })).rejects.toThrow()
      expect(await fixture.repositories.teacherAssignments.forAccess(await access.entity('teacherAssignments').readScope()).count()).toBe(1)
      expect((await fixture.repositories.teachers.forAccess(await access.entity('teachers').readScope()).list()).map(row => row.id)).toEqual(['teacher-a'])
    }
    await expect(access.entity('catalogServices').readScope()).rejects.toThrow()
  })
})
