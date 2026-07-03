import { Permission } from "@edaya/core";
import { z } from "zod";
import { scopeGrantResponseSchema } from "@/lib/school-api/schemas/entities";

export const serviceAccountPermissionAssignmentRequestSchema = z.object({
  permission: z.nativeEnum(Permission),
  scopeIds: z.string(),
  academicYearId: z.string().trim().min(1),
}).openapi("ServiceAccountPermissionAssignmentRequest");

export const createServiceAccountRequestSchema = z.object({
  serviceId: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  /** @deprecated Prefer permissionAssignments */
  roleIds: z.array(z.string().trim().min(1)).optional(),
  scopeGrants: z.array(scopeGrantResponseSchema).optional(),
  permissionAssignments: z.array(serviceAccountPermissionAssignmentRequestSchema).optional(),
  elevated: z.boolean().optional(),
  apiKey: z.string().trim().min(1).optional(),
}).refine(
  data => data.elevated === true
    || (data.roleIds !== undefined && data.roleIds.length > 0)
    || (data.permissionAssignments !== undefined && data.permissionAssignments.length > 0),
  { message: "roleIds or permissionAssignments are required unless elevated" },
).openapi("CreateServiceAccountRequest");

export const updateServiceAccountRequestSchema = z.object({
  displayName: z.string().trim().min(1).optional(),
  /** @deprecated Prefer permissionAssignments */
  roleIds: z.array(z.string().trim().min(1)).min(1).optional(),
  scopeGrants: z.array(scopeGrantResponseSchema).optional(),
  permissionAssignments: z.array(serviceAccountPermissionAssignmentRequestSchema).optional(),
}).refine(
  data => data.displayName !== undefined
    || data.roleIds !== undefined
    || data.scopeGrants !== undefined
    || data.permissionAssignments !== undefined,
  { message: "At least one field must be provided" },
).openapi("UpdateServiceAccountRequest");

export const serviceAccountResponseSchema = z.object({
  id: z.string(),
  schoolId: z.string(),
  serviceId: z.string(),
  displayName: z.string(),
  accountKind: z.literal("service"),
  serviceElevated: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
}).openapi("ServiceAccountResponse");

export const createServiceAccountResponseSchema = serviceAccountResponseSchema.extend({
  apiKey: z.string(),
}).openapi("CreateServiceAccountResponse");

export const rotateServiceAccountKeyResponseSchema = z.object({
  apiKey: z.string(),
}).openapi("RotateServiceAccountKeyResponse");

export function serializeServiceAccount(staffMember: {
  id: string;
  schoolId: string;
  serviceId?: string;
  firstName: string;
  lastName: string;
  serviceElevated: boolean;
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: staffMember.id,
    schoolId: staffMember.schoolId,
    serviceId: staffMember.serviceId!,
    displayName: `${staffMember.firstName} ${staffMember.lastName}`.trim(),
    accountKind: "service" as const,
    serviceElevated: staffMember.serviceElevated,
    isActive: staffMember.isActive,
    createdAt: staffMember.createdAt.toISOString(),
  };
}
