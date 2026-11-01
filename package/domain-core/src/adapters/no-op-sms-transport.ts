import type { SmsTransportPort } from '../ports/gateways/sms-transport'

export const noOpSmsTransport: SmsTransportPort = {
  implemented: false,
  send: async () => {
    throw new Error('SMS transport is not implemented')
  },
}
