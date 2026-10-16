/** A successful child exit cannot override failed or empty test results. */
export function nativeTestExitCode(childExitCode: number, junit: string): number {
  const suites = junit.match(/<testsuite\b[^>]*>/g) ?? []
  let tests = 0
  for (const suite of suites) {
    const count = (name: string) => {
      const value = suite.match(new RegExp(`\\b${name}=["'](\\d+)["']`))?.[1]
      return value === undefined ? null : Number(value)
    }
    const total = count('tests')
    const failures = count('failures')
    const errors = count('errors') ?? 0
    const skipped = count('skipped') ?? 0
    if (total === null || failures === null || failures > 0 || errors > 0 || skipped > 0)
      return 1
    tests += total
  }
  return childExitCode !== 0 ? childExitCode : tests > 0 ? 0 : 1
}
