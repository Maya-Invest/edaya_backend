import type { TeacherAssignmentKind, TeacherAssignmentStatus } from '@edaya/core'

export interface TeacherSeedRecord {
  id: string
  schoolId: string
  firstName: string
  lastName: string
  email?: string
  subjectId?: string
}

export interface TeacherAssignmentSeedRecord {
  id: string
  teacherId: string
  academicYearId: string
  kind: TeacherAssignmentKind
  classSubjectId?: string
  classGroupId?: string
  responsibility?: string
  status?: TeacherAssignmentStatus
}

export interface TeachersSeedPort {
  saveTeacher: (record: TeacherSeedRecord) => Promise<void>
  saveTeacherAssignment: (record: TeacherAssignmentSeedRecord) => Promise<void>
}
