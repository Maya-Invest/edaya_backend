import type { TeacherAssignmentSeedRecord, TeacherSeedRecord, TeachersSeedPort } from './port'
import { demoCiDataset } from '@edaya/fixtures'
import { describe, expect, test } from 'bun:test'
import { seedDevTeachers } from './workflow'

describe('teachers seed port workflow', () => {
  test('seeds teachers and teacher assignments from demo-ci fixtures', async () => {
    const teachers: TeacherSeedRecord[] = []
    const teacherAssignments: TeacherAssignmentSeedRecord[] = []
    const port: TeachersSeedPort = {
      saveTeacher: async (record) => {
        teachers.push(record)
      },
      saveTeacherAssignment: async (record) => {
        teacherAssignments.push(record)
      },
    }

    await seedDevTeachers(port, demoCiDataset)

    expect(teachers).toHaveLength(demoCiDataset.entities.teachers?.length ?? 0)
    expect(teacherAssignments).toHaveLength(demoCiDataset.entities.teacherAssignments?.length ?? 0)
    expect(teachers.map(teacher => teacher.id)).toEqual([
      'ci-t1',
      'ci-t2',
      'ci-t3',
      'ci-t4',
      'ci-t5',
    ])
    expect(teacherAssignments.some(assignment => assignment.classSubjectId === 'ci-cs-6a-math')).toBe(true)
    expect(teacherAssignments.some(assignment => assignment.classSubjectId === 'ci-cs-6a-fr')).toBe(true)
    expect(teacherAssignments.some(assignment => assignment.classSubjectId === 'ci-cs-6a-eps')).toBe(true)
    expect(teacherAssignments.some(assignment => assignment.classGroupId === 'ci-6b')).toBe(true)
  })
})
