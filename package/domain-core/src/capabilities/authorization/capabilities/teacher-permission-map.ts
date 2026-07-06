import { Permission } from '../permissions/permission'
import { HomeroomCapability } from './homeroom-capability'
import { TeachingCapability } from './teaching-capability'

const TEACHER_TEACHING_PERMISSION_CAPABILITY_MAP: Partial<Record<Permission, TeachingCapability>> = {
  [Permission.GRADE_READ]: TeachingCapability.ReadSubjectGrades,
  [Permission.ATTENDANCE_READ]: TeachingCapability.ReadSubjectAttendance,
  [Permission.ATTENDANCE_RECORD]: TeachingCapability.RecordSessionAttendance,
  [Permission.CLASS_LOGBOOK_READ]: TeachingCapability.ReadSubjectLogbook,
  [Permission.CLASS_LOGBOOK_CREATE]: TeachingCapability.CreateLogbookEntry,
  [Permission.CLASS_LOGBOOK_UPDATE]: TeachingCapability.UpdateLogbookEntry,
  [Permission.QUERY_TIMETABLE_READ]: TeachingCapability.ReadSubjectTimetable,
  [Permission.QUERY_CLASS_CURRICULUM_READ]: TeachingCapability.ReadSubjectCurriculum,
  [Permission.QUERY_REPORT_CARD_DETAIL_READ]: TeachingCapability.ReadSubjectReportCard,
  [Permission.QUERY_STUDENT_DETAIL_READ]: TeachingCapability.ReadSubjectRoster,
  [Permission.QUERY_STUDENT_DIRECTORY_READ]: TeachingCapability.ReadSubjectRoster,
  [Permission.DISCIPLINE_CREATE]: TeachingCapability.CreateSubjectDisciplineIncident,
}

const TEACHER_HOMEROOM_PERMISSION_CAPABILITY_MAP: Partial<Record<Permission, HomeroomCapability>> = {
  [Permission.QUERY_CLASS_DIRECTORY_READ]: HomeroomCapability.ReadClassRoster,
  [Permission.QUERY_STUDENT_DIRECTORY_READ]: HomeroomCapability.ReadClassRoster,
  [Permission.QUERY_STUDENT_DETAIL_READ]: HomeroomCapability.ReadClassRoster,
  [Permission.ATTENDANCE_READ]: HomeroomCapability.ReadClassAttendance,
  [Permission.ATTENDANCE_RECORD]: HomeroomCapability.RecordDailyAttendance,
  [Permission.CLASS_LOGBOOK_READ]: HomeroomCapability.ReadClassLogbook,
  [Permission.QUERY_TIMETABLE_READ]: HomeroomCapability.ReadClassTimetable,
  [Permission.QUERY_REPORT_CARD_DETAIL_READ]: HomeroomCapability.ReadClassGradesOverview,
  [Permission.DISCIPLINE_CREATE]: HomeroomCapability.CreateClassDisciplineIncident,
}

export function teachingCapabilityForPermission(permission: Permission): TeachingCapability | undefined {
  return TEACHER_TEACHING_PERMISSION_CAPABILITY_MAP[permission]
}

export function homeroomCapabilityForPermission(permission: Permission): HomeroomCapability | undefined {
  return TEACHER_HOMEROOM_PERMISSION_CAPABILITY_MAP[permission]
}
