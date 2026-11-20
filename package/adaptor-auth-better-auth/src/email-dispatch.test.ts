import { expect, spyOn, test } from 'bun:test'
import { createEmailDispatch } from './email-dispatch'

test('request-local delivery handles interleaved rejection, acceptance and an omitted callback', async () => {
  const log = spyOn(console, 'error').mockImplementation(() => {})
  const attempts = new Map<string, string | undefined>()
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const dispatch = createEmailDispatch({ async send({ destination, attemptId }) {
    attempts.set(destination, attemptId)
    if (attemptId === 'first') {
      entered.resolve()
      await release.promise
      throw Object.assign(new Error('synthetic recipient, OTP and provider details'), { code: 1234 })
    }
  } })
  const callback = (email: string) => dispatch.callback({ email, otp: '000000' })
  try {
    const first = dispatch.send('first', () => callback('first@example.test'))
    await entered.promise
    await dispatch.send('second', () => callback('second@example.test'))
    await expect(dispatch.send('missing', async () => {})).rejects.toThrow('Email delivery unavailable')
    release.resolve()
    await expect(first).rejects.toThrow('Email delivery unavailable')
    expect([...attempts]).toEqual([['first@example.test', 'first'], ['second@example.test', 'second']])
    expect(log.mock.calls).toEqual([
      ['auth_email_delivery_failed', { providerCode: 'callback_missing' }],
      ['auth_email_delivery_failed', { providerCode: 1234 }],
    ])
  }
  finally {
    release.resolve()
    log.mockRestore()
  }
})
