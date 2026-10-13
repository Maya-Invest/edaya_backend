import type { Assessment, AssessmentResult, GradeScale, ReportCardDefinitionSection, ReportCardResult } from '@edaya/core'
import type { StoreDatabase } from '../postgres-store'
import type { StoredReportCardResultSection } from './entity-store-helpers'
import type { EntityStores } from './entity-stores-types'
import {
  Assessment as AssessmentCtor,
  AssessmentKind,
  AssessmentResult as AssessmentResultCtor,
  AttendanceSummary,
  DeadlineComplianceStatus,
  GradeScale as GradeScaleCtor,
  ReportCardDefinition as ReportCardDefinitionCtor,
  ReportCardDefinitionSection as ReportCardDefinitionSectionCtor,
  ReportCardDefinitionSectionKind,
  ReportCardResult as ReportCardResultCtor,
  ReportCardResultStatus,
} from '@edaya/core'
import { deserializeJsonb } from '../lib/mappers'
import { customStore, defaultStore } from '../lib/store-factory'
import * as schema from '../postgres-schema'
import {
  deserializeReportCardResultSection,
  enumValue,
  serializeReportCardResultSection,
} from './entity-store-helpers'

function numberToNumeric(value: number): string {
  return value.toFixed(2)
}

function numericToNumber(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed))
    throw new Error(`Invalid numeric grade value: ${value}`)
  return parsed
}

export function createAssessmentsEntityStores(db: StoreDatabase): Pick<EntityStores, 'assessments' | 'assessmentResults' | 'gradeScales' | 'definitions' | 'sections' | 'results'> {
  return {
    assessments: customStore(
      db,
      schema.assessments,
      (entity: Assessment) => ({
        id: entity.id,
        classGroupId: entity.classGroupId,
        classSubjectId: entity.classSubjectId,
        periodId: entity.periodId,
        title: entity.title,
        kind: entity.kind,
        maxScore: numberToNumeric(entity.maxScore),
        coefficient: numberToNumeric(entity.coefficient),
        description: entity.description ?? null,
        attachments: entity.attachments,
        lessonSessionId: entity.lessonSessionId ?? null,
        startsAt: entity.startsAt ?? null,
        endsAt: entity.endsAt ?? null,
        dueAt: entity.dueAt ?? null,
        completedAt: entity.completedAt ?? null,
        marksStatus: entity.marksStatus,
        marksRevision: entity.marksRevision,
        marksReview: entity.marksReview,
        createdAt: entity.createdAt,
      }),
      row => new AssessmentCtor({
        id: row.id,
        classGroupId: row.classGroupId,
        classSubjectId: row.classSubjectId,
        periodId: row.periodId,
        title: row.title,
        kind: enumValue(AssessmentKind, row.kind, 'assessments.kind'),
        maxScore: numericToNumber(row.maxScore),
        coefficient: numericToNumber(row.coefficient),
        description: row.description ?? undefined,
        attachments: deserializeJsonb(row.attachments) ?? [],
        lessonSessionId: row.lessonSessionId ?? undefined,
        startsAt: row.startsAt ?? undefined,
        endsAt: row.endsAt ?? undefined,
        dueAt: row.dueAt,
        completedAt: row.completedAt,
        marksStatus: row.marksStatus,
        marksRevision: row.marksRevision,
        marksReview: deserializeJsonb(row.marksReview),
        createdAt: row.createdAt,
      }),
    ),

    assessmentResults: customStore(
      db,
      schema.assessmentResults,
      (entity: AssessmentResult) => ({
        revision: entity.revision,
        id: entity.id,
        studentId: entity.studentId,
        assessmentId: entity.assessmentId,
        mentionId: entity.mentionId ?? null,
        originalEntry: entity.originalEntry ?? null,
        calculation: entity.calculation ?? null,
        designation: entity.designation ?? null,
        score: entity.score == null ? null : String(entity.score),
        status: entity.status ?? null,
        notes: entity.notes ?? null,
        createdBy: entity.createdBy ?? null,
        createdAt: entity.createdAt,
      }),
      row => new AssessmentResultCtor({
        revision: row.revision,
        id: row.id,
        studentId: row.studentId,
        assessmentId: row.assessmentId,
        mentionId: row.mentionId ?? undefined,
        originalEntry: deserializeJsonb(row.originalEntry) ?? undefined,
        calculation: deserializeJsonb(row.calculation) ?? undefined,
        designation: row.designation ?? undefined,
        score: row.score == null ? undefined : numericToNumber(row.score),
        status: row.status === null ? undefined : enumValue(DeadlineComplianceStatus, row.status, 'assessmentResults.status'),
        notes: row.notes,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
      }),
    ),

    gradeScales: customStore(
      db,
      schema.gradeScales,
      (entity: GradeScale) => ({
        id: entity.id,
        schoolId: entity.schoolId,
        name: entity.name,
        minScore: String(entity.minScore),
        maxScore: String(entity.maxScore),
        ranges: entity.ranges,
        decimalPlaces: entity.decimalPlaces,
        roundingMode: entity.roundingMode,
        intervalConvention: entity.intervalConvention,
        revision: entity.revision,
        description: entity.description,
        isDefault: entity.isDefault,
        createdAt: entity.createdAt,
      }),
      row => new GradeScaleCtor({
        id: row.id,
        schoolId: row.schoolId,
        name: row.name,
        minScore: numericToNumber(row.minScore),
        maxScore: numericToNumber(row.maxScore),
        ranges: [...deserializeJsonb(row.ranges)],
        decimalPlaces: row.decimalPlaces,
        roundingMode: row.roundingMode as GradeScale['roundingMode'],
        intervalConvention: row.intervalConvention as GradeScale['intervalConvention'],
        revision: row.revision,
        description: row.description,
        isDefault: row.isDefault,
        createdAt: row.createdAt,
      }),
    ),

    definitions: defaultStore(db, schema.reportCardDefinitions, ReportCardDefinitionCtor),

    sections: customStore(
      db,
      schema.reportCardDefinitionSections,
      (entity: ReportCardDefinitionSection) => ({
        id: entity.id,
        reportCardDefinitionId: entity.reportCardDefinitionId,
        name: entity.name,
        role: entity.role ?? null,
        coefficient: entity.coefficient ?? null,
        order: entity.order,
        weight: entity.weight,
        parentSectionId: entity.parentSectionId ?? null,
        subjectId: entity.subjectId ?? null,
        createdAt: entity.createdAt,
      }),
      row => new ReportCardDefinitionSectionCtor({
        id: row.id,
        reportCardDefinitionId: row.reportCardDefinitionId,
        name: row.name,
        kind: row.subjectId
          ? ReportCardDefinitionSectionKind.Subject
          : ReportCardDefinitionSectionKind.Group,
        role: row.role ?? undefined,
        coefficient: row.coefficient ?? undefined,
        order: row.order,
        weight: row.weight,
        parentSectionId: row.parentSectionId,
        subjectId: row.subjectId,
        createdAt: row.createdAt,
      }),
    ),

    results: customStore(
      db,
      schema.reportCardResults,
      (entity: ReportCardResult) => ({
        id: entity.id,
        studentId: entity.studentId,
        classGroupId: entity.classGroupId,
        periodId: entity.periodId,
        reportCardDefinitionId: entity.reportCardDefinitionId,
        sectionResults: entity.sectionResults.map(serializeReportCardResultSection),
        attendanceSummary: entity.attendanceSummary,
        assessmentResultCount: entity.assessmentResultCount,
        version: entity.version,
        sourceMarks: entity.sourceMarks,
        pendingCorrectionIds: entity.pendingCorrectionIds,
        sourceAssessments: entity.sourceAssessments,
        pendingAssessmentIds: entity.pendingAssessmentIds,
        calculationStale: entity.calculationStale,
        grading: entity.grading ?? null,
        aggregateLabel: entity.aggregateLabel ?? null,
        gradingPolicyRevision: entity.gradingPolicyRevision ?? null,
        revisedDraft: entity.revisedDraft ?? null,
        publicationHistory: entity.publicationHistory,
        overallAverage: entity.overallAverage == null ? null : String(entity.overallAverage),
        rank: entity.rank ?? null,
        classSize: entity.classSize ?? null,
        passThreshold: entity.passThreshold == null ? null : numberToNumeric(entity.passThreshold),
        teacherComment: entity.teacherComment ?? null,
        principalComment: entity.principalComment ?? null,
        status: entity.status,
        generatedAt: entity.generatedAt,
        publishedAt: entity.publishedAt ?? null,
        aggregation: entity.aggregation ?? null,
      }),
      (row) => {
        const sectionsData = deserializeJsonb(row.sectionResults) || []
        const attendanceData = deserializeJsonb(row.attendanceSummary)

        return new ReportCardResultCtor({
          id: row.id,
          reportCardDefinitionId: row.reportCardDefinitionId,
          studentId: row.studentId,
          classGroupId: row.classGroupId,
          periodId: row.periodId,
          sectionResults: (sectionsData as StoredReportCardResultSection[]).map(deserializeReportCardResultSection),
          attendanceSummary: new AttendanceSummary(attendanceData),
          assessmentResultCount: row.assessmentResultCount,
          version: row.version,
          sourceMarks: deserializeJsonb(row.sourceMarks),
          pendingCorrectionIds: deserializeJsonb(row.pendingCorrectionIds),
          sourceAssessments: deserializeJsonb(row.sourceAssessments),
          pendingAssessmentIds: deserializeJsonb(row.pendingAssessmentIds),
          calculationStale: row.calculationStale,
          grading: deserializeJsonb(row.grading) ?? undefined,
          aggregateLabel: row.aggregateLabel ?? undefined,
          gradingPolicyRevision: row.gradingPolicyRevision ?? undefined,
          revisedDraft: deserializeJsonb(row.revisedDraft) ?? undefined,
          publicationHistory: deserializeJsonb(row.publicationHistory) ?? [],
          overallAverage: row.overallAverage == null ? undefined : numericToNumber(row.overallAverage),
          rank: row.rank,
          classSize: row.classSize,
          passThreshold: row.passThreshold == null ? undefined : numericToNumber(row.passThreshold),
          teacherComment: row.teacherComment,
          principalComment: row.principalComment,
          status: enumValue(ReportCardResultStatus, row.status, 'reportCardResults.status'),
          generatedAt: row.generatedAt,
          publishedAt: row.publishedAt,
          aggregation: row.aggregation ?? undefined,
        })
      },
    ),
  }
}
