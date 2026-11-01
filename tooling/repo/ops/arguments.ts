/** Adapt the public positional target to the private seeding implementation. */
export function seedArguments(args: readonly string[]): string[] {
  const clean = args[0] === 'clean'
  const [target, ...options] = clean ? args.slice(1) : args
  return [...(clean ? ['clean'] : []), ...(target === 'staging' ? ['--staging'] : []), ...options]
}
export function clientArguments(args: readonly string[]): string[] {
  // Skip option values so a header or path literally named --check stays intact.
  const forwarded: string[] = []
  let check = false
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--check') {
      check = true
      continue
    }
    forwarded.push(args[index]!, args[++index]!)
  }
  return [check ? 'check' : 'generate', ...forwarded]
}
