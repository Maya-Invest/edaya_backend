import { expect, test } from 'bun:test'
import { nativeTestExitCode } from '../native/test-result'

test('native runner rejects reported failures even when the child exits zero', () => {
  expect(nativeTestExitCode(0, '<testsuites><testsuite tests="8" failures="1" /></testsuites>')).toBe(1)
})

test('native runner rejects missing, malformed and zero-test reports', () => {
  for (const report of ['', '<testsuite />', '<testsuite tests="0" failures="0" />'])
    expect(nativeTestExitCode(0, report)).toBe(1)
})

test('native runner accepts executed passing tests and preserves process failures', () => {
  const report = '<testsuites><testsuite tests="8" failures="0" errors="0" /></testsuites>'
  expect(nativeTestExitCode(0, report)).toBe(0)
  expect(nativeTestExitCode(2, report)).toBe(2)
})

test('native runner rejects skipped required tests, including an entirely skipped suite', () => {
  for (const skipped of [1, 8]) {
    expect(nativeTestExitCode(0, `<testsuites><testsuite tests="8" failures="0" errors="0" skipped="${skipped}" /></testsuites>`)).toBe(1)
  }
  expect(nativeTestExitCode(0, '<testsuites><testsuite tests="8" failures="0" errors="0" skipped="0" /></testsuites>')).toBe(0)
})
