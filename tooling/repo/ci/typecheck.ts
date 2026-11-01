import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import process from 'node:process'
import * as ts from 'typescript'
import { root, run, verificationPhase, writeJson } from '../ops/runtime'

const combinedProject = 'tooling/integration-tests/tsconfig.json'
const absorbedProjects = ['apps/api/tsconfig.json', 'tooling/repo/tsconfig.api-tools.json']

export function readProject(project: string, directory = root): ts.ParsedCommandLine {
  const parsed = ts.getParsedCommandLineOfConfigFile(resolve(directory, project), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => { throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')) },
  })
  if (!parsed || parsed.errors.length)
    throw new Error(`Invalid type-check project: ${project}`)
  return parsed
}

/** Consolidation is allowed only with identical diagnostics and a superset of roots. */
export function assertProjectCoverage(original: ts.ParsedCommandLine, combined: ts.ParsedCommandLine): void {
  const roots = new Set(combined.fileNames)
  if (original.fileNames.some(file => !roots.has(file)))
    throw new Error('Combined type check omits original root files')
  const placement = new Set(['configFilePath', 'rootDir', 'paths', 'pathsBasePath', 'rewriteRelativeImportExtensions'])
  for (const key of new Set([...Object.keys(original.options), ...Object.keys(combined.options)])) {
    if (!placement.has(key) && JSON.stringify(original.options[key]) !== JSON.stringify(combined.options[key]))
      throw new Error(`Combined type check changes compiler option: ${key}`)
  }
  const targets = (options: ts.CompilerOptions, values: string[]) => {
    const base = options.baseUrl ?? options.pathsBasePath
    if (typeof base !== 'string')
      throw new Error('Cannot validate compiler alias base')
    return values.map(value => resolve(base, value))
  }
  for (const [alias, values] of Object.entries(original.options.paths ?? {})) {
    const replacement = combined.options.paths?.[alias]
    if (!replacement || JSON.stringify(targets(original.options, values)) !== JSON.stringify(targets(combined.options, replacement)))
      throw new Error(`Combined type check changes alias: ${alias}`)
  }
}

export function typecheckPlan(directory = root): { projects: string[], preparations: { cwd: string, command: string[] }[] } {
  const projects: string[] = []
  const preparations: { cwd: string, command: string[] }[] = []
  const manifest = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8')) as { workspaces: string[] }
  for (const workspace of manifest.workspaces) {
    for (const path of new Bun.Glob(`${workspace}/package.json`).scanSync({ cwd: directory, onlyFiles: true })) {
      const pkg = JSON.parse(readFileSync(resolve(directory, path), 'utf8')) as { scripts?: { check?: string } }
      if (!pkg.scripts?.check)
        continue
      for (const part of pkg.scripts.check.split('&&').map(value => value.trim())) {
        if (dirname(path) === 'package/adaptor-docs' && part === 'bun scripts/precompile-templates.ts --check') {
          preparations.push({ cwd: dirname(path), command: ['bun', 'scripts/precompile-templates.ts', '--check'] })
          continue
        }
        const compiler = /^bun x --bun tsc --noEmit(?: -p (\S+))?$/.exec(part)
        if (!compiler)
          throw new Error(`Unrecognized check command in ${path}: ${part}`)
        projects.push(relative(directory, resolve(directory, dirname(path), compiler[1] ?? 'tsconfig.json')))
      }
    }
  }
  if (!projects.includes(combinedProject) || absorbedProjects.some(project => !projects.includes(project)))
    throw new Error('Missing API type-check owner')
  const combined = readProject(combinedProject, directory)
  for (const project of absorbedProjects)
    assertProjectCoverage(readProject(project, directory), combined)
  if (new Set(projects).size !== projects.length)
    throw new Error('Duplicate compiler project')
  return { projects: projects.filter(project => !absorbedProjects.includes(project)).sort(), preparations }
}

export async function typecheck(): Promise<void> {
  const { projects, preparations } = typecheckPlan()
  const concurrency = Number(process.env.EDAYA_TYPECHECK_CONCURRENCY ?? 2)
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4)
    throw new Error('EDAYA_TYPECHECK_CONCURRENCY must be between 1 and 4')
  for (const preparation of preparations)
    await verificationPhase(`type preparation ${preparation.cwd}`, () => run(preparation.command, { cwd: resolve(root, preparation.cwd) }))
  const queue = [...projects]
  const results: { project: string, status: string, durationMs: number }[] = []
  const failures: unknown[] = []
  await Promise.all(Array.from({ length: concurrency }, async () => {
    for (let project = queue.shift(); project; project = queue.shift()) {
      const started = performance.now()
      const report = { project, status: 'failed', durationMs: 0 }
      try {
        const buildInfo = resolve(root, '.cache/quality/types', `${project.replaceAll('/', '_')}.tsbuildinfo`)
        mkdirSync(dirname(buildInfo), { recursive: true })
        await verificationPhase(`types ${project}`, () => run([process.execPath, resolve(root, 'node_modules/typescript/bin/tsc'), '--project', resolve(root, project), '--noEmit', '--incremental', '--tsBuildInfoFile', buildInfo]))
        report.status = 'passed'
      }
      catch (error) { failures.push(error) }
      finally {
        report.durationMs = performance.now() - started
        results.push(report)
      }
    }
  }))
  writeJson(resolve(root, '.ci-evidence/quality-details/typechecks.json'), { concurrency, projects: results.sort((a, b) => a.project.localeCompare(b.project)) })
  if (failures.length)
    throw new AggregateError(failures, 'Workspace type checking failed')
}

if (import.meta.main)
  await typecheck()
