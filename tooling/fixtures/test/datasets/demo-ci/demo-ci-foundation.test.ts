import type { GradeLevelInput, SubjectInput } from '@edaya/core'
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

describe('demo-ci dataset (Côte d\'Ivoire)', () => {
  it('assembles a French Ivorian collège school shell', () => {
    expect(demoCiDataset.purpose).toBe('demo-ci')
    expect(demoCiDataset.entities.school?.country).toBe('Côte d\'Ivoire')
    expect(demoCiDataset.entities.school?.city).toBe('Abidjan')
    expect(demoCiDataset.entities.school?.timeZone).toBe('Africa/Abidjan')
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
    expect(demoCiDataset.entities.activities).toHaveLength(5)
    expect(demoCiDataset.entities.fees).toHaveLength(5)
    expect(demoCiDataset.entities.announcements).toHaveLength(5)
    expect(demoCiDataset.entities.incidents).toHaveLength(3)
    expect(demoCiDataset.entities.disciplinaryActions).toHaveLength(4)
    expect(demoCiDataset.entities.studentHealthProfiles).toHaveLength(3)
    expect(demoCiDataset.entities.attachments).toHaveLength(7)
    expect(demoCiDataset.extensions?.calendarEvents!.length).toBeGreaterThan(10)
    expect(demoCiDataset.extensions?.reportCardDefinitionFixtures).toHaveLength(4)
    expect(demoCiDataset.extensions?.reportCardResults).toHaveLength(90)
    expect(demoCiDataset.entities.guardians).toHaveLength(21)
    expect(demoCiDataset.entities.guardianLinks).toHaveLength(30)
  })

  it('uses French subject and grade level labels', () => {
    const subject = demoCiSubjects[0] satisfies SubjectInput
    expect(subject.name).toBe('Français')

    const gradeLevel = demoCiGradeLevels[0] satisfies GradeLevelInput
    expect(gradeLevel.name).toBe('6ème')
    expect(gradeLevel.cycle).toBe('Collège')
  })

  it('names the school in French', () => {
    expect(demoCiSchool.name).toBe('École Edaya — Cocody')
  })

  it('uses a realistic default min day gap for timetable generation', () => {
    expect(demoCiSchool.timetableMinDayGapSameSubject).toBe(1)
  })

  it('skips lesson session seeding while timetable periodicity is under review', () => {
    expect(demoCiDataset.extensions?.skipLessonSessionSeeding).toBe(true)
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
