import type { AuthenticationProviderPort, OtpChannel, OtpDeliveryPort } from '@edaya/account'
import { AsyncLocalStorage } from 'node:async_hooks'
import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { authSchema } from '@edaya/adaptor-auth'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { emailOTP, phoneNumber } from 'better-auth/plugins'
/** Provider handlers are deliberately private: only AccountService can complete authentication. */
export function createBetterAuthAdapter(database: unknown, options: {
  secret: string
  baseUrl: string
  generation: string
  delivery: OtpDeliveryPort
}): AuthenticationProviderPort {
  interface Dispatch { channel: OtpChannel, attemptId?: string, delivery?: Promise<void> }
  const context = new AsyncLocalStorage<Dispatch>()
  const preparation = new AsyncLocalStorage<{ code?: string }>()
  const hashOtp = (value: string) => createHmac('sha256', options.secret).update(`edaya:otp:${value}`).digest('hex')
  const auth = betterAuth({
    secret: options.secret,
    baseURL: options.baseUrl,
    database: drizzleAdapter(database as never, { provider: 'pg', schema: authSchema, transaction: true }),
    emailAndPassword: { enabled: false },
    session: { storeSessionInDatabase: true, cookieCache: { enabled: false } },
    plugins: [
      emailOTP({ otpLength: 6, expiresIn: 300, allowedAttempts: 5, storeOTP: { hash: async otp => hashOtp(otp) }, sendVerificationOTP: async ({ email, otp }) => {
        const dispatch = context.getStore()
        if (!dispatch)
          throw new Error('Missing email dispatch context')
        dispatch.delivery = Promise.resolve().then(async () => {
          const result = await options.delivery.send({ channel: 'email', destination: email, code: otp, attemptId: dispatch.attemptId })
          if (result && result.status !== 'accepted')
            throw new Error('Email dispatch rejected')
        })
        // Better Auth catches callback failures. The owning request observes the original promise.
        await dispatch.delivery.catch(() => {})
      } }),
      phoneNumber({ otpLength: 6, expiresIn: 300, allowedAttempts: 5, sendOTP: async ({ phoneNumber: destination, code }, ctx) => {
        if (!ctx)
          throw new Error('Phone verification context required')
        // Replace provider plaintext within the enclosing transaction, before delivery or commit.
        await ctx.context.internalAdapter.updateVerificationByIdentifier(destination, { value: `${hashOtp(`${destination}:${code}`)}:0` })
        const prepared = preparation.getStore()
        if (prepared) {
          prepared.code = code
          return
        }
        const selected = context.getStore()?.channel
        if (selected !== 'sms' && selected !== 'whatsapp')
          throw new Error('Phone delivery channel is required')
        await options.delivery.send({ channel: selected, destination, code })
      }, verifyOTP: async ({ phoneNumber: destination, code }, ctx) => {
        if (!ctx)
          return false
        const verification = await ctx.context.internalAdapter.findVerificationValue(destination)
        if (!verification || verification.expiresAt.getTime() <= Date.now())
          return false
        const [expected, rawAttempts] = verification.value.split(':')
        const attempts = Number(rawAttempts)
        if (!expected || !Number.isInteger(attempts) || attempts >= 5)
          return false
        await ctx.context.internalAdapter.updateVerificationByIdentifier(destination, { value: `${expected}:${attempts + 1}` })
        const supplied = hashOtp(`${destination}:${code}`)
        return expected.length === supplied.length && timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
      }, signUpOnVerification: { getTempEmail: phone => `phone-${phone.slice(1)}@phone.invalid`, getTempName: () => '' } }),
    ],
  })
  return {
    generation: options.generation,
    async preparePhoneOtp(value) {
      const prepared: { code?: string } = {}
      await preparation.run(prepared, () => auth.api.sendPhoneNumberOTP({ body: { phoneNumber: value } }))
      if (!prepared.code)
        throw new Error('Phone OTP preparation failed')
      return prepared.code
    },
    async sendOtp(input) {
      const dispatch: Dispatch = { channel: input.channel, attemptId: input.attemptId }
      await context.run(dispatch, async () => {
        if (input.kind === 'email') {
          try {
            await auth.api.sendVerificationOTP({ body: { email: input.value, type: 'sign-in' } })
            if (!dispatch.delivery)
              throw new Error('Missing email dispatch callback')
            await dispatch.delivery
          }
          catch (error) {
            const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
            // Workers adds request correlation to this event. Do not log the destination, challenge or provider message.
            const providerCode = typeof code === 'number' && Number.isSafeInteger(code) ? code : 'email_dispatch_failed'
            console.error('auth_email_delivery_failed', { providerCode })
            throw new Error('Email delivery unavailable')
          }
        }
        else {
          await auth.api.sendPhoneNumberOTP({ body: { phoneNumber: input.value } })
        }
      })
    },
    async verifyOtp(input) {
      try {
        const result = input.kind === 'email'
          ? await auth.api.signInEmailOTP({ body: { email: input.value, otp: input.code } })
          : await auth.api.verifyPhoneNumber({ body: { phoneNumber: input.value, code: input.code } })
        if (!result.user)
          return null
        const user = result.user
        const valid = input.kind === 'email'
          ? user.emailVerified && user.email === input.value
          : 'phoneNumber' in user && user.phoneNumber === input.value && 'phoneNumberVerified' in user && user.phoneNumberVerified === true
        if (!valid)
          return null
        // These are implementation sessions, never usable Edaya renewal credentials.
        await (await auth.$context).internalAdapter.deleteSession(result.token!)
        return { provider: options.generation, subject: user.id, kind: input.kind, value: input.value }
      }
      catch (error) {
        if (error && typeof error === 'object' && 'statusCode' in error && typeof error.statusCode === 'number' && error.statusCode < 500)
          return null
        throw error
      }
    },
  }
}
