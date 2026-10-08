export type ParsedVerifyCli
  = | { kind: 'help' }
    | { kind: 'run', full: boolean, ci?: boolean }

export function parseVerifyCliArgs(argv: readonly string[]): ParsedVerifyCli {
  const args = [...argv]
  if (args.includes('--help') || args.includes('-h')) {
    return { kind: 'help' }
  }

  if (new Set(args).size !== args.length)
    throw new Error('Duplicate verify options')
  let full = false
  let ci = false
  for (const arg of args) {
    if (arg === '--ci') {
      ci = true
      continue
    }
    if (arg === '--full') {
      full = true
      continue
    }
    throw new Error(`Unknown verify option: ${arg}. Use --ci, --full or --help.`)
  }

  if (ci && full)
    throw new Error('Choose --ci or --full')
  return { kind: 'run', full, ...(ci ? { ci } : {}) }
}
