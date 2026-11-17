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

// Mount routes from route factories
[...buildCoreRoutes()]
  .forEach(({ route, handler }) => {
    router.openapi(route, handler);
  });

export default router;
