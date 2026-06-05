import type { Permission } from './permission'
import type { PermissionDefinition } from './permission-definition'
import { buildPermissionDefinitions } from './build-permission-definitions'

/** Metadata for every permission; TypeScript enforces completeness via Record<Permission, …>. */
export const permissionDefinitions: Record<Permission, PermissionDefinition> = buildPermissionDefinitions()
