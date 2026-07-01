/** Reference Monday for concrete timetable sessions (week aligned with mock planning). */
export const SEED_PLANNING_REFERENCE_WEEK_START = '2026-05-11'

export interface SeedPlanningSlot {
  id: string
  scheduleId: string
  classGroupId: string
  classSubjectId: string
  title: string
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri'
  startTime: string
  endTime: string
  teacherId: string
  resourceId?: string
}

/** Weekly timetable for class 6a (hero class — full week). */
export const SEED_PLANNING_SLOTS_6A: readonly SeedPlanningSlot[] = [
  { id: 'p1', scheduleId: 'sch-p1', classGroupId: '6a', classSubjectId: 'cs-6a-math', title: 'Algebra basics', day: 'Mon', startTime: '08:30', endTime: '09:30', teacherId: 'st1' },
  { id: 'p2', scheduleId: 'sch-p2', classGroupId: '6a', classSubjectId: 'cs-6a-fr', title: 'Reading session', day: 'Mon', startTime: '10:00', endTime: '11:00', teacherId: 'st2' },
  { id: 'p3', scheduleId: 'sch-p3', classGroupId: '6a', classSubjectId: 'cs-6a-hist', title: 'Ancient Greece', day: 'Tue', startTime: '09:00', endTime: '10:00', teacherId: 'st3' },
  { id: 'p4', scheduleId: 'sch-p4', classGroupId: '6a', classSubjectId: 'cs-6a-sci', title: 'Lab — Cells', day: 'Wed', startTime: '08:30', endTime: '10:30', teacherId: 'st1', resourceId: 'r2' },
  { id: 'p5', scheduleId: 'sch-p5', classGroupId: '6a', classSubjectId: 'cs-6a-en', title: 'Conversation', day: 'Thu', startTime: '11:00', endTime: '12:00', teacherId: 'st7' },
  { id: 'p6', scheduleId: 'sch-p6', classGroupId: '6a', classSubjectId: 'cs-6a-eps', title: 'Athletics', day: 'Fri', startTime: '14:00', endTime: '16:00', teacherId: 'st7', resourceId: 'r3' },
  { id: 'p7', scheduleId: 'sch-p7', classGroupId: '6a', classSubjectId: 'cs-6a-math', title: 'Geometry workshop', day: 'Thu', startTime: '08:30', endTime: '09:30', teacherId: 'st1' },
  { id: 'p8', scheduleId: 'sch-p8', classGroupId: '6a', classSubjectId: 'cs-6a-fr', title: 'Essay writing', day: 'Wed', startTime: '11:00', endTime: '12:00', teacherId: 'st2' },
]

/** Partial timetable for class 6b. */
export const SEED_PLANNING_SLOTS_6B: readonly SeedPlanningSlot[] = [
  { id: 'p6b-1', scheduleId: 'sch-6b-1', classGroupId: '6b', classSubjectId: 'cs-6b-math', title: 'Algebra', day: 'Mon', startTime: '09:00', endTime: '10:00', teacherId: 'st1' },
  { id: 'p6b-2', scheduleId: 'sch-6b-2', classGroupId: '6b', classSubjectId: 'cs-6b-fr', title: 'Literature', day: 'Tue', startTime: '10:00', endTime: '11:00', teacherId: 'st2' },
  { id: 'p6b-3', scheduleId: 'sch-6b-3', classGroupId: '6b', classSubjectId: 'cs-6b-math', title: 'Geometry', day: 'Wed', startTime: '08:30', endTime: '09:30', teacherId: 'st1' },
  { id: 'p6b-4', scheduleId: 'sch-6b-4', classGroupId: '6b', classSubjectId: 'cs-6b-fr', title: 'Writing workshop', day: 'Thu', startTime: '11:00', endTime: '12:00', teacherId: 'st2' },
]

/** Partial timetable for class 5a. */
export const SEED_PLANNING_SLOTS_5A: readonly SeedPlanningSlot[] = [
  { id: 'p5a-1', scheduleId: 'sch-5a-1', classGroupId: '5a', classSubjectId: 'cs-5a-math', title: 'Algebra', day: 'Mon', startTime: '08:30', endTime: '09:30', teacherId: 'st1' },
  { id: 'p5a-2', scheduleId: 'sch-5a-2', classGroupId: '5a', classSubjectId: 'cs-5a-fr', title: 'Literature', day: 'Tue', startTime: '09:00', endTime: '10:00', teacherId: 'st2' },
  { id: 'p5a-3', scheduleId: 'sch-5a-3', classGroupId: '5a', classSubjectId: 'cs-5a-hist', title: 'Medieval Europe', day: 'Wed', startTime: '10:00', endTime: '11:00', teacherId: 'st3' },
  { id: 'p5a-4', scheduleId: 'sch-5a-4', classGroupId: '5a', classSubjectId: 'cs-5a-sci', title: 'Physics basics', day: 'Thu', startTime: '13:30', endTime: '14:30', teacherId: 'st1', resourceId: 'r2' },
]

export const SEED_PLANNING_SLOTS: readonly SeedPlanningSlot[] = [
  ...SEED_PLANNING_SLOTS_6A,
  ...SEED_PLANNING_SLOTS_6B,
  ...SEED_PLANNING_SLOTS_5A,
]

export function countSeedPlanningSlots(): number {
  return SEED_PLANNING_SLOTS.length
}
