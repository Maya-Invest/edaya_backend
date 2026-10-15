import type { Argument, Command, Invocation, Option } from './command-tree'

const env: Argument = { name: 'environment', choices: ['staging', 'production'] }
const target: Argument = { name: 'target', choices: ['local', 'staging', 'production'] }
const yes: Option = { description: 'Explicitly confirm the operation.', aliases: ['-y'] }
const dry: Option = { description: 'Preview without applying remote changes.' }
const nameArg: Argument = { name: 'name', pattern: /^[A-Z][A-Z0-9_]*$/ }
function confirmed({ options }: Invocation) {
  if (!options['--dry-run'] && !options['--yes'])
    throw new Error('This operation requires explicit --yes; use --dry-run to preview')
}
function leaf(path: string, description: string, extra: Partial<Command> = {}): Command {
  return { description, examples: [[`bun repo ${path}`, ...(extra.arguments ?? []).map(arg => arg.default ?? arg.choices?.[0] ?? `<${arg.name}>`), ...(extra.validate === confirmed ? ['--dry-run'] : []), ...(extra.passthrough ? ['-- bun test'] : [])].join(' ')], run: async (invocation) => {
    const { executeCommand } = await import('./execute')
    await executeCommand([...path.split(' '), ...invocation.argv])
  }, ...extra }
}
const group = (description: string, children: Record<string, Command>): Command => ({ description, children })
const checks = (names: Record<string, string>) => ({ ...leaf('check', 'Run all repository checks.'), children: Object.fromEntries(Object.entries(names).map(([name, description]) => [name, leaf(`check ${name}`, description)])) })
const tests = group('Run test suites.', Object.fromEntries(Object.entries({ unit: 'Run workspace unit tests.', tooling: 'Run the complete tooling package test suite.', integration: 'Run supervised integration suites.' }).map(([name, description]) => [name, leaf(`test ${name}`, description)])))
const emergency = leaf('ops emergency-deploy', 'Build and deploy through the emergency qualification bypass; does not migrate or seed.', { arguments: [env], options: { '--yes': { ...yes, aliases: [] }, '--dry-run': dry }, validate: confirmed, examples: ['bun repo ops emergency-deploy staging --dry-run', 'bun repo ops emergency-deploy staging --yes'] })
const ci: Record<string, Command> = {
  'verify': leaf('ci verify', 'Run repository checks, workflow lint, tooling tests, quality, builds and unit tests.'),
  'qualify': leaf('ci qualify', 'Verify, integrate, build and qualify a release.', { arguments: [env] }),
  'deploy': leaf('ci deploy', 'Deploy existing qualified release artifacts.', { arguments: [env], options: { '--dry-run': dry } }),
  'workflows': leaf('ci workflows', 'Validate workflow definitions.'),
  'setup': leaf('ci setup', 'Prepare CI tools and framework files where applicable.'),
  'archive-inputs': leaf('ci archive-inputs', 'Copy lockfile inputs into release evidence.'),
}

const seedTarget: Argument = { name: 'target', choices: ['local', 'staging'], optional: true, default: 'local' }
const seed = leaf('ops seed', 'Populate demo data while supervising background-work pauses.', {
  arguments: [seedTarget],
  options: {
    '--scope': { value: 'scope', description: 'Seed scope. Default: all.', choices: ['all', 'school', 'auth', 'auth:link', 'access', 'profile-pictures', 'service-account', 'validate', 'doctor'] },
    '--clean': { description: 'Delete school data before seeding; prompts unless --yes.' },
    '--yes': yes,
    '--repair': { description: 'Run the repair chain with --scope doctor.' },
    '--skip-profile-photos': { description: 'Skip profile-photo uploads.' },
    '--skip-attachments': { description: 'Skip fixture attachment registration.' },
    '--no-progress': { description: 'Disable interactive progress bars.' },
  },
  validate: ({ options }) => {
    if (options['--yes'] && !options['--clean'])
      throw new Error('--yes requires clean or --clean')
  },
  examples: ['bun repo ops seed', 'bun repo ops seed staging --scope doctor', 'bun repo ops seed local --clean --yes'],
  children: { clean: leaf('ops seed clean', 'Delete school data without reseeding. Stop local dev before deleting local data.', { arguments: [seedTarget], options: { '--yes': yes }, examples: ['bun repo ops seed clean local', 'bun repo ops seed clean staging --yes'] }) },
})
const client = leaf('generate client', 'Generate client/schema/bindings, or check existing artifacts with --check.', {
  options: {
    '--check': { description: 'Check for drift instead of updating artifacts.' },
    '--input': { value: 'file-or-url', description: 'Required OpenAPI input file or URL.' },
    '--client-dir': { value: 'path', description: 'Generated client package directory.' },
    '--bindings-out': { value: 'path', description: 'Generated bindings output.' },
    '--schema-out': { value: 'path', description: 'Schema types output; defaults to schema.d.ts in --client-dir.' },
    '--client-out': { value: 'path', description: 'Generated single-file client output.' },
    '--openapi-out': { value: 'path', description: 'OpenAPI artifact to compare with --check.' },
    '--repo-root': { value: 'path', description: 'Repository root for --check; defaults to the working directory.' },
    '--runtime-version': { value: 'version', description: 'Client runtime version.' },
    '--header': { value: 'Name: value', description: 'Header for fetching the input URL.', repeat: true, pattern: /^[^:]+:/ },
  },
  validate: ({ options }) => {
    if (!options['--input'])
      throw new Error('--input is required')
    const outputs = ['--client-dir', '--bindings-out', '--schema-out', '--client-out', ...(options['--check'] ? ['--openapi-out'] : [])]
    if (!outputs.some(name => options[name]))
      throw new Error('Specify --client-dir or an output artifact')
  },
  examples: ['bun repo generate client --input schema.json --client-dir package/client', 'bun repo generate client --check --input schema.json --client-dir package/client'],
})
export const commands: Command = group('Backend repository commands. Use <command> --help for details.', {
  dev: leaf('dev', 'Start the local API/auth and file services with Bun.'),
  check: checks({ 'doctor': 'Check configuration and repository layout.', 'commands': 'Check generated command documentation.', 'openapi': 'Check API/client artifact drift.', 'boundaries': 'Check package import boundaries.', 'test-naming': 'Check test naming conventions.' }),
  test: tests,
  build: leaf('build', 'Build release artifacts without deployment.', { arguments: [env] }),
  generate: group('Generate repository artifacts.', {
    openapi: leaf('generate openapi', 'Export the API schema and refresh repository clients.'),
    schema: leaf('generate schema', 'Export only the API schema.', { options: { '--output': { value: 'path', description: 'Output path. Default: tooling/repo/fixtures/openapi.json.' } } }),
    client,
    templates: leaf('generate templates', 'Precompile document templates.'),
    commands: leaf('generate commands', 'Regenerate the full command reference and saved help.'),
  }),
  ops: group('Manage data, configuration and operational state.', {
    'db': group('Manage database schemas and data.', {
      migrate: leaf('ops db migrate', 'Apply database migrations.', { arguments: [{ name: 'database', choices: ['school', 'identity'] }, target] }),
      reset: leaf('ops db reset', 'Reset school database schemas.', { arguments: [{ name: 'database', choices: ['school'] }, env], options: { '--yes': yes } }),
      wipe: leaf('ops db wipe', 'Delete identity data.', { arguments: [{ name: 'database', choices: ['identity'] }, { name: 'target', choices: ['local', 'staging'] }], options: { '--yes': yes } }),
      generate: leaf('ops db generate', 'Generate school migration files.'),
      flatten: leaf('ops db flatten', 'Replace school migration history.', { options: { '--yes': yes } }),
      browser: leaf('ops db browser', 'Open the local school database browser.', { arguments: [{ name: 'database', choices: ['school'] }] }),
    }),
    seed,
    'vars': group('Manage configuration variables.', {
      push: leaf('ops vars push', 'Merge configured variables while preserving secrets and bindings.', { arguments: [env], options: { '--dry-run': dry, '--replace-secret': { value: 'name', description: 'Explicitly replace this secret with a variable.', repeat: true, pattern: nameArg.pattern } } }),
      delete: leaf('ops vars delete', 'Delete a configuration variable.', { arguments: [env, nameArg], options: { '--dry-run': dry } }),
    }),
    'secrets': group('Manage secrets without displaying values.', {
      push: leaf('ops secrets push', 'Validate and upload configured secrets.', { arguments: [env], options: { '--dry-run': dry } }),
      list: leaf('ops secrets list', 'List secret names.', { arguments: [env] }),
      delete: leaf('ops secrets delete', 'Delete a secret.', { arguments: [env, nameArg], options: { '--dry-run': dry } }),
    }),
    ...Object.fromEntries(['pause', 'resume'].map(action => [action, leaf(`ops ${action}`, `${action === 'pause' ? 'Enable' : 'Disable'} selected pause controls.`, { arguments: [{ name: 'control', choices: ['api', 'scheduler', 'jobs', 'all'] }, target], options: { '--dry-run': dry } })])),
    'status': leaf('ops status', 'Inspect operational state without exposing credentials.', { arguments: [target] }),
    'smoke': group('Run explicit live smoke checks.', {
      api: leaf('ops smoke api', 'Exercise the staging API.', { arguments: [{ name: 'environment', choices: ['staging'] }] }),
      notify: leaf('ops smoke notify', 'Create and publish a local notification.', { arguments: [{ name: 'environment', choices: ['local'] }] }),
      r2: leaf('ops smoke r2', 'Upload, check and delete a staging storage object.', { arguments: [{ name: 'environment', choices: ['staging'] }], options: { '--curl-only': { description: 'Print a short-lived signed upload command without uploading.' } } }),
    }),
    'reset': leaf('ops reset', 'Coordinate staging reset/reseed with pause and recovery controls.', { arguments: [{ name: 'environment', choices: ['staging'] }], options: { '--dry-run': dry, '--yes': { ...yes, aliases: [] } }, validate: confirmed }),
    'recover': leaf('ops recover', 'Resume controls left paused by staging maintenance; does not retry reset or seed.', { arguments: [{ name: 'environment', choices: ['staging'] }], options: { '--dry-run': dry, '--yes': { ...yes, aliases: [] } }, validate: confirmed }),
    'emergency-deploy': emergency,
  }),
  ci: group('Run CI verification, release and fixture operations.', {
    ...ci,
    fixture: leaf('ci fixture', 'Run a child command against disposable local services.', { arguments: [{ name: 'cwd' }], passthrough: true, examples: ['bun repo ci fixture . -- bun test tests/integration'] }),
    migrate: leaf('ci migrate', 'Migrate identity and school databases using qualified release evidence.', { arguments: [env] }),
    resolve: leaf('ci resolve', 'Emit the current source commit as a CI output.'),
    maintenance: leaf('ci maintenance', 'Run staging maintenance from MAINTENANCE_DRY_RUN, MAINTENANCE_OPERATION and MAINTENANCE_CONFIRMATION workflow inputs.'),
  }),
})

export const removedCommands: Record<string, string> = {
  maintenance: 'bun repo ops <command>',
  doctor: 'bun repo check doctor',
  verify: 'bun repo ci verify (or ci qualify <environment> for full qualification)',
  deploy: 'bun repo ops emergency-deploy <environment>',
}

Object.assign(removedCommands, {
  'generate codegen': 'bun repo generate client [--check] <options>',
  'generate openapi-export': 'bun repo generate schema',
  'ops reset-staging': 'bun repo ops reset staging (or ops recover staging)',
  'ops reset --recover': 'bun repo ops recover staging',
  'ops seed --staging': 'bun repo ops seed staging',
  'ops seed clean --staging': 'bun repo ops seed clean staging',
  'seed': 'bun repo ops seed [local|staging]',
  'db': 'bun repo ops db <command>',
  'smoke': 'bun repo ops smoke <command>',
  'smoke-test': 'bun repo ops smoke api staging',
  'codegen': 'bun repo generate client [--check] <options>',
  'openapi': 'bun repo generate openapi (or generate schema)',
  'identity-migrate': 'bun repo ops db migrate identity <target>',
  'identity-wipe': 'bun repo ops db wipe identity <target>',
  ...Object.fromEntries(['vars', 'secrets', 'pause', 'resume', 'status'].map(name => [name, `bun repo ops ${name}`])),
})
