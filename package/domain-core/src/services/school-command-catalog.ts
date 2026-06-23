export type SchoolCommandKey
  = | 'registerSchool'
    | 'updateSchoolConfiguration'
    | 'createAcademicYear'
    | 'activateAcademicYear'
    | 'createAcademicPeriod'
    | 'publishAcademicPeriod'
    | 'createClassGroup'
    | 'updateClassGroupConfiguration'
    | 'registerStaffMember'
    | 'updateStaffMemberStatus'
    | 'assignStaffToClass'
    | 'assignStaffToClassSubject'
    | 'assignStaffToSession'
    | 'assignResourceToClass'
    | 'assignResourceToSession'
    | 'removeResourceAssignment'
    | 'registerAttachment'
    | 'removeAttachment'
    | 'linkActorSubject'
    | 'offerSubjectToClass'
    | 'assignMatterToClassSubject'
    | 'recordSessionProgress'
    | 'createGradeScale'
    | 'createReportCardDefinition'
    | 'createReportCardDefinitionSection'
    | 'createAssessment'
    | 'completeAssessment'
    | 'recordAssessmentResult'
    | 'recordAssessmentResultCompliance'
    | 'listClassSubjectAssessmentResultsForPeriod'
    | 'generateReportCardResult'
    | 'publishReportCardResult'
    | 'registerStudent'
    | 'enrollStudent'
    | 'linkGuardianToStudent'
    | 'registerGuardian'
    | 'promoteStudent'
    | 'transferStudent'
    | 'graduateStudent'
    | 'closeEnrollment'
    | 'recordProgressionDecision'
    | 'updateStudentProfile'
    | 'updateStudentStatus'
    | 'upsertStudentHealthProfile'
    | 'createStudentNote'
    | 'updateStudentNote'
    | 'updateGuardianContactMethods'
    | 'updateGuardianStudentLink'
    | 'createSchedule'
    | 'createCalendarEvent'
    | 'createSession'
    | 'generateSessions'
    | 'recordAttendance'
    | 'recordDailyAttendance'
    | 'recordSessionAttendance'
    | 'recordClassDailyAttendance'
    | 'reviewAttendanceJustification'
    | 'createAnnouncement'
    | 'addTarget'
    | 'publishAnnouncement'
    | 'recordDelivery'
    | 'materializeDeliveries'
    | 'recordIncident'
    | 'addStudentInvolvement'
    | 'applyDisciplinaryAction'
    | 'updateStudentDisciplinaryActionStatus'
    | 'resolveIncident'
    | 'createFee'
    | 'assignFeeToStudent'
    | 'recordPayment'
    | 'reversePayment'
    | 'cancelPayment'
    | 'adjustStudentFee'
    | 'cancelStudentFee'

function defineSchoolCommandKeys<const Keys extends readonly SchoolCommandKey[]>(
  keys: Keys & (
    Exclude<SchoolCommandKey, Keys[number]> extends never
      ? unknown
      : readonly ['Missing school command keys', Exclude<SchoolCommandKey, Keys[number]>]
  ),
): Keys {
  return keys
}

export const SCHOOL_COMMAND_KEYS = defineSchoolCommandKeys([
  'registerSchool',
  'updateSchoolConfiguration',
  'createAcademicYear',
  'activateAcademicYear',
  'createAcademicPeriod',
  'publishAcademicPeriod',
  'createClassGroup',
  'updateClassGroupConfiguration',
  'registerStaffMember',
  'updateStaffMemberStatus',
  'assignStaffToClass',
  'assignStaffToClassSubject',
  'assignStaffToSession',
  'assignResourceToClass',
  'assignResourceToSession',
  'removeResourceAssignment',
  'registerAttachment',
  'removeAttachment',
  'linkActorSubject',
  'offerSubjectToClass',
  'assignMatterToClassSubject',
  'recordSessionProgress',
  'createGradeScale',
  'createReportCardDefinition',
  'createReportCardDefinitionSection',
  'createAssessment',
  'completeAssessment',
  'recordAssessmentResult',
  'recordAssessmentResultCompliance',
  'listClassSubjectAssessmentResultsForPeriod',
  'generateReportCardResult',
  'publishReportCardResult',
  'registerStudent',
  'enrollStudent',
  'linkGuardianToStudent',
  'registerGuardian',
  'promoteStudent',
  'transferStudent',
  'graduateStudent',
  'closeEnrollment',
  'recordProgressionDecision',
  'updateStudentProfile',
  'updateStudentStatus',
  'upsertStudentHealthProfile',
  'createStudentNote',
  'updateStudentNote',
  'updateGuardianContactMethods',
  'updateGuardianStudentLink',
  'createSchedule',
  'createCalendarEvent',
  'createSession',
  'generateSessions',
  'recordAttendance',
  'recordDailyAttendance',
  'recordSessionAttendance',
  'recordClassDailyAttendance',
  'reviewAttendanceJustification',
  'createAnnouncement',
  'addTarget',
  'publishAnnouncement',
  'recordDelivery',
  'materializeDeliveries',
  'recordIncident',
  'addStudentInvolvement',
  'applyDisciplinaryAction',
  'updateStudentDisciplinaryActionStatus',
  'resolveIncident',
  'createFee',
  'assignFeeToStudent',
  'recordPayment',
  'reversePayment',
  'cancelPayment',
  'adjustStudentFee',
  'cancelStudentFee',
] as const)
