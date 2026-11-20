import { importClientBindings } from "@/lib/school-api/import-client-bindings";
import { permitsPublicSave } from "@/lib/school-api/public-operations";
import { coreCommands, coreEntities, coreQueries } from "@/lib/school-api/registry";
import { getOpenApiSchemaName } from "@/lib/school-api/schemas/schema-name";
import { X_EDAYA_QUERY_KEY, X_EDAYA_QUERY_PUBLIC_NAME, X_EDAYA_REQUEST_SCHEMA, X_EDAYA_RESPONSE_SCHEMA } from "@/lib/school-api/openapi/client-extensions";
import { conversationCountRoute } from "@/routes/conversation-count.route";
import { teacherIncidentDetailRoute, teacherIncidentsRoute } from "@/routes/teacher-incidents.route";
import { teacherLogbookRoute } from "@/routes/teacher-logbook.route";
import { guardianChildPhotoRoute, guardianPapersRoute } from "@/routes/guardian-child-profile.route";
import { classReportRosterRoute } from "@/routes/class-report-roster.route";
import { staffActivityMembersRoute } from "@/routes/staff-activity-members.route";
import { staffActivityPupilOptionsRoute } from "@/routes/staff-activity-pupil-options.route";
import { incidentLessonOptionsRoute } from "@/routes/incident-lesson-options.route";
import { activityListExportRoute, activityListRoute, activityProfileRoute } from "@/routes/staff-activity-list.route";
import { historyExportRoute, historyRoute } from "@/routes/staff-feedback-history.route";
import { guardianOccurrenceRoute } from "@/routes/guardian-occurrence.route";
import { guardianFeesRoute, guardianPaymentRoute, guardianSettlementsRoute } from "@/routes/guardian-payment.route";
import { attendanceRoute, gradeRoute } from "@/routes/student-history.route";
import { deliveryRoute, unreadRoute } from "@/routes/delivery-inbox.route";
import { guardianFeedbackRoute, staffFeedbackRoute, staffOptionsRoute, teacherFeedbackRoute } from "@/routes/family-feedback-lists.route";
import { choicesRoute, highlightsRoute } from "@/routes/guardian-home.routes";
import { overviewRoute, subjectRoute } from "@/routes/guardian-period-reads.route";
import { classRosterMembersRoute, studentDirectoryRoute } from "@/routes/student-directory.route";
import { portraitGrantsRoute } from "@/routes/student-portrait-grants.route";
import { dailyAttendanceStatusRoute } from "@/routes/teacher-daily-attendance-status.route";
import type { ClientBindingsDocument } from "@maya-invest/edaya-api-client/contract";
import { CLIENT_BINDINGS_OPENAPI_EXTENSION } from "@maya-invest/edaya-api-client/contract";

export { CLIENT_BINDINGS_OPENAPI_EXTENSION };

const manualClientRoutes: Pick<
  ClientBindingsDocument,
  "authorization" | "onboarding" | "files" | "imports" | "serviceAccounts" | "platformUsers" | "s2sClients" | "public"
> = {
  imports: importClientBindings,
  authorization: {
    teacherQuickCodeOptions: {
      method: "GET",
      path: "teachers/{teacherId}/quick-login-code",
      pathParams: ["teacherId"],
      responseSchemaName: "TeacherQuickCodeOptions",
    },
    issueTeacherQuickCode: {
      method: "POST",
      path: "teachers/{teacherId}/quick-login-code",
      pathParams: ["teacherId"],
      requestSchemaName: "TeacherQuickCodeIssue",
      responseSchemaName: "TeacherQuickCodeDelivery",
    },
    effectiveGrants: {
      method: "GET",
      path: "authorization/effective-grants",
      responseSchemaName: "EffectiveGrantsResponse",
    },
    profiles: {
      method: "GET",
      path: "authorization/profiles",
      responseSchemaName: "AuthorizationProfilesResponse",
    },
    permissionCatalog: {
      method: "GET",
      path: "authorization/permission-catalog",
      responseSchemaName: "PermissionCatalogResponse",
    },
    scopeRender: {
      method: "POST",
      path: "authorization/scope/render",
      requestSchemaName: "ScopeRenderRequest",
      responseSchemaName: "ScopeRenderResponse",
    },
    scopeSelectionsRender: {
      method: "POST",
      path: "authorization/scope-selections/render",
      requestSchemaName: "ScopeSelectionsRenderRequest",
      responseSchemaName: "ScopeSelectionsRenderResponse",
    },
  },
  onboarding: {
    listDatasets: { method: "GET", path: "onboarding/datasets", responseSchemaName: "OnboardingDatasetChoices" },
    getDataset: { method: "GET", path: "onboarding/datasets/{id}/{version}", pathParams: ["id", "version"], responseSchemaName: "OnboardingDataset" },
    registerSchool: {
      method: "POST",
      path: "onboarding/register-school",
      requestSchemaName: "OnboardingRegisterSchoolRequest",
      responseSchemaName: "School",
    },
    listStructureTemplates: {
      method: "GET",
      path: "onboarding/structure-templates",
      responseSchemaName: "OnboardingListStructureTemplatesResponse",
    },
    applyStructureTemplate: {
      method: "POST",
      path: "onboarding/apply-structure-template",
      requestSchemaName: "OnboardingApplyStructureTemplateRequest",
      responseSchemaName: "OnboardingApplyStructureTemplateResponse",
    },
    accountStatus: {
      method: "GET",
      path: "onboarding/account-status",
      responseSchemaName: "OnboardingAccountStatusResponse",
    },
    completeWizard: {
      method: "POST",
      path: "onboarding/complete-wizard",
      requestSchemaName: "OnboardingCompleteWizardRequest",
      responseSchemaName: "OnboardingAccountStatusResponse",
    },
    inviteStaffMembers: {
      method: "POST",
      path: "onboarding/invite-staff-members",
      requestSchemaName: "OnboardingInviteStaffMembersRequest",
      responseSchemaName: "OnboardingInviteStaffMembersResponse",
    },
    provision: {
      method: "POST",
      path: "onboarding/provision",
      requestSchemaName: "OnboardingProvisionRequest",
      responseSchemaName: "OnboardingProvisionResponse",
    },
  },
  files: {
    createUploadIntent: {
      method: "POST",
      path: "files/upload-intents",
      requestSchemaName: "CreateFileUploadIntentRequest",
      responseSchemaName: "CreateFileUploadIntentResponse",
    },
    getDownloadUrl: {
      method: "GET",
      path: "files/{attachmentId}/download-url",
      pathParams: ["attachmentId"],
      responseSchemaName: "FileDownloadUrlResponse",
    },
    getContent: {
      method: "GET",
      path: "files/{attachmentId}/content",
      pathParams: ["attachmentId"],
    },
  },
  serviceAccounts: {
    create: {
      method: "POST",
      path: "service-accounts",
      requestSchemaName: "CreateServiceAccountRequest",
      responseSchemaName: "CreateServiceAccountResponse",
    },
    list: {
      method: "GET",
      path: "service-accounts",
      responseSchemaName: "ServiceAccountResponse",
      responseIsArray: true,
    },
    update: {
      method: "PATCH",
      path: "service-accounts/{id}",
      pathParams: ["id"],
      requestSchemaName: "UpdateServiceAccountRequest",
      responseSchemaName: "ServiceAccountResponse",
    },
    revoke: {
      method: "POST",
      path: "service-accounts/{id}/revoke",
      pathParams: ["id"],
      responseSchemaName: "ServiceAccountResponse",
    },
    rotateKey: {
      method: "POST",
      path: "service-accounts/{id}/rotate-key",
      pathParams: ["id"],
      responseSchemaName: "RotateServiceAccountKeyResponse",
    },
  },
  platformUsers: {
    me: {
      method: "GET",
      path: "platform/me",
      responseSchemaName: "PlatformMeResponse",
    },
    list: {
      method: "GET",
      path: "platform-users",
      responseSchemaName: "PlatformUserResponse",
      responseIsArray: true,
    },
    create: {
      method: "POST",
      path: "platform-users",
      requestSchemaName: "CreatePlatformUserRequest",
      responseSchemaName: "PlatformUserResponse",
    },
    deactivate: {
      method: "POST",
      path: "platform-users/{id}/deactivate",
      pathParams: ["id"],
      responseSchemaName: "PlatformUserResponse",
    },
  },
  s2sClients: {
    list: {
      method: "GET",
      path: "s2s-clients",
      responseSchemaName: "S2sClientResponse",
      responseIsArray: true,
    },
    create: {
      method: "POST",
      path: "s2s-clients",
      requestSchemaName: "CreateS2sClientRequest",
      responseSchemaName: "CreateS2sClientResponse",
    },
    revoke: {
      method: "POST",
      path: "s2s-clients/{id}/revoke",
      pathParams: ["id"],
      responseSchemaName: "S2sClientResponse",
    },
    rotateKey: {
      method: "POST",
      path: "s2s-clients/{id}/rotate-key",
      pathParams: ["id"],
      requestSchemaName: "RotateS2sClientKeyRequest",
      responseSchemaName: "RotateS2sClientKeyResponse",
    },
  },
  public: {
    previewInvitation: {
      method: "GET",
      path: "public/invitations/{token}",
      pathParams: ["token"],
      basePath: "root",
      responseSchemaName: "InvitationPreviewResponse",
    },
    acceptInvitation: {
      method: "POST",
      path: "public/invitations/{token}/accept",
      pathParams: ["token"],
      basePath: "root",
      responseSchemaName: "AcceptInvitationResponse",
    },
    listMyInvitations: {
      method: "GET",
      path: "public/me/invitations",
      basePath: "root",
      responseSchemaName: "ListMyInvitationsResponse",
    },
    acceptMyInvitation: {
      method: "POST",
      path: "public/me/invitations/{invitationId}/accept",
      pathParams: ["invitationId"],
      basePath: "root",
      responseSchemaName: "AcceptInvitationResponse",
    },
  },
};

const dedicatedQueryRoutes = [
  teacherLogbookRoute,
  teacherIncidentsRoute,
  teacherIncidentDetailRoute,
  guardianOccurrenceRoute,
  guardianPaymentRoute,
  guardianFeesRoute,
  guardianSettlementsRoute,
  conversationCountRoute,
  attendanceRoute,
  gradeRoute,
  deliveryRoute,
  unreadRoute,
  guardianFeedbackRoute,
  staffFeedbackRoute,
  activityListRoute,
  activityListExportRoute,
  activityProfileRoute,
  guardianChildPhotoRoute,
  guardianPapersRoute,
  classReportRosterRoute,
  staffActivityMembersRoute,
  staffActivityPupilOptionsRoute,
  incidentLessonOptionsRoute,
  historyRoute,
  historyExportRoute,
  staffOptionsRoute,
  teacherFeedbackRoute,
  choicesRoute,
  highlightsRoute,
  overviewRoute,
  subjectRoute,
  classRosterMembersRoute,
  studentDirectoryRoute,
  portraitGrantsRoute,
  dailyAttendanceStatusRoute,
] as const;

export function buildClientBindings(): ClientBindingsDocument {
  return {
    entities: Object.fromEntries(
      coreEntities.map((entity) => {
        return [
          entity.serviceName,
          {
            publicName: entity.publicName,
            schemaName: getOpenApiSchemaName(entity.responseSchema),
            allowDirectSave: permitsPublicSave(entity.publicOperations),
            publicOperations: entity.publicOperations,
          },
        ];
      }),
    ),
    commands: Object.fromEntries(
      coreCommands.map((command) => {
        return [
          command.methodName,
          {
            publicName: command.publicName,
            requestSchemaName: getOpenApiSchemaName(command.requestSchema),
            responseSchemaName: getOpenApiSchemaName(command.responseSchema),
          },
        ];
      }),
    ),
    queries: {
      ...Object.fromEntries(coreQueries.map(query => [query.methodName, {
        publicName: query.publicName,
        requestSchemaName: getOpenApiSchemaName(query.requestSchema),
        responseSchemaName: getOpenApiSchemaName(query.responseSchema),
      }])),
      ...Object.fromEntries(dedicatedQueryRoutes.map(route => [route[X_EDAYA_QUERY_KEY], {
        publicName: route[X_EDAYA_QUERY_PUBLIC_NAME],
        requestSchemaName: route[X_EDAYA_REQUEST_SCHEMA],
        responseSchemaName: route[X_EDAYA_RESPONSE_SCHEMA],
        ...(route.method === "get" ? { getPath: route.path } : {}),
      }])),
    },
    ...manualClientRoutes,
  };
}
