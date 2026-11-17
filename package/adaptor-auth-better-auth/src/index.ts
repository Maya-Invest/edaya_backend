import type { AuthenticationProviderPort, OtpChannel, OtpDeliveryPort } from '@edaya/account'
import { AsyncLocalStorage } from 'node:async_hooks'
import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { authSchema } from '@edaya/adaptor-auth'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { emailOTP, phoneNumber } from 'better-auth/plugins'
import { createEmailDispatch } from './email-dispatch'
/** Provider handlers are deliberately private: only AccountService can complete authentication. */
export function createBetterAuthAdapter(database: unknown, options: {
  secret: string
  baseUrl: string
  generation: string
  delivery: OtpDeliveryPort
}): AuthenticationProviderPort {
  const emailDispatch = createEmailDispatch(options.delivery)
  const context = new AsyncLocalStorage<OtpChannel>()
  const preparation = new AsyncLocalStorage<{ code?: string }>()
  const hashOtp = (value: string) => createHmac('sha256', options.secret).update(`edaya:otp:${value}`).digest('hex')
  const auth = betterAuth({
    secret: options.secret,
    baseURL: options.baseUrl,
    database: drizzleAdapter(database as never, { provider: 'pg', schema: authSchema, transaction: true }),
    emailAndPassword: { enabled: false },
    session: { storeSessionInDatabase: true, cookieCache: { enabled: false } },
    plugins: [
      emailOTP({ otpLength: 6, expiresIn: 300, allowedAttempts: 5, storeOTP: { hash: async otp => hashOtp(otp) }, sendVerificationOTP: emailDispatch.callback }),
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
        const selected = context.getStore()
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
      if (input.kind === 'email') {
        await emailDispatch.send(input.attemptId, () => auth.api.sendVerificationOTP({ body: { email: input.value, type: 'sign-in' } }))
        return
      }
      await context.run(input.channel, () => auth.api.sendPhoneNumberOTP({ body: { phoneNumber: input.value } }))
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
        // These are implementation sessions, never usable EDaya renewal credentials.
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
