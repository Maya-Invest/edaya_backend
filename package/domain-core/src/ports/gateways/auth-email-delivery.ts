export type AuthOtpEmailType
  = | 'sign-in'
    | 'email-verification'
    | 'forget-password'
    | 'change-email'

export interface AuthOtpEmailInput {
  email: string
  otp: string
  type: AuthOtpEmailType
}

export interface AuthVerificationEmailInput {
  email: string
  url: string
  displayName?: string
}

/** Delivers Better Auth OTP and verification emails via the notification provider. */
export interface AuthEmailDeliveryPort {
  sendOtp: (input: AuthOtpEmailInput) => Promise<void>
  sendVerificationEmail: (input: AuthVerificationEmailInput) => Promise<void>
}
