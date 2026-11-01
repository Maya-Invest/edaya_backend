export interface SmsMessage {
  to: string
  body: string
  attemptId: string
}

export type SmsProviderResult
  = | { status: 'accepted', messageId: string }
    | { status: 'rejected', reason: string, retryable: boolean }
    | { status: 'uncertain' }

export interface SmsProviderPort {
  send: (message: SmsMessage) => Promise<SmsProviderResult>
}

export interface SmsRoute {
  prefix: string
  provider: string
}

export type SmsRoutingResult
  = | (SmsProviderResult & { providerId: string })
    | { status: 'rejected', reason: string, retryable: false, providerId?: undefined }

export interface SmsRouterPort {
  readonly routes: readonly SmsRoute[]
  supports: (destination: string) => boolean
  send: (message: SmsMessage) => Promise<SmsRoutingResult>
}

export interface SmsSendInput {
  to: string
  body: string
  idempotencyKey: string
}

export type SmsTransportResult
  = | { status: 'accepted', providerMessageId: string }
    | { status: 'rejected', reason: string, retryable: boolean }
    | { status: 'uncertain' }

export interface SmsTransportPort {
  readonly implemented: boolean
  send: (input: SmsSendInput) => Promise<SmsTransportResult>
}

/** Opaque, reversible reference; legacy and non-SMS references remain untouched. */
export function smsMessageReference(providerId: string, messageId: string): string {
  return `sms:v1:${JSON.stringify([providerId, messageId])}`
}
