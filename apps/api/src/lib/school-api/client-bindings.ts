import { permitsPublicSave } from "@/lib/school-api/public-operations";
import { coreCommands, coreEntities, coreQueries } from "@/lib/school-api/registry";
import { getOpenApiSchemaName } from "@/lib/school-api/schemas/schema-name";
import type { ClientBindingsDocument } from "@maya-invest/edaya-api-client/contract";
import { CLIENT_BINDINGS_OPENAPI_EXTENSION } from "@maya-invest/edaya-api-client/contract";

export { CLIENT_BINDINGS_OPENAPI_EXTENSION };

const manualClientRoutes: Pick<
  ClientBindingsDocument,
  "authorization" | "onboarding" | "files" | "serviceAccounts" | "platformUsers" | "s2sClients" | "public"
> = {
  authorization: {
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
  },
  onboarding: {
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
    queries: Object.fromEntries(
      coreQueries.map((query) => {
        return [
          query.methodName,
          {
            publicName: query.publicName,
            requestSchemaName: getOpenApiSchemaName(query.requestSchema),
            responseSchemaName: getOpenApiSchemaName(query.responseSchema),
          },
        ];
      }),
    ),
    ...manualClientRoutes,
  };
}
