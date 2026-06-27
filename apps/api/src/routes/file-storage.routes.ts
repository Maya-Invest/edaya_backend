import type { AppRouteHandler } from "@/http/types";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import { coreRouteErrorResponses, validatedJson, validatedParam } from "@/lib/school-api/routes/shared";
import { schoolApiPath } from "@/lib/school-api/routes/paths";
import {
  Attachment,
  AttachmentOwnerKind,
  AttachmentStatus,
  assertUploadPolicyAllowed,
  buildStorageKey,
  BusinessRuleViolationError,
  isInteractiveActor,
  Permission,
  permissionAction,
  validateAttachmentSave,
} from "@edaya/core";
import { createRoute, z } from "@hono/zod-openapi";
import { randomUUID } from "node:crypto";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

const commandMessageSchema = createMessageObjectSchema();

const uploadIntentRequestSchema = z.object({
  ownerKind: z.nativeEnum(AttachmentOwnerKind),
  ownerId: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  attachmentId: z.string().min(1).optional(),
}).openapi("CreateFileUploadIntentRequest");

const uploadIntentResponseSchema = z.object({
  attachmentId: z.string(),
  storageKey: z.string(),
  uploadUrl: z.string().url(),
  expiresAt: z.coerce.date(),
  headers: z.record(z.string()).optional(),
  status: z.literal('pending_upload'),
}).openapi("CreateFileUploadIntentResponse");

const downloadUrlResponseSchema = z.object({
  downloadUrl: z.string().url(),
  expiresAt: z.coerce.date(),
}).openapi("FileDownloadUrlResponse");

export const createFileUploadIntentRoute = createRoute({
  method: "post",
  path: schoolApiPath("files", "upload-intents"),
  tags: ["Files"],
  summary: "Create a presigned upload URL for a new attachment",
  request: {
    body: jsonContent(uploadIntentRequestSchema, "Upload intent payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(uploadIntentResponseSchema, "Presigned upload intent"),
    ...coreRouteErrorResponses,
  },
});

export const getFileDownloadUrlRoute = createRoute({
  method: "get",
  path: schoolApiPath("files", "{attachmentId}", "download-url"),
  tags: ["Files"],
  summary: "Create a presigned download URL for an attachment",
  request: {
    params: z.object({
      attachmentId: z.string().min(1),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(downloadUrlResponseSchema, "Presigned download URL"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(commandMessageSchema, "Attachment not found"),
    ...coreRouteErrorResponses,
  },
});

export const createFileUploadIntentHandler: AppRouteHandler<typeof createFileUploadIntentRoute> = async (c) => {
  const actor = c.var.actor;
  if (!actor) {
    return unauthorizedResponse(c);
  }

  try {
    const body = validatedJson(c) as z.infer<typeof uploadIntentRequestSchema>;
    await permissionAction(Permission.ATTACHMENT_CONFIGURE)(actor);
    assertUploadPolicyAllowed({
      ownerKind: body.ownerKind,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
    });

    const attachmentId = body.attachmentId ?? `att-${randomUUID()}`;
    const storageKey = buildStorageKey({
      schoolId: actor.schoolId,
      purpose: "uploads",
      ownerKind: body.ownerKind,
      ownerId: body.ownerId,
      attachmentId,
      fileName: body.fileName,
    });

    await validateAttachmentSave(
      new Attachment({
        id: attachmentId,
        schoolId: actor.schoolId,
        ownerKind: body.ownerKind,
        ownerId: body.ownerId,
        fileName: body.fileName,
        storageKey,
        status: AttachmentStatus.PendingUpload,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
        uploadedById: isInteractiveActor(actor) ? actor.actorId : undefined,
      }),
      undefined,
      c.var.schoolApp.repositories,
    );

    const presigned = await c.var.schoolApp.fileStorage.createPresignedUpload({
      key: storageKey,
      contentType: body.mimeType,
      sizeBytes: body.sizeBytes,
    });

    return c.json({
      attachmentId,
      storageKey,
      uploadUrl: presigned.uploadUrl,
      expiresAt: presigned.expiresAt.toISOString(),
      headers: presigned.headers,
      status: 'pending_upload' as const,
    }, HttpStatusCodes.OK);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};

export const getFileDownloadUrlHandler: AppRouteHandler<typeof getFileDownloadUrlRoute> = async (c) => {
  const actor = c.var.actor;
  if (!actor) {
    return unauthorizedResponse(c);
  }

  try {
    const { attachmentId } = validatedParam(c) as { attachmentId: string };
    await permissionAction(Permission.ATTACHMENT_READ)(actor);

    const attachment = await c.var.schoolApp.repositories.attachments.findById(attachmentId);
    if (!attachment || attachment.schoolId !== actor.schoolId) {
      return c.json({ message: "Attachment not found" }, HttpStatusCodes.NOT_FOUND);
    }

    if (!attachment.storageKey) {
      if (attachment.fileUrl) {
        return c.json({
          downloadUrl: attachment.fileUrl,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        }, HttpStatusCodes.OK);
      }
      throw new BusinessRuleViolationError(
        "ATTACHMENT_STORAGE_KEY_MISSING",
        "Attachment has no storage key",
      );
    }

    const presigned = await c.var.schoolApp.fileStorage.createPresignedDownload(
      attachment.storageKey,
      { fileName: attachment.fileName },
    );

    return c.json({
      downloadUrl: presigned.downloadUrl,
      expiresAt: presigned.expiresAt.toISOString(),
    }, HttpStatusCodes.OK);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};
