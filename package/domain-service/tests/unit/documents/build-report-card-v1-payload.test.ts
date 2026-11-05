import { AttendanceSummary, ReportCardResult, ReportCardResultSection, ReportCardResultSectionKind, School, Student, withShortName } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { buildReportCardV1Payload } from '../../../src/capabilities/documents/build-report-card-v1-payload'

describe('buildReportCardV1Payload', () => {
  const school = new School(withShortName({
    id: 'sch-1',
    name: 'Lycée Test',
    timeZone: 'Africa/Abidjan',
    city: 'Abidjan',
  }))
  const student = new Student({
    id: 'stu-1',
    schoolId: school.id,
    firstName: 'Awa',
    lastName: 'Kouassi',
  })

  test('formats no-score sections distinctly from zero while retaining comments', () => {
    const result = new ReportCardResult({
      id: 'rc-empty',
      assessmentResultCount: 1,
      attendanceSummary: new AttendanceSummary({ presentCount: 0, absenceCount: 0, excusedAbsenceCount: 0, lateCount: 0 }),
      gradeLevelId: 'grade1',
      academicYearId: 'ay1',
      reportConfigurationRevision: 0,
      studentId: student.id,
      classGroupId: 'cg-1',
      periodId: 'per-1',
      sectionResults: [
        new ReportCardResultSection({ sectionId: 'absent', sectionKind: ReportCardResultSectionKind.Subject, name: 'Math', classSubjectId: 'cs1', weight: 1, comment: 'Excused absence' }),
        new ReportCardResultSection({ sectionId: 'zero', sectionKind: ReportCardResultSectionKind.Subject, name: 'Physics', classSubjectId: 'cs2', weight: 1, average: 0 }),
      ],
    })
    const payload = buildReportCardV1Payload({ school, student, result, periodLabel: 'Term 1' })
    expect(payload.subjects[0]).toMatchObject({ average: '—', total: '—', appreciation: 'Excused absence' })
    expect(payload.subjects[1]).toMatchObject({ average: '0,00', total: '0,00' })
  })

  test('flattens subject and bilan rows and formats totals', () => {
    const result = new ReportCardResult({
      id: 'rc-1',
      gradeLevelId: 'grade1',
      academicYearId: 'ay1',
      reportConfigurationRevision: 0,
      studentId: student.id,
      classGroupId: 'cg-1',
      periodId: 'per-1',
      assessmentResultCount: 2,
      overallAverage: 14.5,
      rank: 3,
      classSize: 30,
      teacherComment: 'Bon semestre',
      attendanceSummary: new AttendanceSummary({
        presentCount: 40,
        absenceCount: 4,
        lateCount: 1,
        excusedAbsenceCount: 1,
      }),
      sectionResults: [
        new ReportCardResultSection({
          sectionId: 'grp-1',
          sectionKind: ReportCardResultSectionKind.Module,
          name: 'Bilan scientifique',
          average: 13,
          weight: 1,
          subResults: [
            new ReportCardResultSection({
              sectionId: 'sub-math',
              sectionKind: ReportCardResultSectionKind.Subject,
              name: 'Mathématiques',
              average: 15,
              weight: 3,
              coefficient: 3,
              classSubjectId: 'cs-math',
              rank: 2,
              participantCount: 18,
              comment: 'Très bien',
            }),
            new ReportCardResultSection({
              sectionId: 'sub-pc',
              sectionKind: ReportCardResultSectionKind.Subject,
              name: 'Physique-Chimie',
              average: 11,
              weight: 2,
              coefficient: 2,
              classSubjectId: 'cs-pc',
              rank: 8,
              participantCount: 18,
            }),
          ],
        }),
      ],
    })

    const payload = buildReportCardV1Payload({
      result,
      student,
      school,
      periodLabel: '1er Trimestre',
      classLabel: '1ère C',
      schoolYear: '2025-2026',
      locale: 'fr-FR',
    })

    expect(payload.studentName).toBe('Awa Kouassi')
    expect(payload.schoolName).toBe('Lycée Test')
    expect(payload.schoolCity).toBe('Abidjan')
    expect(payload.periodLabel).toBe('1er Trimestre')
    expect(payload.classLabel).toBe('1ère C')
    expect(payload.schoolYear).toBe('2025-2026')
    expect(payload.semesterAverage).toBe('14,50 / 20')
    expect(payload.semesterRank).toBe('3è / 30 élèves')
    expect(payload.attendance).toEqual({
      absenceHoursTotal: '4',
      absenceHoursJustified: '1',
      absenceHoursUnjustified: '3',
    })
    expect(payload.council).toEqual({ appreciation: 'Bon semestre' })

    expect(payload.subjects.map(row => ({ name: row.name, kind: row.kind }))).toEqual([
      { name: 'Mathématiques', kind: 'subject' },
      { name: 'Physique-Chimie', kind: 'subject' },
      { name: 'Bilan scientifique', kind: 'bilan' },
      { name: 'TOTAL', kind: 'totals' },
    ])
    expect(payload.subjects[0]).toMatchObject({
      average: '15,00',
      coefficient: '3',
      total: '45,00',
      rank: '2è / 18',
      appreciation: 'Très bien',
    })
    expect(payload.subjects[1]).toMatchObject({
      average: '11,00',
      rank: '8è / 18',
    })
    expect(payload.subjects.at(-1)).toMatchObject({
      kind: 'totals',
      average: '14,50',
      rank: '3è / 30',
    })
  })

  test('localizes catalog labels and ranks for English locale', () => {
    const result = new ReportCardResult({
      id: 'rc-en',
      gradeLevelId: 'grade1',
      academicYearId: 'ay1',
      reportConfigurationRevision: 0,
      studentId: student.id,
      classGroupId: 'cg-1',
      periodId: 'per-1',
      assessmentResultCount: 1,
      overallAverage: 14.5,
      rank: 3,
      classSize: 30,
      attendanceSummary: new AttendanceSummary({
        presentCount: 40,
        absenceCount: 4,
        lateCount: 0,
        excusedAbsenceCount: 1,
      }),
      sectionResults: [
        new ReportCardResultSection({
          sectionId: 'sub-esp',
          sectionKind: ReportCardResultSectionKind.Subject,
          name: 'Espagnol',
          average: 15,
          weight: 2,
          coefficient: 2,
          classSubjectId: 'cs-esp',
          rank: 2,
          participantCount: 18,
        }),
      ],
    })

    const payload = buildReportCardV1Payload({
      result,
      student,
      school,
      periodLabel: 'Trimestre 1',
      classLabel: '2nde A 1',
      locale: 'en-US',
    })

    expect(payload.periodLabel).toBe('Term 1')
    expect(payload.classLabel).toBe('10th A 1')
    expect(payload.semesterRank).toBe('3 / 30 students')
    expect(payload.subjects[0]?.name).toBe('Spanish')
    expect(payload.subjects[0]?.rank).toBe('2 / 18')
  })

  test('throws when there are no renderable section rows', () => {
    const result = new ReportCardResult({
      id: 'rc-empty',
      gradeLevelId: 'grade1',
      academicYearId: 'ay1',
      reportConfigurationRevision: 0,
      studentId: student.id,
      classGroupId: 'cg-1',
      periodId: 'per-1',
      assessmentResultCount: 0,
      attendanceSummary: new AttendanceSummary({
        presentCount: 0,
        absenceCount: 0,
        lateCount: 0,
      }),
      sectionResults: [],
    })

    expect(() => buildReportCardV1Payload({
      result,
      student,
      school,
      periodLabel: '1er Trimestre',
    })).toThrow(/no section results/)
  })
})

test('configured report documents use captured points, precision, mention and aggregate label', () => {
  const grading = { policyRevision: 2, scaleId: 'gpa', scaleRevision: 1, mode: 'mention-first' as const, maximum: 4, decimalPlaces: 3, roundingMode: 'nearest' as const, units: 'points' as const, value: 11 / 3, reportedValue: 3.667, mention: { id: 'a', code: 'A', label: 'Excellent' }, provenance: 'mention-points' as const }
  const result = new ReportCardResult({ id: 'configured', gradeLevelId: 'grade1', academicYearId: 'ay1', reportConfigurationRevision: 0, studentId: 'student', classGroupId: 'class', periodId: 'period', assessmentResultCount: 2, attendanceSummary: { presentCount: 0, absenceCount: 0, excusedAbsenceCount: 0, lateCount: 0 }, aggregateLabel: 'GPA', grading, gradingPolicyRevision: 2, overallAverage: 3.667, sectionResults: [new ReportCardResultSection({ sectionId: 'math', sectionKind: ReportCardResultSectionKind.Subject, classSubjectId: 'math', name: 'Math', weight: 1, average: 3.667, grading })] })
  const school = new School(withShortName({ id: 'school', name: 'School', timeZone: 'America/Toronto' }))
  const student = new Student({ id: 'student', schoolId: school.id, firstName: 'Ada', lastName: 'L' })
  for (const locale of ['en-US', 'fr-FR']) {
    const payload = buildReportCardV1Payload({ school, student, result, periodLabel: 'Term', locale })
    expect(payload.aggregateLabel).toBe('GPA')
    expect(payload.gradingMaximum).toBe('4')
    expect(payload.semesterAverage).toBe(`${locale === 'fr-FR' ? '3,667' : '3.667'} / 4 · A — Excellent`)
    expect(payload.subjects[0]?.average).toContain('667 · A')
    expect(payload.semesterAverage).not.toContain('/ 20')
  }
})
