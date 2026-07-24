import {
  AttendanceSummary,
  ReportCardDefinitionSectionKind,
  ReportCardResult,
  ReportCardResultSection,
  School,
  Student,
} from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { buildReportCardV1Payload } from '../../../src/capabilities/documents/build-report-card-v1-payload'

describe('buildReportCardV1Payload', () => {
  const school = new School({
    id: 'sch-1',
    name: 'Lycée Test',
    timeZone: 'Africa/Abidjan',
    city: 'Abidjan',
  })
  const student = new Student({
    id: 'stu-1',
    schoolId: school.id,
    firstName: 'Awa',
    lastName: 'Kouassi',
    birthDate: '2014-02-14',
  })

  test('flattens subject and bilan rows and formats totals', () => {
    const result = new ReportCardResult({
      id: 'rc-1',
      reportCardDefinitionId: 'def-1',
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
          sectionKind: ReportCardDefinitionSectionKind.Group,
          name: 'Bilan scientifique',
          average: 13,
          weight: 1,
          subResults: [
            new ReportCardResultSection({
              sectionId: 'sub-math',
              sectionKind: ReportCardDefinitionSectionKind.Subject,
              name: 'Mathématiques',
              average: 15,
              weight: 3,
              classSubjectId: 'cs-math',
              rank: 2,
              comment: 'Très bien',
            }),
            new ReportCardResultSection({
              sectionId: 'sub-pc',
              sectionKind: ReportCardDefinitionSectionKind.Subject,
              name: 'Physique-Chimie',
              average: 11,
              weight: 2,
              classSubjectId: 'cs-pc',
              rank: 8,
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
      teacherNameByClassSubjectId: new Map([['cs-math', 'Mme Diallo']]),
      classResults: {
        classAverage: '13,20 / 20',
        lowestAverage: '10,00 / 20',
        highestAverage: '16,00 / 20',
      },
      homeroomTeacherName: 'M. Koné',
      principalName: 'Jean Aka',
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
    expect(payload.birthDate).toBe('14/02/2014')
    expect(payload.classResults).toEqual({
      classAverage: '13,20 / 20',
      lowestAverage: '10,00 / 20',
      highestAverage: '16,00 / 20',
    })
    expect(payload.council).toEqual({
      appreciation: 'Bon semestre',
      homeroomTeacherName: 'M. Koné',
      principalName: 'Jean Aka',
    })

    expect(payload.subjects.map(row => ({ name: row.name, kind: row.kind, teacherName: row.teacherName }))).toEqual([
      { name: 'Mathématiques', kind: 'subject', teacherName: 'Mme Diallo' },
      { name: 'Physique-Chimie', kind: 'subject', teacherName: undefined },
      { name: 'Bilan scientifique', kind: 'bilan', teacherName: undefined },
      { name: 'TOTAL', kind: 'totals', teacherName: undefined },
    ])
    expect(payload.subjects[0]).toMatchObject({
      average: '15,00',
      coefficient: '3',
      total: '45,00',
      rank: '2è / 30',
      appreciation: 'Très bien',
      teacherName: 'Mme Diallo',
    })
    expect(payload.subjects[1]).toMatchObject({
      average: '11,00',
      rank: '8è / 30',
    })
    expect(payload.subjects.at(-1)).toMatchObject({
      kind: 'totals',
      average: '14,50',
      rank: '3è / 30',
    })
  })

  test('resolves subject catalog names when section labels are ids', () => {
    const result = new ReportCardResult({
      id: 'rc-ids',
      reportCardDefinitionId: 'def-1',
      studentId: student.id,
      classGroupId: 'cg-1',
      periodId: 'per-1',
      assessmentResultCount: 1,
      overallAverage: 15,
      classSize: 6,
      attendanceSummary: new AttendanceSummary({
        presentCount: 40,
        absenceCount: 0,
        lateCount: 0,
      }),
      sectionResults: [
        new ReportCardResultSection({
          sectionId: 'sub-fr',
          sectionKind: ReportCardDefinitionSectionKind.Subject,
          name: 'ci-subj-fr',
          average: 15.9,
          weight: 2,
          classSubjectId: 'cs-fr',
        }),
      ],
    })

    const payload = buildReportCardV1Payload({
      result,
      student,
      school,
      periodLabel: 'Trimestre 3',
      subjectNameByClassSubjectId: new Map([['cs-fr', 'Français']]),
      teacherNameByClassSubjectId: new Map([['cs-fr', 'Mme N\'Guessan']]),
    })

    expect(payload.subjects[0]).toMatchObject({
      name: 'Français',
      teacherName: 'Mme N\'Guessan',
    })
  })

  test('throws when there are no renderable section rows', () => {
    const result = new ReportCardResult({
      id: 'rc-empty',
      reportCardDefinitionId: 'def-1',
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
