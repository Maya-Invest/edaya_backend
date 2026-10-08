/** Public command names, syntax and effects: shared by routing, help and docs. */
export const commandCatalog = {
  'dev': { mode: 'spawn', syntax: 'dev', description: 'Start local API/auth and file service (writes local data).' },
  'seed': { mode: 'spawn', syntax: 'seed [clean] [--staging] [--scope NAME] [--clean] [--yes] [--repair] [--skip-profile-photos] [--skip-attachments] [--no-progress]', description: 'Seed local/staging data. clean deletes data; --clean prompts unless --yes. Scopes: all, school, auth, auth:link, access, profile-pictures, service-account, validate, doctor.' },
  'db': { mode: 'compound', syntax: 'db migrate <school|identity> <local|staging|production>\ndb reset school <staging|production> [--yes]\ndb wipe identity <local|staging> [--yes]\ndb generate\ndb flatten [--yes]\ndb browser school', description: 'Migrate schemas, reset school schemas, wipe Account data, generate migrations, replace migration history, or browse local school data. Legacy db migrate/reset without school remain aliases.' },
  'check': { mode: 'compound', syntax: 'check <openapi|boundaries|test-naming|commands>', description: 'Read-only artifact, import, test-name and generated command-documentation checks.' },
  'doctor': { mode: 'spawn', syntax: 'doctor', description: 'Check configuration ownership, Worker parity, environment files and repository layout.' },
  'verify': { mode: 'compound', syntax: 'verify [--ci|--full]', description: 'Default: repository hygiene. --ci: workflow lint, quality/build/unit checks and both Worker builds. --full: --ci plus all backend integrations (requires pg_config).' },
  'smoke': { mode: 'compound', syntax: 'smoke api staging\nsmoke notify local\nsmoke r2 staging [--curl-only]', description: 'Explicit live checks: API exercises staging; notify creates/publishes an announcement; R2 uploads, checks and deletes an object. --curl-only prints a short-lived signed upload command without uploading.' },
  'vars': { mode: 'compound', syntax: 'vars push api <staging|production> [--dry-run] [--replace-secret NAME]...\nvars delete api <staging|production> NAME [--dry-run]', description: 'Merge config or explicitly delete variables; preserves secrets and resource bindings. Requires Cloudflare account/token.' },
  'secrets': { mode: 'compound', syntax: 'secrets push api <staging|production> [--dry-run]\nsecrets list api <staging|production>\nsecrets delete api <staging|production> NAME [--dry-run]', description: 'Validate and upload the selected private secrets JSON, list names, or delete one secret. Never displays values. Requires Cloudflare account/token.' },
  'pause': { mode: 'compound', syntax: 'pause <api|scheduler|jobs|all> <staging|production> [--dry-run]', description: 'Enable only the selected pause controls through a settings-only update.' },
  'resume': { mode: 'compound', syntax: 'resume <api|scheduler|jobs|all> <staging|production> [--dry-run]', description: 'Disable only the selected pause controls through a settings-only update.' },
  'status': { mode: 'compound', syntax: 'status api <staging|production>', description: 'Read Worker deployment versions and pause controls; no configuration or credential values are printed.' },
  'deploy': { mode: 'compound', syntax: 'deploy api <staging|production> [--dry-run]', description: 'Code-only Worker deployment; --dry-run builds without deploying. Does not migrate, seed, apply config, or coordinate a release.' },
  'openapi': { mode: 'compound', syntax: 'openapi export [--output PATH]\nopenapi generate', description: 'Export the OpenAPI fixture, or export and regenerate repository client artifacts.' },
  'codegen': { mode: 'spawn', syntax: 'codegen <generate|check> --input <file|url> [--client-dir PATH] [--schema-out PATH] [--bindings-out PATH] [--client-out PATH] [--openapi-out PATH] [--repo-root PATH] [--runtime-version VERSION] [--header "Name: value"]', description: 'Low-level client generation or drift checking. Detailed option combinations: bun repo codegen --help.' },
  'smoke-test': { mode: 'compound', syntax: 'smoke-test <staging|notify|r2> [--curl-only]', description: 'Compatibility alias: staging → smoke api staging; notify → smoke notify local; r2 → smoke r2 staging.' },
  'identity-migrate': { mode: 'spawn', syntax: 'identity-migrate [local|staging|production]', description: 'Compatibility alias for db migrate identity. Without a target, requires exactly one configured database URL; explicit targets are preferred.' },
  'identity-wipe': { mode: 'spawn', syntax: 'identity-wipe <local|staging> [--yes]', description: 'Compatibility alias for db wipe identity; omitted target retains local behavior.' },
} as const

export type RepoCliCommand = keyof typeof commandCatalog
export type CommandsWithMode<M extends 'spawn' | 'compound'> = { [K in RepoCliCommand]: typeof commandCatalog[K]['mode'] extends M ? K : never }[RepoCliCommand]
export function commandUsage(command: RepoCliCommand): string {
  const definition = commandCatalog[command]
  return `${definition.syntax.split('\n').map(line => `Usage: bun repo ${line}`).join('\n')}\n\n${definition.description}`
}
export function commandMarkdown(): string {
  return ['| Command | Behavior |', '| --- | --- |', ...Object.values(commandCatalog).map(c => `| ${c.syntax.split('\n').map(s => `\`${s.replaceAll('|', '\\|')}\``).join('<br>')} | ${c.description.replaceAll('|', '\\|')} |`)].join('\n')
}
