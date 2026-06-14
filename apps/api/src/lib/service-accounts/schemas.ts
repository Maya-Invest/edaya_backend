import { z } from "zod";
import { scopeGrantResponseSchema } from "@/lib/school-api/schemas/entities";

export const createServiceAccountRequestSchema = z.object({
  serviceId: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  roleIds: z.array(z.string().trim().min(1)).min(1),
  scopeGrants: z.array(scopeGrantResponseSchema).optional(),
  elevated: z.boolean().optional(),
}).openapi("CreateServiceAccountRequest");

export const updateServiceAccountRequestSchema = z.object({
  displayName: z.string().trim().min(1).optional(),
  roleIds: z.array(z.string().trim().min(1)).min(1).optional(),
  scopeGrants: z.array(scopeGrantResponseSchema).optional(),
}).refine(
  data => data.displayName !== undefined
    || data.roleIds !== undefined
    || data.scopeGrants !== undefined,
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
