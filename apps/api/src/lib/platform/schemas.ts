import { PlatformPermission, type PlatformUser, S2S_ACCESS_CLASSES, type S2sClient } from "@edaya/core";
import { z } from "zod";

export const platformPermissionSchema = z.nativeEnum(PlatformPermission);

export const createPlatformUserRequestSchema = z.object({
  email: z.string().trim().email(),
  permissions: z.array(platformPermissionSchema).min(1).optional(),
}).openapi("CreatePlatformUserRequest");

export const platformUserResponseSchema = z.object({
  id: z.string(),
  subjectId: z.string(),
  email: z.string().email(),
  permissions: z.array(platformPermissionSchema),
  isActive: z.boolean(),
  createdBySubjectId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).openapi("PlatformUserResponse");

export const platformMeResponseSchema = z.object({
  kind: z.literal("platform"),
  actorId: z.string(),
  subjectId: z.string(),
  email: z.string().email(),
  permissions: z.array(platformPermissionSchema),
  assuranceLevel: z.enum(["standard", "verified", "strong", "service"]),
}).openapi("PlatformMeResponse");

export const createS2sClientRequestSchema = z.object({
  schoolId: z.string().trim().min(1),
  clientId: z.string().trim().min(1),
  accessClass: z.enum(S2S_ACCESS_CLASSES),
  apiKey: z.string().trim().min(1).optional(),
}).openapi("CreateS2sClientRequest");

export const s2sClientResponseSchema = z.object({
  id: z.string(),
  schoolId: z.string(),
  clientId: z.string(),
  accessClass: z.enum(S2S_ACCESS_CLASSES),
  keyPrefix: z.string(),
  createdBySubjectId: z.string(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  revokedAt: z.string().datetime().optional(),
  lastUsedAt: z.string().datetime().optional(),
  isActive: z.boolean(),
}).openapi("S2sClientResponse");

export const createS2sClientResponseSchema = s2sClientResponseSchema.extend({
  apiKey: z.string(),
}).openapi("CreateS2sClientResponse");

export const rotateS2sClientKeyRequestSchema = z.object({
  apiKey: z.string().trim().min(1).optional(),
}).openapi("RotateS2sClientKeyRequest");

export const rotateS2sClientKeyResponseSchema = z.object({
  apiKey: z.string(),
}).openapi("RotateS2sClientKeyResponse");

export function serializePlatformUser(user: PlatformUser) {
  return {
    id: user.id,
    subjectId: user.subjectId,
    email: user.email,
    permissions: [...user.permissions],
    isActive: user.isActive,
    createdBySubjectId: user.createdBySubjectId,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function serializeS2sClient(client: S2sClient, now: Date = new Date()) {
  return {
    id: client.id,
    schoolId: client.schoolId,
    clientId: client.clientId,
    accessClass: client.accessClass,
    keyPrefix: client.keyPrefix,
    createdBySubjectId: client.createdBySubjectId,
    createdAt: client.createdAt.toISOString(),
    ...(client.expiresAt ? { expiresAt: client.expiresAt.toISOString() } : {}),
    ...(client.revokedAt ? { revokedAt: client.revokedAt.toISOString() } : {}),
    ...(client.lastUsedAt ? { lastUsedAt: client.lastUsedAt.toISOString() } : {}),
    isActive: client.isActive(now),
  };
}
