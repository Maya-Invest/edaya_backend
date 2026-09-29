export function assertStagingFixtureTarget(databaseUrl: string, expectedHost: string): void {
  const target = new URL(databaseUrl)
  if (!expectedHost || target.hostname !== expectedHost || target.hostname.includes('-pooler')
    || !['postgres:', 'postgresql:'].includes(target.protocol)
    || target.pathname !== '/edaya_identity' || target.username !== 'edaya_identity') {
    throw new Error('Fixture provisioning requires the explicit staging host and dedicated identity database/role')
  }
}
