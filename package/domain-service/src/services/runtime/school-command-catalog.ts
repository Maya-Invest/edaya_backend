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
    | 'registerTeacher'
    | 'updateStaffMemberStatus'
    | 'updateStaffMemberProfile'
    | 'updateTeacherSelfProfile'
    | 'assignStaffToClass'
    | 'assignStaffToClassSubject'
    | 'assignStaffToLessonSession'
    | 'assignStaffPermission'
    | 'configurePermissionProfile'
    | 'applyStaffPermissionProfile'
    | 'reorderStaffPermissionProfiles'
    | 'removeStaffPermissionProfile'
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
    | 'configureSubjectCategory'
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
    | 'submitAssessmentMarks'
    | 'requestAssessmentMarksCorrection'
    | 'approveAssessmentMarksCorrection'
    | 'rejectAssessmentMarksCorrection'
    | 'withdrawAssessmentMarksCorrection'
    | 'completeAssessment'
    | 'recordAssessmentResults'
    | 'recordAssessmentResult'
    | 'recordAssessmentResultCompliance'
    | 'listClassSubjectAssessmentResultsForPeriod'
    | 'generateReportCardResult'
    | 'writeHomeroomReportComment'
    | 'writeReportCardSectionComments'
    | 'publishReportCardResult'
    | 'renderClassLogbook'
    | 'requestDocumentIssuance'
    | 'requestDocumentIssuanceBatch'
    | 'retryDocumentIssuance'
    | 'correctDocumentIssuance'
    | 'voidDocumentIssuance'
    | 'previewDocument'
    | 'createSchoolIssuanceAssetUpload'
    | 'completeSchoolIssuanceAssetUpload'
    | 'clearSchoolIssuanceAsset'
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
    | 'createCatalogService'
    | 'updateCatalogService'
    | 'activateCatalogService'
    | 'archiveCatalogService'
    | 'enrollStudentInService'
    | 'enrollStudentsInService'
    | 'cancelServiceEnrollment'
    | 'materializeOneTimeCharge'
    | 'adjustStudentCharge'
    | 'waiveStudentCharge'
    | 'cancelStudentCharge'
    | 'allocateAccountBalance'
    | 'reverseAllocation'
    | 'refundAvailableBalance'
    | 'createProfilePhotoUpload'
    | 'completeProfilePhotoUpload'
    | 'submitStudentPhoto'
    | 'withdrawStudentPhotoSubmission'
    | 'reviewStudentPhoto'
    | 'publishStudentPhoto'
    | 'createFamilyFeedbackCampaign'
    | 'updateFamilyFeedbackCampaign'
    | 'assignFamilyFeedbackModerator'
    | 'scheduleFamilyFeedbackCampaign'
    | 'openFamilyFeedbackCampaign'
    | 'closeFamilyFeedbackCampaign'
    | 'cancelFamilyFeedbackCampaign'
    | 'submitFamilyFeedbackResponse'
    | 'saveFamilyFeedbackThemeDraft'
    | 'publishFamilyFeedbackCampaign'
    | 'archiveFamilyFeedbackCampaign'

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
  'registerTeacher',
  'updateStaffMemberStatus',
  'updateStaffMemberProfile',
  'updateTeacherSelfProfile',
  'assignStaffToClass',
  'assignStaffToClassSubject',
  'assignStaffToLessonSession',
  'assignStaffPermission',
  'configurePermissionProfile',
  'applyStaffPermissionProfile',
  'reorderStaffPermissionProfiles',
  'removeStaffPermissionProfile',
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
  'configureSubjectCategory',
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
  'submitAssessmentMarks',
  'requestAssessmentMarksCorrection',
  'approveAssessmentMarksCorrection',
  'rejectAssessmentMarksCorrection',
  'withdrawAssessmentMarksCorrection',
  'completeAssessment',
  'recordAssessmentResults',
  'recordAssessmentResult',
  'recordAssessmentResultCompliance',
  'listClassSubjectAssessmentResultsForPeriod',
  'generateReportCardResult',
  'writeHomeroomReportComment',
  'writeReportCardSectionComments',
  'publishReportCardResult',
  'renderClassLogbook',
  'requestDocumentIssuance',
  'requestDocumentIssuanceBatch',
  'retryDocumentIssuance',
  'correctDocumentIssuance',
  'voidDocumentIssuance',
  'previewDocument',
  'createSchoolIssuanceAssetUpload',
  'completeSchoolIssuanceAssetUpload',
  'clearSchoolIssuanceAsset',
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
  'createCatalogService',
  'updateCatalogService',
  'activateCatalogService',
  'archiveCatalogService',
  'enrollStudentInService',
  'enrollStudentsInService',
  'cancelServiceEnrollment',
  'materializeOneTimeCharge',
  'adjustStudentCharge',
  'waiveStudentCharge',
  'cancelStudentCharge',
  'allocateAccountBalance',
  'reverseAllocation',
  'refundAvailableBalance',
  'createProfilePhotoUpload',
  'completeProfilePhotoUpload',
  'submitStudentPhoto',
  'withdrawStudentPhotoSubmission',
  'reviewStudentPhoto',
  'publishStudentPhoto',
  'createFamilyFeedbackCampaign',
  'updateFamilyFeedbackCampaign',
  'assignFamilyFeedbackModerator',
  'scheduleFamilyFeedbackCampaign',
  'openFamilyFeedbackCampaign',
  'closeFamilyFeedbackCampaign',
  'cancelFamilyFeedbackCampaign',
  'submitFamilyFeedbackResponse',
  'saveFamilyFeedbackThemeDraft',
  'publishFamilyFeedbackCampaign',
  'archiveFamilyFeedbackCampaign',
] as const)
