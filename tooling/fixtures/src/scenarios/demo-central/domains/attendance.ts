import { SEED_REFERENCE_DATE } from '../../../meta/dates'

export interface SeedAbsenceRecord {
  id: string
  scheduleId: string
  classGroupId: string
  classSubjectId: string
  studentId: string
  date: string
  startTime: string
  endTime: string
  reason?: string
}

export type SeedTodayAttendanceStatus = 'present' | 'absent' | 'late'

export interface SeedTodayAttendanceRecord {
  id: string
  studentId: string
  status: SeedTodayAttendanceStatus
  reason?: string
}

/** Attendance absences from mock `absences[]` — includes dedicated session slots. */
export const SEED_ABSENCE_RECORDS: readonly SeedAbsenceRecord[] = [
  { id: 'a1', scheduleId: 'sch-sess-abs-a1', classGroupId: '6a', classSubjectId: 'cs-6a-math', studentId: 's1', date: '2026-05-12', startTime: '08:30', endTime: '09:30', reason: 'Maladie' },
  { id: 'a2', scheduleId: 'sch-sess-abs-a2', classGroupId: '6a', classSubjectId: 'cs-6a-hist', studentId: 's1', date: '2026-05-06', startTime: '14:00', endTime: '15:00', reason: 'Rendez-vous médical' },
  { id: 'a3', scheduleId: 'sch-sess-abs-a3', classGroupId: '6a', classSubjectId: 'cs-6a-en', studentId: 's2', date: '2026-05-05', startTime: '10:15', endTime: '11:15' },
  { id: 'a4', scheduleId: 'sch-sess-abs-a4', classGroupId: '6a', classSubjectId: 'cs-6a-sci', studentId: 's3', date: '2026-05-15', startTime: '09:00', endTime: '10:00', reason: 'Non justifiée' },
  { id: 'a5', scheduleId: 'sch-sess-abs-a5', classGroupId: '6a', classSubjectId: 'cs-6a-sci', studentId: 's3', date: '2026-05-07', startTime: '13:30', endTime: '14:30', reason: 'Maladie' },
  { id: 'a6', scheduleId: 'sch-sess-abs-a6', classGroupId: '6a', classSubjectId: 'cs-6a-eps', studentId: 's3', date: '2026-03-18', startTime: '16:00', endTime: '17:00' },
  { id: 'a7', scheduleId: 'sch-sess-abs-a7', classGroupId: '6a', classSubjectId: 'cs-6a-fr', studentId: 's4', date: '2026-05-08', startTime: '11:00', endTime: '12:00', reason: 'Famille' },
  { id: 'a8', scheduleId: 'sch-sess-abs-a8', classGroupId: '6a', classSubjectId: 'cs-6a-math', studentId: 's6', date: '2026-05-09', startTime: '08:30', endTime: '09:30' },
]

/** Session attendance for the narrative reference date — powers dashboard attendance KPIs. */
export const SEED_TODAY_ATTENDANCE = {
  scheduleId: 'sch-sess-att-today-6a',
  classGroupId: '6a',
  classSubjectId: 'cs-6a-math',
  date: SEED_REFERENCE_DATE,
  startTime: '08:30',
  endTime: '09:30',
  records: [
    { id: 'att-today-s1', studentId: 's1', status: 'present' },
    { id: 'att-today-s2', studentId: 's2', status: 'present' },
    { id: 'att-today-s3', studentId: 's3', status: 'absent', reason: 'Absence signalée par les parents' },
    { id: 'att-today-s4', studentId: 's4', status: 'present' },
    { id: 'att-today-s5', studentId: 's5', status: 'late' },
    { id: 'att-today-s6', studentId: 's6', status: 'present' },
  ] satisfies readonly SeedTodayAttendanceRecord[],
} as const

/** Attendance record ids that should carry a pending justification after seeding. */
export const SEED_PENDING_JUSTIFICATION_RECORD_IDS = [
  'att-today-s3',
  'a3',
  'a4',
] as const

export function countSeedAttendanceRecords(): number {
  return SEED_ABSENCE_RECORDS.length + SEED_TODAY_ATTENDANCE.records.length
}
