export interface SmsSendInput {
  to: string
  body: string
  idempotencyKey: string
}

export interface SmsTransportPort {
  readonly implemented: boolean
  send: (input: SmsSendInput) => Promise<{ providerMessageId?: string }>
}
