import type { AppRouteHandler } from "@/http/types";
import { Buffer } from "node:buffer";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import type { Environment } from "@/runtime/shared/env/schema";
import { coreRouteErrorResponses, validatedJson, validatedParam } from "@/lib/school-api/routes/shared";
import { clientRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { schoolApiPath } from "@/lib/school-api/routes/paths";
import { Attachment, AttachmentOwnerKind, AttachmentStatus, BusinessRuleViolationError } from "@edaya/core";
import { AttachmentOperations, isInteractiveActor, operationModule } from "@edaya/authorization";
import { allowsPublicInlineAttachmentContent, assertUploadPolicyAllowed, buildStorageKey, validateAttachmentSave } from "@edaya/service";
import { createRoute, z } from "@hono/zod-openapi";
import { randomUUID } from "node:crypto";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";
import { readLocalDevStoredObject } from "@/runtime/shared/adapters/local-dev-file-storage";

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
  status: z.literal("pending_upload"),
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
  ...clientRouteOperation({
    namespace: "files",
    clientKey: "createUploadIntent",
    path: "files/upload-intents",
    requestSchemaName: "CreateFileUploadIntentRequest",
    responseSchemaName: "CreateFileUploadIntentResponse",
  }),
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
  ...clientRouteOperation({
    namespace: "files",
    clientKey: "getDownloadUrl",
    path: "files/{attachmentId}/download-url",
    pathParams: ["attachmentId"],
    responseSchemaName: "FileDownloadUrlResponse",
  }),
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

export const getFileContentRoute = createRoute({
  method: "get",
  path: schoolApiPath("files", "{attachmentId}", "content"),
  tags: ["Files"],
  summary: "Redirect to a presigned download URL for attachment content",
  ...clientRouteOperation({
    namespace: "files",
    clientKey: "getContent",
    path: "files/{attachmentId}/content",
    pathParams: ["attachmentId"],
  }),
  request: {
    params: z.object({
      attachmentId: z.string().min(1),
    }),
  },
  responses: {
    [HttpStatusCodes.MOVED_TEMPORARILY]: {
      description: "Redirect to presigned object storage URL",
    },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(commandMessageSchema, "Attachment not found"),
    ...coreRouteErrorResponses,
  },
});

export const putMemoryFileRoute = createRoute({
  method: "put",
  path: schoolApiPath("files", "memory", "{storageKey}"),
  tags: ["Files"],
  summary: "Upload bytes to local in-memory object storage (dev without R2)",
  request: {
    params: z.object({
      storageKey: z.string().min(1),
    }),
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: "Object stored",
    },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(commandMessageSchema, "Not available"),
    ...coreRouteErrorResponses,
  },
});

export const getMemoryFileRoute = createRoute({
  method: "get",
  path: schoolApiPath("files", "memory", "{storageKey}"),
  tags: ["Files"],
  summary: "Download bytes from local in-memory object storage (dev without R2)",
  request: {
    params: z.object({
      storageKey: z.string().min(1),
    }),
    query: z.object({
      fileName: z.string().optional(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: {
      description: "Stored object bytes",
    },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(commandMessageSchema, "Object not found"),
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
    await operationModule(AttachmentOperations.configure)(actor);
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
      status: "pending_upload" as const,
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
    await operationModule(AttachmentOperations.read)(actor);

    const attachment = await c.var.schoolApp.repositories.attachments.findById(attachmentId);
    if (!attachment || attachment.schoolId !== actor.schoolId) {
      return c.json({ message: "Attachment not found" }, HttpStatusCodes.NOT_FOUND);
    }

    await c.var.schoolApp.forActor(actor).baseService.authorizationPolicy.checkAttachmentAccess(actor, [attachment]);

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

function contentDispositionForAttachment(
  mimeType: string | null | undefined,
  fileName: string,
): { fileName: string; disposition: "inline" | "attachment" } {
  const inline = (mimeType ?? "").toLowerCase().startsWith("image/");
  return {
    fileName,
    disposition: inline ? "inline" : "attachment",
  };
}

function isLocalMemoryFileStorageEnabled(env: Environment): boolean {
  return env.RUNTIME === "local" || env.RUNTIME === "in-memory";
}

export const putMemoryFileHandler: AppRouteHandler<typeof putMemoryFileRoute> = async (c) => {
  if (!isLocalMemoryFileStorageEnabled(c.env)) {
    return c.json({ message: "Not Found" }, HttpStatusCodes.NOT_FOUND);
  }

  try {
    const { storageKey } = validatedParam(c) as { storageKey: string };
    const key = decodeURIComponent(storageKey);
    const body = new Uint8Array(await c.req.arrayBuffer());
    const contentType = c.req.header("content-type") ?? "application/octet-stream";

    await c.var.schoolApp.fileStorage.putObject({
      key,
      body,
      contentType,
    });

    return c.body(null, HttpStatusCodes.NO_CONTENT);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};

export const getMemoryFileHandler: AppRouteHandler<typeof getMemoryFileRoute> = async (c) => {
  if (!isLocalMemoryFileStorageEnabled(c.env)) {
    return c.json({ message: "Not Found" }, HttpStatusCodes.NOT_FOUND);
  }

  try {
    const { storageKey } = validatedParam(c) as { storageKey: string };
    const key = decodeURIComponent(storageKey);
    const stored = await readLocalDevStoredObject(c.var.schoolApp.fileStorage, key);
    if (!stored) {
      return c.json({ message: "Object not found" }, HttpStatusCodes.NOT_FOUND);
    }

    const fileName = c.req.query("fileName") ?? "file";
    const inline = stored.contentType.toLowerCase().startsWith("image/");
    return c.body(Buffer.from(stored.body), HttpStatusCodes.OK, {
      "Content-Type": stored.contentType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fileName.replace(/"/g, "")}"`,
    });
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};

export const getFileContentHandler: AppRouteHandler<typeof getFileContentRoute> = async (c) => {
  try {
    const { attachmentId } = validatedParam(c) as { attachmentId: string };
    const attachment = await c.var.schoolApp.repositories.attachments.findById(attachmentId);
    if (!attachment || attachment.status !== AttachmentStatus.Ready) {
      return c.json({ message: "Attachment not found" }, HttpStatusCodes.NOT_FOUND);
    }

    const publicInline = allowsPublicInlineAttachmentContent(attachment);
    if (!publicInline) {
      const actor = c.var.actor;
      if (!actor) {
        return unauthorizedResponse(c);
      }
      await operationModule(AttachmentOperations.read)(actor);
      if (attachment.schoolId !== actor.schoolId) {
        return c.json({ message: "Attachment not found" }, HttpStatusCodes.NOT_FOUND);
      }
      await c.var.schoolApp.forActor(actor).baseService.authorizationPolicy.checkAttachmentAccess(actor, [attachment]);
    }

    if (!attachment.storageKey) {
      if (attachment.fileUrl) {
        return c.redirect(attachment.fileUrl, HttpStatusCodes.MOVED_TEMPORARILY);
      }
      return c.json({ message: "Attachment not found" }, HttpStatusCodes.NOT_FOUND);
    }

    const presigned = await c.var.schoolApp.fileStorage.createPresignedDownload(
      attachment.storageKey,
      contentDispositionForAttachment(attachment.mimeType, attachment.fileName),
    );

    return c.redirect(presigned.downloadUrl, HttpStatusCodes.MOVED_TEMPORARILY);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};
