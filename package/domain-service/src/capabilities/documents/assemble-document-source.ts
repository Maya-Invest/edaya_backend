import type { DocumentIssuance, DocumentIssuanceSnapshot, DocumentTemplateKey } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import type { DocumentLocale } from './catalog'
import {
  BusinessRuleViolationError,
  ChargeStatus,
  DOCUMENT_FAILURES,
  DocumentSourceType,
  EnrollmentEndReason,
  isAllocationActive,
  OccurrenceStatus,
  PaymentKind,
  PaymentStatus,
  remainingChargeObligation,
  ReportCardResultStatus,
  StudentClassEnrollmentStatus,
  TimetableGenerated,
} from '@edaya/core'
import { buildLogbookV1Payload as composeLogbook } from './build-logbook-v1-payload'
import { buildReportCardV1Payload } from './build-report-card-v1-payload'
import { getDocumentTemplateCatalogEntry } from './catalog'
import { catalogClassName, catalogLangFromLocale, catalogMatter, catalogPeriodLabel, catalogSubjectName } from './catalog-label'
import { formatDocumentDate, formatDocumentIsoDate, formatDocumentMoney } from './document-format'

export interface AssembleDocumentInput {
  templateKey: DocumentTemplateKey
  sourceId: string
  locale: DocumentLocale
  academicYearId?: string
  academicPeriodId?: string
  classSubjectId?: string
  studentId?: string
  classGroupId?: string
  teacherId?: string
  staffFields?: { recipient?: string, date?: string, location?: string, reason?: string }
  preview?: boolean
}

export interface AssembledDocumentSource {
  academicYearId: string
  sourceType: DocumentSourceType
  sourceId: string
  sourceVersion: string
  studentId?: string
  classGroupId?: string
  snapshot: DocumentIssuanceSnapshot
  portraitRequired: boolean
}

/** Rebuild assemble input from the stored issuance so durable render uses the same filters. */
export function assembleInputFromIssuance(issuance: Pick<DocumentIssuance, 'templateKey' | 'sourceId' | 'locale' | 'academicYearId' | 'studentId' | 'classGroupId' | 'snapshot'>): AssembleDocumentInput {
  return {
    templateKey: issuance.templateKey,
    sourceId: issuance.sourceId,
    locale: issuance.locale,
    academicYearId: issuance.academicYearId,
    studentId: issuance.studentId,
    classGroupId: issuance.classGroupId,
    academicPeriodId: issuance.snapshot.academicPeriodId,
    classSubjectId: issuance.snapshot.classSubjectId,
    teacherId: issuance.snapshot.teacherId,
    staffFields: issuance.snapshot.staffFields,
  }
}

function fail(code: string, message: string): never {
  throw new BusinessRuleViolationError(code, message)
}

function localeTag(locale: DocumentLocale): string {
  return locale === 'en' ? 'en-GB' : 'fr-FR'
}

export async function assembleDocumentSource(base: BaseSchoolService, input: AssembleDocumentInput): Promise<AssembledDocumentSource> {
  const catalog = getDocumentTemplateCatalogEntry(input.templateKey)
  if (!catalog.locales.includes(input.locale))
    fail(DOCUMENT_FAILURES.LOCALE_UNSUPPORTED, `Locale ${input.locale} is not admitted for ${input.templateKey}`)
  const school = await base.repositories.schools.findById(base.actor.schoolId)
  if (!school)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'School was not found')
  const locale = localeTag(input.locale)
  const timeZone = school.timeZone
  const titles = catalog.titles[input.locale]
  const branding = {
    logoAttachmentId: school.logoAttachmentId,
    crestAttachmentId: school.crestAttachmentId,
    stampAttachmentId: school.stampAttachmentId,
    signatureAttachmentId: school.signatureAttachmentId,
    issuanceAssetVersion: school.issuanceAssetVersion,
  }

  switch (input.templateKey) {
    case 'report-card.v1':
      return assembleReportDocument(base, input, school, locale, timeZone, titles, branding)
    case 'annual-transcript.v1':
      return assembleAnnualTranscript(base, input, school, locale, timeZone, titles, branding)
    case 'logbook.v1':
      return assembleLogbook(base, input, school, locale, timeZone, titles, branding)
    case 'schooling-certificate.v1':
    case 'enrollment-record.v1':
    case 'withdrawal-certificate.v1':
      return assembleEnrollmentDocument(base, input, school, locale, timeZone, titles, branding)
    case 'student-id-card.v1':
      return assembleStudentIdCard(base, input, school, locale, timeZone, titles, branding)
    case 'invoice.v1':
    case 'account-statement.v1':
    case 'payment-reminder.v1':
      return assembleAccountDocument(base, input, school, locale, timeZone, titles, branding)
    case 'receipt.v1':
    case 'settlement-quittance.v1':
      return assemblePaymentDocument(base, input, school, locale, timeZone, titles, branding)
    case 'convocation.v1':
      return assembleConvocation(base, input, school, locale, timeZone, titles, branding)
    case 'class-timetable.v1':
    case 'class-roster.v1':
      return assembleClassOperational(base, input, school, locale, timeZone, titles, branding)
    case 'teacher-timetable.v1':
      return assembleTeacherTimetable(base, input, school, locale, timeZone, titles, branding)
    case 'attendance-sheet.v1':
      return assembleAttendanceSheet(base, input, school, locale, timeZone, titles, branding)
    case 'incident-report.v1':
      return assembleIncidentReport(base, input, school, locale, timeZone, titles, branding)
    default:
      fail(DOCUMENT_FAILURES.TEMPLATE_UNSUPPORTED, `Unsupported template ${input.templateKey}`)
  }
}

async function requireYear(base: BaseSchoolService, academicYearId: string) {
  const year = await base.repositories.academicYears.findById(academicYearId)
  if (!year || year.schoolId !== base.actor.schoolId)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Academic year was not found')
  return year
}

async function assembleReportDocument(
  base: BaseSchoolService,
  input: AssembleDocumentInput,
  school: Awaited<ReturnType<BaseSchoolService['repositories']['schools']['findById']>> & {},
  locale: string,
  timeZone: string,
  title: string,
  branding: Record<string, unknown>,
): Promise<AssembledDocumentSource> {
  const context = await base.access.reportCards.documentContext(input.sourceId)
  if (context.result.status !== ReportCardResultStatus.Published || !context.period.isPublished)
    fail(DOCUMENT_FAILURES.SOURCE_UNPUBLISHED, 'Report documents require a published result and academic period')
  const catalogLang = catalogLangFromLocale(locale)
  const subjectNameByClassSubjectId = new Map(context.subjects.map(({ classSubjectId, subject }) => [classSubjectId, catalogSubjectName(subject.name, catalogLang, subject.code)]))
  const peerAverages = [...context.peerResults].sort((a, b) => a.id.localeCompare(b.id)).map(entry => entry.overallAverage).filter((value): value is number => value !== undefined)
  const formatAverage = (value: number) => `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} / 20`
  const payload = buildReportCardV1Payload({
    result: context.result,
    student: context.student,
    school: context.school,
    periodLabel: context.period.name,
    classLabel: context.classGroup.name,
    schoolYear: context.academicYear.name,
    locale,
    subjectNameByClassSubjectId,
    teacherNameByClassSubjectId: context.teacherNameByClassSubjectId,
    homeroomTeacherName: context.homeroomTeacherName,
    classResults: peerAverages.length
      ? {
          classAverage: formatAverage(peerAverages.reduce((sum, value) => sum + value, 0) / peerAverages.length),
          lowestAverage: formatAverage(Math.min(...peerAverages)),
          highestAverage: formatAverage(Math.max(...peerAverages)),
        }
      : undefined,
  })
  const publishedAt = context.result.publishedAt?.toISOString() ?? ''
  return {
    academicYearId: context.academicYear.id,
    sourceType: DocumentSourceType.ReportCardResult,
    sourceId: context.result.id,
    sourceVersion: `${publishedAt}:${context.period.id}:${context.result.reportCardDefinitionId}`,
    studentId: context.student.id,
    classGroupId: context.classGroup.id,
    portraitRequired: false,
    snapshot: {
      facts: { kind: input.templateKey, documentTitle: title, ...payload, schoolCode: school.schoolCode, schoolAddress: school.postalAddress, schoolPhone: school.phone, schoolEmail: school.email },
      sourceVersion: `${publishedAt}:${context.period.id}`,
      locale: input.locale,
      timeZone,
      portraitAttachmentId: context.student.photoAttachmentId,
      ...branding,
    },
  }
}

async function assembleAnnualTranscript(
  base: BaseSchoolService,
  input: AssembleDocumentInput,
  school: NonNullable<Awaited<ReturnType<BaseSchoolService['repositories']['schools']['findById']>>>,
  locale: string,
  timeZone: string,
  title: string,
  branding: Record<string, unknown>,
): Promise<AssembledDocumentSource> {
  const result = await base.repositories.results.findById(input.sourceId)
  if (!result)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Report card result was not found')
  const period = await base.repositories.academicPeriods.findById(result.periodId)
  const student = await base.repositories.students.findById(result.studentId)
  const classGroup = await base.repositories.classGroups.findById(result.classGroupId)
  if (!period || !student || !classGroup || student.schoolId !== base.actor.schoolId)
    fail(DOCUMENT_FAILURES.SOURCE_INACCESSIBLE, 'Annual transcript source is not accessible')
  if (result.status !== ReportCardResultStatus.Published || !period.isPublished)
    fail(DOCUMENT_FAILURES.SOURCE_UNPUBLISHED, 'Annual transcripts require published annual results')
  const year = await requireYear(base, period.academicYearId)
  const periods = await base.repositories.academicPeriods.list({ academicYearId: year.id })
  const published = await base.repositories.results.list({ studentId: student.id, status: ReportCardResultStatus.Published })
  const yearResults = published.filter(entry => periods.some(item => item.id === entry.periodId))
  if (yearResults.length === 0)
    fail(DOCUMENT_FAILURES.SOURCE_UNPUBLISHED, 'Annual transcripts require published annual results')
  const rows = yearResults.map((entry) => {
    const resultPeriod = periods.find(item => item.id === entry.periodId)
    return {
      cells: [
        resultPeriod?.name ?? entry.periodId,
        entry.overallAverage !== undefined ? `${entry.overallAverage}` : '—',
      ],
    }
  })
  const sourceVersion = yearResults.map(entry => `${entry.id}:${entry.publishedAt?.toISOString() ?? ''}`).sort().join('|')
  return {
    academicYearId: year.id,
    sourceType: DocumentSourceType.ReportCardResult,
    sourceId: result.id,
    sourceVersion,
    studentId: student.id,
    classGroupId: classGroup.id,
    portraitRequired: false,
    snapshot: {
      facts: {
        kind: 'annual-transcript.v1',
        documentTitle: title,
        schoolName: school.issuingName ?? school.name,
        studentName: student.fullName,
        classLabel: classGroup.name,
        schoolYear: year.name,
        date: formatDocumentDate(new Date(), locale, timeZone),
        columns: locale.startsWith('en') ? ['Period', 'Average'] : ['Période', 'Moyenne'],
        rows,
      },
      sourceVersion,
      locale: input.locale,
      timeZone,
      ...branding,
    },
  }
}

async function assembleLogbook(
  base: BaseSchoolService,
  input: AssembleDocumentInput,
  school: NonNullable<Awaited<ReturnType<BaseSchoolService['repositories']['schools']['findById']>>>,
  locale: string,
  timeZone: string,
  title: string,
  branding: Record<string, unknown>,
): Promise<AssembledDocumentSource> {
  const context = await base.access.logbooks.documentContext({
    classGroupId: input.sourceId,
    academicPeriodId: input.academicPeriodId,
    classSubjectId: input.classSubjectId,
  })
  const catalogLang = catalogLangFromLocale(locale)
  const subjectNameById = new Map(context.subjects.map(entry => [entry.id, catalogSubjectName(entry.name, catalogLang, entry.code)]))
  const chapterNameByMatterLinkId = new Map(
    context.classSubjectMatters.map((link) => {
      const matter = context.subjectMatters.find(entry => entry.id === link.subjectMatterId)
      return [link.id, catalogMatter(matter?.name ?? '', catalogLang)] as const
    }).filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
  )
  let payload
  try {
    payload = composeLogbook({
      schoolName: school.name,
      classLabel: catalogClassName(context.classGroup.name, catalogLang),
      schoolCity: school.city,
      schoolYear: context.academicYear?.name,
      periodLabel: context.period ? catalogPeriodLabel(context.period.name, catalogLang) : undefined,
      dateFrom: context.period ? formatDocumentIsoDate(context.period.startDate, timeZone) : undefined,
      dateTo: context.period ? formatDocumentIsoDate(context.period.endDate, timeZone) : undefined,
      locale,
      timeZone,
      documentTitle: title,
      subjects: context.classSubjects.map(classSubject => ({
        classSubjectId: classSubject.id,
        name: subjectNameById.get(classSubject.subjectId) ?? classSubject.id,
        teacherName: context.teacherNameByClassSubjectId.get(classSubject.id),
      })),
      sessions: context.lessonSessions.map(session => ({
        id: session.id,
        classSubjectId: session.classSubjectId,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        displayLabel: session.displayLabel,
        sessionNote: session.sessionNote,
        status: session.status ?? OccurrenceStatus.Pending,
      })),
      progress: context.progressRecords.map(progress => ({
        lessonSessionId: progress.lessonSessionId,
        classSubjectMatterId: progress.classSubjectMatterId,
        completedPercentage: progress.completedPercentage,
        notes: progress.notes,
      })),
      chapters: [...chapterNameByMatterLinkId.entries()].map(([classSubjectMatterId, name]) => ({ classSubjectMatterId, name })),
      homework: context.homeworkAssessments.flatMap((assessment) => {
        if (!assessment.lessonSessionId)
          return []
        const text = (assessment.description ?? assessment.title).trim()
        if (!text)
          return []
        return [{ lessonSessionId: assessment.lessonSessionId, text }]
      }),
    })
  }
  catch (error) {
    if (error instanceof Error && /no logbook content/i.test(error.message))
      fail(DOCUMENT_FAILURES.SOURCE_MISSING, `No logbook content for class ${context.classGroup.name}`)
    throw error
  }
  const sessionStamp = context.lessonSessions.map(session => session.id).sort().join(',')
  return {
    academicYearId: context.academicYear?.id ?? context.classGroup.academicYearId,
    sourceType: DocumentSourceType.ClassLogbook,
    sourceId: context.classGroup.id,
    sourceVersion: `${sessionStamp}:${context.period?.id ?? ''}`,
    classGroupId: context.classGroup.id,
    portraitRequired: false,
    snapshot: {
      facts: { kind: 'logbook.v1', ...payload },
      sourceVersion: `${sessionStamp}:${context.period?.id ?? ''}`,
      locale: input.locale,
      timeZone,
      ...(context.period ? { academicPeriodId: context.period.id } : {}),
      ...(input.classSubjectId ? { classSubjectId: input.classSubjectId } : {}),
      ...branding,
    },
  }
}

async function assembleEnrollmentDocument(
  base: BaseSchoolService,
  input: AssembleDocumentInput,
  school: NonNullable<Awaited<ReturnType<BaseSchoolService['repositories']['schools']['findById']>>>,
  locale: string,
  timeZone: string,
  title: string,
  branding: Record<string, unknown>,
): Promise<AssembledDocumentSource> {
  const enrollment = await base.repositories.enrollments.findById(input.sourceId)
  if (!enrollment)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Enrollment was not found')
  const student = await base.repositories.students.findById(enrollment.studentId)
  const classGroup = await base.repositories.classGroups.findById(enrollment.classGroupId)
  const year = await requireYear(base, enrollment.academicYearId)
  if (year.status !== 'published')
    fail(DOCUMENT_FAILURES.SOURCE_UNPUBLISHED, 'Official enrollment documents require a published academic year')
  if (!student || !classGroup || student.schoolId !== base.actor.schoolId)
    fail(DOCUMENT_FAILURES.SOURCE_INACCESSIBLE, 'Enrollment is not accessible')
  if (input.templateKey === 'withdrawal-certificate.v1') {
    if (enrollment.status !== StudentClassEnrollmentStatus.Closed || enrollment.endReason !== EnrollmentEndReason.Withdrawn)
      fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Radiation requires a completed withdrawal')
  }
  else if (enrollment.status !== StudentClassEnrollmentStatus.Active && input.templateKey === 'schooling-certificate.v1') {
    fail(DOCUMENT_FAILURES.SOURCE_UNPUBLISHED, 'A schooling certificate requires an active enrollment')
  }
  const paragraphs = input.templateKey === 'withdrawal-certificate.v1'
    ? [{ text: locale.startsWith('en')
        ? `${student.fullName} was withdrawn from ${school.issuingName ?? school.name} on ${enrollment.endedAt ? formatDocumentDate(enrollment.endedAt, locale, timeZone) : '—'}.`
        : `${student.fullName} a été radié(e) de ${school.issuingName ?? school.name} le ${enrollment.endedAt ? formatDocumentDate(enrollment.endedAt, locale, timeZone) : '—'}.` }]
    : [{ text: locale.startsWith('en')
        ? `${student.fullName} is enrolled at ${school.issuingName ?? school.name} for ${year.name}.`
        : `${student.fullName} est scolarisé(e) à ${school.issuingName ?? school.name} pour ${year.name}.` }]
  const sourceVersion = `${enrollment.status}:${enrollment.endReason ?? ''}:${enrollment.endedAt?.toISOString() ?? ''}:${enrollment.enrolledAt?.toISOString() ?? ''}:${student.fullName}`
  return {
    academicYearId: enrollment.academicYearId,
    sourceType: DocumentSourceType.Enrollment,
    sourceId: enrollment.id,
    sourceVersion,
    studentId: student.id,
    classGroupId: classGroup.id,
    portraitRequired: false,
    snapshot: {
      facts: {
        kind: input.templateKey,
        documentTitle: title,
        schoolName: school.issuingName ?? school.name,
        studentName: student.fullName,
        classLabel: classGroup.name,
        schoolYear: year.name,
        matricule: student.matricule,
        date: formatDocumentDate(new Date(), locale, timeZone),
        schoolCity: school.city,
        schoolAddress: school.postalAddress,
        schoolPhone: school.phone,
        schoolCode: school.schoolCode,
        paragraphs,
        fields: [
          { label: locale.startsWith('en') ? 'Class' : 'Classe', value: classGroup.name },
          { label: locale.startsWith('en') ? 'Status' : 'Statut', value: enrollment.status },
          ...(enrollment.endReason ? [{ label: locale.startsWith('en') ? 'Reason' : 'Motif', value: enrollment.endReason }] : []),
        ],
      },
      sourceVersion,
      locale: input.locale,
      timeZone,
      portraitAttachmentId: student.photoAttachmentId,
      ...branding,
    },
  }
}

async function assembleStudentIdCard(
  base: BaseSchoolService,
  input: AssembleDocumentInput,
  school: NonNullable<Awaited<ReturnType<BaseSchoolService['repositories']['schools']['findById']>>>,
  locale: string,
  timeZone: string,
  title: string,
  branding: Record<string, unknown>,
): Promise<AssembledDocumentSource> {
  const student = await base.repositories.students.findById(input.sourceId)
  if (!student || student.schoolId !== base.actor.schoolId)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Student was not found')
  const enrollments = await base.repositories.enrollments.list({ studentId: student.id, status: StudentClassEnrollmentStatus.Active })
  const enrollment = enrollments[0]
  if (!enrollment)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'An active enrollment is required for a student ID card')
  const classGroup = await base.repositories.classGroups.findById(enrollment.classGroupId)
  const year = await requireYear(base, enrollment.academicYearId)
  if (!student.photoAttachmentId)
    fail(input.preview ? DOCUMENT_FAILURES.PREVIEW_REQUIRED : DOCUMENT_FAILURES.ASSET_MISSING, 'An approved portrait is required for a student ID card')
  const sourceVersion = `${student.photoAttachmentId}:${enrollment.id}`
  return {
    academicYearId: enrollment.academicYearId,
    sourceType: DocumentSourceType.Student,
    sourceId: student.id,
    sourceVersion,
    studentId: student.id,
    classGroupId: classGroup?.id,
    portraitRequired: true,
    snapshot: {
      facts: {
        kind: 'student-id-card.v1',
        documentTitle: title,
        schoolName: school.issuingName ?? school.name,
        studentName: student.fullName,
        classLabel: classGroup?.name,
        schoolYear: year.name,
        matricule: student.matricule,
        schoolCity: school.city,
        schoolCode: school.schoolCode,
        fields: [
          { label: locale.startsWith('en') ? 'Date of birth' : 'Né(e) le', value: student.birthDate ? formatDocumentDate(student.birthDate, locale, timeZone) : '—' },
        ],
      },
      sourceVersion,
      locale: input.locale,
      timeZone,
      portraitAttachmentId: student.photoAttachmentId,
      ...branding,
    },
  }
}

async function assembleAccountDocument(
  base: BaseSchoolService,
  input: AssembleDocumentInput,
  school: NonNullable<Awaited<ReturnType<BaseSchoolService['repositories']['schools']['findById']>>>,
  locale: string,
  timeZone: string,
  title: string,
  branding: Record<string, unknown>,
): Promise<AssembledDocumentSource> {
  const account = await base.repositories.studentYearAccounts.findById(input.sourceId)
  if (!account || account.schoolId !== base.actor.schoolId)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Student year account was not found')
  const student = await base.repositories.students.findById(account.studentId)
  const year = await requireYear(base, account.academicYearId)
  const charges = await base.repositories.studentCharges.list({ studentId: account.studentId, academicYearId: account.academicYearId })
  const open = charges.filter(charge => remainingChargeObligation(charge) > 0 && charge.status !== ChargeStatus.Cancelled && charge.status !== ChargeStatus.Waived)
  const overdue = open.filter(charge => charge.status === ChargeStatus.Overdue || (charge.dueDate && charge.dueDate.getTime() < Date.now()))
  if (input.templateKey === 'invoice.v1' && open.length === 0)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'An invoice requires open or due charges')
  if (input.templateKey === 'payment-reminder.v1' && overdue.length === 0)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'A reminder requires overdue remainders')
  const rowsSource = input.templateKey === 'payment-reminder.v1' ? overdue : input.templateKey === 'invoice.v1' ? open : charges
  const columns = locale.startsWith('en') ? ['Label', 'Due', 'Remaining'] : ['Libellé', 'Échéance', 'Reste']
  const rows = rowsSource.map(charge => ({
    cells: [
      charge.label,
      charge.dueDate ? formatDocumentIsoDate(charge.dueDate, timeZone) : '—',
      formatDocumentMoney(remainingChargeObligation(charge), account.currency, locale),
    ],
  }))
  const notes = input.templateKey === 'account-statement.v1'
    ? (locale.startsWith('en')
        ? `Available balance: ${formatDocumentMoney(account.availableBalance.amount, account.currency, locale)}. An unallocated deposit is not a settlement of every charge.`
        : `Solde disponible : ${formatDocumentMoney(account.availableBalance.amount, account.currency, locale)}. Un dépôt non imputé ne solde pas toutes les charges.`)
    : undefined
  const sourceVersion = `${account.id}:${charges.map(charge => `${charge.id}:${charge.allocatedAmount.amount}:${charge.status}`).sort().join('|')}`
  return {
    academicYearId: account.academicYearId,
    sourceType: DocumentSourceType.StudentYearAccount,
    sourceId: account.id,
    sourceVersion,
    studentId: account.studentId,
    portraitRequired: false,
    snapshot: {
      facts: {
        kind: input.templateKey,
        documentTitle: title,
        schoolName: school.issuingName ?? school.name,
        studentName: student?.fullName,
        schoolYear: year.name,
        date: formatDocumentDate(new Date(), locale, timeZone),
        columns,
        rows,
        notes,
      },
      sourceVersion,
      locale: input.locale,
      timeZone,
      currency: account.currency,
      ...branding,
    },
  }
}

async function assemblePaymentDocument(
  base: BaseSchoolService,
  input: AssembleDocumentInput,
  school: NonNullable<Awaited<ReturnType<BaseSchoolService['repositories']['schools']['findById']>>>,
  locale: string,
  timeZone: string,
  title: string,
  branding: Record<string, unknown>,
): Promise<AssembledDocumentSource> {
  const payment = await base.repositories.payments.findById(input.sourceId)
  if (!payment || payment.schoolId !== base.actor.schoolId)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Payment was not found')
  if (payment.kind !== PaymentKind.Receipt || payment.status !== PaymentStatus.Recorded)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'A receipt proves money received on a recorded receipt only')
  const account = await base.repositories.studentYearAccounts.findById(payment.accountId)
  const student = account ? await base.repositories.students.findById(account.studentId) : undefined
  if (!student)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Payment student was not found')
  const allocations = await base.repositories.allocations.list({ causedByPaymentId: payment.id })
  const active = allocations.filter(allocation => isAllocationActive(allocation, allocations))
  if (input.templateKey === 'settlement-quittance.v1' && active.length === 0)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'A settlement quittance identifies settled obligations via allocations')
  const paragraphs = input.templateKey === 'receipt.v1'
    ? [{ text: locale.startsWith('en')
        ? `Received ${formatDocumentMoney(payment.amount.amount, payment.amount.currency, locale)} on ${formatDocumentDate(payment.paymentDate, locale, timeZone)}. This receipt does not state that every charge is settled.`
        : `Reçu ${formatDocumentMoney(payment.amount.amount, payment.amount.currency, locale)} le ${formatDocumentDate(payment.paymentDate, locale, timeZone)}. Cette quittance ne déclare pas que toutes les charges sont soldées.` }]
    : [{ text: locale.startsWith('en')
        ? `Settlements below identify allocated obligations. They do not imply that unrelated charges are paid.`
        : `Les imputations ci-dessous identifient les obligations réglées. Elles n'impliquent pas que les autres charges sont soldées.` }]
  const rows = active.map(allocation => ({
    cells: [allocation.chargeId, formatDocumentMoney(allocation.amount.amount, payment.amount.currency, locale)],
  }))
  const sourceVersion = `${payment.id}:${payment.status}:${payment.amount.amount}:${active.map(allocation => allocation.id).sort().join(',')}`
  return {
    academicYearId: payment.academicYearId,
    sourceType: DocumentSourceType.Payment,
    sourceId: payment.id,
    sourceVersion,
    studentId: account?.studentId,
    portraitRequired: false,
    snapshot: {
      facts: {
        kind: input.templateKey,
        documentTitle: title,
        schoolName: school.issuingName ?? school.name,
        studentName: student.fullName,
        date: formatDocumentDate(payment.paymentDate, locale, timeZone),
        paragraphs,
        columns: locale.startsWith('en') ? ['Charge', 'Allocated'] : ['Charge', 'Imputé'],
        rows,
        notes: payment.reference,
      },
      sourceVersion,
      locale: input.locale,
      timeZone,
      currency: payment.amount.currency,
      ...branding,
    },
  }
}

async function assembleConvocation(
  base: BaseSchoolService,
  input: AssembleDocumentInput,
  school: NonNullable<Awaited<ReturnType<BaseSchoolService['repositories']['schools']['findById']>>>,
  locale: string,
  timeZone: string,
  title: string,
  branding: Record<string, unknown>,
): Promise<AssembledDocumentSource> {
  const fields = input.staffFields
  if (!fields?.recipient || !fields.date || !fields.location || !fields.reason)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Convocation requires recipient, date, location and reason')
  const student = await base.repositories.students.findById(input.sourceId)
  if (!student || student.schoolId !== base.actor.schoolId)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Student was not found')
  const enrollments = await base.repositories.enrollments.list({ studentId: student.id, status: StudentClassEnrollmentStatus.Active })
  const enrollment = enrollments[0]
  const yearId = enrollment?.academicYearId ?? input.academicYearId
  if (!yearId)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Academic year is required')
  const year = await requireYear(base, yearId)
  const sourceVersion = `${fields.recipient}|${fields.date}|${fields.location}|${fields.reason}`
  return {
    academicYearId: year.id,
    sourceType: DocumentSourceType.Convocation,
    sourceId: student.id,
    sourceVersion,
    studentId: student.id,
    classGroupId: enrollment?.classGroupId,
    portraitRequired: false,
    snapshot: {
      facts: {
        kind: 'convocation.v1',
        documentTitle: title,
        schoolName: school.issuingName ?? school.name,
        studentName: student.fullName,
        schoolYear: year.name,
        fields: [
          { label: locale.startsWith('en') ? 'Recipient' : 'Destinataire', value: fields.recipient },
          { label: locale.startsWith('en') ? 'Date' : 'Date', value: fields.date },
          { label: locale.startsWith('en') ? 'Location' : 'Lieu', value: fields.location },
          { label: locale.startsWith('en') ? 'Reason' : 'Motif', value: fields.reason },
        ],
        paragraphs: [
          { text: locale.startsWith('en') ? `Recipient: ${fields.recipient}` : `Destinataire : ${fields.recipient}` },
          { text: locale.startsWith('en') ? `Date: ${fields.date}` : `Date : ${fields.date}` },
          { text: locale.startsWith('en') ? `Location: ${fields.location}` : `Lieu : ${fields.location}` },
          { text: locale.startsWith('en') ? `Reason: ${fields.reason}` : `Motif : ${fields.reason}` },
        ],
      },
      sourceVersion,
      locale: input.locale,
      timeZone,
      staffFields: fields,
      ...branding,
    },
  }
}

async function assembleClassOperational(
  base: BaseSchoolService,
  input: AssembleDocumentInput,
  school: NonNullable<Awaited<ReturnType<BaseSchoolService['repositories']['schools']['findById']>>>,
  locale: string,
  timeZone: string,
  title: string,
  branding: Record<string, unknown>,
): Promise<AssembledDocumentSource> {
  const classGroup = await base.repositories.classGroups.findById(input.sourceId)
  if (!classGroup || classGroup.schoolId !== base.actor.schoolId)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Class was not found')
  const year = await requireYear(base, classGroup.academicYearId)
  if (input.templateKey === 'class-timetable.v1') {
    const sessions = (await base.repositories.lessonSessions.list({ classGroupId: classGroup.id, timetableGenerated: TimetableGenerated.Published }))
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    if (sessions.length === 0)
      fail(DOCUMENT_FAILURES.SOURCE_UNPUBLISHED, 'A class timetable requires published sessions')
    const sourceVersion = sessions.map(session => `${session.id}:${session.startsAt.toISOString()}`).join('|')
    return {
      academicYearId: classGroup.academicYearId,
      sourceType: DocumentSourceType.ClassGroup,
      sourceId: classGroup.id,
      sourceVersion,
      classGroupId: classGroup.id,
      portraitRequired: false,
      snapshot: {
        facts: {
          kind: 'class-timetable.v1',
          documentTitle: title,
          schoolName: school.name,
          classLabel: classGroup.name,
          schoolYear: year.name,
          columns: locale.startsWith('en') ? ['When', 'Session'] : ['Quand', 'Séance'],
          rows: sessions.map(session => ({ cells: [formatDocumentDate(session.startsAt, locale, timeZone), session.displayLabel] })),
        },
        sourceVersion,
        locale: input.locale,
        timeZone,
        ...branding,
      },
    }
  }
  const enrollments = await base.repositories.enrollments.list({ classGroupId: classGroup.id, status: StudentClassEnrollmentStatus.Active })
  const students = await Promise.all(enrollments.map(enrollment => base.repositories.students.findById(enrollment.studentId)))
  const names = students.filter(Boolean).map(student => student!.fullName).sort((a, b) => a.localeCompare(b, locale))
  const sourceVersion = enrollments.map(enrollment => enrollment.studentId).sort().join(',')
  return {
    academicYearId: classGroup.academicYearId,
    sourceType: DocumentSourceType.ClassGroup,
    sourceId: classGroup.id,
    sourceVersion,
    classGroupId: classGroup.id,
    portraitRequired: false,
    snapshot: {
      facts: {
        kind: 'class-roster.v1',
        documentTitle: title,
        schoolName: school.name,
        classLabel: classGroup.name,
        schoolYear: year.name,
        columns: locale.startsWith('en') ? ['#', 'Student'] : ['N°', 'Élève'],
        rows: names.map((name, index) => ({ cells: [String(index + 1), name] })),
      },
      sourceVersion,
      locale: input.locale,
      timeZone,
      ...branding,
    },
  }
}

async function assembleTeacherTimetable(
  base: BaseSchoolService,
  input: AssembleDocumentInput,
  school: NonNullable<Awaited<ReturnType<BaseSchoolService['repositories']['schools']['findById']>>>,
  locale: string,
  timeZone: string,
  title: string,
  branding: Record<string, unknown>,
): Promise<AssembledDocumentSource> {
  const teacherId = input.teacherId ?? (base.actor.kind === 'teacher' ? base.actor.teacherId : input.sourceId)
  const teacher = await base.repositories.teachers.findById(teacherId)
  if (!teacher || teacher.schoolId !== base.actor.schoolId)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Teacher was not found')
  const yearId = input.academicYearId
  if (!yearId)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Academic year is required')
  const year = await requireYear(base, yearId)
  const sessions = (await base.repositories.lessonSessions.list({ schoolId: school.id, timetableGenerated: TimetableGenerated.Published }))
    .filter(session => session.timetableTeacherIds.includes(teacher.id))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  if (sessions.length === 0)
    fail(DOCUMENT_FAILURES.SOURCE_UNPUBLISHED, 'A teacher timetable requires published assigned sessions')
  const sourceVersion = sessions.map(session => session.id).join(',')
  return {
    academicYearId: year.id,
    sourceType: DocumentSourceType.Teacher,
    sourceId: teacher.id,
    sourceVersion,
    classGroupId: input.classGroupId,
    portraitRequired: false,
    snapshot: {
      facts: {
        kind: 'teacher-timetable.v1',
        documentTitle: title,
        schoolName: school.name,
        schoolYear: year.name,
        fields: [{ label: locale.startsWith('en') ? 'Teacher' : 'Enseignant', value: `${teacher.firstName} ${teacher.lastName}` }],
        columns: locale.startsWith('en') ? ['When', 'Class', 'Session'] : ['Quand', 'Classe', 'Séance'],
        rows: await Promise.all(sessions.map(async (session) => {
          const classGroup = await base.repositories.classGroups.findById(session.classGroupId)
          return { cells: [formatDocumentDate(session.startsAt, locale, timeZone), classGroup?.name ?? session.classGroupId, session.displayLabel] }
        })),
      },
      sourceVersion,
      locale: input.locale,
      timeZone,
      teacherId: teacher.id,
      ...branding,
    },
  }
}

async function assembleAttendanceSheet(
  base: BaseSchoolService,
  input: AssembleDocumentInput,
  school: NonNullable<Awaited<ReturnType<BaseSchoolService['repositories']['schools']['findById']>>>,
  locale: string,
  timeZone: string,
  title: string,
  branding: Record<string, unknown>,
): Promise<AssembledDocumentSource> {
  const [classGroupId, day] = input.sourceId.includes(':') ? input.sourceId.split(':', 2) as [string, string] : [input.sourceId, formatDocumentIsoDate(new Date(), timeZone)]
  const classGroup = await base.repositories.classGroups.findById(classGroupId)
  if (!classGroup || classGroup.schoolId !== base.actor.schoolId)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Class was not found')
  const year = await requireYear(base, classGroup.academicYearId)
  const enrollments = await base.repositories.enrollments.list({ classGroupId: classGroup.id, status: StudentClassEnrollmentStatus.Active })
  const students = await Promise.all(enrollments.map(enrollment => base.repositories.students.findById(enrollment.studentId)))
  const names = students.filter(Boolean).map(student => student!.fullName).sort((a, b) => a.localeCompare(b, locale))
  const sourceVersion = `${classGroup.id}:${day}:${names.join(',')}`
  return {
    academicYearId: classGroup.academicYearId,
    sourceType: DocumentSourceType.AttendanceDay,
    sourceId: `${classGroup.id}:${day}`,
    sourceVersion,
    classGroupId: classGroup.id,
    portraitRequired: false,
    snapshot: {
      facts: {
        kind: 'attendance-sheet.v1',
        documentTitle: title,
        schoolName: school.name,
        classLabel: classGroup.name,
        schoolYear: year.name,
        date: day,
        columns: locale.startsWith('en') ? ['Student', 'Present', 'Absent'] : ['Élève', 'Présent', 'Absent'],
        rows: names.map(name => ({ cells: [name, '☐', '☐'] })),
      },
      sourceVersion,
      locale: input.locale,
      timeZone,
      ...branding,
    },
  }
}

async function assembleIncidentReport(
  base: BaseSchoolService,
  input: AssembleDocumentInput,
  school: NonNullable<Awaited<ReturnType<BaseSchoolService['repositories']['schools']['findById']>>>,
  locale: string,
  timeZone: string,
  title: string,
  branding: Record<string, unknown>,
): Promise<AssembledDocumentSource> {
  const incident = await base.repositories.incidents.findById(input.sourceId)
  if (!incident || incident.schoolId !== base.actor.schoolId)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Incident was not found')
  const involvements = await base.repositories.studentIncidentInvolvements.list({ incidentId: incident.id })
  const names = await Promise.all(involvements.map(async (involvement) => {
    const student = await base.repositories.students.findById(involvement.studentId)
    return student ? `${student.fullName} (${involvement.role})` : involvement.studentId
  }))
  const classGroup = incident.classGroupId ? await base.repositories.classGroups.findById(incident.classGroupId) : undefined
  const yearId = classGroup?.academicYearId ?? input.academicYearId
  if (!yearId)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Academic year is required')
  const year = await requireYear(base, yearId)
  const sourceVersion = `${incident.id}:${incident.status}:${incident.updatedAt?.toISOString() ?? incident.createdAt.toISOString()}`
  return {
    academicYearId: year.id,
    sourceType: DocumentSourceType.Incident,
    sourceId: incident.id,
    sourceVersion,
    classGroupId: incident.classGroupId,
    portraitRequired: false,
    snapshot: {
      facts: {
        kind: 'incident-report.v1',
        documentTitle: title,
        schoolName: school.name,
        date: formatDocumentDate(incident.date, locale, timeZone),
        paragraphs: [
          { text: incident.title },
          ...(incident.description ? [{ text: incident.description }] : []),
        ],
        fields: names.map(name => ({ label: locale.startsWith('en') ? 'Involved' : 'Impliqué', value: name })),
      },
      sourceVersion,
      locale: input.locale,
      timeZone,
      ...branding,
    },
  }
}
