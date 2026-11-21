import { guardianChildPhotoHandler, guardianChildPhotoQuery, guardianChildPhotoRoute, guardianPapersHandler, guardianPapersQuery, guardianPapersRoute } from "@/routes/guardian-child-profile.route";
import { classReportRosterHandler, classReportRosterQuery, classReportRosterRoute } from "@/routes/class-report-roster.route";
import { staffActivityMembersHandler, staffActivityMembersQuery, staffActivityMembersRoute } from "@/routes/staff-activity-members.route";
import { staffActivityPupilOptionsHandler, staffActivityPupilOptionsQuery, staffActivityPupilOptionsRoute } from "@/routes/staff-activity-pupil-options.route";
import { incidentLessonOptionsHandler, incidentLessonOptionsQuery, incidentLessonOptionsRoute } from "@/routes/incident-lesson-options.route";
import { activityListExportHandler, activityListExportQuery, activityListExportRoute, activityListHandler, activityListQuery, activityListRoute, activityProfileHandler, activityProfileQuery, activityProfileRoute } from "@/routes/staff-activity-list.route";
import { historyExportHandler, historyExportQuery, historyExportRoute, historyHandler, historyQuery, historyRoute } from "@/routes/staff-feedback-history.route";
import { teacherIncidentDetailHandler, teacherIncidentDetailQuery, teacherIncidentDetailRoute, teacherIncidentsHandler, teacherIncidentsQuery, teacherIncidentsRoute } from "@/routes/teacher-incidents.route";
import { logbookQuery, teacherLogbookHandler, teacherLogbookRoute } from "@/routes/teacher-logbook.route";
import { guardianOccurrenceHandler, guardianOccurrenceRoute, occurrenceQuery } from "@/routes/guardian-occurrence.route";
import { feesQuery, guardianFeesHandler, guardianFeesRoute, guardianPaymentHandler, guardianPaymentRoute, guardianSettlementsHandler, guardianSettlementsRoute, paymentQuery, settlementsQuery } from "@/routes/guardian-payment.route";
import { attendanceHandler, attendanceQuery, attendanceRoute, gradeHandler, gradeQuery, gradeRoute } from "@/routes/student-history.route";
import { deliveryHandler, deliveryQuery, deliveryRoute, unreadHandler, unreadQuery, unreadRoute } from "@/routes/delivery-inbox.route";
import { overviewHandler, overviewQuery, overviewRoute, subjectHandler, subjectQuery, subjectRoute } from "@/routes/guardian-period-reads.route";
import { portraitGrantsHandler, portraitGrantsRoute } from "@/routes/student-portrait-grants.route";
import { dailyAttendanceStatusHandler, dailyAttendanceStatusQuery, dailyAttendanceStatusRoute } from "@/routes/teacher-daily-attendance-status.route";
import { choicesHandler, choicesQuery, choicesRoute, highlightsHandler, highlightsQuery, highlightsRoute } from "@/routes/guardian-home.routes";
import { guardianFeedbackHandler, guardianFeedbackQuery, guardianFeedbackRoute, staffFeedbackHandler, staffFeedbackQuery, staffFeedbackRoute, staffOptionsHandler, staffOptionsQuery, staffOptionsRoute, teacherFeedbackHandler, teacherFeedbackQuery, teacherFeedbackRoute } from "@/routes/family-feedback-lists.route";
import { classRosterMembersHandler, classRosterMembersQuery, classRosterMembersRoute, studentDirectoryHandler, studentDirectoryQuery, studentDirectoryRoute } from "@/routes/student-directory.route";
import { conversationCountHandler, conversationCountQuery, conversationCountRoute } from "@/routes/conversation-count.route";
import quickCodes from "@/routes/teacher-quick-code.routes";
import importsRouter from "@/routes/imports.routes";
import { createRouter } from "@/http/create-app";
import { edayaSparkResolveGuardianHandler, edayaSparkResolveGuardianRoute } from "@/routes/edaya-spark-internal.routes";
import { getAuthorizationProfilesHandler, getAuthorizationProfilesRoute } from "@/routes/authorization-profiles.route";
import { getEffectiveGrantsHandler, getEffectiveGrantsRoute } from "@/routes/effective-grants.route";
import {
  getPermissionCatalogHandler,
  getPermissionCatalogRoute,
  postScopeRenderHandler,
  postScopeRenderRoute,
  postScopeSelectionsRenderHandler,
  postScopeSelectionsRenderRoute,
} from "@/routes/authorization.routes";
import {
  createServiceAccountHandler,
  createServiceAccountRoute,
  listServiceAccountsHandler,
  listServiceAccountsRoute,
  revokeServiceAccountHandler,
  revokeServiceAccountRoute,
  rotateServiceAccountKeyHandler,
  rotateServiceAccountKeyRoute,
  updateServiceAccountHandler,
  updateServiceAccountRoute,
} from "@/routes/service-accounts.routes";
import {
  createPlatformUserHandler,
  createPlatformUserRoute,
  deactivatePlatformUserHandler,
  deactivatePlatformUserRoute,
  getPlatformMeHandler,
  getPlatformMeRoute,
  listPlatformUsersHandler,
  listPlatformUsersRoute,
} from "@/routes/platform-users.routes";
import {
  createS2sClientHandler,
  createS2sClientRoute,
  listS2sClientsHandler,
  listS2sClientsRoute,
  revokeS2sClientHandler,
  revokeS2sClientRoute,
  rotateS2sClientKeyHandler,
  rotateS2sClientKeyRoute,
} from "@/routes/s2s-clients.routes";
import {
  onboardingAccountStatusHandler,
  onboardingAccountStatusRoute,
  onboardingApplyStructureTemplateHandler,
  onboardingApplyStructureTemplateRoute,
  onboardingCompleteWizardHandler,
  onboardingCompleteWizardRoute,
  onboardingGetDatasetHandler,
  onboardingGetDatasetRoute,
  onboardingInviteStaffMembersHandler,
  onboardingInviteStaffMembersRoute,
  onboardingListDatasetsHandler,
  onboardingListDatasetsRoute,
  onboardingListStructureTemplatesHandler,
  onboardingListStructureTemplatesRoute,
  onboardingProvisionHandler,
  onboardingProvisionRoute,
  onboardingRegisterSchoolHandler,
  onboardingRegisterSchoolRoute,
} from "@/routes/onboarding.routes";
import {
  acceptInvitationHandler,
  acceptInvitationRoute,
  acceptMyInvitationHandler,
  acceptMyInvitationRoute,
  invitationPreviewHandler,
  invitationPreviewRoute,
  listMyInvitationsHandler,
  listMyInvitationsRoute,
} from "@/routes/invitation.routes";
import {
  createFileUploadIntentHandler,
  createFileUploadIntentRoute,
  getFileContentHandler,
  getFileContentRoute,
  getFileDownloadUrlHandler,
  getFileDownloadUrlRoute,
  getMemoryFileHandler,
  getMemoryFileRoute,
  putMemoryFileHandler,
  putMemoryFileRoute,
} from "@/routes/file-storage.routes";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";
import { buildCoreRoutes } from "@/lib/school-api/routes";

// Index route
const router = createRouter()
  .route("/", importsRouter)
  .route("/", quickCodes)
  .openapi(
    createRoute({
      tags: ["Index"],
      method: "get",
      path: "/",
      responses: {
        [HttpStatusCodes.OK]: jsonContent(
          createMessageObjectSchema(),
          "EDaya Core API Index",
        ),
      },
    }),
    async (c) => {
      return c.json({
        message: "EDaya Core API",
      }, HttpStatusCodes.OK);
    },
  );

// Mount routes from route builders
router
  .openapi(getEffectiveGrantsRoute, getEffectiveGrantsHandler)
  .openapi(getAuthorizationProfilesRoute, getAuthorizationProfilesHandler)
  .openapi(getPermissionCatalogRoute, getPermissionCatalogHandler)
  .openapi(postScopeRenderRoute, postScopeRenderHandler)
  .openapi(postScopeSelectionsRenderRoute, postScopeSelectionsRenderHandler)
  .openapi(edayaSparkResolveGuardianRoute, edayaSparkResolveGuardianHandler)
  .openapi(onboardingRegisterSchoolRoute, onboardingRegisterSchoolHandler)
  .openapi(onboardingListStructureTemplatesRoute, onboardingListStructureTemplatesHandler)
  .openapi(onboardingListDatasetsRoute, onboardingListDatasetsHandler)
  .openapi(onboardingGetDatasetRoute, onboardingGetDatasetHandler)
  .openapi(onboardingAccountStatusRoute, onboardingAccountStatusHandler)
  .openapi(onboardingApplyStructureTemplateRoute, onboardingApplyStructureTemplateHandler)
  .openapi(onboardingCompleteWizardRoute, onboardingCompleteWizardHandler)
  .openapi(onboardingInviteStaffMembersRoute, onboardingInviteStaffMembersHandler)
  .openapi(onboardingProvisionRoute, onboardingProvisionHandler)
  .openapi(createServiceAccountRoute, createServiceAccountHandler)
  .openapi(listServiceAccountsRoute, listServiceAccountsHandler)
  .openapi(updateServiceAccountRoute, updateServiceAccountHandler)
  .openapi(revokeServiceAccountRoute, revokeServiceAccountHandler)
  .openapi(rotateServiceAccountKeyRoute, rotateServiceAccountKeyHandler)
  .openapi(getPlatformMeRoute, getPlatformMeHandler)
  .openapi(listPlatformUsersRoute, listPlatformUsersHandler)
  .openapi(createPlatformUserRoute, createPlatformUserHandler)
  .openapi(deactivatePlatformUserRoute, deactivatePlatformUserHandler)
  .openapi(listS2sClientsRoute, listS2sClientsHandler)
  .openapi(createS2sClientRoute, createS2sClientHandler)
  .openapi(revokeS2sClientRoute, revokeS2sClientHandler)
  .openapi(rotateS2sClientKeyRoute, rotateS2sClientKeyHandler)
  .openapi(listMyInvitationsRoute, listMyInvitationsHandler)
  .openapi(acceptMyInvitationRoute, acceptMyInvitationHandler)
  .openapi(invitationPreviewRoute, invitationPreviewHandler)
  .openapi(acceptInvitationRoute, acceptInvitationHandler)
  .openapi(createFileUploadIntentRoute, createFileUploadIntentHandler)
  .openapi(getFileDownloadUrlRoute, getFileDownloadUrlHandler)
  .openapi(putMemoryFileRoute, putMemoryFileHandler)
  .openapi(getMemoryFileRoute, getMemoryFileHandler)
  .openapi(getFileContentRoute, getFileContentHandler);

router.openAPIRegistry.register("UnresolvedConversationCountQuery", conversationCountQuery);
router.openapi(conversationCountRoute, conversationCountHandler);
router.openAPIRegistry.register("StudentDirectoryQuery", studentDirectoryQuery);
router.openapi(studentDirectoryRoute, studentDirectoryHandler);
router.openAPIRegistry.register("ClassRosterMembersQuery", classRosterMembersQuery);
router.openapi(classRosterMembersRoute, classRosterMembersHandler);
router.openAPIRegistry.register("GuardianHighlightsQuery", highlightsQuery);
router.openAPIRegistry.register("TeacherDailyAttendanceStatusQuery", dailyAttendanceStatusQuery);
router.openapi(dailyAttendanceStatusRoute, dailyAttendanceStatusHandler);
router.openAPIRegistry.register("GuardianChildChoicesQuery", choicesQuery);
router.openapi(highlightsRoute, highlightsHandler);
router.openapi(choicesRoute, choicesHandler);
router.openAPIRegistry.register("GuardianOccurrenceQuery", occurrenceQuery);
router.openAPIRegistry.register("TeacherLogbookQuery", logbookQuery);
router.openapi(teacherLogbookRoute, teacherLogbookHandler);
router.openAPIRegistry.register("TeacherIncidentsQuery", teacherIncidentsQuery);
router.openapi(teacherIncidentsRoute, teacherIncidentsHandler);
router.openAPIRegistry.register("TeacherIncidentDetailQuery", teacherIncidentDetailQuery);
router.openapi(teacherIncidentDetailRoute, teacherIncidentDetailHandler);
router.openapi(guardianOccurrenceRoute, guardianOccurrenceHandler);
router.openAPIRegistry.register("GuardianPaymentQuery", paymentQuery);
router.openapi(guardianPaymentRoute, guardianPaymentHandler);
router.openAPIRegistry.register("GuardianFeesQuery", feesQuery);
router.openapi(guardianFeesRoute, guardianFeesHandler);
router.openAPIRegistry.register("GuardianSettlementsQuery", settlementsQuery);
router.openapi(guardianSettlementsRoute, guardianSettlementsHandler);
router.openAPIRegistry.register("StudentGradeHistoryQuery", gradeQuery);
router.openAPIRegistry.register("StudentAttendanceHistoryQuery", attendanceQuery);
router.openapi(gradeRoute, gradeHandler);
router.openapi(attendanceRoute, attendanceHandler);
router.openAPIRegistry.register("DeliveryInboxQuery", deliveryQuery);
router.openAPIRegistry.register("UnreadConversationCountQuery", unreadQuery);
router.openapi(deliveryRoute, deliveryHandler);
router.openapi(unreadRoute, unreadHandler);
router.openAPIRegistry.register("GuardianPeriodOverviewQuery", overviewQuery);
router.openAPIRegistry.register("GuardianSubjectMarksQuery", subjectQuery);
router.openapi(overviewRoute, overviewHandler);
router.openapi(subjectRoute, subjectHandler);
router.openAPIRegistry.register("GuardianFeedbackCampaignsQuery", guardianFeedbackQuery);
router.openAPIRegistry.register("TeacherFeedbackSummariesQuery", teacherFeedbackQuery);
router.openapi(guardianFeedbackRoute, guardianFeedbackHandler);
router.openAPIRegistry.register("StaffFeedbackCampaignsQuery", staffFeedbackQuery);
router.openapi(staffFeedbackRoute, staffFeedbackHandler);
router.openAPIRegistry.register("StaffFeedbackOptionsQuery", staffOptionsQuery);
router.openapi(staffOptionsRoute, staffOptionsHandler);
router.openAPIRegistry.register("StaffActivityListQuery", activityListQuery);
router.openapi(activityListRoute, activityListHandler);
router.openAPIRegistry.register("StaffActivityListExportQuery", activityListExportQuery);
router.openapi(activityListExportRoute, activityListExportHandler);
router.openAPIRegistry.register("StaffActivityProfileQuery", activityProfileQuery);
router.openapi(activityProfileRoute, activityProfileHandler);
router.openAPIRegistry.register("GuardianChildPhotoQuery", guardianChildPhotoQuery);
router.openapi(guardianChildPhotoRoute, guardianChildPhotoHandler);
router.openAPIRegistry.register("GuardianPapersQuery", guardianPapersQuery);
router.openapi(guardianPapersRoute, guardianPapersHandler);
router.openAPIRegistry.register("ClassReportRosterQuery", classReportRosterQuery);
router.openAPIRegistry.register("StaffActivityMembersQuery", staffActivityMembersQuery);
router.openapi(classReportRosterRoute, classReportRosterHandler);
router.openapi(staffActivityMembersRoute, staffActivityMembersHandler);
router.openAPIRegistry.register("StaffActivityPupilOptionsQuery", staffActivityPupilOptionsQuery);
router.openapi(staffActivityPupilOptionsRoute, staffActivityPupilOptionsHandler);
router.openAPIRegistry.register("IncidentLessonOptionsQuery", incidentLessonOptionsQuery);
router.openapi(incidentLessonOptionsRoute, incidentLessonOptionsHandler);
router.openAPIRegistry.register("StaffFeedbackHistoryQuery", historyQuery);
router.openapi(historyRoute, historyHandler);
router.openAPIRegistry.register("StaffFeedbackHistoryExportQuery", historyExportQuery);
router.openapi(historyExportRoute, historyExportHandler);
router.openapi(teacherFeedbackRoute, teacherFeedbackHandler);
router.openapi(portraitGrantsRoute, portraitGrantsHandler);

// Mount routes from route factories
[...buildCoreRoutes()]
  .forEach(({ route, handler }) => {
    router.openapi(route, handler);
  });

export default router;
