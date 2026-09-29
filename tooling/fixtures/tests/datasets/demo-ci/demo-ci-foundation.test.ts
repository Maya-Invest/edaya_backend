import { describe, expect, it } from 'bun:test'
import { demoCiSchedulingSlots } from '../../../src/datasets/demo-ci/domains/scheduling'
import { demoCiDataset } from '../../../src/datasets/demo-ci/index'
import { demoCiStaffMembers } from '../../../src/datasets/demo-ci/people'
import { demoCiAllStudentIds } from '../../../src/datasets/demo-ci/rosters'
import {
  demoCiClassGroups,
  demoCiClassSubjects,
  demoCiGradeLevels,
  demoCiSchool,
  demoCiSubjectMatters,
  demoCiSubjects,
} from '../../../src/datasets/demo-ci/school'
import { classNameFromLabel } from '../../../src/onboarding/registry'

describe('demo-ci dataset (Côte d\'Ivoire)', () => {
  it('provides published reports for both guardian profiles and an eligible grading roster', () => {
    const reports = demoCiDataset.extensions.reportCardResults
    expect(reports.filter(result => result.narrativeStatus === 'published').map(result => result.studentId)).toEqual(['ci-s1', 'ci-s4'])
    expect(reports.some(result => result.classGroupId === 'ci-6a' && result.narrativeStatus === 'generated')).toBe(true)
  })
  it('assembles a French Ivorian collège school shell', () => {
    expect(demoCiDataset.purpose).toBe('demo-ci')
    expect(demoCiDataset.entities.school?.country).toBe('Côte d\'Ivoire')
    expect(demoCiDataset.entities.school?.city).toBe('Abidjan')
    expect(demoCiDataset.entities.school?.timeZone).toBe('Africa/Abidjan')
    expect(demoCiDataset.entities.school?.issuingName).toBe('École Edaya — Cocody')
    expect(demoCiDataset.entities.school?.schoolCode).toBe('EDAYA-CI')
    expect(demoCiGradeLevels).toHaveLength(4)
    expect(demoCiClassGroups).toHaveLength(5)
    expect(demoCiStaffMembers).toHaveLength(5)
    expect(demoCiDataset.entities.teachers).toHaveLength(5)
    expect(demoCiDataset.entities.teacherAssignments).toHaveLength(34)
    expect(demoCiSubjects).toHaveLength(8)
    expect(demoCiSubjectMatters.length).toBeGreaterThan(8)
    expect(demoCiSubjectMatters.some(matter => matter.name === 'Fractions et proportions')).toBe(true)
    expect(demoCiClassSubjects).toHaveLength(33)
    expect(demoCiDataset.entities.students).toHaveLength(30)
    expect(demoCiAllStudentIds).toHaveLength(30)
    expect(demoCiSchedulingSlots).toHaveLength(6)
    expect(demoCiDataset.extensions?.schedulingSlots).toHaveLength(6)
    expect(demoCiDataset.extensions?.schedulingSessionProgressAnchors).toHaveLength(3)
    expect(demoCiDataset.entities.gradeScales).toHaveLength(1)
    expect(demoCiDataset.entities.inClassAssessments!.length).toBeGreaterThan(19)
    expect(demoCiDataset.entities.homeworkAssessments!.length).toBeGreaterThan(0)
    expect(demoCiDataset.entities.homeworkSubmissions!.length).toBeGreaterThan(0)
    expect(demoCiDataset.entities.attendanceRecords!.length).toBeGreaterThan(0)
    expect(demoCiDataset.extensions?.dailyAttendanceDays).toHaveLength(6)
    expect(demoCiDataset.extensions?.dailyAttendanceDays?.filter(day => day.classGroupId === 'ci-6a')).toHaveLength(3)
    expect(demoCiDataset.extensions?.dailyAttendanceDays?.filter(day => day.classGroupId === 'ci-6b')).toHaveLength(3)
    expect(demoCiDataset.entities.activities).toHaveLength(5)
    expect(demoCiDataset.entities.catalogServices).toHaveLength(9)
    expect(demoCiDataset.entities.studentServiceEnrollments!.length).toBeGreaterThan(0)
    expect(demoCiDataset.entities.announcements).toHaveLength(5)
    expect(demoCiDataset.entities.incidents).toHaveLength(3)
    expect(demoCiDataset.entities.disciplinaryActions).toHaveLength(4)
    expect(demoCiDataset.entities.studentHealthProfiles).toHaveLength(3)
    expect(demoCiDataset.entities.attachments).toHaveLength(7)
    expect(demoCiDataset.extensions?.calendarEvents!.length).toBeGreaterThan(10)
    expect(demoCiDataset.extensions?.reportCardDefinitionFixtures).toHaveLength(4)
    expect(demoCiDataset.extensions?.reportCardResults).toHaveLength(30)
    expect(demoCiDataset.extensions?.publishAcademicPeriodIds).toEqual(['ci-2025-t1'])
    expect(demoCiDataset.extensions?.schedulingReferenceWeekStart).toBe('2026-09-14')
    expect(demoCiDataset.entities.academicYear?.name).toBe('2026 — 2027')
    expect(demoCiDataset.entities.academicYear?.startDate).toBe('2026-09-14')
    expect(demoCiDataset.entities.guardians).toHaveLength(21)
    expect(demoCiDataset.entities.guardianLinks).toHaveLength(30)
  })

  it('names the school in French', () => {
    expect(demoCiSchool.name).toBe('École Edaya — Cocody')
  })

  it('names classes exactly like onboarding does from the level label', () => {
    const labelByGradeLevelId = new Map(demoCiGradeLevels.map(level => [level.id, level.label]))
    const indexByGradeLevelId = new Map<string, number>()

    for (const classGroup of demoCiClassGroups) {
      const label = labelByGradeLevelId.get(classGroup.gradeLevelId)
      expect(label).toBeDefined()
      const index = indexByGradeLevelId.get(classGroup.gradeLevelId) ?? 0
      indexByGradeLevelId.set(classGroup.gradeLevelId, index + 1)
      expect(classGroup.name).toBe(classNameFromLabel(label!, index, 'numerical'))
    }

    expect(demoCiClassGroups.map(classGroup => classGroup.name)).toEqual([
      '6ème 1',
      '6ème 2',
      '5ème 1',
      '4ème 1',
      '3ème 1',
    ])
  })

  it('configures demo-ci mathematics with double-period span bounds', () => {
    const math = demoCiClassSubjects.find(entry => entry.id === 'ci-cs-6a-math')
    expect(math).toMatchObject({
      periodsPerWeek: 4,
      minPeriodSpan: 1,
      maxPeriodSpan: 2,
    })
    expect(demoCiClassSubjects.filter(entry => entry.subjectId === 'ci-subj-math')).toHaveLength(5)
  })

  it('uses a realistic default min day gap for timetable generation', () => {
    expect(demoCiSchool.timetableMinDayGapSameSubject).toBe(1)
  })

  it('materializes lesson sessions from recurring schedules', () => {
    expect(demoCiDataset.extensions?.skipLessonSessionSeeding).not.toBe(true)
  })

  it('assigns a subject teacher to every class subject', () => {
    const classSubjectIds = demoCiClassSubjects.map(classSubject => classSubject.id)
    const assignedClassSubjectIds = (demoCiDataset.entities.teacherAssignments ?? [])
      .map(assignment => assignment.classSubjectId)
      .filter((classSubjectId): classSubjectId is string => Boolean(classSubjectId))

    expect(classSubjectIds).toHaveLength(33)
    expect(assignedClassSubjectIds).toHaveLength(33)
    for (const classSubjectId of classSubjectIds) {
      expect(assignedClassSubjectIds).toContain(classSubjectId)
    }
  })
})
