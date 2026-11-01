import type { RuntimeBoundaryViolation } from './runtime-boundaries'

// Ignore resource identities only, never binding names or behavioral settings.
const resourcePaths = new Set([
  'name',
  'routes.*.pattern',
  'hyperdrive.*.id',
  'kv_namespaces.*.id',
  'kv_namespaces.*.preview_id',
  'queues.producers.*.queue',
  'queues.consumers.*.queue',
  'r2_buckets.*.bucket_name',
  'r2_buckets.*.preview_bucket_name',
  'd1_databases.*.database_id',
  'd1_databases.*.database_name',
])

function normalized(value: unknown, path = ''): unknown {
  if (resourcePaths.has(path))
    return '<environment-resource>'
  if (Array.isArray(value))
    return value.map(item => normalized(item, `${path}.*`))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, normalized(item, path ? `${path}.${key}` : key)]))
  }
  return value
}

export function findWorkerParityViolations(config: Record<string, unknown>): RuntimeBoundaryViolation[] {
  const { env, ...shared } = config
  const profiles = env as Record<string, Record<string, unknown>> | undefined
  if (!profiles?.staging || !profiles.prod) {
    return [{ label: 'Worker environment parity', message: 'Wrangler must declare staging and prod environments' }]
  }
  // Wrangler environment bindings do not inherit from the top-level profile.
  const inherited = Object.fromEntries(Object.entries(shared).filter(([key]) => ![
    'vars',
    'kv_namespaces',
    'send_email',
    'hyperdrive',
    'browser',
    'queues',
    'r2_buckets',
    'd1_databases',
    'durable_objects',
    'services',
    'ai',
    'analytics_engine_datasets',
    'dispatch_namespaces',
    'mtls_certificates',
    'vectorize',
    'workflows',
    'unsafe',
    'secrets_store_secrets',
  ].includes(key)))
  const staging = { ...inherited, ...profiles.staging }
  const production = { ...inherited, ...profiles.prod }
  if (typeof staging.main !== 'string' || typeof production.main !== 'string'
    || JSON.stringify(normalized(staging)) !== JSON.stringify(normalized(production))) {
    return [{ label: 'Worker environment parity', message: 'Staging and production must share entrypoint, build settings, bindings, schedules and queue behavior; only resource identities may differ' }]
  }
  return []
}
