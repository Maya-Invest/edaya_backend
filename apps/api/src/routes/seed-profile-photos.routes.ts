import type { Context } from "hono";
import { Buffer } from "node:buffer";
import type { AppBindings } from "@/http/types";
import { schoolApiPath } from "@/lib/school-api/routes/paths";
import { resolveLocalDevFileStorageRoot } from "@/runtime/shared/adapters/file-storage";
import { readLocalDevObject } from "@edaya/adaptor-file";
import * as HttpStatusCodes from "stoker/http-status-codes";

export const seedProfilePhotoPath = schoolApiPath("seed", "profile-photos", ":attachmentId");

function isSeedProfilePhotoRouteEnabled(nodeEnv: string | undefined): boolean {
  return nodeEnv !== "production";
}

export async function seedProfilePhotoHandler(c: Context<AppBindings>) {
  if (!isSeedProfilePhotoRouteEnabled(c.env.NODE_ENV)) {
    return c.json({ message: "Not found" }, HttpStatusCodes.NOT_FOUND);
  }

  const attachmentId = c.req.param("attachmentId");
  if (!attachmentId) {
    return c.json({ message: "Attachment not found" }, HttpStatusCodes.NOT_FOUND);
  }
  const attachment = await c.var.schoolApp.repositories.attachments.findById(attachmentId);
  if (!attachment?.storageKey) {
    return c.json({ message: "Attachment not found" }, HttpStatusCodes.NOT_FOUND);
  }

  if (c.env.RUNTIME === "local" && c.env.NODE_ENV === "development") {
    const stored = await readLocalDevObject(
      resolveLocalDevFileStorageRoot(c.env),
      attachment.storageKey,
    );
    if (!stored) {
      return c.json({ message: "Attachment not found" }, HttpStatusCodes.NOT_FOUND);
    }

    return c.newResponse(Buffer.from(stored.body), HttpStatusCodes.OK, {
      "Content-Type": stored.contentType ?? attachment.mimeType ?? "image/jpeg",
      "Cache-Control": "public, max-age=3600",
    });
  }

  const presigned = await c.var.schoolApp.fileStorage.createPresignedDownload(
    attachment.storageKey,
    { fileName: attachment.fileName },
  );

  return c.redirect(presigned.downloadUrl, HttpStatusCodes.MOVED_TEMPORARILY);
}
