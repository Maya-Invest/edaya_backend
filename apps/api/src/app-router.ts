import { toBetterAuthHandlerRequest } from "@/http/auth-request";
import { createRouter } from "@/http/create-app";
import type { AppBindings } from "@/http/types";
import { getEffectiveGrantsHandler, getEffectiveGrantsRoute } from "@/routes/effective-grants.route";
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
  onboardingAccountStatusHandler,
  onboardingAccountStatusRoute,
  onboardingApplyStructureTemplateHandler,
  onboardingApplyStructureTemplateRoute,
  onboardingCompleteWizardHandler,
  onboardingCompleteWizardRoute,
  onboardingInviteStaffMembersHandler,
  onboardingInviteStaffMembersRoute,
  onboardingRegisterSchoolHandler,
  onboardingRegisterSchoolRoute,
} from "@/routes/onboarding.routes";
import {
  notificationDeliveryWebhookHandler,
  notificationDeliveryWebhookRoute,
} from "@/routes/notification-delivery-webhook.routes";
import {
  acceptInvitationHandler,
  acceptInvitationRoute,
  invitationPreviewHandler,
  invitationPreviewRoute,
} from "@/routes/invitation.routes";
import {
  createFileUploadIntentHandler,
  createFileUploadIntentRoute,
  getFileContentHandler,
  getFileContentRoute,
  getFileDownloadUrlHandler,
  getFileDownloadUrlRoute,
} from "@/routes/file-storage.routes";
import { createRoute } from "@hono/zod-openapi";
import type { Context } from "hono";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";
import { buildCoreRoutes } from "@/lib/school-api/routes";

// Index route
const router = createRouter()
  .openapi(
    createRoute({
      tags: ["Index"],
      method: "get",
      path: "/",
      responses: {
        [HttpStatusCodes.OK]: jsonContent(
          createMessageObjectSchema(),
          "Edaya Core API Index",
        ),
      },
    }),
    async (c) => {
      return c.json({
        message: "Edaya Core API",
      }, HttpStatusCodes.OK);
    },
  );

// Mount routes from route builders
router
  .openapi(getEffectiveGrantsRoute, getEffectiveGrantsHandler)
  .openapi(onboardingRegisterSchoolRoute, onboardingRegisterSchoolHandler)
  .openapi(onboardingAccountStatusRoute, onboardingAccountStatusHandler)
  .openapi(onboardingApplyStructureTemplateRoute, onboardingApplyStructureTemplateHandler)
  .openapi(onboardingCompleteWizardRoute, onboardingCompleteWizardHandler)
  .openapi(onboardingInviteStaffMembersRoute, onboardingInviteStaffMembersHandler)
  .openapi(createServiceAccountRoute, createServiceAccountHandler)
  .openapi(listServiceAccountsRoute, listServiceAccountsHandler)
  .openapi(updateServiceAccountRoute, updateServiceAccountHandler)
  .openapi(revokeServiceAccountRoute, revokeServiceAccountHandler)
  .openapi(rotateServiceAccountKeyRoute, rotateServiceAccountKeyHandler)
  .openapi(notificationDeliveryWebhookRoute, notificationDeliveryWebhookHandler)
  .openapi(invitationPreviewRoute, invitationPreviewHandler)
  .openapi(acceptInvitationRoute, acceptInvitationHandler)
  .openapi(createFileUploadIntentRoute, createFileUploadIntentHandler)
  .openapi(getFileDownloadUrlRoute, getFileDownloadUrlHandler)
  .openapi(getFileContentRoute, getFileContentHandler);

// Mount routes from route factories
[...buildCoreRoutes()]
  .forEach(({ route, handler }) => {
    router.openapi(route, handler);
  });

// Mount auth routes
router
  .on(["GET", "POST"], "/auth/*", (c: Context<AppBindings>) => c.var.auth.handler(toBetterAuthHandlerRequest(c)));

export default router;
