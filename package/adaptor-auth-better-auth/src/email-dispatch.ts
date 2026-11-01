import type { OtpDeliveryPort } from '@edaya/account'
import { AsyncLocalStorage } from 'node:async_hooks'

// Better Auth may swallow background callback failures. Retain the original
// delivery promise in the request that initiated this send.
export function createEmailDispatch(delivery: OtpDeliveryPort) {
  const requests = new AsyncLocalStorage<{ attemptId?: string, result?: Promise<void> }>()
  return {
    async send(attemptId: string | undefined, invoke: () => Promise<unknown>) {
      const request: { attemptId?: string, result?: Promise<void> } = { attemptId }
      let failure = 'provider_failure'
      try {
        await requests.run(request, invoke)
        if (!request.result) {
          failure = 'callback_missing'
          throw new Error('Missing email dispatch callback')
        }
        await request.result
      }
      catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
        // Cloudflare attaches request correlation. Provider messages may contain a recipient or code.
        const providerCode = typeof code === 'number' && Number.isSafeInteger(code) ? code : failure
        console.error('auth_email_delivery_failed', { providerCode })
        throw new Error('Email delivery unavailable')
      }
    },
    async callback({ email, otp }: { email: string, otp: string }) {
      const request = requests.getStore()
      if (!request)
        throw new Error('Missing email dispatch context')
      request.result = Promise.resolve().then(async () => {
        const result = await delivery.send({ channel: 'email', destination: email, code: otp, attemptId: request.attemptId })
        if (result && result.status !== 'accepted')
          throw new Error('Email dispatch rejected')
      })
      await request.result.catch(() => {})
    },
  }
}
