export type ParsedVerifyCli
  = | { kind: 'help' }
    | { kind: 'run', full: boolean }

export function parseVerifyCliArgs(argv: readonly string[]): ParsedVerifyCli {
  const args = [...argv]
  if (args.includes('--help') || args.includes('-h')) {
    return { kind: 'help' }
  }

  let full = false
  for (const arg of args) {
    if (arg === '--full') {
      full = true
      continue
    }
    throw new Error(`Unknown verify option: ${arg}. Use --full or --help.`)
  }

  return { kind: 'run', full }
}
