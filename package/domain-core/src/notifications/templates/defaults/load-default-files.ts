import { resolve } from 'node:path'

const DEFAULTS_ROOT = resolve(import.meta.dirname, '.')

async function readDefaultFile(relativePath: string): Promise<string> {
  const path = resolve(DEFAULTS_ROOT, relativePath)
  return (await Bun.file(path).text()).trim()
}

/** Account invitation copy — single source of truth on disk for the platform default slice. */
export async function loadAccountInvitationDefaultFiles(): Promise<{
  subject: string
  body: string
}> {
  const [subject, body] = await Promise.all([
    readDefaultFile('subjects/account-invitation.txt'),
    readDefaultFile('emails/account-invitation.html'),
  ])
  return { subject, body }
}
