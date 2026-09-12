export * from './bootstrap-actor'
export * from './capabilities'
export * from './engine'
export * from './gates'
export * from './grants'
export * from './lifecycle'
export * from './migration'
export * from './model'
export * from './operations'
/**
 * Public authorization API.
 *
 * Export order matters: `permissions` and `model` must initialize before grant
 * resolution or policy modules that transitively touch domain entities.
 */
export * from './permissions'
export * from './platform'
export * from './policy'
export {
  authorizeReportCardCommentSave,
  guardianReportCardResultAccess,
  staffReportCardResultAccess,
  studentSelfReportCardResultAccess,
  teacherReportCardResultAccess,
} from './policy/strategies/report-card-access'
export { authorizeTeacherReportCardCommentSave, teacherCanReadReportCard } from './policy/strategies/report-card-access/comment-access'
export {
  dispatchAttendanceRecordAccess,
  dispatchLessonSessionAccess,
  dispatchLessonSessionReadAccess,
} from './policy/strategies/scheduling-access'
export * from './ports'
export * from './resolution'
export * from './s2s'
export * from './scope'
export * from './service-accounts'
export * from './sync'
