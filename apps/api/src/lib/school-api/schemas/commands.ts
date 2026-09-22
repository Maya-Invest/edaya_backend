import { z } from "@hono/zod-openapi";
import {
  academicPeriodSchema,
  academicYearSchema,
  AccountInvitationContactChannel,
  AccountInvitationKind,
  activityEnrollmentSchema,
  activitySchema,
  announcementSchema,
  announcementTargetSchema,
  assessmentResultSchema,
  assessmentSchema,
  AttachmentOwnerKind,
  attachmentPurposeSchema,
  attachmentSchema,
  AttendanceJustificationStatus,
  attendanceRecordSchema,
  AttendanceStatus,
  calendarEventSchema,
  classGroupSchema,
  classSubjectMatterSchema,
  classSubjectProgressSchema,
  classSubjectSchema,
  gradeScaleRangeSchema as coreGradeScaleRangeSchema,
  DeadlineComplianceStatus,
  disciplinaryActionSchema,
  DOCUMENT_TEMPLATE_KEYS,
  EnrollmentEndReason,
  gradeLevelSchema,
  gradeLevelSubjectMatterSchema,
  gradeLevelSubjectSchema,
  gradeScaleSchema,
  grantScopesSchema,
  guardianContactMethodSchema,
  guardianSchema,
  guardianStudentLinkSchema,
  IncidentInvolvementRole,
  incidentSchema,
  messageDeliverySchema,
  PaymentMethod,
  periodDefinitionSchema,
  ProgressionDecision,
  reportCardDefinitionSchema,
  reportCardDefinitionSectionSchema,
  reportCardResultSchema,
  resourceAssignmentSchema,
  resourceSchema,
  scheduleSchema,
  SCHOOL_ISSUANCE_ASSET_PURPOSES,
  SCHOOL_PUBLIC_BRANDING_PURPOSES,
  schoolSchema,
  SchoolType,
  staffAssignmentSchema,
  staffMemberSchema,
  staffPermissionAssignmentSchema,
  staffPermissionProfileSchema,
  studentClassEnrollmentSchema,
  studentDisciplinaryActionSchema,
  StudentDisciplinaryActionStatus,
  studentHealthProfileSchema,
  studentIncidentInvolvementSchema,
  studentNoteSchema,
  studentSchema,
  StudentStatus,
  teacherSchema,
  subjectMatterSchema,
  subjectCategorySchema,
  subjectSchema,
} from "@edaya/core";
import { NOTIFICATION_TEMPLATE_KEYS } from "@edaya/service";
import { field, namedObjectSchema, objectFromSchema } from "./helpers";

const optionalText = () => z.string().optional();
const attendanceByStudentSchema = z.record(field.id(), field.enumValue(AttendanceStatus));

export const gradeLevelConfigCommandSchema = objectFromSchema(gradeLevelSchema).openapi("GradeLevelConfigCommand");

export const periodDefinitionConfigCommandSchema = objectFromSchema(periodDefinitionSchema)
  .omit({ schoolId: true })
  .openapi("PeriodDefinitionConfigCommand");

export const resourceConfigCommandSchema = objectFromSchema(resourceSchema)
  .omit({ schoolId: true })
  .openapi("ResourceConfigCommand");

export const subjectConfigCommandSchema = objectFromSchema(subjectSchema)
  .omit({ schoolId: true })
  .openapi("SubjectConfigCommand");

export const subjectCategoryConfigCommandSchema = objectFromSchema(subjectCategorySchema)
  .omit({ schoolId: true })
  .openapi("SubjectCategoryConfigCommand");

export const subjectMatterConfigCommandSchema = objectFromSchema(subjectMatterSchema)
  .openapi("SubjectMatterConfigCommand");

export const disciplinaryActionConfigCommandSchema = objectFromSchema(disciplinaryActionSchema)
  .omit({ schoolId: true })
  .openapi("DisciplinaryActionConfigCommand");

export const activityConfigCommandSchema = objectFromSchema(activitySchema)
  .omit({ schoolId: true })
  .openapi("ActivityConfigCommand");

export const activityEnrollmentConfigCommandSchema = objectFromSchema(activityEnrollmentSchema)
  .openapi("ActivityEnrollmentConfigCommand");

export const relinkActorSubjectCommandSchema = z.object({
  subjectId: field.id(),
  staffMemberId: field.id().optional(),
  guardianId: field.id().optional(),
  studentId: field.id().optional(),
  teacherId: field.id().optional(),
}).superRefine((data, ctx) => {
  const targetCount = [data.staffMemberId, data.guardianId, data.studentId, data.teacherId].filter(Boolean).length;
  if (targetCount !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Exactly one of staffMemberId, guardianId, studentId, or teacherId is required",
    });
  }
}).openapi("RelinkActorSubjectCommand");

export const requestAttendanceJustificationCommandSchema = z.object({
  studentId: field.id(),
  attendanceId: field.id(),
  reason: field.text(),
}).openapi("RequestAttendanceJustificationCommand");

export const registerSchoolCommandSchema = objectFromSchema(schoolSchema)
  .extend({
    type: z.nativeEnum(SchoolType).nullable().optional(),
    country: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
  })
  .openapi("RegisterSchoolCommand");

export const updateSchoolConfigurationCommandSchema = objectFromSchema(schoolSchema)
  .partial()
  .omit({
    id: true,
    createdAt: true,
    logoAttachmentId: true,
    crestAttachmentId: true,
    stampAttachmentId: true,
    signatureAttachmentId: true,
    issuanceAssetVersion: true,
  })
  .extend({
    schoolId: field.id(),
    type: z.nativeEnum(SchoolType).nullable().optional(),
    country: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    postalAddress: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    schoolCode: z.string().nullable().optional(),
    issuingName: z.string().nullable().optional(),
    publicBrandingPurposes: z.array(z.enum(SCHOOL_PUBLIC_BRANDING_PURPOSES)).optional(),
  })
  .openapi("UpdateSchoolConfigurationCommand");

export const createAcademicYearCommandSchema = objectFromSchema(academicYearSchema)
  .omit({ status: true, createdAt: true })
  .openapi("CreateAcademicYearCommand");

export const publishAcademicYearCommandSchema = z.object({
  academicYearId: field.id(),
}).openapi("PublishAcademicYearCommand");

export const archiveAcademicYearCommandSchema = z.object({
  academicYearId: field.id(),
}).openapi("ArchiveAcademicYearCommand");

export const publishAcademicPeriodCommandSchema = z.object({
  academicPeriodId: field.id(),
}).openapi("PublishAcademicPeriodCommand");

export const createAcademicPeriodCommandSchema = objectFromSchema(academicPeriodSchema)
  .openapi("CreateAcademicPeriodCommand");

export const createClassGroupCommandSchema = objectFromSchema(classGroupSchema)
  .openapi("CreateClassGroupCommand");

export const updateClassGroupConfigurationCommandSchema = objectFromSchema(classGroupSchema)
  .partial()
  .omit({ id: true, schoolId: true, academicYearId: true, gradeLevelId: true, createdAt: true })
  .extend({
    classGroupId: field.id(),
  })
  .openapi("UpdateClassGroupConfigurationCommand");

export const registerStaffMemberCommandSchema = objectFromSchema(staffMemberSchema)
  .extend({
    sendAccountInvitation: field.optionalBoolean(),
  })
  .openapi("RegisterStaffMemberCommand");

export const registerTeacherCommandSchema = objectFromSchema(teacherSchema)
  .openapi("RegisterTeacherCommand");

export const updateStaffMemberStatusCommandSchema = z.object({
  staffId: field.id(),
  isActive: field.boolean(),
}).openapi("UpdateStaffMemberStatusCommand");

export const updateStaffMemberProfileCommandSchema = objectFromSchema(staffMemberSchema)
  .partial()
  .omit({
    id: true,
    schoolId: true,
    isActive: true,
    createdAt: true,
    subjectId: true,
    accountKind: true,
    serviceId: true,
    createdBySubjectId: true,
    serviceElevated: true,
    notificationEmail: true,
    notificationPhone: true,
  })
  .extend({
    staffId: field.id(),
  })
  .openapi("UpdateStaffMemberProfileCommand");

export const linkActorSubjectCommandSchema = z.object({
  subjectId: field.id(),
  staffMemberId: field.id().optional(),
  guardianId: field.id().optional(),
  studentId: field.id().optional(),
  teacherId: field.id().optional(),
}).superRefine((data, ctx) => {
  const targetCount = [data.staffMemberId, data.guardianId, data.studentId, data.teacherId].filter(Boolean).length;
  if (targetCount !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Exactly one of staffMemberId, guardianId, studentId, or teacherId is required",
    });
  }
}).openapi("LinkActorSubjectCommand");

export const unlinkActorSubjectCommandSchema = z.object({
  staffMemberId: field.id().optional(),
  guardianId: field.id().optional(),
  studentId: field.id().optional(),
  teacherId: field.id().optional(),
}).superRefine((data, ctx) => {
  const targetCount = [data.staffMemberId, data.guardianId, data.studentId, data.teacherId].filter(Boolean).length;
  if (targetCount !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Exactly one of staffMemberId, guardianId, studentId, or teacherId is required",
    });
  }
}).openapi("UnlinkActorSubjectCommand");

export const sendAccountInvitationCommandSchema = z.object({
  kind: field.enumValue(AccountInvitationKind),
  targetId: field.id(),
  contactChannel: field.enumValue(AccountInvitationContactChannel).optional(),
  contactValue: field.optionalString(),
}).openapi("SendAccountInvitationCommand");

export const resendAccountInvitationCommandSchema = z.object({
  invitationId: field.id(),
}).openapi("ResendAccountInvitationCommand");

export const revokeAccountInvitationCommandSchema = z.object({
  invitationId: field.id(),
}).openapi("RevokeAccountInvitationCommand");

export const acceptAccountInvitationCommandSchema = z.object({
  token: z.string().min(1),
  subjectId: field.id(),
  contactValue: z.string().min(1),
}).openapi("AcceptAccountInvitationCommand");

export const assignStaffToClassCommandSchema = objectFromSchema(staffAssignmentSchema)
  .omit({ classSubjectId: true, lessonSessionId: true, activitySessionId: true, assessmentId: true })
  .extend({
    classGroupId: field.id(),
  })
  .openapi("AssignStaffToClassCommand");

export const assignStaffToClassSubjectCommandSchema = objectFromSchema(staffAssignmentSchema)
  .omit({ classGroupId: true, lessonSessionId: true, activitySessionId: true, assessmentId: true })
  .extend({
    classSubjectId: field.id(),
  })
  .openapi("AssignStaffToClassSubjectCommand");

export const assignStaffToLessonSessionCommandSchema = objectFromSchema(staffAssignmentSchema)
  .omit({ classGroupId: true, classSubjectId: true, activitySessionId: true, assessmentId: true })
  .extend({
    lessonSessionId: field.id(),
  })
  .openapi("AssignStaffToLessonSessionCommand");

export const staffPermissionAssignmentConfigCommandSchema = objectFromSchema(staffPermissionAssignmentSchema)
  .openapi("StaffPermissionAssignmentConfigCommand");

export const configurePermissionProfileCommandSchema = objectFromSchema(staffPermissionProfileSchema)
  .omit({ sourceKey: true, createdAt: true, updatedAt: true })
  .openapi("ConfigurePermissionProfileCommand");

export const applyStaffPermissionProfileCommandSchema = z.object({
  staffId: field.id(),
  profileId: field.id(),
  academicYearId: field.id().optional(),
  scopes: grantScopesSchema,
}).openapi("ApplyStaffPermissionProfileCommand");

export const reorderStaffPermissionProfilesCommandSchema = z.object({
  staffId: field.id(),
  profileIds: z.array(field.id()).min(1),
}).openapi("ReorderStaffPermissionProfilesCommand");

export const removeStaffPermissionProfileCommandSchema = z.object({
  staffId: field.id(),
  profileId: field.id(),
}).openapi("RemoveStaffPermissionProfileCommand");

export const assignResourceToClassCommandSchema = objectFromSchema(resourceAssignmentSchema)
  .omit({ lessonSessionId: true, activitySessionId: true, assessmentId: true })
  .extend({
    classGroupId: field.id(),
  })
  .openapi("AssignResourceToClassCommand");

export const assignResourceToLessonSessionCommandSchema = objectFromSchema(resourceAssignmentSchema)
  .omit({ classGroupId: true, activitySessionId: true, assessmentId: true })
  .extend({
    lessonSessionId: field.id(),
  })
  .openapi("AssignResourceToLessonSessionCommand");

export const removeResourceAssignmentCommandSchema = z.object({
  assignmentId: field.id(),
}).openapi("RemoveResourceAssignmentCommand");

export const registerAttachmentCommandSchema = objectFromSchema(attachmentSchema)
  .extend({ purpose: attachmentPurposeSchema.optional() })
  .omit({ uploadedById: true })
  .openapi("RegisterAttachmentCommand");

export const removeAttachmentCommandSchema = z.object({
  attachmentId: field.id(),
}).openapi("RemoveAttachmentCommand");

export const registerStudentCommandSchema = objectFromSchema(studentSchema)
  .omit({
    gender: true,
    placeOfBirth: true,
    nationality: true,
    matricule: true,
    photoUrl: true,
    subjectId: true,
    status: true,
    enrollmentDate: true,
  })
  .extend({
    sendAccountInvitation: field.optionalBoolean(),
    inviteEmail: field.optionalString(),
  })
  .openapi("RegisterStudentCommand");

export const enrollStudentCommandSchema = objectFromSchema(studentClassEnrollmentSchema)
  .omit({
    academicYearId: true,
    enrollmentIndex: true,
    status: true,
    endedAt: true,
    endReason: true,
    progressionDecision: true,
    previousEnrollmentId: true,
    closedBy: true,
    progressionDecidedAt: true,
    progressionDecidedBy: true,
    progressionNotes: true,
  })
  .openapi("EnrollStudentCommand");

export const closeEnrollmentCommandSchema = z.object({
  enrollmentId: field.id(),
  endReason: z.nativeEnum(EnrollmentEndReason),
  endedAt: field.optionalDate(),
}).openapi("CloseEnrollmentCommand");

export const recordProgressionDecisionCommandSchema = z.object({
  enrollmentId: field.id(),
  decision: z.nativeEnum(ProgressionDecision),
  decidedAt: field.optionalDate(),
  notes: optionalText(),
}).openapi("RecordProgressionDecisionCommand");

export const promoteStudentCommandSchema = z.object({
  enrollmentId: field.id(),
  nextEnrollmentId: field.id(),
  nextClassGroupId: field.id(),
  effectiveAt: field.date(),
  decidedAt: field.optionalDate(),
  notes: optionalText(),
}).openapi("PromoteStudentCommand");

export const transferStudentCommandSchema = z.object({
  enrollmentId: field.id(),
  nextEnrollmentId: field.id(),
  nextClassGroupId: field.id(),
  effectiveAt: field.date(),
}).openapi("TransferStudentCommand");

export const graduateStudentCommandSchema = z.object({
  enrollmentId: field.id(),
  effectiveAt: field.date(),
  decidedAt: field.optionalDate(),
  notes: optionalText(),
}).openapi("GraduateStudentCommand");

export const registerGuardianCommandSchema = objectFromSchema(guardianSchema)
  .extend({
    contactMethods: z.array(objectFromSchema(guardianContactMethodSchema)).optional(),
    sendAccountInvitation: field.optionalBoolean(),
  })
  .openapi("RegisterGuardianCommand");

export const updateStudentProfileCommandSchema = objectFromSchema(studentSchema)
  .partial()
  .omit({ id: true, schoolId: true, status: true, createdAt: true, photoUrl: true, photoAttachmentId: true })
  .extend({
    studentId: field.id(),
  })
  .openapi("UpdateStudentProfileCommand");

export const updateStudentStatusCommandSchema = z.object({
  studentId: field.id(),
  status: z.nativeEnum(StudentStatus),
}).openapi("UpdateStudentStatusCommand");

export const upsertStudentHealthProfileCommandSchema = objectFromSchema(studentHealthProfileSchema)
  .omit({ schoolId: true })
  .openapi("UpsertStudentHealthProfileCommand");

export const createStudentNoteCommandSchema = objectFromSchema(studentNoteSchema)
  .omit({ schoolId: true, authorStaffId: true })
  .openapi("CreateStudentNoteCommand");

export const updateStudentNoteCommandSchema = objectFromSchema(studentNoteSchema)
  .partial()
  .omit({ id: true, schoolId: true, studentId: true, authorStaffId: true, createdAt: true })
  .extend({
    noteId: field.id(),
  })
  .openapi("UpdateStudentNoteCommand");

export const updateGuardianContactMethodsCommandSchema = objectFromSchema(guardianSchema)
  .partial()
  .omit({ id: true, schoolId: true, subjectId: true, createdAt: true })
  .extend({
    guardianId: field.id(),
    contactMethods: z.array(objectFromSchema(guardianContactMethodSchema)).optional(),
  })
  .openapi("UpdateGuardianContactMethodsCommand");

export const linkGuardianToStudentCommandSchema = objectFromSchema(guardianStudentLinkSchema)
  .omit({ schoolId: true })
  .openapi("LinkGuardianToStudentCommand");

export const updateGuardianStudentLinkCommandSchema = objectFromSchema(guardianStudentLinkSchema)
  .partial()
  .omit({ id: true, schoolId: true, createdAt: true })
  .openapi("UpdateGuardianStudentLinkCommand");

export const offerSubjectToClassCommandSchema = objectFromSchema(classSubjectSchema)
  .omit({ completedPercentage: true })
  .openapi("OfferSubjectToClassCommand");

export const offerSubjectToGradeLevelCommandSchema = objectFromSchema(gradeLevelSubjectSchema)
  .extend({
    classSubjectIdsByClassGroupId: z.record(field.id(), field.id()).optional(),
    classSubjectMatterIdsByClassGroupId: z.record(field.id(), field.id()).optional(),
  })
  .openapi("OfferSubjectToGradeLevelCommand");

export const removeSubjectFromGradeLevelCommandSchema = z.object({
  gradeLevelSubjectId: field.id(),
}).openapi("RemoveSubjectFromGradeLevelCommand");

export const updateGradeLevelSubjectCommandSchema = z.object({
  gradeLevelSubjectId: field.id(),
  coefficient: z.number().positive().optional(),
  isOptional: z.boolean().optional(),
}).openapi("UpdateGradeLevelSubjectCommand");

export const addCustomClassSubjectCommandSchema = objectFromSchema(classSubjectSchema)
  .omit({ gradeLevelSubjectId: true, completedPercentage: true })
  .openapi("AddCustomClassSubjectCommand");

export const setClassSubjectOfferedCommandSchema = z.object({
  classSubjectId: field.id(),
  isOffered: z.boolean(),
}).openapi("SetClassSubjectOfferedCommand");

export const configureClassSubjectTimetableCommandSchema = z.object({
  classSubjectId: field.id(),
  periodsPerWeek: z.number().int().positive().nullable().optional(),
  minPeriodSpan: z.number().int().positive().nullable().optional(),
  maxPeriodSpan: z.number().int().positive().nullable().optional(),
}).openapi("ConfigureClassSubjectTimetableCommand");

export const assignMatterToClassSubjectCommandSchema = objectFromSchema(classSubjectMatterSchema)
  .omit({ status: true, completedPercentage: true, updatedByStaffId: true, startedAt: true, completedAt: true })
  .openapi("AssignMatterToClassSubjectCommand");

export const assignMatterToGradeLevelSubjectCommandSchema = objectFromSchema(gradeLevelSubjectMatterSchema)
  .extend({
    classSubjectMatterIdsByClassGroupId: z.record(field.id(), field.id()).optional(),
  })
  .openapi("AssignMatterToGradeLevelSubjectCommand");

export const recordLessonSessionProgressCommandSchema = objectFromSchema(classSubjectProgressSchema)
  .omit({ recordedByStaffId: true })
  .openapi("RecordLessonSessionProgressCommand");

export const createScheduleCommandSchema = objectFromSchema(scheduleSchema)
  .openapi("CreateScheduleCommand");

export const saveScheduleCommandSchema = z.object({
  schedule: objectFromSchema(scheduleSchema),
  materialize: z.boolean().optional(),
}).openapi("SaveScheduleCommand");

export const materializeScheduleCommandSchema = z.object({
  scheduleId: field.id(),
}).openapi("MaterializeScheduleCommand");

export const createCalendarEventCommandSchema = objectFromSchema(calendarEventSchema)
  .openapi("CreateCalendarEventCommand");

export const cancelLessonSessionCommandSchema = z.object({
  lessonSessionId: field.id(),
}).openapi("CancelLessonSessionCommand");

export const cancelActivitySessionCommandSchema = z.object({
  activitySessionId: field.id(),
}).openapi("CancelActivitySessionCommand");

export const rescheduleOccurrenceCommandSchema = z.object({
  lessonSessionId: field.id().optional(),
  activitySessionId: field.id().optional(),
  startsAt: field.date(),
  endsAt: field.date(),
}).openapi("RescheduleOccurrenceCommand");

const timetableGenerationOptionsSchema = z.object({
  generationMode: z.enum(["weekly", "free"]).optional(),
  enforceWorkloadFulfillment: z.boolean().optional(),
  excludeBreakSlots: z.boolean().optional(),
  minDayGapSameSubject: z.number().int().nonnegative().optional(),
  preferredPeriodDefinitionIds: z.array(field.id()).optional(),
  allowUnassignedTeacherPlacements: z.boolean().optional(),
  useHomeroomTeacherFallback: z.boolean().optional(),
}).openapi("TimetableGenerationOptions");

const timetablePlacementParametersSchema = z.object({
  periodsPerWeekByClassSubjectId: z.record(field.id(), z.number().int().positive()).optional(),
  minPeriodSpanByClassSubjectId: z.record(field.id(), z.number().int().positive()).optional(),
  maxPeriodSpanByClassSubjectId: z.record(field.id(), z.number().int().positive()).optional(),
}).openapi("TimetablePlacementParameters");

export const generateClassGroupTimetableCommandSchema = z.object({
  classGroupId: field.id(),
  academicYearId: field.id(),
  startDate: field.date(),
  endDate: field.date(),
  placementParameters: timetablePlacementParametersSchema.optional(),
  options: timetableGenerationOptionsSchema.optional(),
}).openapi("GenerateClassGroupTimetableCommand");

export const generateSchoolTimetableCommandSchema = generateClassGroupTimetableCommandSchema
  .omit({ classGroupId: true })
  .openapi("GenerateSchoolTimetableCommand");

export const publishClassGroupTimetableCommandSchema = z.object({
  classGroupId: field.id(),
  startDate: field.date(),
  endDate: field.date(),
  sessionConflictPolicy: z.enum(["fail", "skip"]).optional(),
}).openapi("PublishClassGroupTimetableCommand");

export const republishClassGroupTimetableCommandSchema = generateClassGroupTimetableCommandSchema
  .extend({ sessionConflictPolicy: z.enum(["fail", "skip"]).optional() })
  .openapi("RepublishClassGroupTimetableCommand");

export const recordAttendanceCommandSchema = objectFromSchema(attendanceRecordSchema)
  .omit({
    date: true,
    justificationStatus: true,
    reason: true,
    notes: true,
    justifiedAt: true,
    justifiedByStaffId: true,
    correctedAt: true,
    correctedByStaffId: true,
    createdBy: true,
    updatedAt: true,
  })
  .openapi("RecordAttendanceCommand");

export const recordDailyAttendanceCommandSchema = objectFromSchema(attendanceRecordSchema)
  .omit({
    attendanceId: true,
    lessonSessionId: true,
    activitySessionId: true,
    assessmentId: true,
    justificationStatus: true,
    reason: true,
    notes: true,
    justifiedAt: true,
    justifiedByStaffId: true,
    correctedAt: true,
    correctedByStaffId: true,
    createdBy: true,
    updatedAt: true,
  })
  .extend({
    classGroupId: field.id(),
  })
  .openapi("RecordDailyAttendanceCommand");

export const reviewAttendanceJustificationCommandSchema = z.object({
  studentId: field.id(),
  attendanceId: field.id().optional(),
  lessonSessionId: field.id().optional(),
  decision: z.union([
    z.literal(AttendanceJustificationStatus.Excused),
    z.literal(AttendanceJustificationStatus.Rejected),
  ]),
  reason: field.text(),
  notes: optionalText(),
  reviewedAt: field.optionalDate(),
}).openapi("ReviewAttendanceJustificationCommand");

export const recordLessonSessionAttendanceCommandSchema = z.object({
  lessonSessionId: field.id(),
  attendanceByStudent: attendanceByStudentSchema,
  createdAt: field.optionalDate(),
}).openapi("RecordLessonSessionAttendanceCommand");

export const recordClassDailyAttendanceCommandSchema = z.object({
  classGroupId: field.id(),
  date: field.date(),
  attendanceByStudent: attendanceByStudentSchema,
  createdAt: field.optionalDate(),
}).openapi("RecordClassDailyAttendanceCommand");

const gradeScaleRangeCommandSchema = objectFromSchema(coreGradeScaleRangeSchema)
  .openapi("GradeScaleRangeCommandValue");

export const createGradeScaleCommandSchema = objectFromSchema(gradeScaleSchema)
  .extend({
    ranges: z.array(gradeScaleRangeCommandSchema).min(1),
  })
  .openapi("CreateGradeScaleCommand");

export const createReportCardDefinitionCommandSchema = objectFromSchema(reportCardDefinitionSchema)
  .openapi("CreateReportCardDefinitionCommand");

export const createAssessmentCommandSchema = objectFromSchema(assessmentSchema)
  .omit({ completedAt: true })
  .openapi("CreateAssessmentCommand");

export const completeAssessmentCommandSchema = z.object({
  assessmentId: field.id(),
  completedAt: field.optionalDate(),
}).openapi("CompleteAssessmentCommand");

export const recordAssessmentResultCommandSchema = objectFromSchema(assessmentResultSchema)
  .omit({ status: true, notes: true, createdBy: true })
  .openapi("RecordAssessmentResultCommand");

export const recordAssessmentResultComplianceCommandSchema = objectFromSchema(assessmentResultSchema)
  .omit({ score: true, createdBy: true })
  .extend({
    status: z.nativeEnum(DeadlineComplianceStatus),
  })
  .openapi("RecordAssessmentResultComplianceCommand");

export const createReportCardDefinitionSectionCommandSchema = objectFromSchema(reportCardDefinitionSectionSchema)
  .openapi("CreateReportCardDefinitionSectionCommand");

export const generateReportCardResultCommandSchema = objectFromSchema(reportCardResultSchema)
  .omit({
    classGroupId: true,
    periodId: true,
    sectionResults: true,
    attendanceSummary: true,
    assessmentResultCount: true,
    overallAverage: true,
    rank: true,
    classSize: true,
    passThreshold: true,
    teacherComment: true,
    principalComment: true,
    status: true,
    publishedAt: true,
  })
  .extend({
    reportCardDefinitionId: optionalText(),
    periodId: field.id(),
  })
  .openapi("GenerateReportCardResultCommand");

export const writeHomeroomReportCommentCommandSchema = z.object({
  id: field.id(),
  teacherComment: field.text(),
}).openapi("WriteHomeroomReportCommentCommand");

export const publishReportCardResultCommandSchema = z.object({
  id: field.id(),
  studentId: field.id(),
  periodId: field.id(),
  reportCardDefinitionId: optionalText(),
  publishedAt: field.optionalDate(),
}).openapi("PublishReportCardResultCommand");

export const renderClassLogbookCommandSchema = z.object({
  classGroupId: field.id(),
  academicPeriodId: field.id().optional(),
  classSubjectId: field.id().optional(),
  locale: z.enum(["fr", "en"]).optional(),
  requestId: field.id().optional(),
}).openapi("RenderClassLogbookCommand");

const documentStaffFieldsSchema = z.object({
  recipient: z.string().min(1).optional(),
  date: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
  reason: z.string().min(1).optional(),
}).optional();

export const requestDocumentIssuanceCommandSchema = z.object({
  id: field.id().optional(),
  requestId: field.id(),
  templateKey: z.enum(DOCUMENT_TEMPLATE_KEYS),
  sourceId: field.id(),
  locale: z.enum(["fr", "en"]).optional(),
  academicYearId: field.id().optional(),
  academicPeriodId: field.id().optional(),
  classSubjectId: field.id().optional(),
  studentId: field.id().optional(),
  classGroupId: field.id().optional(),
  teacherId: field.id().optional(),
  staffFields: documentStaffFieldsSchema,
}).openapi("RequestDocumentIssuanceCommand");

export const requestDocumentIssuanceBatchCommandSchema = z.object({
  requestId: field.id(),
  templateKey: z.enum(DOCUMENT_TEMPLATE_KEYS),
  locale: z.enum(["fr", "en"]).optional(),
  academicYearId: field.id().optional(),
  items: z.array(z.object({
    sourceId: field.id(),
    requestId: field.id(),
    studentId: field.id().optional(),
    classGroupId: field.id().optional(),
    teacherId: field.id().optional(),
    academicPeriodId: field.id().optional(),
    classSubjectId: field.id().optional(),
    staffFields: documentStaffFieldsSchema,
  })).min(1).max(50),
}).openapi("RequestDocumentIssuanceBatchCommand");

export const retryDocumentIssuanceCommandSchema = z.object({
  requestId: field.id(),
  issuanceId: field.id(),
}).openapi("RetryDocumentIssuanceCommand");

export const correctDocumentIssuanceCommandSchema = requestDocumentIssuanceCommandSchema.extend({
  issuanceId: field.id(),
}).openapi("CorrectDocumentIssuanceCommand");

export const voidDocumentIssuanceCommandSchema = z.object({
  requestId: field.id(),
  issuanceId: field.id(),
  reason: field.text(),
}).openapi("VoidDocumentIssuanceCommand");

export const previewDocumentCommandSchema = requestDocumentIssuanceCommandSchema.openapi("PreviewDocumentCommand");

export const createSchoolIssuanceAssetUploadCommandSchema = z.object({
  purpose: z.enum(SCHOOL_ISSUANCE_ASSET_PURPOSES),
  fileName: field.string(),
  mimeType: field.string(),
  sizeBytes: field.positiveNumber(),
  attachmentId: field.id().optional(),
}).openapi("CreateSchoolIssuanceAssetUploadCommand");

export const completeSchoolIssuanceAssetUploadCommandSchema = objectFromSchema(attachmentSchema)
  .extend({ purpose: z.enum(SCHOOL_ISSUANCE_ASSET_PURPOSES) })
  .omit({ uploadedById: true })
  .openapi("CompleteSchoolIssuanceAssetUploadCommand");

export const clearSchoolIssuanceAssetCommandSchema = z.object({
  purpose: z.enum(SCHOOL_ISSUANCE_ASSET_PURPOSES),
}).openapi("ClearSchoolIssuanceAssetCommand");

export const recordIncidentCommandSchema = objectFromSchema(incidentSchema)
  .omit({
    reporterId: true,
    status: true,
    resolutionNotes: true,
    resolvedAt: true,
    resolvedByStaffId: true,
  })
  .openapi("RecordIncidentCommand");

export const addStudentInvolvementCommandSchema = objectFromSchema(studentIncidentInvolvementSchema)
  .openapi("AddStudentInvolvementCommand");

export const applyDisciplinaryActionCommandSchema = objectFromSchema(studentDisciplinaryActionSchema)
  .omit({
    assignedByStaffId: true,
    status: true,
  })
  .openapi("ApplyDisciplinaryActionCommand");

export const updateStudentDisciplinaryActionStatusCommandSchema = z.object({
  studentDisciplinaryActionId: field.id(),
  status: z.nativeEnum(StudentDisciplinaryActionStatus),
  updatedAt: field.optionalDate(),
}).openapi("UpdateStudentDisciplinaryActionStatusCommand");

export const resolveIncidentCommandSchema = z.object({
  incidentId: field.id(),
  resolutionNotes: optionalText(),
  resolvedAt: field.optionalDate(),
}).openapi("ResolveIncidentCommand");

const resolveIncidentInvolvementCommandSchema = z.object({
  id: field.id(),
  studentId: field.id(),
  role: z.nativeEnum(IncidentInvolvementRole),
  notes: optionalText(),
  createdAt: field.optionalDate(),
}).openapi("ResolveIncidentInvolvementCommandValue");

const resolveIncidentSanctionCommandSchema = objectFromSchema(studentDisciplinaryActionSchema)
  .pick({
    id: true,
    studentId: true,
    disciplinaryActionId: true,
    startsAt: true,
    endsAt: true,
    notes: true,
  })
  .extend({
    createdAt: field.optionalDate(),
  })
  .openapi("ResolveIncidentSanctionCommandValue");

export const resolveIncidentWithOutcomesCommandSchema = z.object({
  incidentId: field.id(),
  resolutionNotes: optionalText(),
  involvedStudents: z.array(resolveIncidentInvolvementCommandSchema).min(1),
  sanctions: z.array(resolveIncidentSanctionCommandSchema).optional(),
}).openapi("ResolveIncidentWithOutcomesCommand");

const retiredFinanceCommandSchema = z.object({
  id: field.id().optional(),
}).passthrough();

export const createFeeCommandSchema = retiredFinanceCommandSchema.openapi("CreateFeeCommand");
export const assignFeeToStudentCommandSchema = retiredFinanceCommandSchema.openapi("AssignFeeToStudentCommand");
export const cancelPaymentCommandSchema = retiredFinanceCommandSchema.openapi("CancelPaymentCommand");
export const adjustStudentFeeCommandSchema = retiredFinanceCommandSchema.openapi("AdjustStudentFeeCommand");
export const cancelStudentFeeCommandSchema = retiredFinanceCommandSchema.openapi("CancelStudentFeeCommand");

const catalogInstallmentTemplateCommandSchema = namedObjectSchema("CatalogInstallmentTemplateCommandValue", {
  label: field.text(),
  percentage: field.positiveNumber(),
  dueDate: field.nullableDate(),
});

const oneTimeBillingTermsCommandSchema = namedObjectSchema("OneTimeBillingTermsCommandValue", {
  kind: z.literal("one_time"),
  installments: z.array(catalogInstallmentTemplateCommandSchema).optional(),
  singleDueDate: field.nullableDate(),
});

export const createCatalogServiceCommandSchema = z.object({
  id: field.id(),
  academicYearId: field.id(),
  name: field.text(),
  description: optionalText(),
  category: optionalText(),
  enrollmentMode: optionalText(),
  defaultPrice: field.positiveNumber(),
  currency: field.text(),
  billingTerms: oneTimeBillingTermsCommandSchema,
  status: optionalText(),
}).openapi("CreateCatalogServiceCommand");

export const updateCatalogServiceCommandSchema = z.object({
  id: field.id(),
  name: optionalText(),
  description: z.string().nullable().optional(),
  category: optionalText(),
  enrollmentMode: optionalText(),
  defaultPrice: field.optionalNumber(),
  billingTerms: oneTimeBillingTermsCommandSchema.optional(),
}).openapi("UpdateCatalogServiceCommand");

export const catalogServiceIdCommandSchema = z.object({
  id: field.id(),
}).openapi("CatalogServiceIdCommand");

export const enrollStudentInServiceCommandSchema = z.object({
  id: field.id(),
  studentId: field.id(),
  catalogServiceId: field.id(),
  priceOverride: field.optionalNumber(),
  dueDate: field.optionalDate(),
}).openapi("EnrollStudentInServiceCommand");

export const enrollStudentsInServiceCommandSchema = z.object({
  id: field.id(),
  catalogServiceId: field.id(),
  studentIds: z.array(field.id()).min(1).max(100),
  priceOverride: field.optionalNumber(),
  dueDate: field.optionalDate(),
}).openapi("EnrollStudentsInServiceCommand");

export const cancelServiceEnrollmentCommandSchema = z.object({
  enrollmentId: field.id(),
  reason: field.text(),
}).openapi("CancelServiceEnrollmentCommand");

export const materializeOneTimeChargeCommandSchema = z.object({
  enrollmentId: field.id(),
}).openapi("MaterializeOneTimeChargeCommand");

export const adjustStudentChargeCommandSchema = z.object({
  chargeId: field.id(),
  adjustmentAmount: field.positiveNumber(),
  reason: field.text(),
}).openapi("AdjustStudentChargeCommand");

export const waiveStudentChargeCommandSchema = z.object({
  chargeId: field.id(),
  reason: field.text(),
  waiverAmount: field.optionalNumber(),
}).openapi("WaiveStudentChargeCommand");

export const cancelStudentChargeCommandSchema = z.object({
  chargeId: field.id(),
  reason: field.text(),
}).openapi("CancelStudentChargeCommand");

const allocationTargetCommandSchema = namedObjectSchema("AllocationTargetCommandValue", {
  chargeId: field.id(),
  amount: field.positiveNumber(),
});

export const allocationPlanCommandSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("account_only") }),
  z.object({ mode: z.literal("fifo") }),
  z.object({ mode: z.literal("targeted"), targets: z.array(allocationTargetCommandSchema).min(1) }),
]).openapi("AllocationPlanCommand");

export const recordPaymentCommandSchema = z.object({
  id: field.id(),
  accountId: field.id().optional(),
  studentId: field.id().optional(),
  academicYearId: field.id().optional(),
  amount: field.positiveNumber(),
  paymentDate: field.date(),
  method: field.enumValue(PaymentMethod),
  reference: optionalText(),
  notes: optionalText(),
  allocation: allocationPlanCommandSchema.optional(),
}).openapi("RecordPaymentCommand");

export const reversePaymentCommandSchema = z.object({
  paymentId: field.id(),
  reverseAllocationIds: z.array(field.id()).optional(),
}).openapi("ReversePaymentCommand");

export const allocateAccountBalanceCommandSchema = z.object({
  id: field.id(),
  accountId: field.id(),
  allocation: allocationPlanCommandSchema,
}).openapi("AllocateAccountBalanceCommand");

export const reverseAllocationCommandSchema = z.object({
  allocationId: field.id(),
}).openapi("ReverseAllocationCommand");

export const refundAvailableBalanceCommandSchema = z.object({
  id: field.id(),
  accountId: field.id(),
  amount: field.positiveNumber(),
  paymentDate: field.date(),
  method: field.enumValue(PaymentMethod),
  reference: optionalText(),
  notes: optionalText(),
}).openapi("RefundAvailableBalanceCommand");

export const createProfilePhotoUploadCommandSchema = z.object({
  ownerKind: z.nativeEnum(AttachmentOwnerKind),
  ownerId: field.id(),
  fileName: field.string(),
  mimeType: field.string(),
  sizeBytes: field.positiveNumber(),
  attachmentId: field.id().optional(),
}).openapi("CreateProfilePhotoUploadCommand");

export const completeProfilePhotoUploadCommandSchema = objectFromSchema(attachmentSchema)
  .extend({ purpose: attachmentPurposeSchema.optional() })
  .omit({ uploadedById: true })
  .openapi("CompleteProfilePhotoUploadCommand");

export const submitStudentPhotoCommandSchema = z.object({
  requestId: field.id(),
  studentId: field.id(),
  attachmentId: field.id(),
}).openapi("SubmitStudentPhotoCommand");

export const withdrawStudentPhotoSubmissionCommandSchema = z.object({
  requestId: field.id(),
  submissionId: field.id(),
  expectedVersion: field.positiveNumber(),
}).openapi("WithdrawStudentPhotoSubmissionCommand");

export const reviewStudentPhotoCommandSchema = z.object({
  requestId: field.id(),
  submissionId: field.id(),
  expectedVersion: field.positiveNumber(),
  decision: z.enum(["approve", "reject"]),
  rejectionReason: field.optionalString(),
}).openapi("ReviewStudentPhotoCommand");

export const publishStudentPhotoCommandSchema = z.object({
  requestId: field.id(),
  studentId: field.id(),
  attachmentId: field.id(),
}).openapi("PublishStudentPhotoCommand");

export const createAnnouncementCommandSchema = objectFromSchema(announcementSchema)
  .omit({
    status: true,
    publishedAt: true,
  })
  .openapi("CreateAnnouncementCommand");

export const addTargetCommandSchema = objectFromSchema(announcementTargetSchema)
  .openapi("AddAnnouncementTargetCommand");

export const publishAnnouncementCommandSchema = z.object({
  announcementId: field.id(),
  publishedAt: field.optionalDate(),
}).openapi("PublishAnnouncementCommand");

export const recordDeliveryCommandSchema = objectFromSchema(messageDeliverySchema)
  .openapi("RecordMessageDeliveryCommand");

export const materializeDeliveriesCommandSchema = z.object({
  announcementId: field.id(),
}).openapi("MaterializeDeliveriesCommand");

export const applyDeliveryEventCommandSchema = z.object({
  deliveryId: field.id(),
  status: z.enum(["sent", "failed", "read", "cancelled"]),
  providerMessageId: field.optionalString(),
  failureReason: field.optionalString(),
  occurredAt: field.optionalDate(),
}).openapi("ApplyDeliveryEventCommand");

export const markDeliveryReadCommandSchema = z.object({
  deliveryId: field.id(),
  readAt: field.optionalDate(),
}).openapi("MarkDeliveryReadCommand");

export const updateNotificationContactCommandSchema = z.object({
  notificationEmail: field.optionalString().nullable(),
  notificationPhone: field.optionalString().nullable(),
}).openapi("UpdateNotificationContactCommand");

export const registerPushDeviceCommandSchema = z.object({
  token: z.string().min(1),
  provider: z.enum(["fcm", "apns"]).default("fcm"),
}).openapi("RegisterPushDeviceCommand");

export const unregisterPushDeviceCommandSchema = z.object({
  provider: z.enum(["fcm", "apns"]).default("fcm"),
}).openapi("UnregisterPushDeviceCommand");

export const updateSchoolNotificationTemplatesCommandSchema = z.object({
  schoolId: field.id(),
  invitationSmsEnabled: z.boolean().optional(),
  templates: z.record(z.string(), z.unknown()).optional().openapi("SchoolNotificationTemplateDocumentPatch", {
    type: "object",
    additionalProperties: true,
  }),
  expectedUpdatedAt: field.optionalDate(),
}).openapi("UpdateSchoolNotificationTemplatesCommand");

export const resetSchoolNotificationTemplatesCommandSchema = z.object({
  schoolId: field.id(),
  templateKey: z.enum(NOTIFICATION_TEMPLATE_KEYS).optional(),
}).openapi("ResetSchoolNotificationTemplatesCommand");

export const listClassSubjectAssessmentResultsForPeriodCommandSchema = z.object({
  classSubjectId: field.id(),
  periodId: field.id(),
}).openapi("ListClassSubjectAssessmentResultsForPeriodCommand");

const familyFeedbackAnswersCommandSchema = z.object({
  communication: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal("cannot_assess")]),
  clarity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal("cannot_assess")]),
  support: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal("cannot_assess")]),
  student_experience: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal("cannot_assess")]),
});

export const createFamilyFeedbackCampaignCommandSchema = z.object({
  requestId: field.id(),
  id: field.id().optional(),
  academicYearId: field.id(),
  academicPeriodId: field.id(),
  teacherAssignmentId: field.id(),
  opensAt: field.optionalDate(),
  closesAt: field.optionalDate(),
  moderatorStaffId: field.id().optional(),
}).openapi("CreateFamilyFeedbackCampaignCommand");

export const updateFamilyFeedbackCampaignCommandSchema = z.object({
  requestId: field.id(),
  id: field.id(),
  opensAt: field.optionalDate(),
  closesAt: field.optionalDate(),
}).openapi("UpdateFamilyFeedbackCampaignCommand");

export const assignFamilyFeedbackModeratorCommandSchema = z.object({
  requestId: field.id(),
  id: field.id(),
  moderatorStaffId: field.id(),
}).openapi("AssignFamilyFeedbackModeratorCommand");

export const familyFeedbackCampaignIdCommandSchema = z.object({
  requestId: field.id(),
  id: field.id(),
}).openapi("FamilyFeedbackCampaignIdCommand");

export const submitFamilyFeedbackResponseCommandSchema = z.object({
  requestId: field.id(),
  campaignId: field.id(),
  studentId: field.id(),
  answers: familyFeedbackAnswersCommandSchema,
  comment: field.optionalString(),
}).openapi("SubmitFamilyFeedbackResponseCommand");

export const saveFamilyFeedbackThemeDraftCommandSchema = z.object({
  requestId: field.id(),
  id: field.id(),
  themes: field.text(),
}).openapi("SaveFamilyFeedbackThemeDraftCommand");
