import type { AuthEmailDeliveryPort } from '../ports/gateways/auth-email-delivery'

export const noOpAuthEmailDeliveryPort: AuthEmailDeliveryPort = {
  sendOtp: async () => {},
  sendVerificationEmail: async () => {},
}
