export function assertStagingFixtureTarget(databaseUrl: string, expectedHost: string, expectedDatabase: string, expectedRole: string): void {
  const target = new URL(databaseUrl)
  if (!expectedHost || target.hostname !== expectedHost || target.hostname.includes('-pooler')
    || !['postgres:', 'postgresql:'].includes(target.protocol)
    || !expectedDatabase || !expectedRole || decodeURIComponent(target.pathname.slice(1)) !== expectedDatabase || decodeURIComponent(target.username) !== expectedRole) {
    throw new Error('Fixture provisioning requires the explicit staging host and dedicated identity database/role')
  }
}
