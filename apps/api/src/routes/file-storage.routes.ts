import { AttachmentOwnerKind, AttachmentStatus } from "@edaya/core";
import type { AppRouteHandler } from "@/http/types";
import { Buffer } from "node:buffer";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import type { Environment } from "@/runtime/shared/env/schema";
import { coreRouteErrorResponses, validatedJson, validatedParam } from "@/lib/school-api/routes/shared";
import { clientRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { schoolApiPath } from "@/lib/school-api/routes/paths";
import { createAttachmentUpload, grantAttachmentDownload, loadAttachmentAsset, receiveAttachmentUpload, resolveAttachmentReadPolicy } from "@edaya/service";
import { createRoute, z } from "@hono/zod-openapi";
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
}).strict().openapi("CreateFileUploadIntentRequest");

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
    const presigned = await createAttachmentUpload(c.var.schoolApp.forActor(actor).baseService, body);
    const { attachmentId, storageKey } = presigned;

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

    const base = c.var.schoolApp.forActor(actor).baseService;
    const access = await resolveAttachmentReadPolicy(base, attachmentId);
    const presigned = await grantAttachmentDownload(base, attachmentId, { access });
    if (!presigned) {
      return c.json({ message: "Attachment not found" }, HttpStatusCodes.NOT_FOUND);
    }
    c.header("Cache-Control", "private, no-store");
    c.header("Vary", "Authorization");

    return c.json({
      downloadUrl: presigned.downloadUrl,
      expiresAt: presigned.expiresAt.toISOString(),
    }, HttpStatusCodes.OK);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};

function isLocalMemoryFileStorageEnabled(env: Environment): boolean {
  return env.RUNTIME === "local" || env.RUNTIME === "in-memory";
}

/** HTTP headers are Latin-1; keep an ASCII filename= fallback and RFC 5987 filename*. */
export function contentDisposition(fileName: string, inline: boolean): string {
  const ascii = fileName.replace(/[^\u0020-\u007E]/g, "-").replaceAll("\"", "");
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export const putMemoryFileHandler: AppRouteHandler<typeof putMemoryFileRoute> = async (c) => {
  if (!isLocalMemoryFileStorageEnabled(c.env)) {
    return c.json({ message: "Not Found" }, HttpStatusCodes.NOT_FOUND);
  }

  try {
    const { storageKey } = validatedParam(c) as { storageKey: string };
    const key = decodeURIComponent(storageKey);
    const received = await receiveAttachmentUpload(c.var.schoolApp, {
      storageKey: key,
      contentType: c.req.header("content-type") ?? "application/octet-stream",
      body: c.req.raw.body,
    });
    if (!received) {
      return c.json({ message: "Upload not found" }, HttpStatusCodes.NOT_FOUND);
    }

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

  if (!c.var.actor) {
    return unauthorizedResponse(c);
  }

  try {
    const base = c.var.schoolApp.forActor(c.var.actor).baseService;
    const { storageKey } = validatedParam(c) as { storageKey: string };
    const key = decodeURIComponent(storageKey);
    const attachment = await base.repositories.attachments.forSchool!(base.actor.schoolId).findOne({ storageKey: key });
    if (!attachment || attachment.status !== AttachmentStatus.Ready) {
      return c.json({ message: "Attachment not found" }, HttpStatusCodes.NOT_FOUND);
    }
    const access = await resolveAttachmentReadPolicy(base, attachment.id);
    const stored = await loadAttachmentAsset(base, {
      attachmentId: attachment.id,
      ownerKind: attachment.ownerKind,
      ownerId: attachment.ownerId,
      maxBytes: attachment.sizeBytes!,
      allowedMimeTypes: [attachment.mimeType!],
      access,
    });

    const inline = (stored.contentType ?? "application/octet-stream").toLowerCase().startsWith("image/");
    return c.body(Buffer.from(stored.body), HttpStatusCodes.OK, {
      "Cache-Control": "private, no-store",
      "Vary": "Authorization",
      "Content-Type": stored.contentType ?? "application/octet-stream",
      "Content-Disposition": contentDisposition(attachment.fileName, inline),
    });
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};

export const getFileContentHandler: AppRouteHandler<typeof getFileContentRoute> = async (c) => {
  if (!c.var.actor) {
    return unauthorizedResponse(c);
  }
  try {
    const { attachmentId } = validatedParam(c) as { attachmentId: string };
    const base = c.var.schoolApp.forActor(c.var.actor).baseService;
    const access = await resolveAttachmentReadPolicy(base, attachmentId);
    const presigned = await grantAttachmentDownload(base, attachmentId, { inlineImages: true, access });
    if (!presigned) {
      return c.json({ message: "Attachment not found" }, HttpStatusCodes.NOT_FOUND);
    }
    c.header("Cache-Control", "private, no-store");
    c.header("Vary", "Authorization");

    return c.redirect(presigned.downloadUrl, HttpStatusCodes.MOVED_TEMPORARILY);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};
