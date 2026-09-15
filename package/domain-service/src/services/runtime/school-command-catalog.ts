export type SchoolCommandKey
  = | 'registerSchool'
    | 'updateSchoolConfiguration'
    | 'createAcademicYear'
    | 'publishAcademicYear'
    | 'archiveAcademicYear'
    | 'createAcademicPeriod'
    | 'publishAcademicPeriod'
    | 'configureGradeLevel'
    | 'configurePeriodDefinition'
    | 'configureResource'
    | 'configureActivity'
    | 'enrollStudentInActivity'
    | 'createClassGroup'
    | 'updateClassGroupConfiguration'
    | 'registerStaffMember'
    | 'updateStaffMemberStatus'
    | 'updateStaffMemberProfile'
    | 'assignStaffToClass'
    | 'assignStaffToClassSubject'
    | 'assignStaffToLessonSession'
    | 'assignStaffPermission'
    | 'assignResourceToClass'
    | 'assignResourceToLessonSession'
    | 'removeResourceAssignment'
    | 'registerAttachment'
    | 'removeAttachment'
    | 'linkActorSubject'
    | 'relinkActorSubject'
    | 'unlinkActorSubject'
    | 'sendAccountInvitation'
    | 'resendAccountInvitation'
    | 'revokeAccountInvitation'
    | 'acceptAccountInvitation'
    | 'configureSubject'
    | 'configureSubjectMatter'
    | 'offerSubjectToClass'
    | 'assignMatterToClassSubject'
    | 'offerSubjectToGradeLevel'
    | 'removeSubjectFromGradeLevel'
    | 'updateGradeLevelSubject'
    | 'assignMatterToGradeLevelSubject'
    | 'addCustomClassSubject'
    | 'setClassSubjectOffered'
    | 'configureClassSubjectTimetable'
    | 'recordLessonSessionProgress'
    | 'createGradeScale'
    | 'createReportCardDefinition'
    | 'createReportCardDefinitionSection'
    | 'createAssessment'
    | 'completeAssessment'
    | 'recordAssessmentResult'
    | 'recordAssessmentResultCompliance'
    | 'listClassSubjectAssessmentResultsForPeriod'
    | 'generateReportCardResult'
    | 'writeHomeroomReportComment'
    | 'publishReportCardResult'
    | 'renderClassLogbook'
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
    | 'saveSchedule'
    | 'materializeSchedule'
    | 'createCalendarEvent'
    | 'cancelLessonSession'
    | 'cancelActivitySession'
    | 'rescheduleOccurrence'
    | 'recordAttendance'
    | 'recordDailyAttendance'
    | 'recordLessonSessionAttendance'
    | 'recordClassDailyAttendance'
    | 'reviewAttendanceJustification'
    | 'requestAttendanceJustification'
    | 'generateClassGroupTimetable'
    | 'generateSchoolTimetable'
    | 'publishClassGroupTimetable'
    | 'republishClassGroupTimetable'
    | 'createAnnouncement'
    | 'addTarget'
    | 'publishAnnouncement'
    | 'recordDelivery'
    | 'materializeDeliveries'
    | 'applyDeliveryEvent'
    | 'markDeliveryRead'
    | 'updateNotificationContact'
    | 'registerPushDevice'
    | 'unregisterPushDevice'
    | 'updateSchoolNotificationTemplates'
    | 'resetSchoolNotificationTemplates'
    | 'recordIncident'
    | 'addStudentInvolvement'
    | 'configureDisciplinaryAction'
    | 'applyDisciplinaryAction'
    | 'updateStudentDisciplinaryActionStatus'
    | 'resolveIncident'
    | 'resolveIncidentWithOutcomes'
    | 'createFee'
    | 'assignFeeToStudent'
    | 'recordPayment'
    | 'reversePayment'
    | 'cancelPayment'
    | 'adjustStudentFee'
    | 'cancelStudentFee'
    | 'createProfilePhotoUpload'
    | 'completeProfilePhotoUpload'
    | 'submitStudentPhoto'
    | 'withdrawStudentPhotoSubmission'
    | 'reviewStudentPhoto'
    | 'publishStudentPhoto'

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
  'publishAcademicYear',
  'archiveAcademicYear',
  'createAcademicPeriod',
  'publishAcademicPeriod',
  'configureGradeLevel',
  'configurePeriodDefinition',
  'configureResource',
  'configureActivity',
  'enrollStudentInActivity',
  'createClassGroup',
  'updateClassGroupConfiguration',
  'registerStaffMember',
  'updateStaffMemberStatus',
  'updateStaffMemberProfile',
  'assignStaffToClass',
  'assignStaffToClassSubject',
  'assignStaffToLessonSession',
  'assignStaffPermission',
  'assignResourceToClass',
  'assignResourceToLessonSession',
  'removeResourceAssignment',
  'registerAttachment',
  'removeAttachment',
  'linkActorSubject',
  'relinkActorSubject',
  'unlinkActorSubject',
  'sendAccountInvitation',
  'resendAccountInvitation',
  'revokeAccountInvitation',
  'acceptAccountInvitation',
  'configureSubject',
  'configureSubjectMatter',
  'offerSubjectToClass',
  'assignMatterToClassSubject',
  'offerSubjectToGradeLevel',
  'removeSubjectFromGradeLevel',
  'updateGradeLevelSubject',
  'assignMatterToGradeLevelSubject',
  'addCustomClassSubject',
  'setClassSubjectOffered',
  'configureClassSubjectTimetable',
  'recordLessonSessionProgress',
  'createGradeScale',
  'createReportCardDefinition',
  'createReportCardDefinitionSection',
  'createAssessment',
  'completeAssessment',
  'recordAssessmentResult',
  'recordAssessmentResultCompliance',
  'listClassSubjectAssessmentResultsForPeriod',
  'generateReportCardResult',
  'writeHomeroomReportComment',
  'publishReportCardResult',
  'renderClassLogbook',
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
  'saveSchedule',
  'materializeSchedule',
  'createCalendarEvent',
  'cancelLessonSession',
  'cancelActivitySession',
  'rescheduleOccurrence',
  'recordAttendance',
  'recordDailyAttendance',
  'recordLessonSessionAttendance',
  'recordClassDailyAttendance',
  'reviewAttendanceJustification',
  'requestAttendanceJustification',
  'generateClassGroupTimetable',
  'generateSchoolTimetable',
  'publishClassGroupTimetable',
  'republishClassGroupTimetable',
  'createAnnouncement',
  'addTarget',
  'publishAnnouncement',
  'recordDelivery',
  'materializeDeliveries',
  'applyDeliveryEvent',
  'markDeliveryRead',
  'updateNotificationContact',
  'registerPushDevice',
  'unregisterPushDevice',
  'updateSchoolNotificationTemplates',
  'resetSchoolNotificationTemplates',
  'recordIncident',
  'addStudentInvolvement',
  'configureDisciplinaryAction',
  'applyDisciplinaryAction',
  'updateStudentDisciplinaryActionStatus',
  'resolveIncident',
  'resolveIncidentWithOutcomes',
  'createFee',
  'assignFeeToStudent',
  'recordPayment',
  'reversePayment',
  'cancelPayment',
  'adjustStudentFee',
  'cancelStudentFee',
  'createProfilePhotoUpload',
  'completeProfilePhotoUpload',
  'submitStudentPhoto',
  'withdrawStudentPhotoSubmission',
  'reviewStudentPhoto',
  'publishStudentPhoto',
] as const)
