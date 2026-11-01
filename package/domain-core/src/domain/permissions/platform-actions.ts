import { Permission } from './permission'

export const ALL_PLATFORM_PERMISSIONS = [
  Permission.PLATFORM_USER_READ,
  Permission.PLATFORM_USER_MANAGE,
  Permission.S2S_CLIENT_READ,
  Permission.S2S_CLIENT_MANAGE,
] as const

export type PlatformAction = typeof ALL_PLATFORM_PERMISSIONS[number]

export function isPlatformPermission(value: string): value is PlatformAction {
  return (ALL_PLATFORM_PERMISSIONS as readonly string[]).includes(value)
}

export const S2S_ACCESS_CLASSES = ['read', 'write'] as const
export type S2sAccessClass = (typeof S2S_ACCESS_CLASSES)[number]

export function isS2sAccessClass(value: string): value is S2sAccessClass {
  return value === 'read' || value === 'write'
}
