import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

// Extract the two changed modules from a local Git revision. All other runtime
// dependencies and the fixture remain identical to the current benchmark.
const { values } = parseArgs({ args: Bun.argv.slice(2), options: { ref: { type: 'string' } } })
if (!values.ref)
  throw new Error('Pass --ref with the original local Git revision')
const repositoryRoot = resolve(import.meta.dir, '../../..')
const outputDirectory = await mkdtemp(join(tmpdir(), 'edaya-timetable-baseline-'))
const paths = {
  resolver: 'package/domain-service/src/capabilities/timetable/resolver.ts',
  workflow: 'package/domain-service/src/services/workflows/timetable-generation.ts',
}

function original(path: string): string {
  const result = Bun.spawnSync(['git', 'show', `${values.ref}:${path}`], { cwd: repositoryRoot })
  if (result.exitCode !== 0)
    throw new Error(result.stderr.toString())
  return result.stdout.toString()
}

function rewriteImports(source: string, originalPath: string): string {
  return source.replace(/from '([^']+)'/g, (match, specifier: string) => {
    let target: string
    if (specifier === '../../capabilities/timetable')
      target = join(outputDirectory, 'resolver.ts')
    else if (specifier === '@edaya/core')
      target = join(repositoryRoot, 'package/domain-core/src/index.ts')
    else if (specifier === '@edaya/authorization')
      target = join(repositoryRoot, 'package/domain-authorization/src/index.ts')
    else if (specifier.startsWith('.'))
      target = resolve(repositoryRoot, dirname(originalPath), specifier)
    else
      return match
    return `from '${target}'`
  })
}

let workflow = original(paths.workflow)
// Add timing hooks only; the original reads, transactions and solver stay intact.
workflow = workflow.replace(/= solveTimetable\(/g, '= this.solve(').replace(/= spreadWeeklyTemplate\(/g, '= this.spread(')
workflow = workflow.replace('export class TimetableGenerationServiceWorkflow extends BaseServiceWorkflow {', `export class TimetableGenerationServiceWorkflow extends BaseServiceWorkflow {
  protected solve(input: Parameters<typeof solveTimetable>[0]) { return solveTimetable(input) }
  protected spread(input: Parameters<typeof spreadWeeklyTemplate>[0]) { return spreadWeeklyTemplate(input) }
`)
const typesPath = join(repositoryRoot, 'package/domain-service/src/capabilities/timetable/types')
await Bun.write(join(outputDirectory, 'resolver.ts'), `${rewriteImports(original(paths.resolver), paths.resolver)}\nexport { WEEKLY_TEMPLATE_WEEK_KEY } from '${typesPath}'\nexport type * from '${typesPath}'\n`)
await Bun.write(join(outputDirectory, 'workflow.ts'), rewriteImports(workflow, paths.workflow))
console.log(join(outputDirectory, 'workflow.ts'))
