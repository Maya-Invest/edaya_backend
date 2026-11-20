import type { EmailTransportPort } from '../ports/gateways/email-transport'

export const noOpEmailTransport: EmailTransportPort = {
  send: async () => ({}),
}
