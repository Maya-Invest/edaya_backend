/** Platform-operator capabilities. Not staff `Permission` — owners must not inherit these. */
export enum PlatformPermission {
  PLATFORM_USER_READ = 'PLATFORM_USER_READ',
  PLATFORM_USER_CREATE = 'PLATFORM_USER_CREATE',
  PLATFORM_USER_DEACTIVATE = 'PLATFORM_USER_DEACTIVATE',
  S2S_CLIENT_READ = 'S2S_CLIENT_READ',
  S2S_CLIENT_CREATE = 'S2S_CLIENT_CREATE',
  S2S_CLIENT_REVOKE = 'S2S_CLIENT_REVOKE',
  S2S_CLIENT_ROTATE_KEY = 'S2S_CLIENT_ROTATE_KEY',
}

export const ALL_PLATFORM_PERMISSIONS: readonly PlatformPermission[] = Object.values(PlatformPermission)

export const S2S_ACCESS_CLASSES = ['read', 'write'] as const
export type S2sAccessClass = (typeof S2S_ACCESS_CLASSES)[number]

export function isPlatformPermission(value: string): value is PlatformPermission {
  return (ALL_PLATFORM_PERMISSIONS as readonly string[]).includes(value)
}

export function isS2sAccessClass(value: string): value is S2sAccessClass {
  return value === 'read' || value === 'write'
}
